import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import {
  ATTENTION, COMPACT_COLUMNS, GLYPHS, ago, attention, bar, contextTone, relation, sessionName, short,
  statusGlyph, treeRows, windowName,
} from './panel'
import type { Live } from './panel'

// Chat verticali: one chat = one vertical (a PACA task, a topic, a function).
// Rules agreed with Ale:
// - a vertical runs as a background session (`claude --bg`); in tmux a window
//   is only a `claude attach <id>`, so hiding it (kill-window) keeps it alive;
// - the mother is the hub (tmux window 0): its pane lists the project's
//   verticals by what they need from the person;
// - Claude proposes a handoff, the person confirms (the tool asks);
// - triggers: a different PACA task goes In Progress, context over 60%,
//   a request outside the chat's declared vertical (judged by the model);
// - when done, the vertical reports back to its mother and to PACA, then stops.

type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'

type Vertical = {
  slug: string
  title: string
  scope: string
  sessionId: string
  // Short id of the background session, what `claude attach/stop` take (v1.0).
  agentId?: string
  parentSessionId?: string
  cwd: string
  // Repo the vertical belongs to (git common dir, shared by worktrees); missing on old records.
  project?: string
  model: Model
  briefPath: string
  pacaTaskId?: string
  pacaRef?: string
  status: 'active' | 'done' | 'paused'
  createdAt: string
  // Written by the vertical chat itself, for the hub.
  contextPercent?: number
  contextAt?: string
  lastAt?: string
  // Snapshot at launch, so the cleanup inventory lists only what the vertical left.
  startBranch?: string
  startBranches?: string[]
  startWorktrees?: string[]
  // Files already modified when the vertical started: never its to clean.
  startDirty?: string[]
  startedAt?: number
  // Cleanup gate before `done`: the plan waits for the mother's approval.
  cleanupStatus?: 'pending' | 'approved'
  cleanupPlan?: PlanItem[]
  cleanupNote?: string
  // What this vertical made, seen by its own tool calls: only these are its to clean.
  created?: Created
}

type Created = { branches?: string[]; worktrees?: string[]; stashes?: string[]; sessions?: string[]; files?: string[]; head?: boolean }

type PlanItem = { item: string; action: 'keep' | 'remove'; reason: string }

type DoneInput = {
  summary: string
  status?: 'done' | 'paused'
  cleanup_plan?: PlanItem[]
  cleanup_report?: string
}

type HandoffInput = {
  slug: string
  title: string
  scope: string
  brief: string
  paca_task_id?: string
  paca_ref?: string
  model?: Model
  cwd?: string
}

const TOOL_HANDOFF = 'handoff'
const TOOL_DONE = 'vertical_done'
const CONTEXT_THRESHOLDS = [60, 75, 90]
const MODELS: readonly Model[] = ['haiku', 'sonnet', 'opus', 'fable']

const PANE = 'verticali'
const PANE_TITLE = 'Verticali'
const PANE_COLUMNS = 72
const POLL_MS = 3000

// Bumped to redraw the pane: the registry lives in $.store, written by other sessions.
const tick = atom({ plugin: 'chat-verticali', key: 'tick' } as const, 0)
// What the hub last read of the running sessions and of the tmux windows.
const snap = atom({ plugin: 'chat-verticali', key: 'snap' } as const, { live: [] as Live[], windows: {} as Record<string, string>, at: 0 })

const verticalKey = (sessionId: string) => `v:${sessionId}`
const focusKey = (sessionId: string) => `focus:${sessionId}`
const warnKey = (sessionId: string) => `ctxwarn:${sessionId}`
// Summaries a vertical could not deliver, kept for its mother's next opening.
const inboxKey = (sessionId: string) => `inbox:${sessionId}`
// Set by vertical_done: close this vertical's window when the turn ends.
const closeKey = (sessionId: string) => `close:${sessionId}`
// The hub (mother chat) of a project: its session id.
const hubKey = (project: string) => `hub:${project}`
const CLOSE_DELAY_S = 5
// What tmux and the claude CLI get from us inside a shell line: ids only.
const SAFE = /^[@%\w-]+$/

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'vertical'

const today = async ($: EngineInterface) => new Date(await $.clock.now()).toISOString().slice(0, 10)
const bump = ($: EngineInterface) => update($, tick, n => (n ?? 0) + 1)

async function thisVertical($: EngineInterface): Promise<Vertical | undefined> {
  const id = await $.session.id()
  return (await $.store.get(verticalKey(id))) as Vertical | undefined
}

async function allVerticals($: EngineInterface): Promise<Vertical[]> {
  const keys = (await $.store.keys()).filter(k => k.startsWith('v:'))
  const list: Vertical[] = []
  for (const k of keys) {
    const v = (await $.store.get(k)) as Vertical | undefined
    if (v) list.push(v)
  }
  return list
}

// The project of a folder: its git common dir without the trailing `.git`, so a
// repo and its worktrees match; the folder itself outside git.
const projects = new Map<string, Promise<string>>()
function projectOf($: EngineInterface, cwd: string): Promise<string> {
  let found = projects.get(cwd)
  if (!found) {
    found = $.process
      .run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, timeoutMs: 5_000 })
      .then(ran => (ran?.exitCode === 0 ? ran.stdout.trim().replace(/\/\.git\/?$/, '') : cwd))
      .catch(() => cwd)
    projects.set(cwd, found)
  }
  return found
}

// The verticals of this session's project, plus any tied to this session itself
// (its own record, its children, its mother) wherever they live.
async function projectVerticals($: EngineInterface): Promise<Vertical[]> {
  const id = await $.session.id()
  const here = await projectOf($, await $.session.cwd())
  const list = await allVerticals($)
  const mother = list.find(v => v.sessionId === id)?.parentSessionId
  const kept: Vertical[] = []
  for (const v of list) {
    const tied = v.sessionId === id || v.parentSessionId === id || v.sessionId === mother
    if (tied || (v.project ?? (await projectOf($, v.cwd))) === here) kept.push(v)
  }
  return kept
}

// --- Running sessions and tmux windows ---

async function listAgents($: EngineInterface): Promise<Live[]> {
  const ran = await $.process.run(['claude', 'agents', '--json'], { timeoutMs: 15_000 }).catch(() => undefined)
  if (!ran || ran.exitCode !== 0) return []
  try {
    const parsed = JSON.parse(ran.stdout) as Live[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Windows the mod tagged with `@cv_id <sessionId>`, in every tmux session.
async function taggedWindows($: EngineInterface): Promise<Record<string, string>> {
  const ran = await $.process.run(['tmux', 'list-windows', '-a', '-F', '#{window_id}\t#{@cv_id}']).catch(() => undefined)
  const found: Record<string, string> = {}
  if (!ran || ran.exitCode !== 0) return found
  for (const line of ran.stdout.split('\n')) {
    const [win, id] = line.split('\t')
    if (win && id) found[id] = win
  }
  return found
}

// Reads both and stores them for the pane; `changed` when anything moved.
async function readLive($: EngineInterface) {
  const [live, windows] = await Promise.all([listAgents($), taggedWindows($)])
  return { live, windows, at: Date.now() }
}

async function refresh($: EngineInterface) {
  const { live, windows } = await readLive($)
  const before = await read($, snap)
  const changed = JSON.stringify(before?.live) !== JSON.stringify(live) || JSON.stringify(before?.windows) !== JSON.stringify(windows)
  const state = { live, windows, at: Date.now() }
  await update($, snap, () => state)
  return { state, changed }
}

// --- Brief, launch, windows ---

async function handoffDir($: EngineInterface): Promise<string> {
  const home = (await $.env.get('HOME')) ?? '/tmp'
  return `${home}/.claude/handoffs`
}

function briefText(v: Vertical, brief: string, parentTitle: string): string {
  return [
    `# Chat verticale: ${v.title}`,
    '',
    `- slug: \`${v.slug}\` · sessione: \`${v.sessionId || 'in avvio'}\`${v.agentId ? ` (id \`${v.agentId}\`)` : ''} · modello: ${v.model}`,
    `- creata: ${v.createdAt} · da: ${parentTitle}`,
    v.pacaRef || v.pacaTaskId
      ? `- task PACA: ${v.pacaRef ?? ''} ${v.pacaTaskId ? `(\`${v.pacaTaskId}\`)` : ''}`.trim()
      : '- task PACA: nessuno',
    `- cwd: \`${v.cwd}\``,
    '',
    '## Scope (confini della chat)',
    '',
    v.scope,
    '',
    '## Brief',
    '',
    brief.trim(),
    '',
  ].join('\n')
}

function launchPrompt(v: Vertical): string {
  return (
    `Sei la chat verticale «${v.title}» (slug ${v.slug}). ` +
    `Leggi il brief in ${v.briefPath}, poi conferma in 3 righe obiettivo, stato e prossimo passo, ` +
    `e chiedimi se procedere. Resta nello scope dichiarato nel brief.`
  )
}

const inTmux = async ($: EngineInterface) => Boolean(await $.env.get('TMUX'))

// Starts the vertical as a background session; resolves its short id and uuid.
// `--bg` picks the session id itself, so it is read back from `claude agents`.
async function launch($: EngineInterface, v: Vertical): Promise<{ agentId: string; sessionId: string }> {
  const ran = await $.process.run(
    ['claude', '--bg', '-n', sessionName(v.title, v.pacaRef), '--model', v.model, launchPrompt(v)],
    { cwd: v.cwd, timeoutMs: 60_000 },
  )
  const agentId = /backgrounded\s+·\s+([\w-]+)/.exec(ran.stdout)?.[1]
  if (ran.exitCode !== 0 || !agentId) throw new Error(`avvio fallito: ${(ran.stderr || ran.stdout).trim().slice(0, 300)}`)
  for (let i = 0; i < 5; i++) {
    const found = (await listAgents($)).find(a => a.id === agentId)
    if (found) return { agentId, sessionId: found.sessionId }
    await $.clock.sleep(1000)
  }
  throw new Error(`sessione ${agentId} avviata ma non trovata in \`claude agents\``)
}

// Opens a tmux window attached to the vertical (by id, never by name: attach
// also takes part of a name) and tags it with `@cv_id` to find it again.
async function openWindow($: EngineInterface, v: Vertical): Promise<boolean> {
  if (!v.agentId || !(await inTmux($))) return false
  const ran = await $.process.run([
    'tmux', 'new-window', '-P', '-F', '#{window_id}', '-n', windowName(v.title, v.pacaRef), '-c', v.cwd,
    'claude', 'attach', v.agentId,
  ])
  const win = ran.stdout.trim()
  if (ran.exitCode !== 0 || !win) {
    $.ui.log(`tmux new-window failed: ${ran.stderr.slice(0, 200)}`, { to: 'debug' })
    return false
  }
  await $.process.run(['tmux', 'set-option', '-w', '-t', win, '@cv_id', v.sessionId])
  return true
}

const attachCommand = (v: Vertical) => (v.agentId ? `claude attach ${v.agentId}` : `claude --resume ${v.sessionId}`)

async function startHandoff($: EngineInterface, input: HandoffInput): Promise<string> {
  const slug = slugify(input.slug || input.title)
  const parentId = await $.session.id()
  const parent = (await $.store.get(verticalKey(parentId))) as Vertical | undefined
  const existing = (await projectVerticals($)).find(v => v.slug === slug && v.status !== 'done')

  if (existing) {
    const choice = await $.ui.ask(
      `Esiste già la chat verticale «${existing.title}». Cosa faccio?`,
      { header: 'Verticale', options: ['Riusa quella esistente', 'Annulla'] },
    )
    if (choice !== 'Riusa quella esistente') return 'Handoff annullato dall\'utente.'
    const sent = await $.session.send({
      to: { sessionId: existing.sessionId },
      text: `Aggiornamento dalla chat madre:\n\n${input.brief}`,
    })
    if (sent.isDelivered) return `Brief inviato alla chat verticale esistente «${existing.slug}» (in esecuzione).`
    await $.fs.write(existing.briefPath,
      `${await $.fs.read(existing.briefPath)}\n## Aggiornamento ${await today($)}\n\n${input.brief.trim()}\n`)
    const opened = await openWindow($, existing)
    return (
      `Chat verticale «${existing.slug}» non raggiungibile: aggiornamento aggiunto al brief ${existing.briefPath}. ` +
      (opened ? 'Riaperta in una finestra tmux.' : `Riaprila con \`${attachCommand(existing)}\`.`)
    )
  }

  const model: Model = input.model && MODELS.includes(input.model) ? input.model : 'sonnet'
  const confirm = await $.ui.ask(
    `Apro una nuova chat verticale «${input.title}» (${model})?`,
    { header: 'Handoff', options: ['Sì, apri', 'No'] },
  )
  if (confirm !== 'Sì, apri') return 'Handoff annullato dall\'utente: resta in questa chat.'

  const v: Vertical = {
    slug,
    title: input.title,
    scope: input.scope,
    sessionId: '',
    parentSessionId: parentId,
    cwd: input.cwd || (await $.session.cwd()),
    model,
    briefPath: `${await handoffDir($)}/${slug}.md`,
    pacaTaskId: input.paca_task_id,
    pacaRef: input.paca_ref,
    status: 'active',
    createdAt: await today($),
  }
  v.project = await projectOf($, v.cwd)
  Object.assign(v, await baseline($, v))
  const from = parent ? `verticale ${parent.slug}` : `sessione ${parentId}`
  // The brief exists before the launch: the new chat reads it on its first turn.
  await $.fs.write(v.briefPath, briefText(v, input.brief, from))
  Object.assign(v, await launch($, v))
  await $.fs.write(v.briefPath, briefText(v, input.brief, from))
  await $.store.set(verticalKey(v.sessionId), v)
  if (!parent) await claimHub($)
  await bump($)
  void openPane($).catch(() => undefined)
  const opened = await openWindow($, v)
  const where = opened
    ? `avviata in background e aperta nella finestra tmux «${windowName(v.title, v.pacaRef)}»`
    : `avviata in background (\`claude attach ${v.agentId}\` per aprirla)`
  return (
    `Chat verticale «${v.slug}» ${where}. Brief: ${v.briefPath}. ` +
    (v.pacaTaskId
      ? `Aggiungi ora un commento al task PACA ${v.pacaRef ?? v.pacaTaskId} che dice che il lavoro prosegue nella chat verticale «${v.slug}».`
      : '')
  )
}

// This chat becomes its project's hub (mother): `hub:<project>` points at it,
// it is renamed `hub-<repo>` and its tmux window `hub`. Another live hub keeps
// the role; this chat then stays a mother of its own children only.
async function claimHub($: EngineInterface) {
  if (await thisVertical($)) return
  const id = await $.session.id()
  const project = await projectOf($, await $.session.cwd())
  const current = (await $.store.get(hubKey(project))) as string | undefined
  const agents = await listAgents($)
  if (current && current !== id && agents.some(a => a.sessionId === current)) return
  await $.store.set(hubKey(project), id)
  const name = `hub-${project.split('/').filter(Boolean).pop() ?? 'progetto'}`
  if (!agents.find(a => a.sessionId === id)?.name?.startsWith('hub-')) {
    // A command cannot run inside a hook the turn waits on: queue it.
    $.clock.after(1000, () => void $.command.run({ command: 'rename', args: name }).catch(() => undefined))
  }
  const pane = await $.env.get('TMUX_PANE')
  if (pane) await $.process.run(['tmux', 'rename-window', '-t', pane, 'hub']).catch(() => undefined)
}

// Old mothers that are gone (not running, not a vertical themselves) hand their
// open children and their inbox to the project's hub.
async function adoptOrphans($: EngineInterface, live: Live[]) {
  const id = await $.session.id()
  const project = await projectOf($, await $.session.cwd())
  if ((await $.store.get(hubKey(project))) !== id) return
  const alive = new Set(live.map(a => a.sessionId))
  const all = await allVerticals($)
  const verticals = new Set(all.map(v => v.sessionId))
  const gone = new Set<string>()
  for (const v of await projectVerticals($)) {
    const p = v.parentSessionId
    if (v.status === 'done' || !p || p === id || alive.has(p) || verticals.has(p)) continue
    await $.store.set(verticalKey(v.sessionId), { ...v, parentSessionId: id })
    gone.add(p)
  }
  for (const p of gone) await moveInbox($, p, id)
  if (gone.size) await bump($)
}

// --- Cleanup gate ---

const runOut = async ($: EngineInterface, argv: string[], cwd: string) => {
  const ran = await $.process.run(argv, { cwd, timeoutMs: 15_000 }).catch(() => undefined)
  return ran?.exitCode === 0 ? ran.stdout : ''
}
const lines = (text: string) => text.split('\n').map(l => l.trimEnd()).filter(Boolean)
const branchesOf = async ($: EngineInterface, repo: string) =>
  lines(await runOut($, ['git', 'for-each-ref', '--format=%(refname:short)', 'refs/heads'], repo))
const worktreesOf = async ($: EngineInterface, repo: string) =>
  lines(await runOut($, ['git', 'worktree', 'list', '--porcelain'], repo))
    .filter(l => l.startsWith('worktree '))
    .map(l => l.slice(9))
    .filter(path => path !== repo)

// Modified and untracked paths under a folder's work tree, absolute; an
// untracked folder ends in `/`. `-z`: no quoting, a rename's old path skipped.
async function dirtyOf($: EngineInterface, dir: string): Promise<string[]> {
  const top = (await runOut($, ['git', 'rev-parse', '--show-toplevel'], dir)).trim()
  if (!top) return []
  const parts = (await runOut($, ['git', 'status', '--porcelain', '-z'], top)).split('\0')
  const found: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    found.push(`${top}/${entry.slice(3)}`)
    if (entry[0] === 'R' || entry[0] === 'C') i++
  }
  return found
}

// A path is within a list when it is in it or under one of its folders.
const within = (list: readonly string[] | undefined, path: string) =>
  Boolean(list?.some(p => p === path || (p.endsWith('/') && path.startsWith(p))))
// A folder path holds something of the list.
const holds = (list: readonly string[] | undefined, path: string) =>
  path.endsWith('/') && Boolean(list?.some(p => p !== path && p.startsWith(path)))
// Either way: for what was dirty at the start, the careful reading.
const overlaps = (list: readonly string[] | undefined, path: string) => within(list, path) || holds(list, path)

// The repo as a Bash call may change it: branches, worktrees, stashes, the
// main checkout's branch, the files left modified. All at once.
async function repoState($: EngineInterface, v: Vertical) {
  const repo = v.project ?? (await projectOf($, v.cwd))
  const [dirtyCwd, dirtyRepo, head, branches, worktrees, stashes] = await Promise.all([
    dirtyOf($, v.cwd),
    v.cwd === repo ? Promise.resolve([]) : dirtyOf($, repo),
    runOut($, ['git', 'branch', '--show-current'], repo),
    branchesOf($, repo),
    worktreesOf($, repo),
    runOut($, ['git', 'stash', 'list', '--format=%H %ct %s'], repo),
  ])
  return { repo, dirty: [...new Set([...dirtyCwd, ...dirtyRepo])], head: head.trim(), branches, worktrees, stashes: lines(stashes) }
}
type RepoState = Awaited<ReturnType<typeof repoState>>

// What the repo looks like when the vertical starts.
async function baseline($: EngineInterface, v: Vertical) {
  const now = await repoState($, v)
  return {
    startBranch: now.head || undefined,
    startBranches: now.branches,
    startWorktrees: now.worktrees,
    startDirty: now.dirty,
    startedAt: Date.now(),
  }
}

// A record from before the gate has no baseline: take it now, so what was
// already there is never counted as this vertical's.
async function withBaseline($: EngineInterface, v: Vertical): Promise<Vertical> {
  if (v.startedAt) return v
  const based = { ...v, ...(await baseline($, v)) }
  await $.store.set(verticalKey(v.sessionId), based)
  return based
}

// Records new items on the vertical. Something new after an approved plan
// voids it: the plan no longer covers what is there.
async function addCreated($: EngineInterface, v: Vertical, patch: Partial<Record<'branches' | 'worktrees' | 'stashes' | 'sessions' | 'files', string[]>>, head?: boolean) {
  const fresh = (await thisVertical($)) ?? v
  const c: Created = { ...fresh.created }
  let added = false
  for (const [key, items] of Object.entries(patch) as [keyof typeof patch, string[]][]) {
    const before = c[key] ?? []
    const next = [...new Set([...before, ...items])]
    if (next.length !== before.length) {
      c[key] = next
      added = true
    }
  }
  if (head !== undefined) c.head = head
  if (!added && head === undefined) return
  const reset = added && fresh.cleanupStatus ? { cleanupStatus: undefined, cleanupPlan: undefined } : {}
  await $.store.set(verticalKey(v.sessionId), { ...fresh, created: c, ...reset })
}

// Adds to the record what appeared between two states, plus sessions the call started.
async function noteCreated($: EngineInterface, v: Vertical, before: RepoState, after: RepoState, output: string) {
  const fresh_ = (a: string[], b: string[]) => a.filter(x => !b.includes(x))
  const hash = (l: string) => l.split(' ')[0]
  await addCreated($, v, {
    branches: fresh_(after.branches, before.branches),
    worktrees: fresh_(after.worktrees, before.worktrees),
    stashes: fresh_(after.stashes.map(hash), before.stashes.map(hash)),
    files: fresh_(after.dirty, before.dirty).filter(f => !overlaps(v.startDirty, f)),
    sessions: [...output.matchAll(/backgrounded\s+·\s+([\w-]+)/g)].map(m => m[1]),
  }, after.head !== before.head ? after.head !== (v.startBranch ?? after.head) : undefined)
}

// What lies around at `done`, one stable line per item. `mine`: made by this
// vertical (its record says so), to keep or remove in the plan. `others`: not
// attributable, reported as "non mio, non toccato" and never cleaned.
async function inventory($: EngineInterface, vertical: Vertical): Promise<{ mine: string[]; others: string[] }> {
  const v = await withBaseline($, vertical)
  const now = await repoState($, v)
  const c = v.created ?? {}
  const mine: string[] = []
  const others: string[] = []
  const put = (isMine: boolean | undefined, item: string) => (isMine ? mine : others).push(item)
  for (const f of now.dirty) {
    if (overlaps(v.startDirty, f)) others.push(`git-modifica:${f} (già modificato all'avvio)`)
    else if (within(c.files, f)) mine.push(`git-modifica:${f}`)
    // A folder wider than what this vertical made: not its to remove whole.
    else if (holds(c.files, f)) others.push(`git-modifica:${f} (contiene file creati da me: rimuovi solo quelli)`)
    else others.push(`git-modifica:${f}`)
  }
  if (v.startBranch && now.head && now.head !== v.startBranch) put(c.head, `git-repo-principale-su:${now.head} (partenza ${v.startBranch})`)
  const knownWt = new Set(v.startWorktrees ?? [])
  for (const wt of now.worktrees) if (!knownWt.has(wt)) put(c.worktrees?.includes(wt), `git-worktree:${wt}`)
  const knownBr = new Set(v.startBranches ?? [])
  for (const b of now.branches) if (!knownBr.has(b)) put(c.branches?.includes(b), `git-ramo:${b}`)
  const since = v.startedAt ?? Date.parse(v.createdAt)
  for (const l of now.stashes) {
    const [hash, at, ...msg] = l.split(' ')
    const isMine = c.stashes?.includes(hash)
    if (isMine || Number(at) * 1000 >= since) put(isMine, `git-stash:${hash.slice(0, 12)} ${msg.join(' ')}`)
  }
  const all = await allVerticals($)
  const registered = new Set(all.map(r => r.sessionId))
  for (const a of await listAgents($)) {
    if (a.sessionId === v.sessionId || registered.has(a.sessionId) || !a.cwd) continue
    const isMine = Boolean(a.id && c.sessions?.includes(a.id))
    if (isMine || ((a.startedAt ?? 0) > since && (await projectOf($, a.cwd)) === now.repo)) {
      put(isMine, `sessione:${a.id ?? a.sessionId} ${a.name ?? ''}`.trim())
    }
  }
  const windows = await taggedWindows($)
  for (const ch of all.filter(ch => ch.parentSessionId === v.sessionId && ch.status !== 'done')) {
    mine.push(`figlia:${ch.slug}`)
    if (windows[ch.sessionId]) mine.push(`finestra-tmux:${windows[ch.sessionId]} (${ch.slug})`)
  }
  return { mine, others }
}

const bullet = (items: string[]) => items.map(i => `- ${i}`).join('\n') || '- (niente)'
const planText = (plan: PlanItem[]) =>
  plan.map(p => `- ${p.action === 'keep' ? 'TIENI' : 'RIMUOVI'} ${p.item}: ${p.reason}`).join('\n')

// `done` passes only through the gate: inventory, plan, the mother's approval,
// cleanup, a clean second inventory. Returns why it stops, or undefined to close.
async function cleanupGate($: EngineInterface, vertical: Vertical, input: DoneInput): Promise<string | undefined> {
  let v = vertical
  const { mine: items, others } = await inventory($, v)
  v = (await thisVertical($)) ?? v
  const save = (patch: Partial<Vertical>) => $.store.set(verticalKey(v.sessionId), { ...v, ...patch })

  if (v.cleanupStatus === 'approved' && !input.cleanup_plan) {
    const keep = new Set((v.cleanupPlan ?? []).filter(p => p.action === 'keep').map(p => p.item))
    const left = items.filter(i => !keep.has(i))
    if (left.length === 0) return undefined
    return (
      'Chiusura rifiutata: dopo la pulizia restano voci che il piano approvato non tiene:\n' + bullet(left) +
      '\nRimuovile e richiama vertical_done (status done, cleanup_report), oppure manda un nuovo cleanup_plan da approvare.'
    )
  }
  if (v.cleanupStatus === 'pending' && !input.cleanup_plan) {
    return 'Piano di pulizia in attesa di approvazione dalla chat madre: aspetta la risposta, non chiudere e non pulire ancora.'
  }
  if (!input.cleanup_plan) {
    return [
      'Prima di chiudere serve la pulizia (gate obbligatorio). La verticale NON è chiusa.',
      '',
      'Inventario raccolto dalla mod, voci create da questa verticale:',
      bullet(items),
      '',
      'Non attribuibili a questa verticale (non mio, non toccato: NON vanno nel piano e non si toccano):',
      bullet(others),
      '',
      'Checklist:',
      '- ogni voce tua: tenere o rimuovere, con il motivo (riporta il testo della voce identico)',
      '- file temporanei (scratchpad, /tmp, prove) e processi che hai avviato tu: aggiungili come voci tue',
      '- la pulizia non si traccia su PACA',
      '',
      'Richiama vertical_done con status done, lo stesso summary e `cleanup_plan`: [{item, action: "keep"|"remove", reason}]. ' +
      'La madre lo approva; poi esegui la pulizia e richiama vertical_done (status done) con `cleanup_report`.',
    ].join('\n')
  }
  const named = new Set(input.cleanup_plan.map(p => p.item))
  const missing = items.filter(i => !named.has(i))
  if (missing.length) return `Il piano non copre tutte le voci dell'inventario. Mancano:\n${bullet(missing)}\nRimanda cleanup_plan completo.`
  const notMine = input.cleanup_plan.filter(p => p.action === 'remove' && others.includes(p.item)).map(p => p.item)
  if (notMine.length) return `Il piano rimuove voci non attribuibili a questa verticale (non tue, non si toccano):\n${bullet(notMine)}\nToglile dal piano e rimandalo.`
  await save({ cleanupStatus: 'pending', cleanupPlan: input.cleanup_plan, cleanupNote: undefined })
  // Asked here only when no one else approves: one question, never two.
  const by = await approval($, v)
  if (!by.id || by.id === v.sessionId) {
    const answer = await askCleanup($, { ...v, cleanupStatus: 'pending', cleanupPlan: input.cleanup_plan })
    if (!answer) return 'Domanda chiusa senza risposta: il piano resta in attesa. Richiama vertical_done con cleanup_plan per riproporla.'
    return answer === 'Approva'
      ? 'Piano approvato: esegui la pulizia, poi richiama vertical_done (status done) con cleanup_report.'
      : `Piano non approvato${answer === 'Rifiuta' ? '' : `: ${answer}`}. Correggilo e rimanda cleanup_plan.`
  }
  await bump($)
  return `Piano di pulizia inviato ${by.isHub ? 'all\'hub' : 'alla chat madre'} per l'approvazione. Aspetta la risposta (arriva come messaggio): non chiudere e non pulire ancora.`
}

// Plans with a question open now, and plans the poll already put once.
const asking = new Set<string>()
const asked = new Set<string>()

// Who approves a vertical's plan: the project's hub while it runs (it adopts
// every mother's children), else the vertical's mother, vertical or not.
async function approverOf($: EngineInterface, v: Vertical): Promise<string | undefined> {
  return (await approval($, v)).id
}
async function approval($: EngineInterface, v: Vertical): Promise<{ id?: string; isHub: boolean }> {
  const hub = (await $.store.get(hubKey(v.project ?? (await projectOf($, v.cwd))))) as string | undefined
  if (hub && hub !== v.sessionId && (await listAgents($)).some(a => a.sessionId === hub)) return { id: hub, isHub: true }
  return { id: v.parentSessionId, isHub: false }
}

// Asks the person to approve a vertical's cleanup plan; writes the answer on
// its record. Anything typed under "Other" is a change the vertical must make.
// Undefined when a question for it is already open, or it is closed unanswered.
async function askCleanup($: EngineInterface, v: Vertical): Promise<string | undefined> {
  if (asking.has(v.sessionId)) return undefined
  asking.add(v.sessionId)
  try {
    const plan = v.cleanupPlan ?? []
    const answer = await $.ui.ask(
      `La verticale «${v.title}» vuole chiudersi. Piano di pulizia:\n${planText(plan)}\nApprovi? (in "Other" scrivi le modifiche da chiedere)`,
      { header: 'Pulizia', options: ['Approva', 'Rifiuta'] },
    ).catch(() => undefined)
    if (!answer?.trim()) return undefined
    const fresh = ((await $.store.get(verticalKey(v.sessionId))) as Vertical | undefined) ?? v
    // The plan changed or was answered meanwhile: this answer is for an old one.
    if (fresh.cleanupStatus !== 'pending' || JSON.stringify(fresh.cleanupPlan) !== JSON.stringify(plan)) return undefined
    const approved = answer === 'Approva'
    await $.store.set(verticalKey(v.sessionId), {
      ...fresh,
      cleanupStatus: approved ? 'approved' : undefined,
      cleanupPlan: approved ? plan : undefined,
      cleanupNote: approved ? undefined : answer,
    })
    await bump($)
    return answer
  } finally {
    asking.delete(v.sessionId)
  }
}

// The approver answers a pending plan and tells the vertical.
async function answerCleanup($: EngineInterface, v: Vertical) {
  const answer = await askCleanup($, v)
  if (!answer) return
  const text = answer === 'Approva'
    ? '[chat-verticali] Piano di pulizia approvato dall\'utente: eseguilo ora, poi chiama vertical_done (status done) con cleanup_report.'
    : `[chat-verticali] Piano di pulizia ${answer === 'Rifiuta' ? 'rifiutato' : `da modificare: ${answer}`}. Correggilo e richiama vertical_done con un nuovo cleanup_plan.`
  await $.session.send({ to: { sessionId: v.sessionId }, text })
}

async function finishVertical(
  $: EngineInterface,
  input: DoneInput,
): Promise<string> {
  const v = await thisVertical($)
  if (!v) return 'Questa chat non è una chat verticale: niente da chiudere.'
  const status = input.status ?? 'done'
  let summary = input.summary.trim()
  if (status === 'done') {
    const stop = await cleanupGate($, v, input)
    if (stop) return stop
    if (input.cleanup_report) summary += `\n\nPulizia:\n${input.cleanup_report.trim()}`
  } else {
    const { mine, others } = await inventory($, v)
    summary += `\n\nLasciato in giro da questa verticale:\n${bullet(mine)}\n\nNon mio, non toccato:\n${bullet(others)}`
  }
  await $.fs.write(v.briefPath,
    `${await $.fs.read(v.briefPath)}\n## Esito (${status}, ${await today($)})\n\n${summary}\n`)
  const reset = status === 'paused' ? { cleanupStatus: undefined, cleanupPlan: undefined, cleanupNote: undefined } : {}
  await $.store.set(verticalKey(v.sessionId), { ...((await thisVertical($)) ?? v), status, ...reset })

  let parentNote = 'nessuna chat madre registrata'
  if (v.parentSessionId) {
    const text = `[chat verticale «${v.slug}» — ${status}]\n\n${summary}\n\nBrief completo: ${v.briefPath}`
    const sent = await $.session.send({ to: { sessionId: v.parentSessionId }, text })
    if (sent.isDelivered) parentNote = 'riepilogo inviato alla chat madre'
    else {
      await enqueue($, inboxKey(v.parentSessionId), text)
      parentNote = `chat madre non raggiunta (${sent.reason}): il riepilogo le arriverà quando si riapre`
    }
  }
  const paca = v.pacaTaskId
    ? ` Ora aggiungi il riepilogo come commento al task PACA ${v.pacaRef ?? v.pacaTaskId} (\`${v.pacaTaskId}\`) e aggiorna lo stato secondo la skill paca-workflow del repo.`
    : ''
  await $.store.set(closeKey(v.sessionId), status)
  const close = status === 'done'
    ? ' A fine turno la finestra tmux di questa chat si chiude e la sessione si ferma: completa ora, in questo turno, ciò che resta (PACA compreso) e non fare domande all\'utente.'
    : v.agentId ? ' A fine turno la finestra tmux si chiude; la sessione resta viva e si riapre dall\'hub.' : ''
  return `Verticale «${v.slug}» segnata ${status}; ${parentNote}.${paca}${close}`
}

// Queues a summary in a session's inbox (store, read by that session later).
async function enqueue($: EngineInterface, key: string, text: string) {
  const queued = ((await $.store.get(key)) as string[] | undefined) ?? []
  await $.store.set(key, [...queued, text])
}

async function moveInbox($: EngineInterface, from: string, to: string) {
  const queued = (await $.store.get(inboxKey(from))) as string[] | undefined
  if (!queued) return
  await $.store.delete(inboxKey(from))
  for (const text of queued) await enqueue($, inboxKey(to), text)
}

// Delivers the summaries queued for this session while it was closed.
async function deliverInbox($: EngineInterface) {
  const key = inboxKey(await $.session.id())
  const queued = (await $.store.get(key)) as string[] | undefined
  if (!queued?.length) return
  await $.store.delete(key)
  for (const text of queued) {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
  }
  $.ui.toast(`Arrivati ${queued.length} esiti di chat verticali`)
}

// After a /clear the session goes on under a new id: move the links (children's
// mother, this session's own record, its inbox, the hub role) to the new one.
async function relink($: EngineInterface, oldId: string) {
  const newId = await $.session.id()
  if (newId === oldId) return false
  for (const v of await allVerticals($)) {
    if (v.parentSessionId === oldId) await $.store.set(verticalKey(v.sessionId), { ...v, parentSessionId: newId })
  }
  const own = (await $.store.get(verticalKey(oldId))) as Vertical | undefined
  if (own) {
    await $.store.delete(verticalKey(oldId))
    await $.store.set(verticalKey(newId), { ...own, sessionId: newId })
  }
  await moveInbox($, oldId, newId)
  const project = await projectOf($, await $.session.cwd())
  if ((await $.store.get(hubKey(project))) === oldId) await $.store.set(hubKey(project), newId)
  return true
}

// v1.0 vertical, at the end of the turn that called vertical_done: close its
// window(s) and, when done, stop the session. A detached shell runs it a few
// seconds on, so the last answer can be read and the stop outlives this process.
async function closeBackground($: EngineInterface, v: Vertical, stop: boolean) {
  const win = (await taggedWindows($))[v.sessionId]
  const steps = [`sleep ${CLOSE_DELAY_S}`]
  if (win && SAFE.test(win)) steps.push(`tmux kill-window -t '${win}'`)
  if (stop && v.agentId && SAFE.test(v.agentId)) steps.push(`claude stop '${v.agentId}'`)
  if (steps.length === 1) return false
  const ran = await $.process.run(['setsid', '-f', 'sh', '-c', `exec >/dev/null 2>&1; ${steps.join('; ')}`])
  return ran.exitCode === 0
}

// v0.3 vertical: closes its own tmux pane, a few seconds on so the last answer
// can be read; only a pane the mod opened for it (its start command names the session).
async function closePane($: EngineInterface, v: Vertical) {
  const pane = await $.env.get('TMUX_PANE')
  if (!pane) return false
  const ran = await $.process.run(['tmux', 'display-message', '-p', '-t', pane, '#{pane_start_command}'])
  if (ran.exitCode !== 0 || !ran.stdout.includes(v.sessionId)) return false
  // The tmux server runs the kill: it outlives this process. Same socket as ours.
  const socket = ((await $.env.get('TMUX')) ?? '').split(',')[0]
  const tmux = socket ? `tmux -S '${socket}'` : 'tmux'
  const killed = await $.process.run(['tmux', 'run-shell', '-b', `sleep ${CLOSE_DELAY_S}; ${tmux} kill-pane -t '${pane}'`])
  return killed.exitCode === 0
}

// --- Hub actions ---

// Vai/Apri: select the vertical's window, or open one attached to it. A v0.3
// vertical has no tagged window: its window is found by slug, as before.
async function goTo($: EngineInterface, v: Vertical) {
  const command = attachCommand(v)
  const offer = async (why: string) => {
    await $.ui.copy({ text: command })
    $.ui.toast(`${why}: copiato "${command}"`)
  }
  if (!(await inTmux($))) return offer('Fuori da tmux')
  if (!v.agentId) {
    const ran = await $.process.run(['tmux', 'select-window', '-t', v.slug])
    if (ran.exitCode !== 0) await offer(`Finestra «${v.slug}» non trovata`)
    return
  }
  const win = (await taggedWindows($))[v.sessionId]
  if (win && (await $.process.run(['tmux', 'select-window', '-t', win])).exitCode === 0) return
  if (v.status === 'paused') await $.store.set(verticalKey(v.sessionId), { ...v, status: 'active' })
  if (!(await openWindow($, v))) return offer('Finestra non aperta')
  await refresh($)
}

// Nascondi: close the window, the session stays alive. No confirmation.
async function hide($: EngineInterface, v: Vertical) {
  if (!v.agentId) return $.ui.toast(`«${v.slug}» è una verticale v0.3: non si può nascondere`)
  const win = (await taggedWindows($))[v.sessionId]
  if (!win) return $.ui.toast(`«${v.slug}» è già nascosta`)
  await $.process.run(['tmux', 'kill-window', '-t', win])
  await refresh($)
}

// Stop: stop the session (its conversation is kept), with its window.
async function stopVertical($: EngineInterface, v: Vertical) {
  if (!v.agentId) return $.ui.toast(`«${v.slug}» è una verticale v0.3: chiudila dalla sua finestra`)
  const ok = await $.ui.ask(`Fermo la sessione di «${v.title}»? La cronologia resta.`, { header: 'Stop', options: ['Sì, ferma', 'No'] })
  if (ok !== 'Sì, ferma') return
  const win = (await taggedWindows($))[v.sessionId]
  if (win) await $.process.run(['tmux', 'kill-window', '-t', win])
  const ran = await $.process.run(['claude', 'stop', v.agentId])
  $.ui.toast(ran.exitCode === 0 ? `Fermata «${v.slug}»` : `Stop non riuscito: ${(ran.stderr || ran.stdout).trim().slice(0, 120)}`)
  await refresh($)
}

// Chiudi: ask the vertical to call vertical_done (it then stops itself); one
// that cannot be reached is marked done here and stopped.
async function closeVertical($: EngineInterface, v: Vertical) {
  const ok = await $.ui.ask(`Chiudo la verticale «${v.title}»? Le chiedo il riepilogo finale, poi si ferma.`, { header: 'Chiudi', options: ['Sì, chiudi', 'No'] })
  if (ok !== 'Sì, chiudi') return
  const sent = await $.session.send({
    to: { sessionId: v.sessionId },
    text: '[chat-verticali] L\'hub chiede di chiudere questa verticale: completa ciò che resta in questo turno, poi chiama `vertical_done` (status done) con il riepilogo. Non fare domande.',
  })
  if (sent.isDelivered) return $.ui.toast(`Chiesto a «${v.slug}» di chiudersi`)
  await $.store.set(verticalKey(v.sessionId), { ...v, status: 'done' })
  const win = (await taggedWindows($))[v.sessionId]
  if (win) await $.process.run(['tmux', 'kill-window', '-t', win])
  if (v.agentId) await $.process.run(['claude', 'stop', v.agentId])
  $.ui.toast(`«${v.slug}» non raggiungibile: segnata chiusa senza riepilogo`)
  await bump($)
}

// The hub pane opens by itself only in a chat that is not a vertical and has
// open verticals of its own (or is the project's hub). Verticals keep `⟂ slug`.
async function isHub($: EngineInterface): Promise<boolean> {
  if (await thisVertical($)) return false
  const id = await $.session.id()
  const project = await projectOf($, await $.session.cwd())
  if ((await $.store.get(hubKey(project))) === id) return true
  return (await allVerticals($)).some(v => v.status !== 'done' && v.parentSessionId === id)
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: PANE_TITLE, columns: PANE_COLUMNS })

function rulesSection(v: Vertical | undefined): string {
  const common = [
    'Regole chat verticali (mod chat-verticali, approvate da Ale):',
    '- Una chat = un verticale: un task/epic PACA, un argomento, una funzione o area di un repo.',
    '- Subagent (skill multi-agent) per lavoro a risultato singolo senza dialogo; chat verticale per lavoro continuativo che richiede decisioni dell\'utente.',
    '- Quando la richiesta esce dal verticale, quando si passa a un task PACA diverso, o quando il contesto supera il 60%: PROPONI all\'utente di passare a una chat verticale e, se d\'accordo, chiama il tool `mcp__chat-verticali__handoff`. Non chiamarlo senza proporlo prima; il tool chiede comunque conferma.',
    '- Il brief del handoff (1-2k token) deve bastare da solo: obiettivo e criterio di fatto, decisioni prese, stato attuale, file/branch/worktree, ID PACA, domande aperte, regole del repo rilevanti, cosa NON fare.',
    '- Modello della nuova chat: sonnet di default, opus per design o lavoro ad alto rischio, haiku solo per lavoro meccanico (tabella della skill multi-agent).',
  ]
  if (!v) return common.join('\n')
  return [
    ...common,
    '',
    `QUESTA CHAT È VERTICALE: «${v.title}» (slug ${v.slug}).`,
    `Scope: ${v.scope}`,
    v.pacaTaskId ? `Task PACA: ${v.pacaRef ?? ''} \`${v.pacaTaskId}\`` : '',
    `Brief: ${v.briefPath}`,
    '- Resta nello scope. Se l\'utente chiede altro, rispondi brevemente solo se banale, altrimenti proponi un handoff verso un\'altra chat verticale.',
    '- A lavoro concluso (o se va messo in pausa) chiama `mcp__chat-verticali__vertical_done` con un riepilogo: cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto.',
    '- Gate di pulizia (obbligatorio, lo impone la mod): lavora in una worktree o in un branch tracciato, non lasciare il repo principale su un altro branch, e annotati file temporanei e processi che avvii (rami, worktree, stash e sessioni bg li registra la mod). Il primo `vertical_done` con status done non chiude: restituisce l\'inventario di ciò che hai creato tu e, a parte, ciò che non è tuo (non si tocca). Rispondi con `cleanup_plan` (ogni voce tua tenere/rimuovere con motivo, più file temporanei e processi), aspetta l\'approvazione della madre, esegui la pulizia, poi richiama con `cleanup_report`. La mod rifà l\'inventario e rifiuta se resta qualcosa di tuo non previsto. La pulizia non si traccia su PACA.',
  ].filter(Boolean).join('\n')
}

// The id a /clear left behind, until the poll has moved its links.
let clearedFrom: string | undefined
// The hub row the focus ring is on: the target of the a/h/s/x hotkeys.
let selected: string | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL_HANDOFF,
      description:
        'Passa il contesto a una NUOVA chat verticale (sessione in background, aperta in una finestra tmux) specializzata su un task PACA, un argomento o una funzione. ' +
        'Usalo solo dopo averlo proposto all\'utente; il tool chiede conferma. Se esiste già una chat attiva con lo stesso slug, la riusa. ' +
        'Il brief deve essere autosufficiente (la nuova chat non vede questa conversazione).',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Identificativo tecnico breve: `ACME-42-fix-x` per un task PACA, `area-funzione` altrimenti.' },
          title: { type: 'string', description: 'Titolo leggibile e breve del verticale: diventa il nome della sessione e della finestra tmux.' },
          scope: { type: 'string', description: 'Confini: cosa rientra in questa chat e cosa no.' },
          brief: { type: 'string', description: 'Markdown: obiettivo e criterio di fatto, decisioni prese, stato, file/branch/worktree, ID PACA, domande aperte, regole del repo, cosa NON fare.' },
          paca_task_id: { type: 'string', description: 'UUID del task PACA, se c\'è.' },
          paca_ref: { type: 'string', description: 'Numero leggibile del task, es. ACME-42.' },
          model: { type: 'string', enum: [...MODELS], description: 'Modello della nuova chat (default sonnet).' },
          cwd: { type: 'string', description: 'Directory di lavoro assoluta (repo o worktree); default la cwd di questa sessione.' },
        },
        required: ['slug', 'title', 'scope', 'brief'],
      },
    })
    await $.tool.register({
      name: TOOL_DONE,
      description:
        'Chiude (o mette in pausa) questa chat verticale: salva il riepilogo nel brief e lo invia alla chat madre. Usalo a lavoro concluso. ' +
        'Con status done passa da un gate di pulizia: la prima chiamata restituisce l\'inventario, poi serve cleanup_plan approvato dalla madre, la pulizia e cleanup_report.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto.' },
          status: { type: 'string', enum: ['done', 'paused'] },
          cleanup_plan: {
            type: 'array',
            description: 'Piano di pulizia (solo per done, dopo l\'inventario): ogni voce dell\'inventario più file temporanei e processi, ciascuna da tenere o rimuovere con il motivo.',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'Testo della voce, identico a quello dell\'inventario.' },
                action: { type: 'string', enum: ['keep', 'remove'] },
                reason: { type: 'string' },
              },
              required: ['item', 'action', 'reason'],
            },
          },
          cleanup_report: { type: 'string', description: 'Cosa hai pulito, dopo l\'approvazione del piano.' },
        },
        required: ['summary'],
      },
    })
    await $.command.register({ name: 'handoff', description: 'Passa il contesto su <tema> a una nuova chat verticale' })
    await $.command.register({ name: 'verticali', description: 'Apre l\'hub delle chat verticali di questo progetto (`tutte` per l\'elenco di ogni progetto)' })

    // A vertical shows `⟂ slug`; its record may land a moment after its start.
    let status = ''
    const showStatus = async () => {
      const v = await thisVertical($)
      const text = v ? `⟂ ${v.slug}` : ''
      if (text !== status) $.ui.status((status = text) || undefined)
    }
    await showStatus()

    // One poll: relink after a /clear, deliver queued summaries, keep the
    // vertical's status line, and in the hub read sessions and windows.
    let signature = ''
    $.clock.every(POLL_MS, () => {
      void (async () => {
        if (clearedFrom && (await relink($, clearedFrom))) clearedFrom = undefined
        await deliverInbox($)
        await showStatus()
        const list = await projectVerticals($)
        const now = JSON.stringify(list)
        let changed = now !== signature
        signature = now
        if (!(await thisVertical($)) && list.some(v => v.status !== 'done')) {
          const fresh = await refresh($)
          if (fresh.changed) changed = true
          await adoptOrphans($, fresh.state.live)
        }
        // Pending cleanup plans this session approves, a vertical mother included: once each.
        const id = await $.session.id()
        for (const v of list) {
          if (v.cleanupStatus !== 'pending') asked.delete(v.sessionId)
          else if (!asked.has(v.sessionId) && (await approverOf($, v)) === id) {
            asked.add(v.sessionId)
            void answerCleanup($, v).catch(() => undefined)
          }
        }
        if (changed) await bump($)
      })().catch(() => undefined)
    })
    if (await isHub($)) void openPane($).catch(() => undefined)
    await deliverInbox($).catch(() => undefined)
    return next(e)
  })

  // A /clear ends the conversation and goes on under a new id, with no
  // session.start: remember the old id, the poll relinks once the id changed.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') clearedFrom = e.sessionId
    return next(e)
  })

  // A vertical keeps its own context fill in its registry record, for the hub.
  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent
    if (e.changed.includes('context') && percent !== undefined) {
      try {
        const v = await thisVertical($)
        if (v && v.contextPercent !== percent) {
          const at = new Date(await $.clock.now()).toISOString()
          await $.store.set(verticalKey(v.sessionId), { ...v, contextPercent: percent, contextAt: at })
          await bump($)
        }
      } catch {
        // The pane just shows no percentage.
      }
    }
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const text = rulesSection(await thisVertical($))
    return { sections: [...composed.sections, { id: 'chat-verticali:rules', text, scope: 'session' }] }
  })

  on('tool.call', { tool: 'mcp__chat-verticali__handoff' }, async ($, e) => {
    try {
      return { result: await startHandoff($, e as unknown as HandoffInput) }
    } catch (err) {
      if (String(err).includes('dismissed')) return { result: 'Domanda chiusa senza risposta: handoff non eseguito.' }
      return { result: `Handoff fallito: ${String(err)}`, isError: true }
    }
  })

  on('tool.call', { tool: 'mcp__chat-verticali__vertical_done' }, async ($, e) => {
    const input = e as unknown as DoneInput
    return { result: await finishVertical($, input) }
  })

  // A vertical notes what it creates, so its cleanup touches only its own mess:
  // files its edits leave, and what a Bash or EnterWorktree call adds to the repo.
  // The tool runs once: no `.catch` that would call `next` again, and a failure
  // in the bookkeeping after it is swallowed, never retried.
  on('tool.call', { tool: /^(Edit|Write|NotebookEdit)$/ }, async ($, e, next) => {
    const ran = await next(e)
    try {
      const v = await thisVertical($)
      const input = e as unknown as { file_path?: string; notebook_path?: string }
      const path = input.file_path ?? input.notebook_path
      if (v && path && ran.deny === undefined) {
        const based = await withBaseline($, v)
        if (!overlaps(based.startDirty, path)) await addCreated($, based, { files: [path] })
      }
    } catch {
      // Not recorded: the file counts as not this vertical's, so it is left alone.
    }
    return ran
  })

  // Only a call that can create repo items or sessions pays for the snapshots.
  const CREATES = /\b(git|claude|gh|worktree)\b/
  on('tool.call', { tool: /^(Bash|EnterWorktree)$/ }, async ($, e, next) => {
    let v: Vertical | undefined
    let before: RepoState | undefined
    try {
      const command = (e as unknown as { command?: string }).command ?? ''
      v = await thisVertical($)
      if (v && ((e as unknown as { tool: string }).tool === 'EnterWorktree' || CREATES.test(command))) {
        v = await withBaseline($, v)
        before = await repoState($, v)
      }
    } catch {
      before = undefined
    }
    const ran = await next(e)
    try {
      if (v && before) await noteCreated($, v, before, await repoState($, v), JSON.stringify(ran.result ?? ''))
    } catch {
      // Not recorded: whatever it made counts as not this vertical's.
    }
    return ran
  })

  // Trigger: a different PACA task changes status in this chat.
  on('tool.call', { tool: /^mcp__paca(-[\w-]+)?__update_task$/ }, async ($, e, next) => {
    const ran = await next(e)
    const input = e as unknown as { taskId?: string; statusId?: string }
    if (ran.deny !== undefined || !input.statusId || !input.taskId) return ran
    try {
      const sessionId = await $.session.id()
      const v = await thisVertical($)
      const focus = v?.pacaTaskId ?? ((await $.store.get(focusKey(sessionId))) as string | undefined)
      if (!focus) {
        await $.store.set(focusKey(sessionId), input.taskId)
        return ran
      }
      if (focus === input.taskId) return ran
      const note =
        `[chat-verticali] Hai cambiato lo stato di un task PACA (\`${input.taskId}\`) diverso dal verticale di questa chat (\`${focus}\`). ` +
        'Se stai iniziando a lavorarci, proponi all\'utente di passarlo a una chat verticale dedicata (tool handoff).'
      return { ...ran, context: [...(ran.context ?? []), note] }
    } catch {
      // The update ran once; the reminder is only skipped.
      return ran
    }
  })

  // vertical_done: close the window (and, when done, stop the session) once the
  // turn that called it ends. Otherwise: note the activity for the hub and warn
  // when the context window passes the thresholds.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (clearedFrom && (await relink($, clearedFrom).catch(() => false))) clearedFrom = undefined
    const sessionId = await $.session.id()
    const closing = (await $.store.get(closeKey(sessionId))) as 'done' | 'paused' | true | undefined
    if (!e.agentId && e.reason === 'answer' && closing) {
      await $.store.delete(closeKey(sessionId))
      const v = await thisVertical($)
      if (!v) return done
      if (v.agentId) {
        const closed = await closeBackground($, v, closing !== 'paused').catch(() => false)
        $.ui.toast(closed ? `Verticale ${closing === 'paused' ? 'in pausa' : 'chiusa'}: la finestra si chiude tra ${CLOSE_DELAY_S}s` : 'Verticale chiusa')
      } else if (closing !== 'paused') {
        if (await closePane($, v).catch(() => false)) $.ui.toast(`Verticale chiusa: la finestra si chiude tra ${CLOSE_DELAY_S}s`)
        else $.ui.toast('Verticale chiusa: esci con /exit')
      }
      return done
    }
    if (!e.agentId) {
      const v = await thisVertical($).catch(() => undefined)
      if (v) await $.store.set(verticalKey(v.sessionId), { ...v, lastAt: new Date(await $.clock.now()).toISOString() })
    }
    const percent = (await $.session.usage()).context.percent
    if (percent === undefined) return done
    const warned = Number((await $.store.get(warnKey(sessionId))) ?? 0)
    const level = [...CONTEXT_THRESHOLDS].reverse().find(t => percent >= t)
    if (!level || level <= warned) return done
    await $.store.set(warnKey(sessionId), level)
    $.ui.toast(`Contesto al ${percent}%: valuta un handoff a una chat verticale`)
    await $.session.append({
      message: {
        type: 'user',
        content: [{
          type: 'text',
          text: `[chat-verticali] Il contesto di questa chat è al ${percent}%. Alla prossima risposta proponi all'utente di passare il lavoro in corso a una chat verticale (tool handoff) invece di /compact.`,
        }],
      },
    })
    return done
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const topic = e.args.trim()
    if (!topic) return { text: 'Uso: /handoff <tema o task da passare a una nuova chat>' }
    const forked = await $.model.fork({
      prompt:
        `Prepara il passaggio di contesto a una nuova chat verticale sul tema: "${topic}". ` +
        'Rispondi SOLO con JSON valido, senza testo attorno: ' +
        '{"slug":"...","title":"titolo breve","scope":"...","brief":"markdown 1-2k token: obiettivo e criterio di fatto, decisioni prese, stato, file/branch/worktree, ID PACA, domande aperte, regole del repo, cosa NON fare","paca_task_id":"uuid o vuoto","paca_ref":"es. ACME-42 o vuoto","model":"sonnet|opus|haiku"}',
    })
    if (!forked.isAnswered) return { text: `Non riesco a preparare il brief (${forked.reason}). Chiedilo a Claude a parole.` }
    const json = forked.text.slice(forked.text.indexOf('{'), forked.text.lastIndexOf('}') + 1)
    let input: HandoffInput
    try {
      input = JSON.parse(json) as HandoffInput
    } catch {
      return { text: 'Il brief generato non era JSON valido: riprova o chiedilo a Claude a parole.' }
    }
    if (!input.paca_task_id) delete input.paca_task_id
    if (!input.paca_ref) delete input.paca_ref
    try {
      return { text: await startHandoff($, input) }
    } catch (err) {
      return { text: `Handoff non eseguito: ${String(err)}` }
    }
  })

  on('command.run', { command: 'verticali' }, async ($, e) => {
    await openPane($).catch(() => undefined)
    const everywhere = e.args.trim() === 'tutte'
    if (!everywhere) await claimHub($).catch(() => undefined)
    const list = everywhere ? await allVerticals($) : await projectVerticals($)
    if (list.length === 0) return { text: everywhere ? 'Nessuna chat verticale registrata.' : 'Nessuna chat verticale in questo progetto (`/verticali tutte` per vederle tutte).' }
    const rows = list
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(v => `${statusGlyph(v.status).glyph} ${v.slug} — ${v.title} [${v.model}, ${v.createdAt}]${v.pacaRef ? ` ${v.pacaRef}` : ''}\n    ${v.briefPath} · ${attachCommand(v)}`)
    return { text: rows.join('\n') }
  })

  // The hotkeys act on the row the focus ring is on.
  on('ui.focus', { requestId: PANE }, async ($, e, next) => {
    const id = e.element?.replace(/^(go|hide)-/, '')
    if (id && id !== e.element) selected = id
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    await read($, tick) // subscribes: a bump redraws
    let state = await read($, snap)
    // First draw before any poll: read now, without writing state from a render.
    if (!state?.at) state = await readLive($).catch(() => state)
    const liveBy = new Map((state?.live ?? []).map(a => [a.sessionId, a]))
    const windows = state?.windows ?? {}
    const currentId = await $.session.id()
    const list = await projectVerticals($)
    const current = list.find(v => v.sessionId === currentId)
    const columns = (e.props as { bodyColumns?: number }).bodyColumns ?? e.viewport?.columns ?? 40
    const compact = columns < COMPACT_COLUMNS
    const now = state?.at || Date.now()

    const approvers = new Map<string, string | undefined>()
    for (const v of list) if (v.cleanupStatus === 'pending') approvers.set(v.sessionId, await approverOf($, v))
    const att = (v: Vertical) => attention(v, liveBy.get(v.sessionId), Boolean(windows[v.sessionId]))
    const rank = (v: Vertical) => ATTENTION.indexOf(att(v))

    // Mothers other than this chat that are still running keep their children:
    // those go under a "madre: <name>" heading. The rest is this hub's tree.
    const isOtherMother = (p?: string) => Boolean(p && p !== currentId && !list.some(v => v.sessionId === p) && liveBy.has(p))
    const mine = list.filter(v => !isOtherMother(v.parentSessionId))
    const others = new Map<string, Vertical[]>()
    for (const v of list) {
      if (!isOtherMother(v.parentSessionId) || v.status === 'done') continue
      others.set(v.parentSessionId!, [...(others.get(v.parentSessionId!) ?? []), v])
    }
    const { rows, closed, closedTotal } = treeRows(mine, rank)
    const target = list.find(v => v.sessionId === selected && v.status !== 'done') ?? rows.find(r => r.v.sessionId !== currentId)?.v

    const section = (title: string, tone: string | undefined, body: RenderChildren) => (
      <Box key={`sec-${title}`} flexDirection="column" borderStyle="round" borderColor={tone ?? 'gray'} paddingX={1}>
        <Text bold color={tone}>
          {title}
        </Text>
        {body}
      </Box>
    )

    const row = (v: Vertical, depth: number) => {
      const a = att(v)
      const g = GLYPHS[a]
      const rel = relation(v, currentId, current?.parentSessionId)
      const percent = a === 'done' ? undefined : v.contextPercent
      const b = percent === undefined ? undefined : bar(percent, compact ? 4 : undefined)
      const lastAt = v.lastAt ?? v.contextAt
      const indent = depth > 0 ? `${'  '.repeat(depth - 1)}└ ` : ''
      const name = short(v.title, Math.max(10, columns - (compact ? 22 : 44) - indent.length))
      const self = v.sessionId === currentId
      return (
        <Box key={`v-${v.sessionId}`}>
          <Text dimColor>{indent}</Text>
          <Text color={g.color} dimColor={g.dim}>
            {g.glyph}{' '}
          </Text>
          {self || a === 'done' ? (
            <Text bold dimColor={g.dim}>
              {name}
            </Text>
          ) : (
            <Button key={`go-${v.sessionId}`} plain onPress={() => void goTo($, v)}>
              {name}
            </Button>
          )}
          {!compact && v.pacaRef && (
            <Text inverse>
              {' '}
              {v.pacaRef}{' '}
            </Text>
          )}
          {rel && <Text dimColor> {rel}</Text>}
          {b && percent !== undefined && (
            <Text>
              {' '}
              <Text color={contextTone(percent)}>{b.on}</Text>
              <Text dimColor>{b.off}</Text>
              <Text color={contextTone(percent)}> {percent}%</Text>
            </Text>
          )}
          {!compact && lastAt && <Text dimColor> {ago(now - Date.parse(lastAt))}</Text>}
          {v.cleanupStatus === 'pending' && approvers.get(v.sessionId) === currentId && (
            <Box marginLeft={1}>
              <Button key={`cleanup-${v.sessionId}`} label="Pulizia" variant="primary" onPress={() => void answerCleanup($, v).catch(() => undefined)} />
            </Box>
          )}
          {!self && v.agentId && windows[v.sessionId] && (
            <Box marginLeft={1}>
              <Button key={`hide-${v.sessionId}`} label="Nascondi" dimColor onPress={() => void hide($, v)} />
            </Box>
          )}
        </Box>
      )
    }

    const keys = target && (
      <Box key="keys">
        <Text dimColor>{compact ? '' : `${short(target.title, 18)}: `}</Text>
        <Button key="k-go" hotkey="a" plain label="Apri" onPress={() => void goTo($, target)} />
        <Text> </Text>
        <Button key="k-hide" hotkey="h" plain label="Nascondi" onPress={() => void hide($, target)} />
        <Text> </Text>
        <Button key="k-stop" hotkey="s" plain label="Stop" onPress={() => void stopVertical($, target)} />
        <Text> </Text>
        <Button key="k-close" hotkey="x" plain label="Chiudi" onPress={() => void closeVertical($, target)} />
      </Box>
    )

    const open = rows
    return (
      <Box flexDirection="column">
        {list.length === 0 && section(PANE_TITLE, undefined, <Text dimColor>Nessuna chat verticale in questo progetto.</Text>)}
        {open.length > 0 && section(`Verticali (${open.length})`, 'green', [keys, ...open.map(r => row(r.v, r.depth))])}
        {[...others].map(([mother, children]) =>
          section(`madre: ${liveBy.get(mother)?.name ?? mother.slice(0, 8)}`, 'cyan',
            treeRows(children, rank).rows.map(r => row(r.v, r.depth))))}
        {closed.length > 0 &&
          section(
            closedTotal > closed.length ? `Chiuse (ultime ${closed.length} di ${closedTotal})` : `Chiuse (${closed.length})`,
            undefined,
            closed.map(v => row(v, 0)),
          )}
      </Box>
    )
  })
}
