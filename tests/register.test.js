"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var panel_1 = require("../hooks/panel");
var composeInput = {
    model: 'claude-sonnet-5-5',
    promptModel: 'claude-sonnet-5-5',
    surfaces: ['terminal'],
    tools: [],
    outputStyle: { name: 'default', isKeepingCodingInstructions: true },
    traits: [],
    sections: [],
};
var notGit = { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false };
// The session's folder, outside git: a vertical's project is then its own cwd.
// `run` answers any other command (tmux in the Vai tests).
var here = function (on, cwd, run) {
    if (cwd === void 0) { cwd = '/tmp'; }
    on('session.cwd', function () { return ({ value: cwd }); });
    on('process.run', function ($, e) {
        var argv = __spreadArray([], e.argv, true);
        return { value: argv[0] === 'git' ? notGit : run === null || run === void 0 ? void 0 : run(argv) };
    });
};
(0, testing_1.test)('/verticali with an empty registry says so', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var ran;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testing_1.mock.store(on);
                on('session.id', function () { return ({ value: 'sess-1' }); });
                here(on);
                return [4 /*yield*/, $.command.run({ command: 'verticali', args: 'tutte' })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(ran.text).toBe('Nessuna chat verticale registrata.');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('/handoff without a topic prints usage and opens nothing', function ($) { return __awaiter(void 0, void 0, void 0, function () {
    var ran;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, $.command.run({ command: 'handoff', args: '  ' })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(ran.text).toContain('Uso: /handoff');
                return [2 /*return*/];
        }
    });
}); });
var vertical = {
    slug: 'acme-42-fix', title: 'Fix ACME-42', scope: 'solo il bug 42', sessionId: 'sess-v',
    cwd: '/tmp', model: 'sonnet', briefPath: '/tmp/b.md', status: 'active', createdAt: '2026-10-19',
};
(0, testing_1.test)('a plain chat gets the general rules only', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var composed, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testing_1.mock.store(on);
                on('session.id', function () { return ({ value: 'sess-1' }); });
                on('prompt.compose', function ($, e) { return ({ sections: e.sections }); });
                return [4 /*yield*/, $.prompt.compose(composeInput)];
            case 1:
                composed = _a.sent();
                rules = composed.sections.find(function (s) { return s.id === 'chat-verticali:rules'; });
                (0, testing_1.expect)(rules === null || rules === void 0 ? void 0 : rules.text).toContain('Una chat = un verticale');
                (0, testing_1.expect)(rules === null || rules === void 0 ? void 0 : rules.text).not.toContain('QUESTA CHAT È VERTICALE');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a vertical chat gets its own scope in the system prompt', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var composed, own;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testing_1.mock.store(on, { 'v:sess-v': vertical });
                on('session.id', function () { return ({ value: 'sess-v' }); });
                on('prompt.compose', function ($, e) { return ({ sections: e.sections }); });
                return [4 /*yield*/, $.prompt.compose(composeInput)];
            case 1:
                composed = _a.sent();
                own = composed.sections.find(function (s) { return s.id === 'chat-verticali:rules'; });
                (0, testing_1.expect)(own === null || own === void 0 ? void 0 : own.text).toContain('QUESTA CHAT È VERTICALE: «Fix ACME-42»');
                (0, testing_1.expect)(own === null || own === void 0 ? void 0 : own.text).toContain('solo il bug 42');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('moving a second PACA task adds a handoff reminder', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var first, same, other;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                testing_1.mock.store(on);
                on('session.id', function () { return ({ value: 'sess-1' }); });
                on('tool.call', { tool: /update_task$/ }, function () { return ({ result: 'ok' }); });
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__paca__update_task', projectId: 'p', taskId: 'task-a', statusId: 's' })];
            case 1:
                first = _d.sent();
                (0, testing_1.expect)((_a = first.context) !== null && _a !== void 0 ? _a : []).toEqual([]);
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__paca__update_task', projectId: 'p', taskId: 'task-a', statusId: 's2' })];
            case 2:
                same = _d.sent();
                (0, testing_1.expect)((_b = same.context) !== null && _b !== void 0 ? _b : []).toEqual([]);
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__paca-homelab__update_task', projectId: 'p', taskId: 'task-b', statusId: 's' })];
            case 3:
                other = _d.sent();
                (0, testing_1.expect)(((_c = other.context) !== null && _c !== void 0 ? _c : []).join('\n')).toContain('diverso dal verticale');
                return [2 /*return*/];
        }
    });
}); });
// --- Pane "Verticali" (0.2.0) ---
var pane = {
    plugin: 'chat-verticali', surface: 'terminal', component: 'Pane', requestId: 'verticali', props: {},
};
var widePane = __assign(__assign({}, pane), { props: { bodyColumns: 90 } });
var v = function (id, over) {
    if (over === void 0) { over = {}; }
    return (__assign(__assign(__assign({}, vertical), { slug: "slug-".concat(id), title: "Titolo ".concat(id), sessionId: id }), over));
};
var runOk = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false };
// A `process.run` answer for the hub: `claude agents --json` and the tagged windows.
var hubRun = function (live, windows, runs, other) {
    if (runs === void 0) { runs = []; }
    return function (argv) {
        var _a;
        runs.push(argv);
        if (argv[0] === 'claude' && argv[1] === 'agents')
            return __assign(__assign({}, runOk), { stdout: JSON.stringify(live) });
        if (argv[1] === 'list-windows')
            return __assign(__assign({}, runOk), { stdout: Object.entries(windows).map(function (_a) {
                    var id = _a[0], w = _a[1];
                    return "".concat(w, "\t").concat(id);
                }).join('\n') });
        return (_a = other === null || other === void 0 ? void 0 : other(argv)) !== null && _a !== void 0 ? _a : runOk;
    };
};
(0, testing_1.test)('the hub draws a tree by attention, with ref, context, glyphs and Nascondi', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var ui, _a, _b, _c, _d, _e, _f, glyphs, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                testing_1.mock.store(on, {
                    'v:a': v('a', { agentId: 'aa', parentSessionId: 'main', pacaRef: 'HOME-16', contextPercent: 72, createdAt: '2026-10-01' }),
                    'v:c': v('c', { agentId: 'cc', parentSessionId: 'a' }),
                    'v:b': v('b', { agentId: 'bb', parentSessionId: 'main', createdAt: '2026-10-09' }),
                    'v:p': v('p', { agentId: 'pp', parentSessionId: 'main', status: 'paused' }),
                    'v:d': v('d', { status: 'done', contextPercent: 90 }),
                });
                on('session.id', function () { return ({ value: 'main' }); });
                here(on, '/tmp', hubRun([
                    { sessionId: 'a', id: 'aa', kind: 'background', status: 'waiting', waitingFor: 'permission prompt' },
                    { sessionId: 'c', id: 'cc', kind: 'background', status: 'busy', state: 'working' },
                    { sessionId: 'b', id: 'bb', kind: 'background', status: 'idle' },
                ], { a: '@5' }));
                return [4 /*yield*/, $.ui.mount(widePane)];
            case 1:
                ui = _j.sent();
                _a = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /Verticali \(4\)/ })];
            case 2:
                _a.apply(void 0, [_j.sent()]).toHaveLength(1);
                _b = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /Chiuse \(1\)/ })];
            case 3:
                _b.apply(void 0, [_j.sent()]).toHaveLength(1);
                _c = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /HOME-16/ })];
            case 4:
                _c.apply(void 0, [_j.sent()]).toHaveLength(1);
                _d = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /72%/ })];
            case 5:
                _d.apply(void 0, [_j.sent()]).not.toHaveLength(0);
                _e = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /90%/ })];
            case 6:
                _e.apply(void 0, [_j.sent()]).toHaveLength(0);
                _f = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /└/ })];
            case 7:
                _f.apply(void 0, [_j.sent()]).toHaveLength(1);
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /^[?◆●○▫◐✓] $/ })];
            case 8:
                glyphs = (_j.sent()).map(function (t) { return String(t.text).trim(); });
                (0, testing_1.expect)(glyphs).toEqual(['?', '●', '▫', '◐', '✓']);
                // Only the vertical with an open window can be hidden from its row.
                _g = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Button', key: 'hide-a' })];
            case 9:
                // Only the vertical with an open window can be hidden from its row.
                _g.apply(void 0, [_j.sent()]).toHaveLength(1);
                _h = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Button', key: 'hide-b' })];
            case 10:
                _h.apply(void 0, [_j.sent()]).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('only the latest 5 closed verticals are listed', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var seed, i, ui, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                seed = {};
                for (i = 1; i <= 7; i++)
                    seed["v:d".concat(i)] = v("d".concat(i), { status: 'done', createdAt: "2026-10-0".concat(i) });
                testing_1.mock.store(on, seed);
                on('session.id', function () { return ({ value: 'main' }); });
                here(on);
                return [4 /*yield*/, $.ui.mount(pane)];
            case 1:
                ui = _d.sent();
                _a = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /ultime 5 di 7/ })];
            case 2:
                _a.apply(void 0, [_d.sent()]).toHaveLength(1);
                _b = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /Titolo d7/ })];
            case 3:
                _b.apply(void 0, [_d.sent()]).not.toHaveLength(0);
                _c = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Text', text: /Titolo d1\b/ })];
            case 4:
                _c.apply(void 0, [_d.sent()]).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('Vai selects the tmux window of the vertical', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var runs, ui;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                runs = [];
                testing_1.mock.store(on, { 'v:a': v('a'), 'v:b': v('b') });
                on('session.id', function () { return ({ value: 'a' }); });
                on('env.get', function () { return ({ value: '/tmp/tmux' }); });
                here(on, '/tmp', function (argv) {
                    runs.push(argv);
                    return runOk;
                });
                return [4 /*yield*/, $.ui.mount(pane)];
            case 1:
                ui = _a.sent();
                return [4 /*yield*/, ui.press({ key: 'go-b' })];
            case 2:
                _a.sent();
                (0, testing_1.expect)(runs.filter(function (r) { return r[1] === 'select-window'; })).toEqual([['tmux', 'select-window', '-t', 'slug-b']]);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('Vai on a missing window, or outside tmux, copies the resume command', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var copied, toasts, tmux, ui;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                copied = [];
                toasts = [];
                tmux = '/tmp/tmux';
                testing_1.mock.store(on, { 'v:a': v('a'), 'v:b': v('b') });
                on('session.id', function () { return ({ value: 'a' }); });
                on('env.get', function () { return ({ value: tmux }); });
                here(on, '/tmp', function () { return (__assign(__assign({}, runOk), { exitCode: 1, stderr: "can't find window" })); });
                on('ui.copy', function ($, e) {
                    copied.push(e.text);
                    return { value: { isCopied: true } };
                });
                on('ui.toast', function ($, e) {
                    toasts.push(e.text);
                    return { value: undefined };
                });
                return [4 /*yield*/, $.ui.mount(pane)];
            case 1:
                ui = _a.sent();
                return [4 /*yield*/, ui.press({ key: 'go-b' })];
            case 2:
                _a.sent();
                (0, testing_1.expect)(toasts[0]).toContain('non trovata');
                tmux = '';
                return [4 /*yield*/, ui.press({ key: 'go-b' })];
            case 3:
                _a.sent();
                (0, testing_1.expect)(toasts[1]).toContain('Fuori da tmux');
                (0, testing_1.expect)(copied).toEqual(['claude --resume b', 'claude --resume b']);
                return [2 /*return*/];
        }
    });
}); });
// A store the test can read back: the plugin's `$.store` is not on the test's `$`.
var spyStore = function (on, seed) {
    var data = new Map(Object.entries(seed));
    on('store.get', function (_$, e) { return ({ value: data.get(e.key) }); });
    on('store.set', function (_$, e) {
        var _a = e, key = _a.key, value = _a.value;
        data.set(key, JSON.parse(JSON.stringify(value)));
        return { value: undefined };
    });
    on('store.delete', function (_$, e) { return ({ value: void data.delete(e.key) }); });
    on('store.keys', function () { return ({ value: __spreadArray([], data.keys(), true) }); });
    return data;
};
(0, testing_1.test)('a vertical records its context percent on session.measure; a plain chat does not', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, measure, rec;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, { 'v:a': v('a') });
                on('session.measure', function ($, e) { return ({ changed: e.changed }); });
                on('session.id', function () { return ({ value: 'a' }); });
                on('clock.now', function () { return ({ value: 1760000000000 }); });
                measure = function (percent, changed) {
                    return $.session.measure({ context: { window: 200000, percent: percent }, rateLimits: [], changed: changed });
                };
                return [4 /*yield*/, measure(55, ['cost'])];
            case 1:
                _a.sent();
                (0, testing_1.expect)(data.get('v:a').contextPercent).toBeUndefined();
                return [4 /*yield*/, measure(55, ['context'])];
            case 2:
                _a.sent();
                rec = data.get('v:a');
                (0, testing_1.expect)(rec.contextPercent).toBe(55);
                (0, testing_1.expect)(rec.contextAt).toContain('2025');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a chat that is not a registered vertical writes nothing on session.measure', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, {});
                on('session.measure', function ($, e) { return ({ changed: e.changed }); });
                on('session.id', function () { return ({ value: 'plain' }); });
                return [4 /*yield*/, $.session.measure({ context: { window: 200000, percent: 70 }, rateLimits: [], changed: ['context'] })];
            case 1:
                _a.sent();
                (0, testing_1.expect)(__spreadArray([], data.keys(), true)).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('/verticali opens the pane and still answers with the text', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var opened, ran;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                opened = [];
                testing_1.mock.store(on, { 'v:a': v('a') });
                on('session.id', function () { return ({ value: 'main' }); });
                here(on);
                on('ui.open', function ($, e) {
                    opened.push(e.id);
                    return { value: { isPlaced: true } };
                });
                return [4 /*yield*/, $.command.run({ command: 'verticali', args: '' })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(opened).toEqual(['verticali']);
                (0, testing_1.expect)(ran.text).toContain('slug-a');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('the pane and /verticali hide the verticals of other projects', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var ui, _i, _a, id, _b, _c, listed, all;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                testing_1.mock.store(on, {
                    'v:mine': v('mine', { cwd: '/repo/a', project: '/repo/a' }),
                    'v:wt': v('wt', { cwd: '/repo/a-worktree', project: '/repo/a' }),
                    'v:old': v('old', { cwd: '/repo/a' }),
                    'v:other': v('other', { cwd: '/repo/b', project: '/repo/b' }),
                    'v:child': v('child', { cwd: '/repo/b', project: '/repo/b', parentSessionId: 'main' }),
                });
                on('session.id', function () { return ({ value: 'main' }); });
                here(on, '/repo/a');
                on('ui.open', function () { return ({ value: { isPlaced: true } }); });
                return [4 /*yield*/, $.ui.mount(pane)];
            case 1:
                ui = _d.sent();
                _i = 0, _a = ['mine', 'wt', 'old', 'child'];
                _d.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 5];
                id = _a[_i];
                _b = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Button', key: "go-".concat(id) })];
            case 3:
                _b.apply(void 0, [_d.sent()]).toHaveLength(1);
                _d.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5:
                _c = testing_1.expect;
                return [4 /*yield*/, ui.findAll({ type: 'Button', key: 'go-other' })];
            case 6:
                _c.apply(void 0, [_d.sent()]).toHaveLength(0);
                return [4 /*yield*/, $.command.run({ command: 'verticali', args: '' })];
            case 7:
                listed = _d.sent();
                (0, testing_1.expect)(listed.text).not.toContain('slug-other');
                return [4 /*yield*/, $.command.run({ command: 'verticali', args: 'tutte' })];
            case 8:
                all = _d.sent();
                (0, testing_1.expect)(all.text).toContain('slug-other');
                return [2 /*return*/];
        }
    });
}); });
// --- Closing and the link to the mother (0.3.0) ---
var turnEnd = function (reason) {
    if (reason === void 0) { reason = 'answer'; }
    return ({ answer: 'fatto', durationMs: 10, isAborted: reason === 'aborted', turnId: 't1', reason: reason });
};
// A vertical with its brief on a fake fs, its mother as `mother`; `delivered` is what the send answers.
var doneSetup = function (on, opts) {
    var data = spyStore(on, { 'v:a': v('a', { parentSessionId: 'mother', briefPath: '/tmp/a.md' }) });
    var runs = [];
    var toasts = [];
    on('session.id', function () { return ({ value: 'a' }); });
    on('session.usage', function () { return ({ value: { context: {} } }); });
    on('clock.now', function () { return ({ value: 1760000000000 }); });
    on('fs.read', function () { return ({ value: '# brief\n' }); });
    on('fs.write', function () { return ({ value: undefined }); });
    on('env.get', function ($, e) {
        var name = e.name;
        return { value: name === 'TMUX_PANE' ? opts.pane : name === 'TMUX' && opts.pane ? '/tmp/tmux-1000/default,42,0' : undefined };
    });
    on('session.send', function () { return (opts.delivered ? { isDelivered: true } : { isDelivered: false, reason: 'gone' }); });
    on('ui.toast', function ($, e) { return ({ value: void toasts.push(e.text) }); });
    here(on, '/tmp', function (argv) {
        var _a;
        runs.push(argv);
        return argv[1] === 'display-message' ? __assign(__assign({}, runOk), { stdout: (_a = opts.start) !== null && _a !== void 0 ? _a : '' }) : runOk;
    });
    return { data: data, runs: runs, toasts: toasts };
};
(0, testing_1.test)('vertical_done (done) closes its own tmux pane when the turn ends', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runs, toasts, data, ran;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = doneSetup(on, { delivered: true, pane: '%7', start: 'claude -n slug-a --session-id a ...' }), runs = _a.runs, toasts = _a.toasts, data = _a.data;
                on('turn.complete', function ($, e) { return ({ text: e.answer }); });
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' })];
            case 1:
                ran = _b.sent();
                (0, testing_1.expect)(ran.result).toContain('si chiude e la sessione si ferma');
                (0, testing_1.expect)(runs).toEqual([]);
                return [4 /*yield*/, $.turn.complete(turnEnd())];
            case 2:
                _b.sent();
                (0, testing_1.expect)(runs[1]).toEqual(['tmux', 'run-shell', '-b', "sleep 5; tmux -S '/tmp/tmux-1000/default' kill-pane -t '%7'"]);
                (0, testing_1.expect)(toasts[0]).toContain('si chiude tra 5s');
                (0, testing_1.expect)(data.has('close:a')).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('vertical_done leaves alone a pane the mod did not open, and paused never closes', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runs, toasts, paused;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = doneSetup(on, { delivered: true, pane: '%3', start: 'zsh' }), runs = _a.runs, toasts = _a.toasts;
                on('turn.complete', function ($, e) { return ({ text: e.answer }); });
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' })];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.turn.complete(turnEnd())];
            case 2:
                _b.sent();
                (0, testing_1.expect)(runs.some(function (r) { return r[1] === 'run-shell'; })).toBe(false);
                (0, testing_1.expect)(toasts[0]).toContain('/exit');
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', status: 'paused' })];
            case 3:
                paused = _b.sent();
                (0, testing_1.expect)(paused.result).not.toContain('si chiude');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('an interrupted turn does not close the pane yet', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runs, data;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = doneSetup(on, { delivered: true, pane: '%7', start: 'claude --resume a' }), runs = _a.runs, data = _a.data;
                on('turn.complete', function ($, e) { return ({ text: e.answer }); });
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' })];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.turn.complete(turnEnd('aborted'))];
            case 2:
                _b.sent();
                (0, testing_1.expect)(runs).toEqual([]);
                (0, testing_1.expect)(data.get('close:a')).toBe('done');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a summary the mother cannot receive waits in her inbox', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, ran;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = doneSetup(on, { delivered: false }).data;
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'tutto ok' })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(ran.result).toContain('quando si riapre');
                (0, testing_1.expect)(data.get('inbox:mother')[0]).toContain('tutto ok');
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('after a /clear the children follow the mother to her new id', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, id;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, {
                    'v:c1': v('c1', { parentSessionId: 'old' }),
                    'v:c2': v('c2', { parentSessionId: 'elsewhere' }),
                    'inbox:old': ['esito c0'],
                });
                id = 'old';
                on('session.id', function () { return ({ value: id }); });
                on('session.usage', function () { return ({ value: { context: {} } }); });
                on('session.end', function ($, e) { return ({ sessionId: e.sessionId }); });
                on('turn.complete', function ($, e) { return ({ text: e.answer }); });
                return [4 /*yield*/, $.session.end({ reason: 'clear', sessionId: 'old', resume: { id: 'old' } })];
            case 1:
                _a.sent();
                id = 'new';
                return [4 /*yield*/, $.turn.complete(turnEnd())];
            case 2:
                _a.sent();
                (0, testing_1.expect)(data.get('v:c1').parentSessionId).toBe('new');
                (0, testing_1.expect)(data.get('v:c2').parentSessionId).toBe('elsewhere');
                (0, testing_1.expect)(data.get('inbox:new')).toEqual(['esito c0']);
                (0, testing_1.expect)(data.has('inbox:old')).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
// --- v1.0: background sessions, hub, names ---
// Answers each ask with the first "Sì, …" option it offers.
var sayYes = function (on) {
    return on('tool.call', { tool: 'AskUserQuestion' }, function (_$, e) {
        var _a;
        var _b;
        var q = e.questions[0].question;
        return { result: { answers: (_a = {}, _a[q] = (_b = JSON.stringify(e).match(/Sì, \w+/)) === null || _b === void 0 ? void 0 : _b[0], _a) } };
    });
};
(0, testing_1.test)('names: session "<REF>: <Title>", window cut at a word end within 20', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, panel_1.sessionName)('Pannello verticali', 'HOME-16')).toBe('HOME-16: Pannello verticali');
        (0, testing_1.expect)((0, panel_1.sessionName)(' Solo titolo ')).toBe('Solo titolo');
        (0, testing_1.expect)((0, panel_1.windowName)('Pannello verticali con hub e parcheggio', 'HOME-16')).toBe('HOME-16: Pannello verticali');
        (0, testing_1.expect)((0, panel_1.windowName)('Riordino')).toBe('Riordino');
        (0, testing_1.expect)((0, panel_1.cutWords)('Supercalifragilistichespiralidoso', 20)).toBe('Supercalifragilistic');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('attention: permission asks first, then input, busy, open, hidden', function () { return __awaiter(void 0, void 0, void 0, function () {
    var bg;
    return __generator(this, function (_a) {
        bg = __assign(__assign({}, vertical), { status: 'active', agentId: 'aa' });
        (0, testing_1.expect)((0, panel_1.attention)(bg, { sessionId: 'x', status: 'waiting', waitingFor: 'permission prompt' }, true)).toBe('ask');
        (0, testing_1.expect)((0, panel_1.attention)(bg, { sessionId: 'x', status: 'waiting', waitingFor: 'input needed' }, true)).toBe('input');
        (0, testing_1.expect)((0, panel_1.attention)(bg, { sessionId: 'x', status: 'busy' }, false)).toBe('busy');
        (0, testing_1.expect)((0, panel_1.attention)(bg, { sessionId: 'x', status: 'idle' }, true)).toBe('open');
        (0, testing_1.expect)((0, panel_1.attention)(bg, undefined, false)).toBe('hidden');
        // A v0.3 vertical, alive, counts as open though no window carries the tag.
        (0, testing_1.expect)((0, panel_1.attention)(__assign(__assign({}, vertical), { status: 'active' }), { sessionId: 'x', status: 'idle' }, false)).toBe('open');
        (0, testing_1.expect)((0, panel_1.attention)(__assign(__assign({}, bg), { status: 'done' }), { sessionId: 'x', status: 'busy' }, true)).toBe('done');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('handoff starts a background session, attaches it in a tagged window and makes the mother the hub', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, runs, renamed, clock, ran, bg, win;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, {});
                runs = [];
                renamed = [];
                clock = testing_1.mock.clock(on, { now: 1760000000000 });
                on('session.id', function () { return ({ value: 'main' }); });
                on('env.get', function (_$, e) { return ({ value: { TMUX: '/tmp/tmux,1,0', TMUX_PANE: '%0', HOME: '/home/x' }[e.name] }); });
                on('fs.write', function () { return ({ value: undefined }); });
                on('ui.open', function () { return ({ value: { isPlaced: true } }); });
                on('command.run', { command: 'rename' }, function (_$, e) { return ({ text: void renamed.push(e.args) }); });
                sayYes(on);
                here(on, '/tmp', hubRun([{ sessionId: 'uuid-1', id: 'ab12cd34', name: 'HOME-16: Pannello verticali con hub e parcheggio' }, { sessionId: 'main', name: 'chat' }], {}, runs, function (argv) { return argv[1] === '--bg' ? __assign(__assign({}, runOk), { stdout: 'backgrounded · ab12cd34 · HOME-16: Pannello…\n' }) : argv[1] === 'new-window' ? __assign(__assign({}, runOk), { stdout: '@9\n' }) : runOk; }));
                return [4 /*yield*/, $.tool.call({
                        tool: 'mcp__chat-verticali__handoff', slug: 'home-16-pannello', title: 'Pannello verticali con hub e parcheggio',
                        scope: 's', brief: 'b', paca_ref: 'HOME-16',
                    })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(ran.result).toContain('aperta nella finestra tmux «HOME-16: Pannello verticali»');
                bg = runs.find(function (r) { return r[1] === '--bg'; });
                (0, testing_1.expect)(bg.slice(0, 6)).toEqual(['claude', '--bg', '-n', 'HOME-16: Pannello verticali con hub e parcheggio', '--model', 'sonnet']);
                win = runs.find(function (r) { return r[1] === 'new-window'; });
                (0, testing_1.expect)(win.slice(-3)).toEqual(['claude', 'attach', 'ab12cd34']);
                (0, testing_1.expect)(win).toContain('HOME-16: Pannello verticali');
                (0, testing_1.expect)(runs).toContainEqual(['tmux', 'set-option', '-w', '-t', '@9', '@cv_id', 'uuid-1']);
                (0, testing_1.expect)(data.get('v:uuid-1')).toMatchObject({ agentId: 'ab12cd34', sessionId: 'uuid-1', parentSessionId: 'main' });
                (0, testing_1.expect)(data.get('hub:/tmp')).toBe('main');
                (0, testing_1.expect)(runs).toContainEqual(['tmux', 'rename-window', '-t', '%0', 'hub']);
                return [4 /*yield*/, clock.advance(1000)];
            case 2:
                _a.sent();
                (0, testing_1.expect)(renamed).toEqual(['hub-tmp']);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a failed background start reports why and registers nothing', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, ran;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, {});
                on('session.id', function () { return ({ value: 'main' }); });
                on('env.get', function () { return ({ value: undefined }); });
                on('fs.write', function () { return ({ value: undefined }); });
                sayYes(on);
                on('clock.now', function () { return ({ value: 1760000000000 }); });
                here(on, '/tmp', function (argv) { return argv[1] === '--bg' ? __assign(__assign({}, runOk), { exitCode: 1, stdout: 'Workspace not trusted.' }) : runOk; });
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__handoff', slug: 'x', title: 'X', scope: 's', brief: 'b' })];
            case 1:
                ran = _a.sent();
                (0, testing_1.expect)(ran.result).toContain('Workspace not trusted');
                (0, testing_1.expect)(__spreadArray([], data.keys(), true).filter(function (k) { return k.startsWith('v:'); })).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('hub keys: Vai selects or opens by id, Nascondi kills the window, Stop and Chiudi confirm', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var runs, sent, ui, acts;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                runs = [];
                sent = [];
                testing_1.mock.store(on, {
                    'v:a': v('a', { agentId: 'aa', parentSessionId: 'main' }),
                    'v:b': v('b', { agentId: 'bb', parentSessionId: 'main' }),
                });
                on('session.id', function () { return ({ value: 'main' }); });
                on('env.get', function () { return ({ value: '/tmp/tmux' }); });
                on('session.send', function (_$, e) { return ({ isDelivered: Boolean(sent.push(JSON.stringify(e))) }); });
                on('ui.toast', function () { return ({ value: undefined }); });
                sayYes(on);
                here(on, '/tmp', hubRun([{ sessionId: 'a', id: 'aa', status: 'idle' }, { sessionId: 'b', id: 'bb', status: 'idle' }], { a: '@5' }, runs, function (argv) { return argv[1] === 'new-window' ? __assign(__assign({}, runOk), { stdout: '@7\n' }) : runOk; }));
                return [4 /*yield*/, $.ui.mount(widePane)];
            case 1:
                ui = _a.sent();
                acts = function () { return runs.filter(function (r) { return !['agents', 'list-windows'].includes(r[1]); }); };
                return [4 /*yield*/, ui.press({ key: 'go-a' })];
            case 2:
                _a.sent();
                (0, testing_1.expect)(acts()).toEqual([['tmux', 'select-window', '-t', '@5']]);
                runs.length = 0;
                return [4 /*yield*/, ui.press({ key: 'go-b' })];
            case 3:
                _a.sent();
                (0, testing_1.expect)(acts()[0]).toEqual(['tmux', 'new-window', '-P', '-F', '#{window_id}', '-n', 'Titolo b', '-c', '/tmp', 'claude', 'attach', 'bb']);
                (0, testing_1.expect)(acts()[1]).toEqual(['tmux', 'set-option', '-w', '-t', '@7', '@cv_id', 'b']);
                runs.length = 0;
                return [4 /*yield*/, ui.press({ key: 'hide-a' })];
            case 4:
                _a.sent();
                (0, testing_1.expect)(acts()).toEqual([['tmux', 'kill-window', '-t', '@5']]);
                // The hotkeys act on the first row when no row has the focus: a (open) before b (hidden).
                runs.length = 0;
                return [4 /*yield*/, ui.press({ key: 'k-stop' })];
            case 5:
                _a.sent();
                (0, testing_1.expect)(acts()).toEqual([['tmux', 'kill-window', '-t', '@5'], ['claude', 'stop', 'aa']]);
                return [4 /*yield*/, ui.press({ key: 'k-close' })];
            case 6:
                _a.sent();
                (0, testing_1.expect)(sent).toHaveLength(1);
                (0, testing_1.expect)(sent[0]).toContain('"to":"a"');
                (0, testing_1.expect)(sent[0]).toContain('vertical_done');
                return [2 /*return*/];
        }
    });
}); });
var bgDone = function (on) {
    var data = spyStore(on, { 'v:a': v('a', { agentId: 'aa', parentSessionId: 'mother', briefPath: '/tmp/a.md' }) });
    var runs = [];
    on('session.id', function () { return ({ value: 'a' }); });
    on('session.usage', function () { return ({ value: { context: {} } }); });
    on('clock.now', function () { return ({ value: 1760000000000 }); });
    on('fs.read', function () { return ({ value: '# brief\n' }); });
    on('fs.write', function () { return ({ value: undefined }); });
    on('env.get', function () { return ({ value: undefined }); });
    on('session.send', function () { return ({ isDelivered: true }); });
    on('ui.toast', function () { return ({ value: undefined }); });
    on('turn.complete', function ($, e) { return ({ text: e.answer }); });
    here(on, '/tmp', hubRun([], { a: '@5' }, runs));
    return { data: data, runs: runs };
};
(0, testing_1.test)('a background vertical, done: its window closes and the session stops, detached', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var runs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                runs = bgDone(on).runs;
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok' })];
            case 1:
                _a.sent();
                return [4 /*yield*/, $.turn.complete(turnEnd())];
            case 2:
                _a.sent();
                (0, testing_1.expect)(runs.find(function (r) { return r[0] === 'setsid'; })).toEqual(['setsid', '-f', 'sh', '-c', "exec >/dev/null 2>&1; sleep 5; tmux kill-window -t '@5'; claude stop 'aa'"]);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a background vertical, paused: the window closes, the session stays alive', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runs, data, ran;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = bgDone(on), runs = _a.runs, data = _a.data;
                return [4 /*yield*/, $.tool.call({ tool: 'mcp__chat-verticali__vertical_done', summary: 'ok', status: 'paused' })];
            case 1:
                ran = _b.sent();
                (0, testing_1.expect)(ran.result).toContain('resta viva');
                return [4 /*yield*/, $.turn.complete(turnEnd())];
            case 2:
                _b.sent();
                (0, testing_1.expect)(runs.find(function (r) { return r[0] === 'setsid'; })).toEqual(['setsid', '-f', 'sh', '-c', "exec >/dev/null 2>&1; sleep 5; tmux kill-window -t '@5'"]);
                (0, testing_1.expect)(data.has('close:a')).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('the hub adopts the open children and the inbox of a mother that is gone', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var data, clock;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                data = spyStore(on, {
                    'hub:/tmp': 'main',
                    'v:x': v('x', { agentId: 'xx', parentSessionId: 'gone' }),
                    'v:y': v('y', { agentId: 'yy', parentSessionId: 'alive' }),
                    'v:z': v('z', { status: 'done', parentSessionId: 'gone' }),
                    'v:s': v('s', { agentId: 'ss', parentSessionId: 'x' }),
                    'inbox:gone': ['esito'],
                });
                clock = testing_1.mock.clock(on, { now: 1760000000000 });
                on('session.id', function () { return ({ value: 'main' }); });
                on('env.get', function () { return ({ value: undefined }); });
                on('ui.open', function () { return ({ value: { isPlaced: true } }); });
                here(on, '/tmp', hubRun([{ sessionId: 'alive' }, { sessionId: 'y' }], {}));
                on('tool.register', function () { return ({ value: undefined }); });
                on('session.start', function (_$, e) { return e; });
                on('command.register', function () { return ({ value: undefined }); });
                on('ui.status', function () { return ({ value: undefined }); });
                return [4 /*yield*/, $.session.start({ source: 'startup', cwd: '/tmp', surface: null, isInteractive: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, clock.advance(3000)];
            case 2:
                _a.sent();
                (0, testing_1.expect)(data.get('v:x').parentSessionId).toBe('main');
                (0, testing_1.expect)(data.get('v:y').parentSessionId).toBe('alive');
                (0, testing_1.expect)(data.get('v:z').parentSessionId).toBe('gone');
                // x is a vertical, stopped or not: its child stays with it.
                (0, testing_1.expect)(data.get('v:s').parentSessionId).toBe('x');
                (0, testing_1.expect)(data.get('inbox:main')).toEqual(['esito']);
                return [2 /*return*/];
        }
    });
}); });
