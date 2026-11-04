import { expect, mock, test } from 'claude-code/testing'

import { attention, cutWords, sessionName, windowName } from '../hooks/panel'

const composeInput = {
  model: 'claude-sonnet-5-5',
  promptModel: 'claude-sonnet-5-5',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: { name: 'default', isKeepingCodingInstructions: true },
  traits: [],
  sections: [],
} as never

const notGit = { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false }

// The session's folder, outside git: a vertical's project is then its own cwd.
// `run` answers any other command (tmux in the Vai tests).
const here = (on: Parameters<typeof mock.store>[0], cwd = '/tmp', run?: (argv: string[]) => unknown) => {
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', ($, e) => {
    const argv = [...(e as { argv: string[] }).argv]
    return { value: argv[0] === 'git' ? notGit : run?.(argv) }
  })
}

test('/verticali with an empty registry says so', async ($, on) => {
  mock.store(on)
  on('session.id', () => ({ value: 'sess-1' }))
  here(on)
  const ran = await $.command.run({ command: 'verticali', args: 'tutte' })
  expect(ran.text).toBe('Nessuna chat verticale registrata.')
})

test('/handoff without a topic prints usage and opens nothing', async $ => {
  const ran = await $.command.run({ command: 'handoff', args: '  ' })
  expect(ran.text).toContain('Uso: /handoff')
})

const vertical = {
  slug: 'acme-42-fix', title: 'Fix ACME-42', scope: 'solo il bug 42', sessionId: 'sess-v',
  cwd: '/tmp', model: 'sonnet', briefPath: '/tmp/b.md', status: 'active', createdAt: '2026-10-19',
}

test('a plain chat gets the general rules only', async ($, on) => {
  mock.store(on)
  on('session.id', () => ({ value: 'sess-1' }))
  on('prompt.compose', ($, e) => ({ sections: e.sections }))
  const composed = await $.prompt.compose(composeInput)
  const rules = composed.sections.find(s => s.id === 'chat-verticali:rules')
  expect(rules?.text).toContain('Una chat = un verticale')
  expect(rules?.text).not.toContain('QUESTA CHAT È VERTICALE')
})

test('a vertical chat gets its own scope in the system prompt', async ($, on) => {
  mock.store(on, { 'v:sess-v': vertical })
  on('session.id', () => ({ value: 'sess-v' }))
  on('prompt.compose', ($, e) => ({ sections: e.sections }))
  const composed = await $.prompt.compose(composeInput)
  const own = composed.sections.find(s => s.id === 'chat-verticali:rules')
  expect(own?.text).toContain('QUESTA CHAT È VERTICALE: «Fix ACME-42»')
  expect(own?.text).toContain('solo il bug 42')
})

test('moving a second PACA task adds a handoff reminder', async ($, on) => {
  mock.store(on)
  on('session.id', () => ({ value: 'sess-1' }))
  on('tool.call', { tool: /update_task$/ }, () => ({ result: 'ok' }))

  const first = await $.tool.call({ tool: 'mcp__paca__update_task', projectId: 'p', taskId: 'task-a', statusId: 's' })
  expect(first.context ?? []).toEqual([])

  const same = await $.tool.call({ tool: 'mcp__paca__update_task', projectId: 'p', taskId: 'task-a', statusId: 's2' })
  expect(same.context ?? []).toEqual([])

  const other = await $.tool.call({ tool: 'mcp__paca-homelab__update_task', projectId: 'p', taskId: 'task-b', statusId: 's' })
  expect((other.context ?? []).join('\n')).toContain('diverso dal verticale')
})

// --- Pane "Verticali" (0.2.0) ---

const pane = {
  plugin: 'chat-verticali', surface: 'terminal', component: 'Pane', requestId: 'verticali', props: {},
} as never
const widePane = { ...(pane as object), props: { bodyColumns: 90 } } as never
const v = (id: string, over: object = {}) => ({
  ...vertical, slug: `slug-${id}`, title: `Titolo ${id}`, sessionId: id, ...over,
})
const runOk = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

// A `process.run` answer for the hub: `claude agents --json` and the tagged windows.
const hubRun = (live: object[], windows: Record<string, string>, runs: string[][] = [], other?: (argv: string[]) => unknown) =>
  (argv: string[]) => {
    runs.push(argv)
    if (argv[0] === 'claude' && argv[1] === 'agents') return { ...runOk, stdout: JSON.stringify(live) }
    if (argv[1] === 'list-windows') return { ...runOk, stdout: Object.entries(windows).map(([id, w]) => `${w}\t${id}`).join('\n') }
    return other?.(argv) ?? runOk
  }

test('the hub draws a tree by attention, with ref, context, glyphs and Nascondi', async ($, on) => {
  mock.store(on, {
    'v:a': v('a', { agentId: 'aa', parentSessionId: 'main', pacaRef: 'HOME-16', contextPercent: 72, createdAt: '2026-10-01' }),
    'v:c': v('c', { agentId: 'cc', parentSessionId: 'a' }),
    'v:b': v('b', { agentId: 'bb', parentSessionId: 'main', createdAt: '2026-10-09' }),
    'v:p': v('p', { agentId: 'pp', parentSessionId: 'main', status: 'paused' }),
    'v:d': v('d', { status: 'done', contextPercent: 90 }),
  })
  on('session.id', () => ({ value: 'main' }))
  here(on, '/tmp', hubRun(
    [
      { sessionId: 'a', id: 'aa', kind: 'background', status: 'waiting', waitingFor: 'permission prompt' },
      { sessionId: 'c', id: 'cc', kind: 'background', status: 'busy', state: 'working' },
      { sessionId: 'b', id: 'bb', kind: 'background', status: 'idle' },
    ],
    { a: '@5' },
  ))
  const ui = await $.ui.mount(widePane)
  expect(await ui.findAll({ type: 'Text', text: /Verticali \(4\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /Chiuse \(1\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /HOME-16/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /72%/ })).not.toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /90%/ })).toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /└/ })).toHaveLength(1)
  // a asks (?) and comes first, though older than b; b has no window: hidden.
  const glyphs = (await ui.findAll({ type: 'Text', text: /^[?◆●○▫◐✓] $/ })).map(t => String(t.text).trim())
  expect(glyphs).toEqual(['?', '●', '▫', '◐', '✓'])
  // Only the vertical with an open window can be hidden from its row.
  expect(await ui.findAll({ type: 'Button', key: 'hide-a' })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Button', key: 'hide-b' })).toHaveLength(0)
})

test('only the latest 5 closed verticals are listed', async ($, on) => {
  const seed: Record<string, unknown> = {}
  for (let i = 1; i <= 7; i++) seed[`v:d${i}`] = v(`d${i}`, { status: 'done', createdAt: `2026-10-0${i}` })
  mock.store(on, seed)
  on('session.id', () => ({ value: 'main' }))
  here(on)
  const ui = await $.ui.mount(pane)
  expect(await ui.findAll({ type: 'Text', text: /ultime 5 di 7/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /Titolo d7/ })).not.toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /Titolo d1\b/ })).toHaveLength(0)
})

test('Vai selects the tmux window of the vertical', async ($, on) => {
  const runs: string[][] = []
  mock.store(on, { 'v:a': v('a'), 'v:b': v('b') })
  on('session.id', () => ({ value: 'a' }))
  on('env.get', () => ({ value: '/tmp/tmux' }))
  here(on, '/tmp', argv => {
    runs.push(argv)
    return runOk
  })
  const ui = await $.ui.mount(pane)
  await ui.press({ key: 'go-b' })
  expect(runs.filter(r => r[1] === 'select-window')).toEqual([['tmux', 'select-window', '-t', 'slug-b']])
})

test('Vai on a missing window, or outside tmux, copies the resume command', async ($, on) => {
  const copied: string[] = []
  const toasts: string[] = []
  let tmux = '/tmp/tmux'
  mock.store(on, { 'v:a': v('a'), 'v:b': v('b') })
  on('session.id', () => ({ value: 'a' }))
  on('env.get', () => ({ value: tmux }))
  here(on, '/tmp', () => ({ ...runOk, exitCode: 1, stderr: "can't find window" }))
  on('ui.copy', ($, e) => {
    copied.push((e as { text: string }).text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', ($, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined }
  })
  const ui = await $.ui.mount(pane)
  await ui.press({ key: 'go-b' })
  expect(toasts[0]).toContain('non trovata')
  tmux = ''
  await ui.press({ key: 'go-b' })
  expect(toasts[1]).toContain('Fuori da tmux')
  expect(copied).toEqual(['claude --resume b', 'claude --resume b'])
})

// A store the test can read back: the plugin's `$.store` is not on the test's `$`.
const spyStore = (on: Parameters<typeof mock.store>[0], seed: Record<string, unknown>) => {
  const data = new Map(Object.entries(seed))
  on('store.get', (_$, e) => ({ value: data.get((e as { key: string }).key) }))
  on('store.set', (_$, e) => {
    const { key, value } = e as { key: string; value: unknown }
    data.set(key, JSON.parse(JSON.stringify(value)))
    return { value: undefined }
  })
  on('store.delete', (_$, e) => ({ value: void data.delete((e as { key: string }).key) }))
  on('store.keys', () => ({ value: [...data.keys()] }))
  return data
}

test('a vertical records its context percent on session.measure; a plain chat does not', async ($, on) => {
  const data = spyStore(on, { 'v:a': v('a') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.id', () => ({ value: 'a' }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  const measure = (percent: number, changed: ('context' | 'cost')[]) =>
    $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed } as never)
  await measure(55, ['cost'])
  expect((data.get('v:a') as { contextPercent?: number }).contextPercent).toBeUndefined()
  await measure(55, ['context'])
  const rec = data.get('v:a') as { contextPercent?: number; contextAt?: string }
  expect(rec.contextPercent).toBe(55)
  expect(rec.contextAt).toContain('2025')
})

test('a chat that is not a registered vertical writes nothing on session.measure', async ($, on) => {
  const data = spyStore(on, {})
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.id', () => ({ value: 'plain' }))
  await $.session.measure({ context: { window: 200000, percent: 70 }, rateLimits: [], changed: ['context'] } as never)
  expect([...data.keys()]).toEqual([])
})

test('/verticali opens the pane and still answers with the text', async ($, on) => {
  const opened: string[] = []
  mock.store(on, { 'v:a': v('a') })
  on('session.id', () => ({ value: 'main' }))
  here(on)
  on('ui.open', ($, e) => {
    opened.push((e as { id: string }).id)
    return { value: { isPlaced: true } }
  })
  const ran = await $.command.run({ command: 'verticali', args: '' } as never)
  expect(opened).toEqual(['verticali'])
  expect(ran.text).toContain('slug-a')
})

test('the pane and /verticali hide the verticals of other projects', async ($, on) => {
  mock.store(on, {
    'v:mine': v('mine', { cwd: '/repo/a', project: '/repo/a' }),
    'v:wt': v('wt', { cwd: '/repo/a-worktree', project: '/repo/a' }),
    'v:old': v('old', { cwd: '/repo/a' }),
    'v:other': v('other', { cwd: '/repo/b', project: '/repo/b' }),
    'v:child': v('child', { cwd: '/repo/b', project: '/repo/b', parentSessionId: 'main' }),
  })
  on('session.id', () => ({ value: 'main' }))
  here(on, '/repo/a')
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const ui = await $.ui.mount(pane)
  for (const id of ['mine', 'wt', 'old', 'child'])
    expect(await ui.findAll({ type: 'Button', key: `go-${id}` })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Button', key: 'go-other' })).toHaveLength(0)

  const listed = await $.command.run({ command: 'verticali', args: '' } as never)
  expect(listed.text).not.toContain('slug-other')
  const all = await $.command.run({ command: 'verticali', args: 'tutte' } as never)
  expect(all.text).toContain('slug-other')
})

// --- Closing and the link to the mother (0.3.0) ---

const turnEnd = (reason = 'answer') =>
  ({ answer: 'fatto', durationMs: 10, isAborted: reason === 'aborted', turnId: 't1', reason }) as never

// A vertical with its brief on a fake fs, its mother as `mother`; `delivered` is what the send answers.
const doneSetup = (on: Parameters<typeof mock.store>[0], opts: { delivered: boolean; pane?: string; start?: string }) => {
  const data = spyStore(on, { 'v:a': v('a', { parentSessionId: 'mother', briefPath: '/tmp/a.md', cleanupStatus: 'approved', cleanupPlan: [] }) })
  const runs: string[][] = []
  const toasts: string[] = []
  on('session.id', () => ({ value: 'a' }))
  on('session.usage', () => ({ value: { context: {} } }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  on('fs.read', () => ({ value: '# brief\n' }))
  on('fs.write', () => ({ value: undefined }))
  on('env.get', ($, e) => {
    const name = (e as { name: string }).name
    return { value: name === 'TMUX_PANE' ? opts.pane : name === 'TMUX' && opts.pane ? '/tmp/tmux-1000/default,42,0' : undefined }
  })
  on('session.send', () => (opts.delivered ? { isDelivered: true } : { isDelivered: false, reason: 'gone' }))
  on('ui.toast', ($, e) => ({ value: void toasts.push((e as { text: string }).text) }))
  here(on, '/tmp', argv => {
    // The cleanup inventory reads sessions and windows: not what these tests watch.
    if (!['agents', 'list-windows'].includes(argv[1])) runs.push(argv)
    return argv[1] === 'display-message' ? { ...runOk, stdout: opts.start ?? '' } : runOk
  })
  return { data, runs, toasts }
}

test('vertical_done (done) closes its own tmux pane when the turn ends', async ($, on) => {
  const { runs, toasts, data } = doneSetup(on, { delivered: true, pane: '%7', start: 'claude -n slug-a --session-id a ...' })
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  expect(ran.result).toContain('si chiude e la sessione si ferma')
  expect(runs).toEqual([])
  await $.turn.complete(turnEnd())
  expect(runs[1]).toEqual(['tmux', 'run-shell', '-b', "sleep 5; tmux -S '/tmp/tmux-1000/default' kill-pane -t '%7'"])
  expect(toasts[0]).toContain('si chiude tra 5s')
  expect(data.has('close:a')).toBe(false)
})

test('vertical_done leaves alone a pane the mod did not open, and paused never closes', async ($, on) => {
  const { runs, toasts } = doneSetup(on, { delivered: true, pane: '%3', start: 'zsh' })
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  await $.turn.complete(turnEnd())
  expect(runs.some(r => r[1] === 'run-shell')).toBe(false)
  expect(toasts[0]).toContain('/exit')

  const paused = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', status: 'paused' } as never)
  expect(paused.result).not.toContain('si chiude')
})

test('an interrupted turn does not close the pane yet', async ($, on) => {
  const { runs, data } = doneSetup(on, { delivered: true, pane: '%7', start: 'claude --resume a' })
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  await $.turn.complete(turnEnd('aborted'))
  expect(runs).toEqual([])
  expect(data.get('close:a')).toBe('done')
})

test('a summary the mother cannot receive waits in her inbox', async ($, on) => {
  const { data } = doneSetup(on, { delivered: false })
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'tutto ok' } as never)
  expect(ran.result).toContain('quando si riapre')
  expect((data.get('inbox:mother') as string[])[0]).toContain('tutto ok')
})

test('after a /clear the children follow the mother to her new id', async ($, on) => {
  const data = spyStore(on, {
    'v:c1': v('c1', { parentSessionId: 'old' }),
    'v:c2': v('c2', { parentSessionId: 'elsewhere' }),
    'inbox:old': ['esito c0'],
  })
  let id = 'old'
  on('session.id', () => ({ value: id }))
  on('session.usage', () => ({ value: { context: {} } }))
  on('session.end', ($, e) => ({ sessionId: (e as { sessionId: string }).sessionId }))
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  await $.session.end({ reason: 'clear', sessionId: 'old', resume: { id: 'old' } } as never)
  id = 'new'
  await $.turn.complete(turnEnd())
  expect((data.get('v:c1') as { parentSessionId: string }).parentSessionId).toBe('new')
  expect((data.get('v:c2') as { parentSessionId: string }).parentSessionId).toBe('elsewhere')
  expect(data.get('inbox:new')).toEqual(['esito c0'])
  expect(data.has('inbox:old')).toBe(false)
})

// --- v1.0: background sessions, hub, names ---

// Answers each ask with the first "Sì, …" option it offers.
const sayYes = (on: Parameters<typeof mock.store>[0]) =>
  on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    return { result: { answers: { [q]: JSON.stringify(e).match(/Sì, \w+/)?.[0] } } }
  })

test('names: session "<REF>: <Title>", window cut at a word end within 20', async () => {
  expect(sessionName('Pannello verticali', 'HOME-16')).toBe('HOME-16: Pannello verticali')
  expect(sessionName(' Solo titolo ')).toBe('Solo titolo')
  expect(windowName('Pannello verticali con hub e parcheggio', 'HOME-16')).toBe('HOME-16: Pannello verticali')
  expect(windowName('Riordino')).toBe('Riordino')
  expect(cutWords('Supercalifragilistichespiralidoso', 20)).toBe('Supercalifragilistic')
})

test('attention: permission asks first, then input, busy, open, hidden', async () => {
  const bg = { ...vertical, status: 'active' as const, agentId: 'aa' }
  expect(attention(bg, { sessionId: 'x', status: 'waiting', waitingFor: 'permission prompt' }, true)).toBe('ask')
  expect(attention(bg, { sessionId: 'x', status: 'waiting', waitingFor: 'input needed' }, true)).toBe('input')
  expect(attention(bg, { sessionId: 'x', status: 'busy' }, false)).toBe('busy')
  expect(attention(bg, { sessionId: 'x', status: 'idle' }, true)).toBe('open')
  expect(attention(bg, undefined, false)).toBe('hidden')
  // A v0.3 vertical, alive, counts as open though no window carries the tag.
  expect(attention({ ...vertical, status: 'active' }, { sessionId: 'x', status: 'idle' }, false)).toBe('open')
  expect(attention({ ...bg, status: 'done' }, { sessionId: 'x', status: 'busy' }, true)).toBe('done')
})

test('handoff starts a background session, attaches it in a tagged window and makes the mother the hub', async ($, on) => {
  const data = spyStore(on, {})
  const runs: string[][] = []
  const renamed: string[] = []
  const clock = mock.clock(on, { now: 1_760_000_000_000 })
  on('session.id', () => ({ value: 'main' }))
  on('env.get', (_$, e) => ({ value: ({ TMUX: '/tmp/tmux,1,0', TMUX_PANE: '%0', HOME: '/home/x' } as Record<string, string>)[(e as { name: string }).name] }))
  on('fs.write', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.run', { command: 'rename' }, (_$, e) => ({ text: void renamed.push((e as { args: string }).args) }))
  sayYes(on)
  here(on, '/tmp', hubRun(
    [{ sessionId: 'uuid-1', id: 'ab12cd34', name: 'HOME-16: Pannello verticali con hub e parcheggio' }, { sessionId: 'main', name: 'chat' }],
    {}, runs,
    argv => argv[1] === '--bg' ? { ...runOk, stdout: 'backgrounded · ab12cd34 · HOME-16: Pannello…\n' }
      : argv[1] === 'new-window' ? { ...runOk, stdout: '@9\n' } : runOk,
  ))
  const ran = await $.tool.call({
    tool: 'mcp__chat-verticali__handoff', slug: 'home-16-pannello', title: 'Pannello verticali con hub e parcheggio',
    scope: 's', brief: 'b', paca_ref: 'HOME-16',
  } as never)
  expect(ran.result).toContain('aperta nella finestra tmux «HOME-16: Pannello verticali»')
  const bg = runs.find(r => r[1] === '--bg')!
  expect(bg.slice(0, 6)).toEqual(['claude', '--bg', '-n', 'HOME-16: Pannello verticali con hub e parcheggio', '--model', 'sonnet'])
  const win = runs.find(r => r[1] === 'new-window')!
  expect(win.slice(-3)).toEqual(['claude', 'attach', 'ab12cd34'])
  expect(win).toContain('HOME-16: Pannello verticali')
  expect(runs).toContainEqual(['tmux', 'set-option', '-w', '-t', '@9', '@cv_id', 'uuid-1'])
  expect(data.get('v:uuid-1')).toMatchObject({ agentId: 'ab12cd34', sessionId: 'uuid-1', parentSessionId: 'main' })
  expect(data.get('hub:/tmp')).toBe('main')
  expect(runs).toContainEqual(['tmux', 'rename-window', '-t', '%0', 'hub'])
  await clock.advance(1000)
  expect(renamed).toEqual(['hub-tmp'])
})

test('a failed background start reports why and registers nothing', async ($, on) => {
  const data = spyStore(on, {})
  on('session.id', () => ({ value: 'main' }))
  on('env.get', () => ({ value: undefined }))
  on('fs.write', () => ({ value: undefined }))
  sayYes(on)
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  here(on, '/tmp', argv => argv[1] === '--bg' ? { ...runOk, exitCode: 1, stdout: 'Workspace not trusted.' } : runOk)
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__handoff', slug: 'x', title: 'X', scope: 's', brief: 'b' } as never)
  expect(ran.result).toContain('Workspace not trusted')
  expect([...data.keys()].filter(k => k.startsWith('v:'))).toEqual([])
})

test('hub keys: Vai selects or opens by id, Nascondi kills the window, Stop and Chiudi confirm', async ($, on) => {
  const runs: string[][] = []
  const sent: string[] = []
  mock.store(on, {
    'v:a': v('a', { agentId: 'aa', parentSessionId: 'main' }),
    'v:b': v('b', { agentId: 'bb', parentSessionId: 'main' }),
  })
  on('session.id', () => ({ value: 'main' }))
  on('env.get', () => ({ value: '/tmp/tmux' }))
  on('session.send', (_$, e) => ({ isDelivered: Boolean(sent.push(JSON.stringify(e))) }))
  on('ui.toast', () => ({ value: undefined }))
  sayYes(on)
  here(on, '/tmp', hubRun([{ sessionId: 'a', id: 'aa', status: 'idle' }, { sessionId: 'b', id: 'bb', status: 'idle' }], { a: '@5' }, runs,
    argv => argv[1] === 'new-window' ? { ...runOk, stdout: '@7\n' } : runOk))
  const ui = await $.ui.mount(widePane)
  const acts = () => runs.filter(r => !['agents', 'list-windows'].includes(r[1]))

  await ui.press({ key: 'go-a' })
  expect(acts()).toEqual([['tmux', 'select-window', '-t', '@5']])
  runs.length = 0
  await ui.press({ key: 'go-b' })
  expect(acts()[0]).toEqual(['tmux', 'new-window', '-P', '-F', '#{window_id}', '-n', 'Titolo b', '-c', '/tmp', 'claude', 'attach', 'bb'])
  expect(acts()[1]).toEqual(['tmux', 'set-option', '-w', '-t', '@7', '@cv_id', 'b'])
  runs.length = 0
  await ui.press({ key: 'hide-a' })
  expect(acts()).toEqual([['tmux', 'kill-window', '-t', '@5']])
  // The hotkeys act on the first row when no row has the focus: a (open) before b (hidden).
  runs.length = 0
  await ui.press({ key: 'k-stop' })
  expect(acts()).toEqual([['tmux', 'kill-window', '-t', '@5'], ['claude', 'stop', 'aa']])
  await ui.press({ key: 'k-close' })
  expect(sent).toHaveLength(1)
  expect(sent[0]).toContain('"to":"a"')
  expect(sent[0]).toContain('vertical_done')
})

const bgDone = (on: Parameters<typeof mock.store>[0]) => {
  const data = spyStore(on, { 'v:a': v('a', { agentId: 'aa', parentSessionId: 'mother', briefPath: '/tmp/a.md', cleanupStatus: 'approved', cleanupPlan: [] }) })
  const runs: string[][] = []
  on('session.id', () => ({ value: 'a' }))
  on('session.usage', () => ({ value: { context: {} } }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  on('fs.read', () => ({ value: '# brief\n' }))
  on('fs.write', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('session.send', () => ({ isDelivered: true }))
  on('ui.toast', () => ({ value: undefined }))
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  here(on, '/tmp', hubRun([], { a: '@5' }, runs))
  return { data, runs }
}

test('a background vertical, done: its window closes and the session stops, detached', async ($, on) => {
  const { runs } = bgDone(on)
  await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  await $.turn.complete(turnEnd())
  expect(runs.find(r => r[0] === 'setsid')).toEqual(['setsid', '-f', 'sh', '-c', "exec >/dev/null 2>&1; sleep 5; tmux kill-window -t '@5'; claude stop 'aa'"])
})

test('a background vertical, paused: the window closes, the session stays alive', async ($, on) => {
  const { runs, data } = bgDone(on)
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', status: 'paused' } as never)
  expect(ran.result).toContain('resta viva')
  await $.turn.complete(turnEnd())
  expect(runs.find(r => r[0] === 'setsid')).toEqual(['setsid', '-f', 'sh', '-c', "exec >/dev/null 2>&1; sleep 5; tmux kill-window -t '@5'"])
  expect(data.has('close:a')).toBe(false)
})

test('the hub adopts the open children and the inbox of a mother that is gone', async ($, on) => {
  const data = spyStore(on, {
    'hub:/tmp': 'main',
    'v:x': v('x', { agentId: 'xx', parentSessionId: 'gone' }),
    'v:y': v('y', { agentId: 'yy', parentSessionId: 'alive' }),
    'v:z': v('z', { status: 'done', parentSessionId: 'gone' }),
    'v:s': v('s', { agentId: 'ss', parentSessionId: 'x' }),
    'inbox:gone': ['esito'],
  })
  const clock = mock.clock(on, { now: 1_760_000_000_000 })
  on('session.id', () => ({ value: 'main' }))
  on('env.get', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  here(on, '/tmp', hubRun([{ sessionId: 'alive' }, { sessionId: 'y' }], {}))
  on('tool.register', () => ({ value: undefined }))
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  await $.session.start({ source: 'startup', cwd: '/tmp', surface: null, isInteractive: true } as never)
  await clock.advance(3000)
  expect((data.get('v:x') as { parentSessionId: string }).parentSessionId).toBe('main')
  expect((data.get('v:y') as { parentSessionId: string }).parentSessionId).toBe('alive')
  expect((data.get('v:z') as { parentSessionId: string }).parentSessionId).toBe('gone')
  // x is a vertical, stopped or not: its child stays with it.
  expect((data.get('v:s') as { parentSessionId: string }).parentSessionId).toBe('x')
  expect(data.get('inbox:main')).toEqual(['esito'])
})

// --- Cleanup gate before done ---

// A vertical in /repo on main; `git` answers from `repo`, which a test changes.
const gateSetup = (on: Parameters<typeof mock.store>[0], over: object = {}) => {
  const data = spyStore(on, {
    'v:a': v('a', {
      cwd: '/repo', project: '/repo', parentSessionId: 'mother', briefPath: '/tmp/a.md',
      startBranch: 'main', startBranches: ['main', 'old'], startWorktrees: [], startedAt: 1_000, ...over,
    }),
  })
  const repo = { branches: ['main', 'old'], dirty: [] as string[], head: 'main' }
  const toasts: string[] = []
  on('session.id', () => ({ value: 'a' }))
  on('session.usage', () => ({ value: { context: {} } }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  on('fs.read', () => ({ value: '# brief\n' }))
  on('fs.write', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('session.send', () => ({ isDelivered: true }))
  on('ui.toast', (_$, e) => ({ value: void toasts.push((e as { text: string }).text) }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('process.run', (_$, e) => {
    const argv = [...(e as { argv: string[] }).argv]
    const out = (stdout: string) => ({ value: { ...runOk, stdout } })
    if (argv[0] !== 'git') return out('')
    if (argv[1] === 'rev-parse') return out('/repo/.git\n')
    if (argv[1] === 'status') return out(repo.dirty.map(f => ` M ${f}`).join('\n'))
    if (argv[1] === 'branch') return out(`${repo.head}\n`)
    if (argv[1] === 'for-each-ref') return out(repo.branches.join('\n'))
    return out('')
  })
  return { data, repo, toasts }
}

test('the gate: the first done does not close and lists what is mine apart from what is not', async ($, on) => {
  const { data, repo } = gateSetup(on, { created: { branches: ['feat/x'] } })
  repo.branches.push('feat/x', 'feat/altrui')
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  const text = String(ran.result)
  expect(text).toContain('NON è chiusa')
  expect(text.split('Non attribuibili')[0]).toContain('git-ramo:feat/x')
  expect(text.split('Non attribuibili')[1]).toContain('git-ramo:feat/altrui')
  expect((data.get('v:a') as { status: string }).status).toBe('active')
  expect(data.has('close:a')).toBe(false)
})

test('the gate: a plan must cover my items and leave others alone; a full one waits for the mother', async ($, on) => {
  const { data, repo } = gateSetup(on, { created: { branches: ['feat/x'] } })
  repo.branches.push('feat/x', 'feat/altrui')
  const call = (plan: object[]) => $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', cleanup_plan: plan } as never)
  expect(String((await call([{ item: 'altro', action: 'keep', reason: 'r' }])).result)).toContain('Mancano')
  const greedy = await call([
    { item: 'git-ramo:feat/x', action: 'remove', reason: 'mergiato' },
    { item: 'git-ramo:feat/altrui', action: 'remove', reason: 'boh' },
  ])
  expect(String(greedy.result)).toContain('non attribuibili')
  const ok = await call([{ item: 'git-ramo:feat/x', action: 'remove', reason: 'mergiato' }])
  expect(String(ok.result)).toContain('approvazione')
  expect(data.get('v:a')).toMatchObject({ cleanupStatus: 'pending', status: 'active' })
  const again = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  expect(String(again.result)).toContain('in attesa')
})

test('the gate: after approval, a leftover of mine refuses the close; a clean repo closes', async ($, on) => {
  const plan = [{ item: 'git-ramo:feat/x', action: 'remove', reason: 'mergiato' }]
  const { data, repo } = gateSetup(on, { created: { branches: ['feat/x'] }, cleanupStatus: 'approved', cleanupPlan: plan })
  repo.branches.push('feat/x')
  const dirty = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', cleanup_report: 'fatto' } as never)
  expect(String(dirty.result)).toContain('Chiusura rifiutata')
  expect(String(dirty.result)).toContain('git-ramo:feat/x')
  repo.branches.pop()
  // Another chat's branch is not this vertical's business: it does not block.
  repo.branches.push('feat/altrui')
  const clean = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', cleanup_report: 'ramo rimosso' } as never)
  expect(String(clean.result)).toContain('segnata done')
  expect((data.get('v:a') as { status: string }).status).toBe('done')
})

test('Bash calls of a vertical record the branches they create and the sessions they start', async ($, on) => {
  const { data, repo } = gateSetup(on)
  on('tool.call', { tool: 'Bash' }, () => {
    repo.branches.push('feat/nuovo')
    return { result: 'backgrounded · ab12cd34 · prova' }
  })
  await $.tool.call({ tool: 'Bash', command: 'git switch -c feat/nuovo && claude --bg prova' } as never)
  expect((data.get('v:a') as { created: object }).created).toMatchObject({ branches: ['feat/nuovo'], sessions: ['ab12cd34'] })
})

test('the hub asks the person to approve a child\'s pending plan, once, and writes the answer', async ($, on) => {
  const data = spyStore(on, {
    'hub:/tmp': 'main',
    'v:x': v('x', { agentId: 'xx', parentSessionId: 'main', cleanupStatus: 'pending', cleanupPlan: [{ item: 'git-ramo:f', action: 'remove', reason: 'r' }] }),
  })
  const sent: string[] = []
  const questions: string[] = []
  const clock = mock.clock(on, { now: 1_760_000_000_000 })
  on('session.id', () => ({ value: 'main' }))
  on('env.get', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.register', () => ({ value: undefined }))
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('session.send', (_$, e) => ({ isDelivered: Boolean(sent.push(JSON.stringify(e))) }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    questions.push(q)
    return { result: { answers: { [q]: 'Approva' } } }
  })
  here(on, '/tmp', hubRun([{ sessionId: 'x', id: 'xx' }], {}))
  await $.session.start({ source: 'startup', cwd: '/tmp', surface: null, isInteractive: true } as never)
  await clock.advance(3000)
  await clock.advance(3000)
  expect(questions).toHaveLength(1)
  expect(questions[0]).toContain('RIMUOVI git-ramo:f')
  expect(data.get('v:x')).toMatchObject({ cleanupStatus: 'approved' })
  expect(sent[0]).toContain('approvato')
})
