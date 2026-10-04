"use strict";
// REQUIREMENT — P1e acceptance
// Shared helpers for the P1e state-copy / dry-run fixtures (r14..r19). Not a fixture itself.
// Read-only reuse of _lifecycle (boards, orders, played turns) and _trace (result-message probe).
//
// BOOT: the real scenario route (?scenario=intro&seed=1 + scenarios/*.js) WITHOUT c9's hand-RNG draw counter:
// that counter replaces handRandom with a wrapper, and snapshotBattleState refuses a hand stream whose
// position it cannot read (it reads the stream's own getState()). Positions are compared through the
// snapshot's rng.handState instead.
//
// LIVE FINGERPRINT (liveFingerprint): everything a preview must leave untouched, read without side effects:
//   state  JSON of snapshotBattleState() (units, queues, pack plan, hand data, RNG position, rules, terrain);
//   dom    every element reachable from document.body / documentElement / head and from the six units
//          (sprite, health bar, intent tags, hidden tag): tag, class, id, text, hidden, disabled, dataset,
//          attributes, own style fields and child identity (index into the walk);
//   view   readable extracts of the same: hand view order, queue rows, intent-tag text per unit, overlay,
//          health-bar text, Play / Reshuffle button state;
//   debug  activeBattleDebugLog, lastBattleDebugReport, window.lastBattleDebugReport, lastTurnEventLog;
//   flags  pendingMoveReplays / unitHealthReplayValues sizes, turnCoreDepth, turnDriverDepth,
//          isExecutingActionQueue, battleStateSwap, selection, playerHandViewItems identity vs the DOM list.
// SPIES (installSpies): copies of r10's counters (DOM creation, DOM mutation methods on every element seen,
// rAF / timers) that only count while __p1e.spy.active is set (around previews).
const { loadGame } = require("../harness/load-game.cjs");
const { sha256 } = require("../harness/util.cjs");
const L = require("./_lifecycle.cjs");

const REQ_HEADER = "REQUIREMENT — P1e acceptance";

function boot() {
  const g = loadGame({ query: "?scenario=intro&seed=1", scenarios: true });
  L.T.installResultMessageProbe(g);
  installProbes(g);
  return g;
}

const INSTALL_PROBES = `(function () {
  const p = { spy: { active: false, created: 0, mutations: {}, scheduled: {} } };
  globalThis.__p1e = p;
  const roots = () => [document.body, document.documentElement, document.head,
    ...units.flatMap((u) => { try { return [u.element, u.healthBar, u.intentTags, u.hiddenTag]; } catch (e) { return []; } })];
  const walk = () => {
    const seen = [];
    const visit = (el) => {
      if (!el || typeof el !== "object" || seen.includes(el)) return;
      seen.push(el);
      Array.from(el.children ?? []).forEach(visit);
    };
    roots().forEach(visit);
    return seen;
  };
  p.dom = () => {
    const seen = walk();
    return seen.map((el) => JSON.stringify([el.tagName, el.className, el.id, el.textContent, el.hidden, el.disabled,
      el.dataset, el.attributes instanceof Map ? [...el.attributes] : null,
      Object.fromEntries(Object.entries(el.style ?? {}).filter(([, v]) => typeof v !== "function")),
      Array.from(el.children ?? []).map((c) => seen.indexOf(c))]));
  };
  const text = (el) => (el ? [el.textContent, ...Array.from(el.children ?? []).map(text)].join("|") : null);
  p.view = () => ({
    handView: Array.from(actionsList.children).map((i) => i.dataset.action),
    queueRows: Array.from(actionQueueList.children).map(text),
    intentTags: Object.fromEntries(units.map((u) => [getBattleDebugUnitId(u),
      u.intentTags ? Array.from(u.intentTags.querySelectorAll(".unit-intent-label")).map((t) => t.textContent) : null])),
    healthBars: Object.fromEntries(units.map((u) => [getBattleDebugUnitId(u), text(u.healthBar)])),
    overlay: { hidden: gameResultOverlay.hidden, msg: __resultMsg.textContent, cls: __resultMsg.className },
    buttons: { play: executeQueueButton.disabled, playClass: executeQueueButton.className,
      reshuffle: reshuffleButton.disabled, charges: reshuffleButton.dataset.chargesRemaining ?? null },
  });
  p.debug = () => ({
    activeLog: JSON.stringify(activeBattleDebugLog), report: lastBattleDebugReport,
    windowReport: window.lastBattleDebugReport ?? null, lastTurnEventLog: JSON.stringify(lastTurnEventLog),
  });
  p.flags = () => ({
    pendingMoveReplays: pendingMoveReplays.size, unitHealthReplayValues: unitHealthReplayValues.size,
    turnCoreDepth, turnDriverDepth, isExecutingActionQueue, swapIsNull: battleStateSwap === null,
    selected: getSelectedPlayerUnit() ? getBattleDebugUnitId(getSelectedPlayerUnit()) : null,
    handViewItemsMatchDom: playerHandViewItems.length === actionsList.children.length
      && playerHandViewItems.every((item, i) => item === actionsList.children[i]),
  });
  p.installSpies = () => {
    const spy = p.spy;
    const count = (bucket, name) => { if (spy.active) bucket[name] = (bucket[name] ?? 0) + 1; };
    ["createElement", "createElementNS", "createTextNode", "createDocumentFragment"].forEach((m) => {
      const orig = document[m];
      document[m] = function (...a) { if (spy.active) spy.created += 1; return orig.apply(this, a); };
    });
    ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "setInterval"].forEach((m) => {
      const orig = globalThis[m];
      globalThis[m] = function (...a) { count(spy.scheduled, m); return orig.apply(this, a); };
    });
    const wrap = (obj, names, label) => names.forEach((n) => {
      const orig = obj[n];
      if (typeof orig !== "function") return;
      obj[n] = function (...a) { count(spy.mutations, label + n); return orig.apply(this, a); };
    });
    const seen = walk();
    seen.forEach((el) => {
      wrap(el, ["append", "prepend", "replaceChildren", "appendChild", "insertBefore", "removeChild", "remove", "setAttribute", "removeAttribute"], "");
      if (el.classList) wrap(el.classList, ["add", "remove", "toggle", "replace"], "classList.");
      if (el.style) wrap(el.style, ["setProperty", "removeProperty"], "style.");
    });
    return seen.length;
  };
  p.counters = () => ({ created: p.spy.created, mutations: p.spy.mutations, scheduled: p.spy.scheduled });
})()`;

function installProbes(g) {
  g.ev(INSTALL_PROBES);
}

const evJ = (g, expr) => JSON.parse(g.ev(`JSON.stringify(${expr})`));
const snapshot = (g) => evJ(g, "snapshotBattleState()");
const stateHash = (g) => sha256(g.ev("JSON.stringify(snapshotBattleState())"));

/** Everything a preview must not change (see the header). Plain data, comparable across contexts. */
function liveFingerprint(g) {
  const dom = evJ(g, "__p1e.dom()");
  return {
    state: g.ev("JSON.stringify(snapshotBattleState())"),
    domHash: sha256(JSON.stringify(dom)),
    domElements: dom.length,
    view: evJ(g, "__p1e.view()"),
    debug: evJ(g, "__p1e.debug()"),
    flags: evJ(g, "__p1e.flags()"),
    handData: evJ(g, "playerHand"),
  };
}

/** Run a dry run inside the context; returns { ok, result } or { ok: false, error: { name, reason, message } }. */
function dryRun(g, options) {
  const out = JSON.parse(g.ev(`JSON.stringify((function () {
    try { return { ok: true, result: dryRunTurn(${options === undefined ? "" : JSON.stringify(options)}) }; }
    catch (e) { return { ok: false, error: { name: e && e.name, reason: (e && e.reason) ?? null, message: String(e && e.message).split("\\n")[0] } }; }
  })())`));
  return out;
}

/** Internal fixture entry: like dryRun but through dryRunTurnInternal (the only way to apply queue overrides to the copy). */
function dryRunInternal(g, options) {
  return JSON.parse(g.ev(`JSON.stringify((function () {
    try { return { ok: true, result: dryRunTurnInternal(${options === undefined ? "" : JSON.stringify(options)}) }; }
    catch (e) { return { ok: false, error: { name: e && e.name, reason: (e && e.reason) ?? null, message: String(e && e.message).split("\\n")[0] } }; }
  })())`));
}

/** Preview with the spies counting; returns the dry-run outcome and the counters for that preview only. */
function spiedDryRun(g, options) {
  g.ev("__p1e.spy.active = true; __p1e.spy.created = 0; __p1e.spy.mutations = {}; __p1e.spy.scheduled = {};");
  let out;
  const stepsBefore = g.usage().steps;
  try {
    out = dryRun(g, options);
  } finally {
    g.ev("__p1e.spy.active = false;");
  }
  return { out, counters: evJ(g, "__p1e.counters()"), steps: g.usage().steps - stepsBefore };
}

const ZERO_COUNTERS = { created: 0, mutations: {}, scheduled: {} };

/** Compact event summary for goldens. */
function summarizeEvents(events) {
  const types = events.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
  const keyLines = events.filter((e) => ["death", "replan", "recovery", "handDraw", "outcome"].includes(e.type)).map(L.fmtEvent);
  return { count: events.length, types, key: keyLines };
}

// ---- boards (hand-authored, one turn each; setups mirror r9 / r10) ----------------------------------------
/** Queue named hand cards (each really taken from the hand, through the real UI path) for one wolf. */
function queueCards(g, unitVar, cards) {
  g.ev(`setPlayerSelected(${unitVar})`);
  cards.forEach((c) => {
    const before = g.ev("playerHand.length");
    g.ev(`applyPlayerAction(${JSON.stringify(c)})`);
    L.check(g.ev("playerHand.length") === before - 1, `card ${c} taken from the hand for ${unitVar}`);
  });
}

const BOARDS = {
  plain: {
    description: "Untouched seed-1 intro board; the first hand card (by index, re-read after each pick) to P1, P2, P3.",
    setup: (g) => [...L.queueByIndex(g, "player", [0]), ...L.queueByIndex(g, "playerSupport", [0]), ...L.queueByIndex(g, "playerFlank", [0])],
  },
  lethal: {
    description: "r10 board, orders as hand cards: 1-HP E1 between P1 (1 HP) and P2 dies in tick 1 (casualty replan); wounded safe P3 heals at turn end; the 4 spent cards are redrawn.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" },
        { row: 10, col: 9, direction: "topRight", health: 7 },
        { row: 5, col: 6, direction: "topLeft", health: 1 }, { row: 0, col: 9, direction: "bottomLeft" }, { row: 0, col: 2, direction: "bottomLeft" }]);
      g.ev("playerFlank.turnsSinceHit = 1;");
      queueCards(g, "player", ["Attack"]);
      queueCards(g, "playerSupport", ["Attack", "Defend"]);
      queueCards(g, "playerFlank", ["Move"]);
      return ["P1:Attack", "P2:Attack,Defend", "P3:Move"];
    },
  },
  doubleKO: {
    description: "r9 board, order as a hand card: last units P1 and E1 (1 HP each) kill each other in tick 1: outcome enemy, doubleKO.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 4, direction: "topRight", health: 1 }, null, null, { row: 4, col: 4, direction: "bottomLeft", health: 1 }]);
      queueCards(g, "player", ["Attack"]);
      return ["P1:Attack"];
    },
  },
};

// ---- presentation-call trace (c10-style call-through wrappers; broader name list) ---------------------------
const PRESENTATION_SPY_NAMES = [
  ...L.T.PRESENTATION_NAMES,
  "setPlayerSelected", "updatePlayerActionControls", "updateActionQueueControls", "syncEnemyModeControls",
  "updateBattleDebugControls", "renderUnitIntentTags", "presentRecovery", "presentEnemyIntentPreview",
  "rebuildPlayerHandView", "renderPlayerHandDraws", "adoptExternalPlayerHandEdits", "updateReshuffleControl",
];

function installPresentationTrace(g) {
  const events = [];
  const unitId = g.ctx.getBattleDebugUnitId;
  const isUnit = (v) => v && typeof v === "object" && "team" in v && "row" in v;
  const red = (v) => {
    if (v === undefined) return "undef";
    if (v === null) return "null";
    if (isUnit(v)) return unitId(v);
    if (typeof v === "number") return String(Math.round(v * 1e6) / 1e6);
    if (typeof v === "string" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "fn";
    if (Array.isArray(v)) return `[${v.map(red).join(",")}]`;
    if (typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${k}:${red(v[k])}`).join(",")}}`;
    return String(v);
  };
  PRESENTATION_SPY_NAMES.forEach((name) => {
    const orig = g.ctx[name];
    if (typeof orig !== "function") throw new Error(`presentation trace: ${name} is not a global function`);
    g.ctx[name] = function (...args) {
      events.push(`t=${g.clock.now} ${name} ${args.map(red).join(" ")}`.trimEnd());
      return orig.apply(this, args);
    };
  });
  return events;
}

module.exports = {
  REQ_HEADER, L, boot, installProbes, evJ, snapshot, stateHash, liveFingerprint, dryRun, dryRunInternal, spiedDryRun, ZERO_COUNTERS, summarizeEvents,
  BOARDS, queueCards, PRESENTATION_SPY_NAMES, installPresentationTrace, sha256,
};
