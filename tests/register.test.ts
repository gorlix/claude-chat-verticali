import { expect, mock, test } from 'claude-code/testing'

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
const v = (id: string, over: object = {}) => ({
  ...vertical, slug: `slug-${id}`, title: `Titolo ${id}`, sessionId: id, ...over,
})
const runOk = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

test('the pane groups verticals, shows ref, context bar and relations', async ($, on) => {
  mock.store(on, {
    'v:a': v('a', { pacaRef: 'HOME-16', contextPercent: 72, parentSessionId: 'main' }),
    'v:b': v('b', { status: 'paused' }),
    'v:c': v('c', { status: 'done', contextPercent: 90 }),
  })
  on('session.id', () => ({ value: 'a' }))
  here(on)
  const ui = await $.ui.mount(pane)
  expect(await ui.findAll({ type: 'Text', text: /Attive \(1\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /In pausa \(1\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /Chiuse \(1\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /HOME-16/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /\(questa\)/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /72%/ })).not.toHaveLength(0)
  // The done one shows no percentage; the current session has no "Vai" for itself.
  expect(await ui.findAll({ type: 'Text', text: /90%/ })).toHaveLength(0)
  expect(await ui.findAll({ type: 'Button', text: /Vai/ })).toHaveLength(1)
})

test('only the latest 5 closed verticals are listed', async ($, on) => {
  const seed: Record<string, unknown> = {}
  for (let i = 1; i <= 7; i++) seed[`v:d${i}`] = v(`d${i}`, { status: 'done', createdAt: `2026-10-0${i}` })
  mock.store(on, seed)
  on('session.id', () => ({ value: 'main' }))
  here(on)
  const ui = await $.ui.mount(pane)
  expect(await ui.findAll({ type: 'Text', text: /ultime 5 di 7/ })).toHaveLength(1)
  expect(await ui.findAll({ type: 'Text', text: /slug-d7/ })).not.toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /slug-d1\b/ })).toHaveLength(0)
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
  expect(runs).toEqual([['tmux', 'select-window', '-t', 'slug-b']])
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
  for (const slug of ['slug-mine', 'slug-wt', 'slug-old', 'slug-child'])
    expect(await ui.findAll({ type: 'Text', text: new RegExp(slug) })).not.toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /slug-other/ })).toHaveLength(0)

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
  const data = spyStore(on, { 'v:a': v('a', { parentSessionId: 'mother', briefPath: '/tmp/a.md' }) })
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
    runs.push(argv)
    return argv[1] === 'display-message' ? { ...runOk, stdout: opts.start ?? '' } : runOk
  })
  return { data, runs, toasts }
}

test('vertical_done (done) closes its own tmux pane when the turn ends', async ($, on) => {
  const { runs, toasts, data } = doneSetup(on, { delivered: true, pane: '%7', start: 'claude -n slug-a --session-id a ...' })
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }))
  const ran = await $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' } as never)
  expect(ran.result).toContain('si chiude da sola')
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
  expect(data.get('close:a')).toBe(true)
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
