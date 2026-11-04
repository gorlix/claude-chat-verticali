// Pure presentation helpers for the hub pane: no `$`, no elements.
// Single-width Unicode only (no emoji): terminals disagree on their width.

export type PanelVertical = {
  slug: string
  title: string
  sessionId: string
  parentSessionId?: string
  model: string
  pacaRef?: string
  status: 'active' | 'done' | 'paused'
  createdAt: string
  contextPercent?: number
  // Short id of the background session (v1.0); absent on v0.3 interactive verticals.
  agentId?: string
}

// One entry of `claude agents --json`.
export type Live = {
  sessionId: string
  id?: string
  name?: string
  kind?: string
  status?: string
  waitingFor?: string
  state?: string
  pid?: number
  cwd?: string
}

export const DONE_SHOWN = 5
export const BAR_CELLS = 8
// Below this many body columns the hub drops the PACA chip, the age and the bar.
export const COMPACT_COLUMNS = 60

export const short = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`

// Cut at the last word end within `max` characters; a single long word is cut hard.
export const cutWords = (text: string, max: number) => {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1).replace(/\s+\S*$/, '')
  return cut.length > 0 && cut.length <= max ? cut : clean.slice(0, max)
}

// Session name: "<REF>: <Title>" with a PACA task, the title alone otherwise.
export const sessionName = (title: string, pacaRef?: string) =>
  pacaRef ? `${pacaRef}: ${title.trim()}` : title.trim()

// tmux window name: the short title (~20 characters, at a word end), after the ref.
export const windowName = (title: string, pacaRef?: string) =>
  pacaRef ? `${pacaRef}: ${cutWords(title, 20)}` : cutWords(title, 20)

// Same shape as the multi-view bars: at least one cell while anything is used.
export const bar = (pct: number, cells = BAR_CELLS) => {
  const clamped = Math.max(0, Math.min(100, pct))
  const filled = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * cells)) : 0
  return { on: '▰'.repeat(filled), off: '▱'.repeat(cells - filled) }
}

// Green below 60 (the warning threshold of the mod), yellow from 60, red from 80.
export const contextTone = (pct: number) => (pct >= 80 ? 'red' : pct >= 60 ? 'yellow' : 'green')

// "3m", "2h", "5g": how long ago, coarse.
export const ago = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000))
  return m < 60 ? `${m}m` : m < 60 * 24 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}g`
}

// What a vertical asks of the person, most urgent first.
export const ATTENTION = ['ask', 'input', 'busy', 'open', 'hidden', 'paused', 'done'] as const
export type Attention = (typeof ATTENTION)[number]

export function attention(v: PanelVertical, live: Live | undefined, hasWindow: boolean): Attention {
  if (v.status === 'done') return 'done'
  if (live?.waitingFor && /permission|dialog/i.test(live.waitingFor)) return 'ask'
  if (live?.status === 'waiting' || live?.waitingFor || live?.state === 'blocked') return 'input'
  if (live?.status === 'busy' || live?.state === 'working') return 'busy'
  if (v.status === 'paused') return 'paused'
  // A v0.3 vertical has no tagged window: alive means its window is open.
  return hasWindow || (!v.agentId && live) ? 'open' : 'hidden'
}

type Glyph = { glyph: string; color?: string; dim: boolean; label: string }

export const GLYPHS: Record<Attention, Glyph> = {
  ask: { glyph: '?', color: 'red', dim: false, label: 'permesso o domanda' },
  input: { glyph: '◆', color: 'yellow', dim: false, label: 'input richiesto' },
  busy: { glyph: '●', color: 'green', dim: false, label: 'al lavoro' },
  open: { glyph: '○', dim: false, label: 'aperta, ferma' },
  hidden: { glyph: '▫', dim: true, label: 'nascosta' },
  paused: { glyph: '◐', color: 'yellow', dim: true, label: 'in pausa' },
  done: { glyph: '✓', dim: true, label: 'chiusa' },
}

// Kept for /verticali's text list.
export const statusGlyph = (status: PanelVertical['status']) =>
  GLYPHS[status === 'active' ? 'busy' : status === 'paused' ? 'paused' : 'done']

// Rows of a tree: roots by attention (then newest), each followed by its open
// children, indented. Done ones are left out; `closed` lists the latest of them.
export function treeRows<T extends PanelVertical>(list: T[], rank: (v: T) => number) {
  const newest = (a: T, b: T) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)
  const open = list.filter(v => v.status !== 'done')
  const ids = new Set(open.map(v => v.sessionId))
  const rows: { v: T; depth: number }[] = []
  const walk = (v: T, depth: number) => {
    rows.push({ v, depth })
    for (const c of open.filter(c => c.parentSessionId === v.sessionId).sort(newest)) walk(c, depth + 1)
  }
  for (const root of open.filter(v => !v.parentSessionId || !ids.has(v.parentSessionId)).sort(newest)) walk(root, 0)
  const done = list.filter(v => v.status === 'done').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { rows, closed: done.slice(0, DONE_SHOWN), closedTotal: done.length }
}

// Where the current session sits relative to the vertical drawn.
export const relation = (v: PanelVertical, currentId: string, currentParentId?: string) =>
  v.sessionId === currentId ? '(questa)' : v.sessionId === currentParentId ? '(madre)' : ''
