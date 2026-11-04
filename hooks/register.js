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
exports.register = void 0;
var claude_code_1 = require("claude-code");
var panel_1 = require("./panel");
var TOOL_HANDOFF = 'handoff';
var TOOL_DONE = 'vertical_done';
var CONTEXT_THRESHOLDS = [60, 75, 90];
var MODELS = ['haiku', 'sonnet', 'opus', 'fable'];
var PANE = 'verticali';
var PANE_TITLE = 'Verticali';
var PANE_COLUMNS = 72;
var POLL_MS = 3000;
// Bumped to redraw the pane: the registry lives in $.store, written by other sessions.
var tick = (0, claude_code_1.atom)({ plugin: 'chat-verticali', key: 'tick' }, 0);
// What the hub last read of the running sessions and of the tmux windows.
var snap = (0, claude_code_1.atom)({ plugin: 'chat-verticali', key: 'snap' }, { live: [], windows: {}, at: 0 });
var verticalKey = function (sessionId) { return "v:".concat(sessionId); };
var focusKey = function (sessionId) { return "focus:".concat(sessionId); };
var warnKey = function (sessionId) { return "ctxwarn:".concat(sessionId); };
// Summaries a vertical could not deliver, kept for its mother's next opening.
var inboxKey = function (sessionId) { return "inbox:".concat(sessionId); };
// Set by vertical_done: close this vertical's window when the turn ends.
var closeKey = function (sessionId) { return "close:".concat(sessionId); };
// The hub (mother chat) of a project: its session id.
var hubKey = function (project) { return "hub:".concat(project); };
var CLOSE_DELAY_S = 5;
// What tmux and the claude CLI get from us inside a shell line: ids only.
var SAFE = /^[@%\w-]+$/;
var slugify = function (text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'vertical';
};
var today = function ($) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
    switch (_b.label) {
        case 0:
            _a = Date.bind;
            return [4 /*yield*/, $.clock.now()];
        case 1: return [2 /*return*/, new (_a.apply(Date, [void 0, _b.sent()]))().toISOString().slice(0, 10)];
    }
}); }); };
var bump = function ($) { return (0, claude_code_1.update)($, tick, function (n) { return (n !== null && n !== void 0 ? n : 0) + 1; }); };
function thisVertical($) {
    return __awaiter(this, void 0, void 0, function () {
        var id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.session.id()];
                case 1:
                    id = _a.sent();
                    return [4 /*yield*/, $.store.get(verticalKey(id))];
                case 2: return [2 /*return*/, (_a.sent())];
            }
        });
    });
}
function allVerticals($) {
    return __awaiter(this, void 0, void 0, function () {
        var keys, list, _i, keys_1, k, v;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.store.keys()];
                case 1:
                    keys = (_a.sent()).filter(function (k) { return k.startsWith('v:'); });
                    list = [];
                    _i = 0, keys_1 = keys;
                    _a.label = 2;
                case 2:
                    if (!(_i < keys_1.length)) return [3 /*break*/, 5];
                    k = keys_1[_i];
                    return [4 /*yield*/, $.store.get(k)];
                case 3:
                    v = (_a.sent());
                    if (v)
                        list.push(v);
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, list];
            }
        });
    });
}
// The project of a folder: its git common dir without the trailing `.git`, so a
// repo and its worktrees match; the folder itself outside git.
var projects = new Map();
function projectOf($, cwd) {
    var found = projects.get(cwd);
    if (!found) {
        found = $.process
            .run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: cwd, timeoutMs: 5000 })
            .then(function (ran) { return ((ran === null || ran === void 0 ? void 0 : ran.exitCode) === 0 ? ran.stdout.trim().replace(/\/\.git\/?$/, '') : cwd); })
            .catch(function () { return cwd; });
        projects.set(cwd, found);
    }
    return found;
}
// The verticals of this session's project, plus any tied to this session itself
// (its own record, its children, its mother) wherever they live.
function projectVerticals($) {
    return __awaiter(this, void 0, void 0, function () {
        var id, here, _a, _b, list, mother, kept, _i, list_1, v, tied, _c, _d;
        var _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, $.session.id()];
                case 1:
                    id = _g.sent();
                    _a = projectOf;
                    _b = [$];
                    return [4 /*yield*/, $.session.cwd()];
                case 2: return [4 /*yield*/, _a.apply(void 0, _b.concat([_g.sent()]))];
                case 3:
                    here = _g.sent();
                    return [4 /*yield*/, allVerticals($)];
                case 4:
                    list = _g.sent();
                    mother = (_e = list.find(function (v) { return v.sessionId === id; })) === null || _e === void 0 ? void 0 : _e.parentSessionId;
                    kept = [];
                    _i = 0, list_1 = list;
                    _g.label = 5;
                case 5:
                    if (!(_i < list_1.length)) return [3 /*break*/, 11];
                    v = list_1[_i];
                    tied = v.sessionId === id || v.parentSessionId === id || v.sessionId === mother;
                    _c = tied;
                    if (_c) return [3 /*break*/, 9];
                    if (!((_f = v.project) !== null && _f !== void 0)) return [3 /*break*/, 6];
                    _d = _f;
                    return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, projectOf($, v.cwd)];
                case 7:
                    _d = (_g.sent());
                    _g.label = 8;
                case 8:
                    _c = (_d) === here;
                    _g.label = 9;
                case 9:
                    if (_c)
                        kept.push(v);
                    _g.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 5];
                case 11: return [2 /*return*/, kept];
            }
        });
    });
}
// --- Running sessions and tmux windows ---
function listAgents($) {
    return __awaiter(this, void 0, void 0, function () {
        var ran, parsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.process.run(['claude', 'agents', '--json'], { timeoutMs: 15000 }).catch(function () { return undefined; })];
                case 1:
                    ran = _a.sent();
                    if (!ran || ran.exitCode !== 0)
                        return [2 /*return*/, []];
                    try {
                        parsed = JSON.parse(ran.stdout);
                        return [2 /*return*/, Array.isArray(parsed) ? parsed : []];
                    }
                    catch (_b) {
                        return [2 /*return*/, []];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Windows the mod tagged with `@cv_id <sessionId>`, in every tmux session.
function taggedWindows($) {
    return __awaiter(this, void 0, void 0, function () {
        var ran, found, _i, _a, line, _b, win, id;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, $.process.run(['tmux', 'list-windows', '-a', '-F', '#{window_id}\t#{@cv_id}']).catch(function () { return undefined; })];
                case 1:
                    ran = _c.sent();
                    found = {};
                    if (!ran || ran.exitCode !== 0)
                        return [2 /*return*/, found];
                    for (_i = 0, _a = ran.stdout.split('\n'); _i < _a.length; _i++) {
                        line = _a[_i];
                        _b = line.split('\t'), win = _b[0], id = _b[1];
                        if (win && id)
                            found[id] = win;
                    }
                    return [2 /*return*/, found];
            }
        });
    });
}
// Reads both and stores them for the pane; `changed` when anything moved.
function readLive($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, live, windows;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([listAgents($), taggedWindows($)])];
                case 1:
                    _a = _b.sent(), live = _a[0], windows = _a[1];
                    return [2 /*return*/, { live: live, windows: windows, at: Date.now() }];
            }
        });
    });
}
function refresh($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, live, windows, before, changed, state;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, readLive($)];
                case 1:
                    _a = _b.sent(), live = _a.live, windows = _a.windows;
                    return [4 /*yield*/, (0, claude_code_1.read)($, snap)];
                case 2:
                    before = _b.sent();
                    changed = JSON.stringify(before === null || before === void 0 ? void 0 : before.live) !== JSON.stringify(live) || JSON.stringify(before === null || before === void 0 ? void 0 : before.windows) !== JSON.stringify(windows);
                    state = { live: live, windows: windows, at: Date.now() };
                    return [4 /*yield*/, (0, claude_code_1.update)($, snap, function () { return state; })];
                case 3:
                    _b.sent();
                    return [2 /*return*/, { state: state, changed: changed }];
            }
        });
    });
}
// --- Brief, launch, windows ---
function handoffDir($) {
    return __awaiter(this, void 0, void 0, function () {
        var home;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.env.get('HOME')];
                case 1:
                    home = (_a = (_b.sent())) !== null && _a !== void 0 ? _a : '/tmp';
                    return [2 /*return*/, "".concat(home, "/.claude/handoffs")];
            }
        });
    });
}
function briefText(v, brief, parentTitle) {
    var _a;
    return [
        "# Chat verticale: ".concat(v.title),
        '',
        "- slug: `".concat(v.slug, "` \u00B7 sessione: `").concat(v.sessionId || 'in avvio', "`").concat(v.agentId ? " (id `".concat(v.agentId, "`)") : '', " \u00B7 modello: ").concat(v.model),
        "- creata: ".concat(v.createdAt, " \u00B7 da: ").concat(parentTitle),
        v.pacaRef || v.pacaTaskId
            ? "- task PACA: ".concat((_a = v.pacaRef) !== null && _a !== void 0 ? _a : '', " ").concat(v.pacaTaskId ? "(`".concat(v.pacaTaskId, "`)") : '').trim()
            : '- task PACA: nessuno',
        "- cwd: `".concat(v.cwd, "`"),
        '',
        '## Scope (confini della chat)',
        '',
        v.scope,
        '',
        '## Brief',
        '',
        brief.trim(),
        '',
    ].join('\n');
}
function launchPrompt(v) {
    return ("Sei la chat verticale \u00AB".concat(v.title, "\u00BB (slug ").concat(v.slug, "). ") +
        "Leggi il brief in ".concat(v.briefPath, ", poi conferma in 3 righe obiettivo, stato e prossimo passo, ") +
        "e chiedimi se procedere. Resta nello scope dichiarato nel brief.");
}
var inTmux = function ($) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
    switch (_b.label) {
        case 0:
            _a = Boolean;
            return [4 /*yield*/, $.env.get('TMUX')];
        case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])
            // Starts the vertical as a background session; resolves its short id and uuid.
            // `--bg` picks the session id itself, so it is read back from `claude agents`.
        ];
    }
}); }); };
// Starts the vertical as a background session; resolves its short id and uuid.
// `--bg` picks the session id itself, so it is read back from `claude agents`.
function launch($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var ran, agentId, i, found;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.process.run(['claude', '--bg', '-n', (0, panel_1.sessionName)(v.title, v.pacaRef), '--model', v.model, launchPrompt(v)], { cwd: v.cwd, timeoutMs: 60000 })];
                case 1:
                    ran = _b.sent();
                    agentId = (_a = /backgrounded\s+·\s+([\w-]+)/.exec(ran.stdout)) === null || _a === void 0 ? void 0 : _a[1];
                    if (ran.exitCode !== 0 || !agentId)
                        throw new Error("avvio fallito: ".concat((ran.stderr || ran.stdout).trim().slice(0, 300)));
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < 5)) return [3 /*break*/, 6];
                    return [4 /*yield*/, listAgents($)];
                case 3:
                    found = (_b.sent()).find(function (a) { return a.id === agentId; });
                    if (found)
                        return [2 /*return*/, { agentId: agentId, sessionId: found.sessionId }];
                    return [4 /*yield*/, $.clock.sleep(1000)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 2];
                case 6: throw new Error("sessione ".concat(agentId, " avviata ma non trovata in `claude agents`"));
            }
        });
    });
}
// Opens a tmux window attached to the vertical (by id, never by name: attach
// also takes part of a name) and tags it with `@cv_id` to find it again.
function openWindow($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, ran, win;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = !v.agentId;
                    if (_a) return [3 /*break*/, 2];
                    return [4 /*yield*/, inTmux($)];
                case 1:
                    _a = !(_b.sent());
                    _b.label = 2;
                case 2:
                    if (_a)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, $.process.run([
                            'tmux', 'new-window', '-P', '-F', '#{window_id}', '-n', (0, panel_1.windowName)(v.title, v.pacaRef), '-c', v.cwd,
                            'claude', 'attach', v.agentId,
                        ])];
                case 3:
                    ran = _b.sent();
                    win = ran.stdout.trim();
                    if (ran.exitCode !== 0 || !win) {
                        $.ui.log("tmux new-window failed: ".concat(ran.stderr.slice(0, 200)), { to: 'debug' });
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, $.process.run(['tmux', 'set-option', '-w', '-t', win, '@cv_id', v.sessionId])];
                case 4:
                    _b.sent();
                    return [2 /*return*/, true];
            }
        });
    });
}
var attachCommand = function (v) { return (v.agentId ? "claude attach ".concat(v.agentId) : "claude --resume ".concat(v.sessionId)); };
function startHandoff($, input) {
    return __awaiter(this, void 0, void 0, function () {
        var slug, parentId, parent, existing, choice, sent, _a, _b, _c, _d, _e, _f, opened_1, model, confirm, v, _g, _h, _j, from, _k, _l, _m, opened, where;
        var _o;
        var _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    slug = slugify(input.slug || input.title);
                    return [4 /*yield*/, $.session.id()];
                case 1:
                    parentId = _q.sent();
                    return [4 /*yield*/, $.store.get(verticalKey(parentId))];
                case 2:
                    parent = (_q.sent());
                    return [4 /*yield*/, projectVerticals($)];
                case 3:
                    existing = (_q.sent()).find(function (v) { return v.slug === slug && v.status !== 'done'; });
                    if (!existing) return [3 /*break*/, 10];
                    return [4 /*yield*/, $.ui.ask("Esiste gi\u00E0 la chat verticale \u00AB".concat(existing.title, "\u00BB. Cosa faccio?"), { header: 'Verticale', options: ['Riusa quella esistente', 'Annulla'] })];
                case 4:
                    choice = _q.sent();
                    if (choice !== 'Riusa quella esistente')
                        return [2 /*return*/, 'Handoff annullato dall\'utente.'];
                    return [4 /*yield*/, $.session.send({
                            to: { sessionId: existing.sessionId },
                            text: "Aggiornamento dalla chat madre:\n\n".concat(input.brief),
                        })];
                case 5:
                    sent = _q.sent();
                    if (sent.isDelivered)
                        return [2 /*return*/, "Brief inviato alla chat verticale esistente \u00AB".concat(existing.slug, "\u00BB (in esecuzione).")];
                    _b = (_a = $.fs).write;
                    _c = [existing.briefPath];
                    _e = "".concat;
                    return [4 /*yield*/, $.fs.read(existing.briefPath)];
                case 6:
                    _f = (_d = _e.apply("", [_q.sent(), "\n## Aggiornamento "])).concat;
                    return [4 /*yield*/, today($)];
                case 7: return [4 /*yield*/, _b.apply(_a, _c.concat([_f.apply(_d, [_q.sent(), "\n\n"]).concat(input.brief.trim(), "\n")]))];
                case 8:
                    _q.sent();
                    return [4 /*yield*/, openWindow($, existing)];
                case 9:
                    opened_1 = _q.sent();
                    return [2 /*return*/, ("Chat verticale \u00AB".concat(existing.slug, "\u00BB non raggiungibile: aggiornamento aggiunto al brief ").concat(existing.briefPath, ". ") +
                            (opened_1 ? 'Riaperta in una finestra tmux.' : "Riaprila con `".concat(attachCommand(existing), "`.")))];
                case 10:
                    model = input.model && MODELS.includes(input.model) ? input.model : 'sonnet';
                    return [4 /*yield*/, $.ui.ask("Apro una nuova chat verticale \u00AB".concat(input.title, "\u00BB (").concat(model, ")?"), { header: 'Handoff', options: ['Sì, apri', 'No'] })];
                case 11:
                    confirm = _q.sent();
                    if (confirm !== 'Sì, apri')
                        return [2 /*return*/, 'Handoff annullato dall\'utente: resta in questa chat.'];
                    _o = {
                        slug: slug,
                        title: input.title,
                        scope: input.scope,
                        sessionId: '',
                        parentSessionId: parentId
                    };
                    _g = input.cwd;
                    if (_g) return [3 /*break*/, 13];
                    return [4 /*yield*/, $.session.cwd()];
                case 12:
                    _g = (_q.sent());
                    _q.label = 13;
                case 13:
                    _o.cwd = _g,
                        _o.model = model;
                    _h = "".concat;
                    return [4 /*yield*/, handoffDir($)];
                case 14:
                    _o.briefPath = _h.apply("", [_q.sent(), "/"]).concat(slug, ".md"),
                        _o.pacaTaskId = input.paca_task_id,
                        _o.pacaRef = input.paca_ref,
                        _o.status = 'active';
                    return [4 /*yield*/, today($)];
                case 15:
                    v = (_o.createdAt = _q.sent(),
                        _o);
                    _j = v;
                    return [4 /*yield*/, projectOf($, v.cwd)];
                case 16:
                    _j.project = _q.sent();
                    from = parent ? "verticale ".concat(parent.slug) : "sessione ".concat(parentId);
                    // The brief exists before the launch: the new chat reads it on its first turn.
                    return [4 /*yield*/, $.fs.write(v.briefPath, briefText(v, input.brief, from))];
                case 17:
                    // The brief exists before the launch: the new chat reads it on its first turn.
                    _q.sent();
                    _l = (_k = Object).assign;
                    _m = [v];
                    return [4 /*yield*/, launch($, v)];
                case 18:
                    _l.apply(_k, _m.concat([_q.sent()]));
                    return [4 /*yield*/, $.fs.write(v.briefPath, briefText(v, input.brief, from))];
                case 19:
                    _q.sent();
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), v)];
                case 20:
                    _q.sent();
                    if (!!parent) return [3 /*break*/, 22];
                    return [4 /*yield*/, claimHub($)];
                case 21:
                    _q.sent();
                    _q.label = 22;
                case 22: return [4 /*yield*/, bump($)];
                case 23:
                    _q.sent();
                    void openPane($).catch(function () { return undefined; });
                    return [4 /*yield*/, openWindow($, v)];
                case 24:
                    opened = _q.sent();
                    where = opened
                        ? "avviata in background e aperta nella finestra tmux \u00AB".concat((0, panel_1.windowName)(v.title, v.pacaRef), "\u00BB")
                        : "avviata in background (`claude attach ".concat(v.agentId, "` per aprirla)");
                    return [2 /*return*/, ("Chat verticale \u00AB".concat(v.slug, "\u00BB ").concat(where, ". Brief: ").concat(v.briefPath, ". ") +
                            (v.pacaTaskId
                                ? "Aggiungi ora un commento al task PACA ".concat((_p = v.pacaRef) !== null && _p !== void 0 ? _p : v.pacaTaskId, " che dice che il lavoro prosegue nella chat verticale \u00AB").concat(v.slug, "\u00BB.")
                                : ''))];
            }
        });
    });
}
// This chat becomes its project's hub (mother): `hub:<project>` points at it,
// it is renamed `hub-<repo>` and its tmux window `hub`. Another live hub keeps
// the role; this chat then stays a mother of its own children only.
function claimHub($) {
    return __awaiter(this, void 0, void 0, function () {
        var id, project, _a, _b, current, agents, name, pane;
        var _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0: return [4 /*yield*/, thisVertical($)];
                case 1:
                    if (_f.sent())
                        return [2 /*return*/];
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    id = _f.sent();
                    _a = projectOf;
                    _b = [$];
                    return [4 /*yield*/, $.session.cwd()];
                case 3: return [4 /*yield*/, _a.apply(void 0, _b.concat([_f.sent()]))];
                case 4:
                    project = _f.sent();
                    return [4 /*yield*/, $.store.get(hubKey(project))];
                case 5:
                    current = (_f.sent());
                    return [4 /*yield*/, listAgents($)];
                case 6:
                    agents = _f.sent();
                    if (current && current !== id && agents.some(function (a) { return a.sessionId === current; }))
                        return [2 /*return*/];
                    return [4 /*yield*/, $.store.set(hubKey(project), id)];
                case 7:
                    _f.sent();
                    name = "hub-".concat((_c = project.split('/').filter(Boolean).pop()) !== null && _c !== void 0 ? _c : 'progetto');
                    if (!((_e = (_d = agents.find(function (a) { return a.sessionId === id; })) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.startsWith('hub-'))) {
                        // A command cannot run inside a hook the turn waits on: queue it.
                        $.clock.after(1000, function () { return void $.command.run({ command: 'rename', args: name }).catch(function () { return undefined; }); });
                    }
                    return [4 /*yield*/, $.env.get('TMUX_PANE')];
                case 8:
                    pane = _f.sent();
                    if (!pane) return [3 /*break*/, 10];
                    return [4 /*yield*/, $.process.run(['tmux', 'rename-window', '-t', pane, 'hub']).catch(function () { return undefined; })];
                case 9:
                    _f.sent();
                    _f.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Old mothers that are gone (not running, not a vertical themselves) hand their
// open children and their inbox to the project's hub.
function adoptOrphans($, live) {
    return __awaiter(this, void 0, void 0, function () {
        var id, project, _a, _b, alive, all, verticals, gone, _i, _c, v, p, _d, gone_1, p;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, $.session.id()];
                case 1:
                    id = _e.sent();
                    _a = projectOf;
                    _b = [$];
                    return [4 /*yield*/, $.session.cwd()];
                case 2: return [4 /*yield*/, _a.apply(void 0, _b.concat([_e.sent()]))];
                case 3:
                    project = _e.sent();
                    return [4 /*yield*/, $.store.get(hubKey(project))];
                case 4:
                    if ((_e.sent()) !== id)
                        return [2 /*return*/];
                    alive = new Set(live.map(function (a) { return a.sessionId; }));
                    return [4 /*yield*/, allVerticals($)];
                case 5:
                    all = _e.sent();
                    verticals = new Set(all.map(function (v) { return v.sessionId; }));
                    gone = new Set();
                    _i = 0;
                    return [4 /*yield*/, projectVerticals($)];
                case 6:
                    _c = _e.sent();
                    _e.label = 7;
                case 7:
                    if (!(_i < _c.length)) return [3 /*break*/, 10];
                    v = _c[_i];
                    p = v.parentSessionId;
                    if (v.status === 'done' || !p || p === id || alive.has(p) || verticals.has(p))
                        return [3 /*break*/, 9];
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { parentSessionId: id }))];
                case 8:
                    _e.sent();
                    gone.add(p);
                    _e.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    _d = 0, gone_1 = gone;
                    _e.label = 11;
                case 11:
                    if (!(_d < gone_1.length)) return [3 /*break*/, 14];
                    p = gone_1[_d];
                    return [4 /*yield*/, moveInbox($, p, id)];
                case 12:
                    _e.sent();
                    _e.label = 13;
                case 13:
                    _d++;
                    return [3 /*break*/, 11];
                case 14:
                    if (!gone.size) return [3 /*break*/, 16];
                    return [4 /*yield*/, bump($)];
                case 15:
                    _e.sent();
                    _e.label = 16;
                case 16: return [2 /*return*/];
            }
        });
    });
}
function finishVertical($, input) {
    return __awaiter(this, void 0, void 0, function () {
        var v, status, _a, _b, _c, _d, _e, _f, parentNote, text, sent, paca, close;
        var _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0: return [4 /*yield*/, thisVertical($)];
                case 1:
                    v = _j.sent();
                    if (!v)
                        return [2 /*return*/, 'Questa chat non è una chat verticale: niente da chiudere.'];
                    status = (_g = input.status) !== null && _g !== void 0 ? _g : 'done';
                    _b = (_a = $.fs).write;
                    _c = [v.briefPath];
                    _e = "".concat;
                    return [4 /*yield*/, $.fs.read(v.briefPath)];
                case 2:
                    _f = (_d = _e.apply("", [_j.sent(), "\n## Esito ("]).concat(status, ", ")).concat;
                    return [4 /*yield*/, today($)];
                case 3: return [4 /*yield*/, _b.apply(_a, _c.concat([_f.apply(_d, [_j.sent(), ")\n\n"]).concat(input.summary.trim(), "\n")]))];
                case 4:
                    _j.sent();
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { status: status }))];
                case 5:
                    _j.sent();
                    parentNote = 'nessuna chat madre registrata';
                    if (!v.parentSessionId) return [3 /*break*/, 9];
                    text = "[chat verticale \u00AB".concat(v.slug, "\u00BB \u2014 ").concat(status, "]\n\n").concat(input.summary.trim(), "\n\nBrief completo: ").concat(v.briefPath);
                    return [4 /*yield*/, $.session.send({ to: { sessionId: v.parentSessionId }, text: text })];
                case 6:
                    sent = _j.sent();
                    if (!sent.isDelivered) return [3 /*break*/, 7];
                    parentNote = 'riepilogo inviato alla chat madre';
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, enqueue($, inboxKey(v.parentSessionId), text)];
                case 8:
                    _j.sent();
                    parentNote = "chat madre non raggiunta (".concat(sent.reason, "): il riepilogo le arriver\u00E0 quando si riapre");
                    _j.label = 9;
                case 9:
                    paca = v.pacaTaskId
                        ? " Ora aggiungi il riepilogo come commento al task PACA ".concat((_h = v.pacaRef) !== null && _h !== void 0 ? _h : v.pacaTaskId, " (`").concat(v.pacaTaskId, "`) e aggiorna lo stato secondo la skill paca-workflow del repo.")
                        : '';
                    return [4 /*yield*/, $.store.set(closeKey(v.sessionId), status)];
                case 10:
                    _j.sent();
                    close = status === 'done'
                        ? ' A fine turno la finestra tmux di questa chat si chiude e la sessione si ferma: completa ora, in questo turno, ciò che resta (PACA compreso) e non fare domande all\'utente.'
                        : v.agentId ? ' A fine turno la finestra tmux si chiude; la sessione resta viva e si riapre dall\'hub.' : '';
                    return [2 /*return*/, "Verticale \u00AB".concat(v.slug, "\u00BB segnata ").concat(status, "; ").concat(parentNote, ".").concat(paca).concat(close)];
            }
        });
    });
}
// Queues a summary in a session's inbox (store, read by that session later).
function enqueue($, key, text) {
    return __awaiter(this, void 0, void 0, function () {
        var queued;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.store.get(key)];
                case 1:
                    queued = (_a = (_b.sent())) !== null && _a !== void 0 ? _a : [];
                    return [4 /*yield*/, $.store.set(key, __spreadArray(__spreadArray([], queued, true), [text], false))];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function moveInbox($, from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var queued, _i, queued_1, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.store.get(inboxKey(from))];
                case 1:
                    queued = (_a.sent());
                    if (!queued)
                        return [2 /*return*/];
                    return [4 /*yield*/, $.store.delete(inboxKey(from))];
                case 2:
                    _a.sent();
                    _i = 0, queued_1 = queued;
                    _a.label = 3;
                case 3:
                    if (!(_i < queued_1.length)) return [3 /*break*/, 6];
                    text = queued_1[_i];
                    return [4 /*yield*/, enqueue($, inboxKey(to), text)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Delivers the summaries queued for this session while it was closed.
function deliverInbox($) {
    return __awaiter(this, void 0, void 0, function () {
        var key, _a, queued, _i, queued_2, text;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = inboxKey;
                    return [4 /*yield*/, $.session.id()];
                case 1:
                    key = _a.apply(void 0, [_b.sent()]);
                    return [4 /*yield*/, $.store.get(key)];
                case 2:
                    queued = (_b.sent());
                    if (!(queued === null || queued === void 0 ? void 0 : queued.length))
                        return [2 /*return*/];
                    return [4 /*yield*/, $.store.delete(key)];
                case 3:
                    _b.sent();
                    _i = 0, queued_2 = queued;
                    _b.label = 4;
                case 4:
                    if (!(_i < queued_2.length)) return [3 /*break*/, 7];
                    text = queued_2[_i];
                    return [4 /*yield*/, $.session.append({ message: { type: 'user', content: [{ type: 'text', text: text }] } })];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    $.ui.toast("Arrivati ".concat(queued.length, " esiti di chat verticali"));
                    return [2 /*return*/];
            }
        });
    });
}
// After a /clear the session goes on under a new id: move the links (children's
// mother, this session's own record, its inbox, the hub role) to the new one.
function relink($, oldId) {
    return __awaiter(this, void 0, void 0, function () {
        var newId, _i, _a, v, own, project, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, $.session.id()];
                case 1:
                    newId = _d.sent();
                    if (newId === oldId)
                        return [2 /*return*/, false];
                    _i = 0;
                    return [4 /*yield*/, allVerticals($)];
                case 2:
                    _a = _d.sent();
                    _d.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    v = _a[_i];
                    if (!(v.parentSessionId === oldId)) return [3 /*break*/, 5];
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { parentSessionId: newId }))];
                case 4:
                    _d.sent();
                    _d.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [4 /*yield*/, $.store.get(verticalKey(oldId))];
                case 7:
                    own = (_d.sent());
                    if (!own) return [3 /*break*/, 10];
                    return [4 /*yield*/, $.store.delete(verticalKey(oldId))];
                case 8:
                    _d.sent();
                    return [4 /*yield*/, $.store.set(verticalKey(newId), __assign(__assign({}, own), { sessionId: newId }))];
                case 9:
                    _d.sent();
                    _d.label = 10;
                case 10: return [4 /*yield*/, moveInbox($, oldId, newId)];
                case 11:
                    _d.sent();
                    _b = projectOf;
                    _c = [$];
                    return [4 /*yield*/, $.session.cwd()];
                case 12: return [4 /*yield*/, _b.apply(void 0, _c.concat([_d.sent()]))];
                case 13:
                    project = _d.sent();
                    return [4 /*yield*/, $.store.get(hubKey(project))];
                case 14:
                    if (!((_d.sent()) === oldId)) return [3 /*break*/, 16];
                    return [4 /*yield*/, $.store.set(hubKey(project), newId)];
                case 15:
                    _d.sent();
                    _d.label = 16;
                case 16: return [2 /*return*/, true];
            }
        });
    });
}
// v1.0 vertical, at the end of the turn that called vertical_done: close its
// window(s) and, when done, stop the session. A detached shell runs it a few
// seconds on, so the last answer can be read and the stop outlives this process.
function closeBackground($, v, stop) {
    return __awaiter(this, void 0, void 0, function () {
        var win, steps, ran;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, taggedWindows($)];
                case 1:
                    win = (_a.sent())[v.sessionId];
                    steps = ["sleep ".concat(CLOSE_DELAY_S)];
                    if (win && SAFE.test(win))
                        steps.push("tmux kill-window -t '".concat(win, "'"));
                    if (stop && v.agentId && SAFE.test(v.agentId))
                        steps.push("claude stop '".concat(v.agentId, "'"));
                    if (steps.length === 1)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, $.process.run(['setsid', '-f', 'sh', '-c', "exec >/dev/null 2>&1; ".concat(steps.join('; '))])];
                case 2:
                    ran = _a.sent();
                    return [2 /*return*/, ran.exitCode === 0];
            }
        });
    });
}
// v0.3 vertical: closes its own tmux pane, a few seconds on so the last answer
// can be read; only a pane the mod opened for it (its start command names the session).
function closePane($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var pane, ran, socket, tmux, killed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.env.get('TMUX_PANE')];
                case 1:
                    pane = _b.sent();
                    if (!pane)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, $.process.run(['tmux', 'display-message', '-p', '-t', pane, '#{pane_start_command}'])];
                case 2:
                    ran = _b.sent();
                    if (ran.exitCode !== 0 || !ran.stdout.includes(v.sessionId))
                        return [2 /*return*/, false
                            // The tmux server runs the kill: it outlives this process. Same socket as ours.
                        ];
                    return [4 /*yield*/, $.env.get('TMUX')];
                case 3:
                    socket = ((_a = (_b.sent())) !== null && _a !== void 0 ? _a : '').split(',')[0];
                    tmux = socket ? "tmux -S '".concat(socket, "'") : 'tmux';
                    return [4 /*yield*/, $.process.run(['tmux', 'run-shell', '-b', "sleep ".concat(CLOSE_DELAY_S, "; ").concat(tmux, " kill-pane -t '").concat(pane, "'")])];
                case 4:
                    killed = _b.sent();
                    return [2 /*return*/, killed.exitCode === 0];
            }
        });
    });
}
// --- Hub actions ---
// Vai/Apri: select the vertical's window, or open one attached to it. A v0.3
// vertical has no tagged window: its window is found by slug, as before.
function goTo($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var command, offer, ran, win, _a;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    command = attachCommand(v);
                    offer = function (why) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, $.ui.copy({ text: command })];
                                case 1:
                                    _a.sent();
                                    $.ui.toast("".concat(why, ": copiato \"").concat(command, "\""));
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, inTmux($)];
                case 1:
                    if (!(_b.sent()))
                        return [2 /*return*/, offer('Fuori da tmux')];
                    if (!!v.agentId) return [3 /*break*/, 5];
                    return [4 /*yield*/, $.process.run(['tmux', 'select-window', '-t', v.slug])];
                case 2:
                    ran = _b.sent();
                    if (!(ran.exitCode !== 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, offer("Finestra \u00AB".concat(v.slug, "\u00BB non trovata"))];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/];
                case 5: return [4 /*yield*/, taggedWindows($)];
                case 6:
                    win = (_b.sent())[v.sessionId];
                    _a = win;
                    if (!_a) return [3 /*break*/, 8];
                    return [4 /*yield*/, $.process.run(['tmux', 'select-window', '-t', win])];
                case 7:
                    _a = (_b.sent()).exitCode === 0;
                    _b.label = 8;
                case 8:
                    if (_a)
                        return [2 /*return*/];
                    if (!(v.status === 'paused')) return [3 /*break*/, 10];
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { status: 'active' }))];
                case 9:
                    _b.sent();
                    _b.label = 10;
                case 10: return [4 /*yield*/, openWindow($, v)];
                case 11:
                    if (!(_b.sent()))
                        return [2 /*return*/, offer('Finestra non aperta')];
                    return [4 /*yield*/, refresh($)];
                case 12:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Nascondi: close the window, the session stays alive. No confirmation.
function hide($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var win;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!v.agentId)
                        return [2 /*return*/, $.ui.toast("\u00AB".concat(v.slug, "\u00BB \u00E8 una verticale v0.3: non si pu\u00F2 nascondere"))];
                    return [4 /*yield*/, taggedWindows($)];
                case 1:
                    win = (_a.sent())[v.sessionId];
                    if (!win)
                        return [2 /*return*/, $.ui.toast("\u00AB".concat(v.slug, "\u00BB \u00E8 gi\u00E0 nascosta"))];
                    return [4 /*yield*/, $.process.run(['tmux', 'kill-window', '-t', win])];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refresh($)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Stop: stop the session (its conversation is kept), with its window.
function stopVertical($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var ok, win, ran;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!v.agentId)
                        return [2 /*return*/, $.ui.toast("\u00AB".concat(v.slug, "\u00BB \u00E8 una verticale v0.3: chiudila dalla sua finestra"))];
                    return [4 /*yield*/, $.ui.ask("Fermo la sessione di \u00AB".concat(v.title, "\u00BB? La cronologia resta."), { header: 'Stop', options: ['Sì, ferma', 'No'] })];
                case 1:
                    ok = _a.sent();
                    if (ok !== 'Sì, ferma')
                        return [2 /*return*/];
                    return [4 /*yield*/, taggedWindows($)];
                case 2:
                    win = (_a.sent())[v.sessionId];
                    if (!win) return [3 /*break*/, 4];
                    return [4 /*yield*/, $.process.run(['tmux', 'kill-window', '-t', win])];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [4 /*yield*/, $.process.run(['claude', 'stop', v.agentId])];
                case 5:
                    ran = _a.sent();
                    $.ui.toast(ran.exitCode === 0 ? "Fermata \u00AB".concat(v.slug, "\u00BB") : "Stop non riuscito: ".concat((ran.stderr || ran.stdout).trim().slice(0, 120)));
                    return [4 /*yield*/, refresh($)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Chiudi: ask the vertical to call vertical_done (it then stops itself); one
// that cannot be reached is marked done here and stopped.
function closeVertical($, v) {
    return __awaiter(this, void 0, void 0, function () {
        var ok, sent, win;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.ui.ask("Chiudo la verticale \u00AB".concat(v.title, "\u00BB? Le chiedo il riepilogo finale, poi si ferma."), { header: 'Chiudi', options: ['Sì, chiudi', 'No'] })];
                case 1:
                    ok = _a.sent();
                    if (ok !== 'Sì, chiudi')
                        return [2 /*return*/];
                    return [4 /*yield*/, $.session.send({
                            to: { sessionId: v.sessionId },
                            text: '[chat-verticali] L\'hub chiede di chiudere questa verticale: completa ciò che resta in questo turno, poi chiama `vertical_done` (status done) con il riepilogo. Non fare domande.',
                        })];
                case 2:
                    sent = _a.sent();
                    if (sent.isDelivered)
                        return [2 /*return*/, $.ui.toast("Chiesto a \u00AB".concat(v.slug, "\u00BB di chiudersi"))];
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { status: 'done' }))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, taggedWindows($)];
                case 4:
                    win = (_a.sent())[v.sessionId];
                    if (!win) return [3 /*break*/, 6];
                    return [4 /*yield*/, $.process.run(['tmux', 'kill-window', '-t', win])];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    if (!v.agentId) return [3 /*break*/, 8];
                    return [4 /*yield*/, $.process.run(['claude', 'stop', v.agentId])];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8:
                    $.ui.toast("\u00AB".concat(v.slug, "\u00BB non raggiungibile: segnata chiusa senza riepilogo"));
                    return [4 /*yield*/, bump($)];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// The hub pane opens by itself only in a chat that is not a vertical and has
// open verticals of its own (or is the project's hub). Verticals keep `⟂ slug`.
function isHub($) {
    return __awaiter(this, void 0, void 0, function () {
        var id, project, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, thisVertical($)];
                case 1:
                    if (_c.sent())
                        return [2 /*return*/, false];
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    id = _c.sent();
                    _a = projectOf;
                    _b = [$];
                    return [4 /*yield*/, $.session.cwd()];
                case 3: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                case 4:
                    project = _c.sent();
                    return [4 /*yield*/, $.store.get(hubKey(project))];
                case 5:
                    if ((_c.sent()) === id)
                        return [2 /*return*/, true];
                    return [4 /*yield*/, allVerticals($)];
                case 6: return [2 /*return*/, (_c.sent()).some(function (v) { return v.status !== 'done' && v.parentSessionId === id; })];
            }
        });
    });
}
var openPane = function ($) { return $.ui.open({ id: PANE, title: PANE_TITLE, columns: PANE_COLUMNS }); };
function rulesSection(v) {
    var _a;
    var common = [
        'Regole chat verticali (mod chat-verticali, approvate da Ale):',
        '- Una chat = un verticale: un task/epic PACA, un argomento, una funzione o area di un repo.',
        '- Subagent (skill multi-agent) per lavoro a risultato singolo senza dialogo; chat verticale per lavoro continuativo che richiede decisioni dell\'utente.',
        '- Quando la richiesta esce dal verticale, quando si passa a un task PACA diverso, o quando il contesto supera il 60%: PROPONI all\'utente di passare a una chat verticale e, se d\'accordo, chiama il tool `mcp__chat-verticali__handoff`. Non chiamarlo senza proporlo prima; il tool chiede comunque conferma.',
        '- Il brief del handoff (1-2k token) deve bastare da solo: obiettivo e criterio di fatto, decisioni prese, stato attuale, file/branch/worktree, ID PACA, domande aperte, regole del repo rilevanti, cosa NON fare.',
        '- Modello della nuova chat: sonnet di default, opus per design o lavoro ad alto rischio, haiku solo per lavoro meccanico (tabella della skill multi-agent).',
    ];
    if (!v)
        return common.join('\n');
    return __spreadArray(__spreadArray([], common, true), [
        '',
        "QUESTA CHAT \u00C8 VERTICALE: \u00AB".concat(v.title, "\u00BB (slug ").concat(v.slug, ")."),
        "Scope: ".concat(v.scope),
        v.pacaTaskId ? "Task PACA: ".concat((_a = v.pacaRef) !== null && _a !== void 0 ? _a : '', " `").concat(v.pacaTaskId, "`") : '',
        "Brief: ".concat(v.briefPath),
        '- Resta nello scope. Se l\'utente chiede altro, rispondi brevemente solo se banale, altrimenti proponi un handoff verso un\'altra chat verticale.',
        '- A lavoro concluso (o se va messo in pausa) chiama `mcp__chat-verticali__vertical_done` con un riepilogo: cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto. Poi commenta il task PACA.',
    ], false).filter(Boolean).join('\n');
}
// The id a /clear left behind, until the poll has moved its links.
var clearedFrom;
// The hub row the focus ring is on: the target of the a/h/s/x hotkeys.
var selected;
var register = function (on) {
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var status, showStatus, signature;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.tool.register({
                        name: TOOL_HANDOFF,
                        description: 'Passa il contesto a una NUOVA chat verticale (sessione in background, aperta in una finestra tmux) specializzata su un task PACA, un argomento o una funzione. ' +
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
                                model: { type: 'string', enum: __spreadArray([], MODELS, true), description: 'Modello della nuova chat (default sonnet).' },
                                cwd: { type: 'string', description: 'Directory di lavoro assoluta (repo o worktree); default la cwd di questa sessione.' },
                            },
                            required: ['slug', 'title', 'scope', 'brief'],
                        },
                    })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, $.tool.register({
                            name: TOOL_DONE,
                            description: 'Chiude (o mette in pausa) questa chat verticale: salva il riepilogo nel brief e lo invia alla chat madre. Usalo a lavoro concluso.',
                            isDeferred: false,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    summary: { type: 'string', description: 'Cosa è stato fatto, file/commit, deploy sì/no, cosa resta aperto.' },
                                    status: { type: 'string', enum: ['done', 'paused'] },
                                },
                                required: ['summary'],
                            },
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, $.command.register({ name: 'handoff', description: 'Passa il contesto su <tema> a una nuova chat verticale' })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, $.command.register({ name: 'verticali', description: 'Apre l\'hub delle chat verticali di questo progetto (`tutte` per l\'elenco di ogni progetto)' })
                        // A vertical shows `⟂ slug`; its record may land a moment after its start.
                    ];
                case 4:
                    _a.sent();
                    status = '';
                    showStatus = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var v, text;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, thisVertical($)];
                                case 1:
                                    v = _a.sent();
                                    text = v ? "\u27C2 ".concat(v.slug) : '';
                                    if (text !== status)
                                        $.ui.status((status = text) || undefined);
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, showStatus()
                        // One poll: relink after a /clear, deliver queued summaries, keep the
                        // vertical's status line, and in the hub read sessions and windows.
                    ];
                case 5:
                    _a.sent();
                    signature = '';
                    $.clock.every(POLL_MS, function () {
                        void (function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _a, list, now, changed, fresh;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = clearedFrom;
                                        if (!_a) return [3 /*break*/, 2];
                                        return [4 /*yield*/, relink($, clearedFrom)];
                                    case 1:
                                        _a = (_b.sent());
                                        _b.label = 2;
                                    case 2:
                                        if (_a)
                                            clearedFrom = undefined;
                                        return [4 /*yield*/, deliverInbox($)];
                                    case 3:
                                        _b.sent();
                                        return [4 /*yield*/, showStatus()];
                                    case 4:
                                        _b.sent();
                                        return [4 /*yield*/, projectVerticals($)];
                                    case 5:
                                        list = _b.sent();
                                        now = JSON.stringify(list);
                                        changed = now !== signature;
                                        signature = now;
                                        return [4 /*yield*/, thisVertical($)];
                                    case 6:
                                        if (!(!(_b.sent()) && list.some(function (v) { return v.status !== 'done'; }))) return [3 /*break*/, 9];
                                        return [4 /*yield*/, refresh($)];
                                    case 7:
                                        fresh = _b.sent();
                                        if (fresh.changed)
                                            changed = true;
                                        return [4 /*yield*/, adoptOrphans($, fresh.state.live)];
                                    case 8:
                                        _b.sent();
                                        _b.label = 9;
                                    case 9:
                                        if (!changed) return [3 /*break*/, 11];
                                        return [4 /*yield*/, bump($)];
                                    case 10:
                                        _b.sent();
                                        _b.label = 11;
                                    case 11: return [2 /*return*/];
                                }
                            });
                        }); })().catch(function () { return undefined; });
                    });
                    return [4 /*yield*/, isHub($)];
                case 6:
                    if (_a.sent())
                        void openPane($).catch(function () { return undefined; });
                    return [4 /*yield*/, deliverInbox($).catch(function () { return undefined; })];
                case 7:
                    _a.sent();
                    return [2 /*return*/, next(e)];
            }
        });
    }); });
    // A /clear ends the conversation and goes on under a new id, with no
    // session.start: remember the old id, the poll relinks once the id changed.
    on('session.end', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (e.reason === 'clear')
                clearedFrom = e.sessionId;
            return [2 /*return*/, next(e)];
        });
    }); });
    // A vertical keeps its own context fill in its registry record, for the hub.
    on('session.measure', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var percent, v, at, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    percent = e.context.percent;
                    if (!(e.changed.includes('context') && percent !== undefined)) return [3 /*break*/, 8];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, thisVertical($)];
                case 2:
                    v = _c.sent();
                    if (!(v && v.contextPercent !== percent)) return [3 /*break*/, 6];
                    _a = Date.bind;
                    return [4 /*yield*/, $.clock.now()];
                case 3:
                    at = new (_a.apply(Date, [void 0, _c.sent()]))().toISOString();
                    return [4 /*yield*/, $.store.set(verticalKey(v.sessionId), __assign(__assign({}, v), { contextPercent: percent, contextAt: at }))];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, bump($)];
                case 5:
                    _c.sent();
                    _c.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    _b = _c.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('prompt.compose', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var composed, text, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    composed = _b.sent();
                    _a = rulesSection;
                    return [4 /*yield*/, thisVertical($)];
                case 2:
                    text = _a.apply(void 0, [_b.sent()]);
                    return [2 /*return*/, { sections: __spreadArray(__spreadArray([], composed.sections, true), [{ id: 'chat-verticali:rules', text: text, scope: 'session' }], false) }];
            }
        });
    }); });
    on('tool.call', { tool: 'mcp__chat-verticali__handoff' }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = {};
                    return [4 /*yield*/, startHandoff($, e)];
                case 1: return [2 /*return*/, (_a.result = _b.sent(), _a)];
                case 2:
                    err_1 = _b.sent();
                    if (String(err_1).includes('dismissed'))
                        return [2 /*return*/, { result: 'Domanda chiusa senza risposta: handoff non eseguito.' }];
                    return [2 /*return*/, { result: "Handoff fallito: ".concat(String(err_1)), isError: true }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    on('tool.call', { tool: 'mcp__chat-verticali__vertical_done' }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var input;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    input = e;
                    _a = {};
                    return [4 /*yield*/, finishVertical($, input)];
                case 1: return [2 /*return*/, (_a.result = _b.sent(), _a)];
            }
        });
    }); });
    // Trigger: a different PACA task changes status in this chat.
    on('tool.call', { tool: /^mcp__paca(-[\w-]+)?__update_task$/ }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var ran, input, sessionId, v, focus, _a, note;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    ran = _d.sent();
                    input = e;
                    if (ran.deny !== undefined || !input.statusId || !input.taskId)
                        return [2 /*return*/, ran];
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    sessionId = _d.sent();
                    return [4 /*yield*/, thisVertical($)];
                case 3:
                    v = _d.sent();
                    if (!((_b = v === null || v === void 0 ? void 0 : v.pacaTaskId) !== null && _b !== void 0)) return [3 /*break*/, 4];
                    _a = _b;
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, $.store.get(focusKey(sessionId))];
                case 5:
                    _a = (_d.sent());
                    _d.label = 6;
                case 6:
                    focus = _a;
                    if (!!focus) return [3 /*break*/, 8];
                    return [4 /*yield*/, $.store.set(focusKey(sessionId), input.taskId)];
                case 7:
                    _d.sent();
                    return [2 /*return*/, ran];
                case 8:
                    if (focus === input.taskId)
                        return [2 /*return*/, ran];
                    note = "[chat-verticali] Hai cambiato lo stato di un task PACA (`".concat(input.taskId, "`) diverso dal verticale di questa chat (`").concat(focus, "`). ") +
                        'Se stai iniziando a lavorarci, proponi all\'utente di passarlo a una chat verticale dedicata (tool handoff).';
                    return [2 /*return*/, __assign(__assign({}, ran), { context: __spreadArray(__spreadArray([], ((_c = ran.context) !== null && _c !== void 0 ? _c : []), true), [note], false) })];
            }
        });
    }); }).catch(function ($, e, next) { return next(e); });
    // vertical_done: close the window (and, when done, stop the session) once the
    // turn that called it ends. Otherwise: note the activity for the hub and warn
    // when the context window passes the thresholds.
    on('turn.complete', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var done, _a, sessionId, closing, v, closed_1, v, _b, _c, _d, _e, _f, percent, warned, _g, level;
        var _h;
        var _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    done = _k.sent();
                    _a = clearedFrom;
                    if (!_a) return [3 /*break*/, 3];
                    return [4 /*yield*/, relink($, clearedFrom).catch(function () { return false; })];
                case 2:
                    _a = (_k.sent());
                    _k.label = 3;
                case 3:
                    if (_a)
                        clearedFrom = undefined;
                    return [4 /*yield*/, $.session.id()];
                case 4:
                    sessionId = _k.sent();
                    return [4 /*yield*/, $.store.get(closeKey(sessionId))];
                case 5:
                    closing = (_k.sent());
                    if (!(!e.agentId && e.reason === 'answer' && closing)) return [3 /*break*/, 12];
                    return [4 /*yield*/, $.store.delete(closeKey(sessionId))];
                case 6:
                    _k.sent();
                    return [4 /*yield*/, thisVertical($)];
                case 7:
                    v = _k.sent();
                    if (!v)
                        return [2 /*return*/, done];
                    if (!v.agentId) return [3 /*break*/, 9];
                    return [4 /*yield*/, closeBackground($, v, closing !== 'paused').catch(function () { return false; })];
                case 8:
                    closed_1 = _k.sent();
                    $.ui.toast(closed_1 ? "Verticale ".concat(closing === 'paused' ? 'in pausa' : 'chiusa', ": la finestra si chiude tra ").concat(CLOSE_DELAY_S, "s") : 'Verticale chiusa');
                    return [3 /*break*/, 11];
                case 9:
                    if (!(closing !== 'paused')) return [3 /*break*/, 11];
                    return [4 /*yield*/, closePane($, v).catch(function () { return false; })];
                case 10:
                    if (_k.sent())
                        $.ui.toast("Verticale chiusa: la finestra si chiude tra ".concat(CLOSE_DELAY_S, "s"));
                    else
                        $.ui.toast('Verticale chiusa: esci con /exit');
                    _k.label = 11;
                case 11: return [2 /*return*/, done];
                case 12:
                    if (!!e.agentId) return [3 /*break*/, 16];
                    return [4 /*yield*/, thisVertical($).catch(function () { return undefined; })];
                case 13:
                    v = _k.sent();
                    if (!v) return [3 /*break*/, 16];
                    _c = (_b = $.store).set;
                    _d = [verticalKey(v.sessionId)];
                    _e = [__assign({}, v)];
                    _h = {};
                    _f = Date.bind;
                    return [4 /*yield*/, $.clock.now()];
                case 14: return [4 /*yield*/, _c.apply(_b, _d.concat([__assign.apply(void 0, _e.concat([(_h.lastAt = new (_f.apply(Date, [void 0, _k.sent()]))().toISOString(), _h)]))]))];
                case 15:
                    _k.sent();
                    _k.label = 16;
                case 16: return [4 /*yield*/, $.session.usage()];
                case 17:
                    percent = (_k.sent()).context.percent;
                    if (percent === undefined)
                        return [2 /*return*/, done];
                    _g = Number;
                    return [4 /*yield*/, $.store.get(warnKey(sessionId))];
                case 18:
                    warned = _g.apply(void 0, [(_j = (_k.sent())) !== null && _j !== void 0 ? _j : 0]);
                    level = __spreadArray([], CONTEXT_THRESHOLDS, true).reverse().find(function (t) { return percent >= t; });
                    if (!level || level <= warned)
                        return [2 /*return*/, done];
                    return [4 /*yield*/, $.store.set(warnKey(sessionId), level)];
                case 19:
                    _k.sent();
                    $.ui.toast("Contesto al ".concat(percent, "%: valuta un handoff a una chat verticale"));
                    return [4 /*yield*/, $.session.append({
                            message: {
                                type: 'user',
                                content: [{
                                        type: 'text',
                                        text: "[chat-verticali] Il contesto di questa chat \u00E8 al ".concat(percent, "%. Alla prossima risposta proponi all'utente di passare il lavoro in corso a una chat verticale (tool handoff) invece di /compact."),
                                    }],
                            },
                        })];
                case 20:
                    _k.sent();
                    return [2 /*return*/, done];
            }
        });
    }); });
    on('command.run', { command: 'handoff' }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var topic, forked, json, input, err_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    topic = e.args.trim();
                    if (!topic)
                        return [2 /*return*/, { text: 'Uso: /handoff <tema o task da passare a una nuova chat>' }];
                    return [4 /*yield*/, $.model.fork({
                            prompt: "Prepara il passaggio di contesto a una nuova chat verticale sul tema: \"".concat(topic, "\". ") +
                                'Rispondi SOLO con JSON valido, senza testo attorno: ' +
                                '{"slug":"...","title":"titolo breve","scope":"...","brief":"markdown 1-2k token: obiettivo e criterio di fatto, decisioni prese, stato, file/branch/worktree, ID PACA, domande aperte, regole del repo, cosa NON fare","paca_task_id":"uuid o vuoto","paca_ref":"es. ACME-42 o vuoto","model":"sonnet|opus|haiku"}',
                        })];
                case 1:
                    forked = _b.sent();
                    if (!forked.isAnswered)
                        return [2 /*return*/, { text: "Non riesco a preparare il brief (".concat(forked.reason, "). Chiedilo a Claude a parole.") }];
                    json = forked.text.slice(forked.text.indexOf('{'), forked.text.lastIndexOf('}') + 1);
                    try {
                        input = JSON.parse(json);
                    }
                    catch (_c) {
                        return [2 /*return*/, { text: 'Il brief generato non era JSON valido: riprova o chiedilo a Claude a parole.' }];
                    }
                    if (!input.paca_task_id)
                        delete input.paca_task_id;
                    if (!input.paca_ref)
                        delete input.paca_ref;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    _a = {};
                    return [4 /*yield*/, startHandoff($, input)];
                case 3: return [2 /*return*/, (_a.text = _b.sent(), _a)];
                case 4:
                    err_2 = _b.sent();
                    return [2 /*return*/, { text: "Handoff non eseguito: ".concat(String(err_2)) }];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    on('command.run', { command: 'verticali' }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var everywhere, list, _a, rows;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, openPane($).catch(function () { return undefined; })];
                case 1:
                    _b.sent();
                    everywhere = e.args.trim() === 'tutte';
                    if (!!everywhere) return [3 /*break*/, 3];
                    return [4 /*yield*/, claimHub($).catch(function () { return undefined; })];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    if (!everywhere) return [3 /*break*/, 5];
                    return [4 /*yield*/, allVerticals($)];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, projectVerticals($)];
                case 6:
                    _a = _b.sent();
                    _b.label = 7;
                case 7:
                    list = _a;
                    if (list.length === 0)
                        return [2 /*return*/, { text: everywhere ? 'Nessuna chat verticale registrata.' : 'Nessuna chat verticale in questo progetto (`/verticali tutte` per vederle tutte).' }];
                    rows = list
                        .sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); })
                        .map(function (v) { return "".concat((0, panel_1.statusGlyph)(v.status).glyph, " ").concat(v.slug, " \u2014 ").concat(v.title, " [").concat(v.model, ", ").concat(v.createdAt, "]").concat(v.pacaRef ? " ".concat(v.pacaRef) : '', "\n    ").concat(v.briefPath, " \u00B7 ").concat(attachCommand(v)); });
                    return [2 /*return*/, { text: rows.join('\n') }];
            }
        });
    }); });
    // The hotkeys act on the row the focus ring is on.
    on('ui.focus', { requestId: PANE }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var id;
        var _a;
        return __generator(this, function (_b) {
            id = (_a = e.element) === null || _a === void 0 ? void 0 : _a.replace(/^(go|hide)-/, '');
            if (id && id !== e.element)
                selected = id;
            return [2 /*return*/, next(e)];
        });
    }); });
    on('ui.render', { component: 'Pane', requestId: PANE }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, Box, Button, Text, state, liveBy, windows, currentId, list, current, columns, compact, now, att, rank, isOtherMother, mine, others, _i, list_2, v, _b, rows, closed, closedTotal, target, section, row, keys, open;
        var _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    _a = $.ui.resolve(e), Box = _a.Box, Button = _a.Button, Text = _a.Text;
                    return [4 /*yield*/, (0, claude_code_1.read)($, tick)]; // subscribes: a bump redraws
                case 1:
                    _l.sent(); // subscribes: a bump redraws
                    return [4 /*yield*/, (0, claude_code_1.read)($, snap)
                        // First draw before any poll: read now, without writing state from a render.
                    ];
                case 2:
                    state = _l.sent();
                    if (!!(state === null || state === void 0 ? void 0 : state.at)) return [3 /*break*/, 4];
                    return [4 /*yield*/, readLive($).catch(function () { return state; })];
                case 3:
                    state = _l.sent();
                    _l.label = 4;
                case 4:
                    liveBy = new Map(((_c = state === null || state === void 0 ? void 0 : state.live) !== null && _c !== void 0 ? _c : []).map(function (a) { return [a.sessionId, a]; }));
                    windows = (_d = state === null || state === void 0 ? void 0 : state.windows) !== null && _d !== void 0 ? _d : {};
                    return [4 /*yield*/, $.session.id()];
                case 5:
                    currentId = _l.sent();
                    return [4 /*yield*/, projectVerticals($)];
                case 6:
                    list = _l.sent();
                    current = list.find(function (v) { return v.sessionId === currentId; });
                    columns = (_g = (_e = e.props.bodyColumns) !== null && _e !== void 0 ? _e : (_f = e.viewport) === null || _f === void 0 ? void 0 : _f.columns) !== null && _g !== void 0 ? _g : 40;
                    compact = columns < panel_1.COMPACT_COLUMNS;
                    now = (state === null || state === void 0 ? void 0 : state.at) || Date.now();
                    att = function (v) { return (0, panel_1.attention)(v, liveBy.get(v.sessionId), Boolean(windows[v.sessionId])); };
                    rank = function (v) { return panel_1.ATTENTION.indexOf(att(v)); };
                    isOtherMother = function (p) { return Boolean(p && p !== currentId && !list.some(function (v) { return v.sessionId === p; }) && liveBy.has(p)); };
                    mine = list.filter(function (v) { return !isOtherMother(v.parentSessionId); });
                    others = new Map();
                    for (_i = 0, list_2 = list; _i < list_2.length; _i++) {
                        v = list_2[_i];
                        if (!isOtherMother(v.parentSessionId) || v.status === 'done')
                            continue;
                        others.set(v.parentSessionId, __spreadArray(__spreadArray([], ((_h = others.get(v.parentSessionId)) !== null && _h !== void 0 ? _h : []), true), [v], false));
                    }
                    _b = (0, panel_1.treeRows)(mine, rank), rows = _b.rows, closed = _b.closed, closedTotal = _b.closedTotal;
                    target = (_j = list.find(function (v) { return v.sessionId === selected && v.status !== 'done'; })) !== null && _j !== void 0 ? _j : (_k = rows.find(function (r) { return r.v.sessionId !== currentId; })) === null || _k === void 0 ? void 0 : _k.v;
                    section = function (title, tone, body) { return (<Box key={"sec-".concat(title)} flexDirection="column" borderStyle="round" borderColor={tone !== null && tone !== void 0 ? tone : 'gray'} paddingX={1}>
        <Text bold color={tone}>
          {title}
        </Text>
        {body}
      </Box>); };
                    row = function (v, depth) {
                        var _a;
                        var a = att(v);
                        var g = panel_1.GLYPHS[a];
                        var rel = (0, panel_1.relation)(v, currentId, current === null || current === void 0 ? void 0 : current.parentSessionId);
                        var percent = a === 'done' ? undefined : v.contextPercent;
                        var b = percent === undefined ? undefined : (0, panel_1.bar)(percent, compact ? 4 : undefined);
                        var lastAt = (_a = v.lastAt) !== null && _a !== void 0 ? _a : v.contextAt;
                        var indent = depth > 0 ? "".concat('  '.repeat(depth - 1), "\u2514 ") : '';
                        var name = (0, panel_1.short)(v.title, Math.max(10, columns - (compact ? 22 : 44) - indent.length));
                        var self = v.sessionId === currentId;
                        return (<Box key={"v-".concat(v.sessionId)}>
          <Text dimColor>{indent}</Text>
          <Text color={g.color} dimColor={g.dim}>
            {g.glyph}{' '}
          </Text>
          {self || a === 'done' ? (<Text bold dimColor={g.dim}>
              {name}
            </Text>) : (<Button key={"go-".concat(v.sessionId)} plain onPress={function () { return void goTo($, v); }}>
              {name}
            </Button>)}
          {!compact && v.pacaRef && (<Text inverse>
              {' '}
              {v.pacaRef}{' '}
            </Text>)}
          {rel && <Text dimColor> {rel}</Text>}
          {b && percent !== undefined && (<Text>
              {' '}
              <Text color={(0, panel_1.contextTone)(percent)}>{b.on}</Text>
              <Text dimColor>{b.off}</Text>
              <Text color={(0, panel_1.contextTone)(percent)}> {percent}%</Text>
            </Text>)}
          {!compact && lastAt && <Text dimColor> {(0, panel_1.ago)(now - Date.parse(lastAt))}</Text>}
          {!self && v.agentId && windows[v.sessionId] && (<Box marginLeft={1}>
              <Button key={"hide-".concat(v.sessionId)} label="Nascondi" dimColor onPress={function () { return void hide($, v); }}/>
            </Box>)}
        </Box>);
                    };
                    keys = target && (<Box key="keys">
        <Text dimColor>{compact ? '' : "".concat((0, panel_1.short)(target.title, 18), ": ")}</Text>
        <Button key="k-go" hotkey="a" plain label="Apri" onPress={function () { return void goTo($, target); }}/>
        <Text> </Text>
        <Button key="k-hide" hotkey="h" plain label="Nascondi" onPress={function () { return void hide($, target); }}/>
        <Text> </Text>
        <Button key="k-stop" hotkey="s" plain label="Stop" onPress={function () { return void stopVertical($, target); }}/>
        <Text> </Text>
        <Button key="k-close" hotkey="x" plain label="Chiudi" onPress={function () { return void closeVertical($, target); }}/>
      </Box>);
                    open = rows;
                    return [2 /*return*/, (<Box flexDirection="column">
        {list.length === 0 && section(PANE_TITLE, undefined, <Text dimColor>Nessuna chat verticale in questo progetto.</Text>)}
        {open.length > 0 && section("Verticali (".concat(open.length, ")"), 'green', __spreadArray([keys], open.map(function (r) { return row(r.v, r.depth); }), true))}
        {__spreadArray([], others, true).map(function (_a) {
                                var _b, _c;
                                var mother = _a[0], children = _a[1];
                                return section("madre: ".concat((_c = (_b = liveBy.get(mother)) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : mother.slice(0, 8)), 'cyan', (0, panel_1.treeRows)(children, rank).rows.map(function (r) { return row(r.v, r.depth); }));
                            })}
        {closed.length > 0 &&
                                section(closedTotal > closed.length ? "Chiuse (ultime ".concat(closed.length, " di ").concat(closedTotal, ")") : "Chiuse (".concat(closed.length, ")"), undefined, closed.map(function (v) { return row(v, 0); }))}
      </Box>)];
            }
        });
    }); });
};
exports.register = register;
