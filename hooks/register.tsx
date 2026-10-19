import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import { bar, contextTone, groupVerticals, relation, short, statusGlyph } from './panel'

// Chat verticali: one chat = one vertical (a PACA task, a topic, a function).
// Rules agreed with Ale on 2026-10-19:
// - new verticals open in a tmux window (fallback: --bg session);
// - Claude proposes a handoff, the person confirms (the tool asks);
// - triggers: a different PACA task goes In Progress, context over 60%,
//   a request outside the chat's declared vertical (judged by the model);
// - when done, the vertical reports back to its parent chat and to PACA.

type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'

type Vertical = {
  slug: string
  title: string
  scope: string
  sessionId: string
  parentSessionId?: string
  cwd: string
  model: Model
  briefPath: string
  pacaTaskId?: string
  pacaRef?: string
  status: 'active' | 'done' | 'paused'
  createdAt: string
  // Written by the vertical chat itself on session.measure, for the pane.
  contextPercent?: number
  contextAt?: string
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
const POLL_MS = 4000

// Bumped to redraw the pane: the registry lives in $.store, written by other sessions.
const tick = atom({ plugin: 'chat-verticali', key: 'tick' } as const, 0)

const verticalKey = (sessionId: string) => `v:${sessionId}`
const focusKey = (sessionId: string) => `focus:${sessionId}`
const warnKey = (sessionId: string) => `ctxwarn:${sessionId}`

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'vertical'

const today = async ($: EngineInterface) => new Date(await $.clock.now()).toISOString().slice(0, 10)

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

async function handoffDir($: EngineInterface): Promise<string> {
  const home = (await $.env.get('HOME')) ?? '/tmp'
  return `${home}/.claude/handoffs`
}

function briefText(v: Vertical, brief: string, parentTitle: string): string {
  return [
    `# Chat verticale: ${v.title}`,
    '',
    `- slug: \`${v.slug}\` · sessione: \`${v.sessionId}\` · modello: ${v.model}`,
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

// Opens the vertical's chat: a tmux window when the session runs in tmux,
// a background session otherwise. `resume` reopens an existing session.
async function openChat(
  $: EngineInterface,
  v: Vertical,
  mode: 'new' | 'resume',
): Promise<string> {
  const claudeArgs =
    mode === 'new'
      ? ['claude', '-n', v.slug, '--session-id', v.sessionId,
         '--model', v.model, launchPrompt(v)]
      : ['claude', '--resume', v.sessionId]

  if (await $.env.get('TMUX')) {
    const ran = await $.process.run(['tmux', 'new-window', '-n', v.slug, '-c', v.cwd, ...claudeArgs])
    if (ran.exitCode === 0) return `aperta nella finestra tmux «${v.slug}»`
    $.ui.log(`tmux new-window failed: ${ran.stderr.slice(0, 200)}`, { to: 'debug' })
  }
  const ran = await $.process.run(['claude', '--bg', ...claudeArgs.slice(1)], { cwd: v.cwd, timeoutMs: 60_000 })
  if (ran.exitCode !== 0) throw new Error(`avvio fallito: ${ran.stderr.slice(0, 300)}`)
  return `avviata in background (\`claude attach ${v.sessionId}\` per aprirla)`
}

async function startHandoff($: EngineInterface, input: HandoffInput): Promise<string> {
  const slug = slugify(input.slug || input.title)
  const parentId = await $.session.id()
  const parent = (await $.store.get(verticalKey(parentId))) as Vertical | undefined
  const existing = (await allVerticals($)).find(v => v.slug === slug && v.status !== 'done')

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
    const where = await openChat($, existing, 'resume')
    return `Chat verticale «${existing.slug}» ripresa, ${where}. Aggiornamento aggiunto al brief ${existing.briefPath}.`
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
    sessionId: crypto.randomUUID(),
    parentSessionId: parentId,
    cwd: input.cwd || (await $.session.cwd()),
    model,
    briefPath: `${await handoffDir($)}/${slug}.md`,
    pacaTaskId: input.paca_task_id,
    pacaRef: input.paca_ref,
    status: 'active',
    createdAt: await today($),
  }
  await $.fs.write(v.briefPath, briefText(v, input.brief, parent ? `verticale ${parent.slug}` : `sessione ${parentId}`))
  await $.store.set(verticalKey(v.sessionId), v)
  await update($, tick, n => (n ?? 0) + 1)
  void openPane($).catch(() => undefined)
  const where = await openChat($, v, 'new')
  return (
    `Chat verticale «${v.slug}» ${where}. Brief: ${v.briefPath}. ` +
    (v.pacaTaskId
      ? `Aggiungi ora un commento al task PACA ${v.pacaRef ?? v.pacaTaskId} che dice che il lavoro prosegue nella chat verticale «${v.slug}».`
      : '')
  )
}

async function finishVertical(
  $: EngineInterface,
  input: { summary: string; status?: 'done' | 'paused' },
): Promise<string> {
  const v = await thisVertical($)
  if (!v) return 'Questa chat non è una chat verticale: niente da chiudere.'
  const status = input.status ?? 'done'
  await $.fs.write(v.briefPath,
    `${await $.fs.read(v.briefPath)}\n## Esito (${status}, ${await today($)})\n\n${input.summary.trim()}\n`)
  await $.store.set(verticalKey(v.sessionId), { ...v, status })

  let parentNote = 'nessuna chat madre registrata'
  if (v.parentSessionId) {
    const sent = await $.session.send({
      to: { sessionId: v.parentSessionId },
      text: `[chat verticale «${v.slug}» — ${status}]\n\n${input.summary.trim()}\n\nBrief completo: ${v.briefPath}`,
    })
    parentNote = sent.isDelivered
      ? 'riepilogo inviato alla chat madre'
      : `chat madre non raggiunta (${sent.reason}): il riepilogo resta nel brief`
  }
  const paca = v.pacaTaskId
    ? ` Ora aggiungi il riepilogo come commento al task PACA ${v.pacaRef ?? v.pacaTaskId} (\`${v.pacaTaskId}\`) e aggiorna lo stato secondo la skill paca-workflow del repo.`
    : ''
  return `Verticale «${v.slug}» segnata ${status}; ${parentNote}.${paca}`
}

// Go to a vertical: select its tmux window; when the window is gone (or we are
// outside tmux) offer the resume command on the clipboard instead.
async function goTo($: EngineInterface, v: Vertical) {
  const resume = `claude --resume ${v.sessionId}`
  const offer = async (why: string) => {
    await $.ui.copy({ text: resume })
    $.ui.toast(`${why}: copiato "${resume}"`)
  }
  if (!(await $.env.get('TMUX'))) return offer('Fuori da tmux')
  const ran = await $.process.run(['tmux', 'select-window', '-t', v.slug])
  if (ran.exitCode !== 0) await offer(`Finestra «${v.slug}» non trovata`)
}

// The pane matters to a mother with active verticals and to a vertical itself.
async function hasActiveVerticals($: EngineInterface): Promise<boolean> {
  const id = await $.session.id()
  return (await allVerticals($)).some(
    v => v.status === 'active' && (v.sessionId === id || v.parentSessionId === id),
  )
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: PANE_TITLE })

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
    '- A lavoro concluso (o se va messo in pausa) chiama `mcp__chat-verticali__vertical_done` con un riepilogo: cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto. Poi commenta il task PACA.',
  ].filter(Boolean).join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL_HANDOFF,
      description:
        'Passa il contesto a una NUOVA chat verticale (finestra tmux) specializzata su un task PACA, un argomento o una funzione. ' +
        'Usalo solo dopo averlo proposto all\'utente; il tool chiede conferma. Se esiste già una chat attiva con lo stesso slug, la riusa. ' +
        'Il brief deve essere autosufficiente (la nuova chat non vede questa conversazione).',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Identificativo breve: `ACME-42-fix-x` per un task PACA, `area-funzione` altrimenti.' },
          title: { type: 'string', description: 'Titolo leggibile del verticale.' },
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
        'Chiude (o mette in pausa) questa chat verticale: salva il riepilogo nel brief e lo invia alla chat madre. Usalo a lavoro concluso.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto.' },
          status: { type: 'string', enum: ['done', 'paused'] },
        },
        required: ['summary'],
      },
    })
    await $.command.register({ name: 'handoff', description: 'Passa il contesto su <tema> a una nuova chat verticale' })
    await $.command.register({ name: 'verticali', description: 'Elenca le chat verticali registrate' })

    const v = await thisVertical($)
    if (v) $.ui.status(`⟂ ${v.slug}`)

    // Pane: opened only where verticals are active; refreshed when the registry changes.
    let signature = ''
    $.clock.every(POLL_MS, () => {
      void allVerticals($)
        .then(list => {
          const now = JSON.stringify(list)
          if (now === signature) return
          signature = now
          return update($, tick, n => (n ?? 0) + 1)
        })
        .catch(() => undefined)
    })
    if (await hasActiveVerticals($)) void openPane($).catch(() => undefined)
    return next(e)
  })

  // A vertical keeps its own context fill in its registry record, for the pane.
  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent
    if (e.changed.includes('context') && percent !== undefined) {
      try {
        const v = await thisVertical($)
        if (v && v.contextPercent !== percent) {
          const at = new Date(await $.clock.now()).toISOString()
          await $.store.set(verticalKey(v.sessionId), { ...v, contextPercent: percent, contextAt: at })
          await update($, tick, n => (n ?? 0) + 1)
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
    const input = e as unknown as { summary: string; status?: 'done' | 'paused' }
    return { result: await finishVertical($, input) }
  })

  // Trigger: a different PACA task changes status in this chat.
  on('tool.call', { tool: /^mcp__paca(-[\w-]+)?__update_task$/ }, async ($, e, next) => {
    const ran = await next(e)
    const input = e as unknown as { taskId?: string; statusId?: string }
    if (ran.deny !== undefined || !input.statusId || !input.taskId) return ran

    const sessionId = await $.session.id()
    const v = await thisVertical($)
    let focus = v?.pacaTaskId ?? ((await $.store.get(focusKey(sessionId))) as string | undefined)
    if (!focus) {
      await $.store.set(focusKey(sessionId), input.taskId)
      return ran
    }
    if (focus === input.taskId) return ran
    const note =
      `[chat-verticali] Hai cambiato lo stato di un task PACA (\`${input.taskId}\`) diverso dal verticale di questa chat (\`${focus}\`). ` +
      'Se stai iniziando a lavorarci, proponi all\'utente di passarlo a una chat verticale dedicata (tool handoff).'
    return { ...ran, context: [...(ran.context ?? []), note] }
  }).catch(($, e, next) => next(e))

  // Trigger: context window over the thresholds.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const percent = (await $.session.usage()).context.percent
    if (percent === undefined) return done
    const sessionId = await $.session.id()
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
        '{"slug":"...","title":"...","scope":"...","brief":"markdown 1-2k token: obiettivo e criterio di fatto, decisioni prese, stato, file/branch/worktree, ID PACA, domande aperte, regole del repo, cosa NON fare","paca_task_id":"uuid o vuoto","paca_ref":"es. ACME-42 o vuoto","model":"sonnet|opus|haiku"}',
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

  on('command.run', { command: 'verticali' }, async $ => {
    await openPane($).catch(() => undefined)
    const list = await allVerticals($)
    if (list.length === 0) return { text: 'Nessuna chat verticale registrata.' }
    const rows = list
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(v => `${v.status === 'active' ? '●' : v.status === 'paused' ? '◐' : '○'} ${v.slug} — ${v.title} [${v.model}, ${v.createdAt}]${v.pacaRef ? ` ${v.pacaRef}` : ''}\n    ${v.briefPath} · claude --resume ${v.sessionId}`)
    return { text: rows.join('\n') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    await read($, tick) // subscribes: a bump redraws
    const currentId = await $.session.id()
    const list = await allVerticals($)
    const current = list.find(v => v.sessionId === currentId)
    const columns = e.viewport?.columns ?? 40
    const titleWidth = Math.max(12, columns - 14)
    const { active, paused, done, doneTotal } = groupVerticals(list)

    // A rounded section with its title as the first line.
    const section = (title: string, tone: string | undefined, body: RenderChildren) => (
      <Box key={`sec-${title}`} flexDirection="column" borderStyle="round" borderColor={tone ?? 'gray'} paddingX={1}>
        <Text bold color={tone}>
          {title}
        </Text>
        {body}
      </Box>
    )

    const row = (v: Vertical) => {
      const g = statusGlyph(v.status)
      const rel = relation(v, currentId, current?.parentSessionId)
      const percent = v.status === 'done' ? undefined : v.contextPercent
      const b = percent === undefined ? undefined : bar(percent)
      return (
        <Box key={`v-${v.sessionId}`} flexDirection="column">
          <Box>
            <Text color={g.color} dimColor={g.dim}>
              {g.glyph}{' '}
            </Text>
            <Text bold dimColor={g.dim}>
              {v.slug}
            </Text>
            {v.pacaRef && (
              <Text inverse>
                {' '}
                {v.pacaRef}{' '}
              </Text>
            )}
            {rel && <Text dimColor> {rel}</Text>}
            {v.status !== 'done' && v.sessionId !== currentId && (
              <Box marginLeft={1}>
                <Button key={`go-${v.sessionId}`} label="Vai" onPress={() => void goTo($, v)} />
              </Box>
            )}
          </Box>
          <Box>
            <Text dimColor>
              {'  '}
              {short(v.title, titleWidth)} · {v.model}
            </Text>
            {b && percent !== undefined && (
              <Text>
                {'  '}
                <Text color={contextTone(percent)}>{b.on}</Text>
                <Text dimColor>{b.off}</Text>
                <Text color={contextTone(percent)}> {percent}%</Text>
              </Text>
            )}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {list.length === 0 && section(PANE_TITLE, undefined, <Text dimColor>Nessuna chat verticale registrata.</Text>)}
        {active.length > 0 && section(`Attive (${active.length})`, 'green', active.map(row))}
        {paused.length > 0 && section(`In pausa (${paused.length})`, 'yellow', paused.map(row))}
        {done.length > 0 &&
          section(
            doneTotal > done.length ? `Chiuse (ultime ${done.length} di ${doneTotal})` : `Chiuse (${done.length})`,
            undefined,
            done.map(row),
          )}
      </Box>
    )
  })
}
