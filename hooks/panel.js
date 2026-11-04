"use strict";
// Pure presentation helpers for the hub pane: no `$`, no elements.
// Single-width Unicode only (no emoji): terminals disagree on their width.
Object.defineProperty(exports, "__esModule", { value: true });
exports.relation = exports.statusGlyph = exports.GLYPHS = exports.ATTENTION = exports.ago = exports.contextTone = exports.bar = exports.windowName = exports.sessionName = exports.cutWords = exports.short = exports.COMPACT_COLUMNS = exports.BAR_CELLS = exports.DONE_SHOWN = void 0;
exports.attention = attention;
exports.treeRows = treeRows;
exports.DONE_SHOWN = 5;
exports.BAR_CELLS = 8;
// Below this many body columns the hub drops the PACA chip, the age and the bar.
exports.COMPACT_COLUMNS = 60;
var short = function (text, max) {
    return text.length <= max ? text : "".concat(text.slice(0, Math.max(1, max - 1)), "\u2026");
};
exports.short = short;
// Cut at the last word end within `max` characters; a single long word is cut hard.
var cutWords = function (text, max) {
    var clean = text.trim().replace(/\s+/g, ' ');
    if (clean.length <= max)
        return clean;
    var cut = clean.slice(0, max + 1).replace(/\s+\S*$/, '');
    return cut.length > 0 && cut.length <= max ? cut : clean.slice(0, max);
};
exports.cutWords = cutWords;
// Session name: "<REF>: <Title>" with a PACA task, the title alone otherwise.
var sessionName = function (title, pacaRef) {
    return pacaRef ? "".concat(pacaRef, ": ").concat(title.trim()) : title.trim();
};
exports.sessionName = sessionName;
// tmux window name: the short title (~20 characters, at a word end), after the ref.
var windowName = function (title, pacaRef) {
    return pacaRef ? "".concat(pacaRef, ": ").concat((0, exports.cutWords)(title, 20)) : (0, exports.cutWords)(title, 20);
};
exports.windowName = windowName;
// Same shape as the multi-view bars: at least one cell while anything is used.
var bar = function (pct, cells) {
    if (cells === void 0) { cells = exports.BAR_CELLS; }
    var clamped = Math.max(0, Math.min(100, pct));
    var filled = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * cells)) : 0;
    return { on: '▰'.repeat(filled), off: '▱'.repeat(cells - filled) };
};
exports.bar = bar;
// Green below 60 (the warning threshold of the mod), yellow from 60, red from 80.
var contextTone = function (pct) { return (pct >= 80 ? 'red' : pct >= 60 ? 'yellow' : 'green'); };
exports.contextTone = contextTone;
// "3m", "2h", "5g": how long ago, coarse.
var ago = function (ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? "".concat(m, "m") : m < 60 * 24 ? "".concat(Math.floor(m / 60), "h") : "".concat(Math.floor(m / 1440), "g");
};
exports.ago = ago;
// What a vertical asks of the person, most urgent first.
exports.ATTENTION = ['ask', 'input', 'busy', 'open', 'hidden', 'paused', 'done'];
function attention(v, live, hasWindow) {
    if (v.status === 'done')
        return 'done';
    if ((live === null || live === void 0 ? void 0 : live.waitingFor) && /permission|dialog/i.test(live.waitingFor))
        return 'ask';
    if ((live === null || live === void 0 ? void 0 : live.status) === 'waiting' || (live === null || live === void 0 ? void 0 : live.waitingFor) || (live === null || live === void 0 ? void 0 : live.state) === 'blocked')
        return 'input';
    if ((live === null || live === void 0 ? void 0 : live.status) === 'busy' || (live === null || live === void 0 ? void 0 : live.state) === 'working')
        return 'busy';
    if (v.status === 'paused')
        return 'paused';
    // A v0.3 vertical has no tagged window: alive means its window is open.
    return hasWindow || (!v.agentId && live) ? 'open' : 'hidden';
}
exports.GLYPHS = {
    ask: { glyph: '?', color: 'red', dim: false, label: 'permesso o domanda' },
    input: { glyph: '◆', color: 'yellow', dim: false, label: 'input richiesto' },
    busy: { glyph: '●', color: 'green', dim: false, label: 'al lavoro' },
    open: { glyph: '○', dim: false, label: 'aperta, ferma' },
    hidden: { glyph: '▫', dim: true, label: 'nascosta' },
    paused: { glyph: '◐', color: 'yellow', dim: true, label: 'in pausa' },
    done: { glyph: '✓', dim: true, label: 'chiusa' },
};
// Kept for /verticali's text list.
var statusGlyph = function (status) {
    return exports.GLYPHS[status === 'active' ? 'busy' : status === 'paused' ? 'paused' : 'done'];
};
exports.statusGlyph = statusGlyph;
// Rows of a tree: roots by attention (then newest), each followed by its open
// children, indented. Done ones are left out; `closed` lists the latest of them.
function treeRows(list, rank) {
    var newest = function (a, b) { return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt); };
    var open = list.filter(function (v) { return v.status !== 'done'; });
    var ids = new Set(open.map(function (v) { return v.sessionId; }));
    var rows = [];
    var walk = function (v, depth) {
        rows.push({ v: v, depth: depth });
        for (var _i = 0, _a = open.filter(function (c) { return c.parentSessionId === v.sessionId; }).sort(newest); _i < _a.length; _i++) {
            var c = _a[_i];
            walk(c, depth + 1);
        }
    };
    for (var _i = 0, _a = open.filter(function (v) { return !v.parentSessionId || !ids.has(v.parentSessionId); }).sort(newest); _i < _a.length; _i++) {
        var root = _a[_i];
        walk(root, 0);
    }
    var done = list.filter(function (v) { return v.status === 'done'; }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
    return { rows: rows, closed: done.slice(0, exports.DONE_SHOWN), closedTotal: done.length };
}
// Where the current session sits relative to the vertical drawn.
var relation = function (v, currentId, currentParentId) {
    return v.sessionId === currentId ? '(questa)' : v.sessionId === currentParentId ? '(madre)' : '';
};
exports.relation = relation;
