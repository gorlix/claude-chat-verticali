// Pure presentation helpers for the "Verticali" pane: no `$`, no elements.
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
}

export const DONE_SHOWN = 5
export const BAR_CELLS = 8

export const short = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`

// Same shape as the multi-view bars: at least one cell while anything is used.
export const bar = (pct: number, cells = BAR_CELLS) => {
  const clamped = Math.max(0, Math.min(100, pct))
  const filled = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * cells)) : 0
  return { on: '▰'.repeat(filled), off: '▱'.repeat(cells - filled) }
}

// Green below 60 (the warning threshold of the mod), yellow from 60, red from 80.
export const contextTone = (pct: number) => (pct >= 80 ? 'red' : pct >= 60 ? 'yellow' : 'green')

type Glyph = { glyph: string; color?: string; dim: boolean }

export const statusGlyph = (status: PanelVertical['status']): Glyph =>
  status === 'active'
    ? { glyph: '●', color: 'green', dim: false }
    : status === 'paused'
      ? { glyph: '◐', color: 'yellow', dim: false }
      : { glyph: '✓', dim: true }

// Active first, then paused, then the latest DONE_SHOWN closed ones; newest first.
export function groupVerticals<T extends PanelVertical>(list: T[]) {
  const newest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt)
  const of = (status: T['status']) => list.filter(v => v.status === status).sort(newest)
  const done = of('done')
  return { active: of('active'), paused: of('paused'), done: done.slice(0, DONE_SHOWN), doneTotal: done.length }
}

// Where the current session sits relative to the vertical drawn.
export const relation = (v: PanelVertical, currentId: string, currentParentId?: string) =>
  v.sessionId === currentId ? '(questa)' : v.sessionId === currentParentId ? '(madre)' : ''
