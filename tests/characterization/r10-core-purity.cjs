"use strict";
// REQUIREMENT — P1d acceptance
// R10: the turn core is pure rules. A full turn (moves, swings, hits, an enemy death with casualty
// replanning, a heal at turn end, a hand draw, the preview replan) is drained with
// window.devTest.drainTurnCore() while spies count, for the duration of the drain only:
//   - DOM creation: document.createElement / createElementNS / createTextNode / createDocumentFragment;
//   - DOM mutation: append / prepend / replaceChildren / appendChild / insertBefore / removeChild / remove /
//     setAttribute / removeAttribute, classList.add / remove / toggle / replace and style.setProperty /
//     removeProperty on every element reachable from the document and from the six units, plus a
//     before/after fingerprint of their plain properties (className, textContent, hidden, disabled, dataset,
//     style fields, attributes, children) to catch direct property writes;
//   - scheduling: requestAnimationFrame / cancelAnimationFrame / setTimeout / clearTimeout / setInterval;
//   - unit.element: a THROWING getter is installed on all six units.
// Every counter must be 0 and the drain must still produce a complete turn. Negative tests prove the guard:
// presentation entry points throw while the core flag is raised, and a deliberately impure rules function
// (patched in a fresh context) makes the real drain throw.
const L = require("./_lifecycle.cjs");

const ID = "r10-core-purity";

function setupFight(g) {
  // Same board as r9 casualty-replan, plus a wounded, safe P3 that heals at turn end.
  L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" },
    { row: 10, col: 9, direction: "topRight", health: 7 },
    { row: 5, col: 6, direction: "topLeft", health: 1 }, { row: 0, col: 9, direction: "bottomLeft" }, { row: 0, col: 2, direction: "bottomLeft" }]);
  g.ev("playerFlank.turnsSinceHit = 1;");
  L.pushOrders(g, "player", ["Attack"]);
  L.pushOrders(g, "playerSupport", ["Attack", "Defend"]);
  L.pushOrders(g, "playerFlank", ["Move"]);
}

const INSTALL_SPIES = `(function () {
  const spy = { active: false, created: 0, mutations: {}, scheduled: {}, elementReads: 0, fingerprintChanges: 0 };
  globalThis.__spy = spy;
  const count = (bucket, name) => { if (spy.active) bucket[name] = (bucket[name] ?? 0) + 1; };
  ["createElement", "createElementNS", "createTextNode", "createDocumentFragment"].forEach((m) => {
    const orig = document[m];
    document[m] = function (...a) { if (spy.active) spy.created += 1; return orig.apply(this, a); };
  });
  ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "setInterval"].forEach((m) => {
    const orig = globalThis[m];
    globalThis[m] = function (...a) { count(spy.scheduled, m); return orig.apply(this, a); };
  });
  const seen = [];
  const collect = (el) => {
    if (!el || typeof el !== "object" || seen.includes(el)) return;
    seen.push(el);
    Array.from(el.children ?? []).forEach(collect);
  };
  [document.body, document.documentElement, document.head, actionsList, actionQueueList, arena, gameResultOverlay].forEach(collect);
  units.forEach((u) => [u.element, u.healthBar, u.intentTags, u.hiddenTag].forEach(collect));
  const wrap = (obj, names, label) => names.forEach((n) => {
    const orig = obj[n];
    if (typeof orig !== "function") return;
    obj[n] = function (...a) { count(spy.mutations, label + n); return orig.apply(this, a); };
  });
  seen.forEach((el) => {
    wrap(el, ["append", "prepend", "replaceChildren", "appendChild", "insertBefore", "removeChild", "remove", "setAttribute", "removeAttribute"], "");
    if (el.classList) wrap(el.classList, ["add", "remove", "toggle", "replace"], "classList.");
    if (el.style) wrap(el.style, ["setProperty", "removeProperty"], "style.");
  });
  const fingerprint = () => seen.map((el) => JSON.stringify({
    className: el.className, id: el.id, text: el.textContent, hidden: el.hidden, disabled: el.disabled,
    dataset: el.dataset, attributes: el.attributes instanceof Map ? [...el.attributes] : null,
    style: Object.fromEntries(Object.entries(el.style ?? {}).filter(([, v]) => typeof v !== "function")),
    children: Array.from(el.children ?? []).map((c) => seen.indexOf(c)),
  }));
  const savedElements = new Map();
  spy.begin = () => {
    spy.before = fingerprint();
    units.forEach((u) => {
      savedElements.set(u, u.element);
      Object.defineProperty(u, "element", { configurable: true, enumerable: true,
        get() { spy.elementReads += 1; throw new Error("unit.element read inside the turn core"); } });
    });
    spy.active = true;
  };
  spy.end = () => {
    spy.active = false;
    savedElements.forEach((el, u) => Object.defineProperty(u, "element", { value: el, writable: true, enumerable: true, configurable: true }));
    const after = fingerprint();
    spy.fingerprintChanges = after.filter((f, i) => f !== spy.before[i]).length;
  };
  return seen.length;
})()`;

const GUARDED_CALLS = [
  "updateUnitHealthBar(player)", "playUnitAnimation(player, 'idle')", "playUnitAnimationCycles(player, 'bite', 1, {})",
  "playUnitHitReaction(player)", "playUnitDeath(player)", "showUnitDamagePopup(player, 1)", "showUnitHealPopup(player, 1)",
  "showUnitMissPopup(player)", "moveUnitToTile(player, 1, 1, {})", "renderActionQueue()", "renderPlayerTimeline()",
  "renderEnemyPackIntentTags()", "renderUnitIntentTags(enemy)", "refillAvailableActions()", "shakeArenaSoon()",
  "setPlayerSelected(null)", "updatePlayerActionControls()", "showGameResult(true)", "concludeBattle(true)",
];

async function run() {
  // --- positive: a full drained turn touches no presentation ---------------------------------------
  const g = L.bootIntro();
  setupFight(g);
  const elementCount = g.ev(INSTALL_SPIES);
  g.ev("__spy.begin()");
  let events;
  try {
    events = L.drainTurn(g);
  } finally {
    g.ev("__spy.end()");
  }
  const spy = JSON.parse(g.ev("JSON.stringify({ created: __spy.created, mutations: __spy.mutations, scheduled: __spy.scheduled, elementReads: __spy.elementReads, fingerprintChanges: __spy.fingerprintChanges })"));
  L.check(elementCount > 50, `spies cover the DOM (${elementCount} elements)`);
  L.same(spy, { created: 0, mutations: {}, scheduled: {}, elementReads: 0, fingerprintChanges: 0 }, "the drained core touched no presentation");
  L.check(g.usage().steps === 0, "no frame or timer ran");
  const types = events.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
  ["move", "attackSwing", "defendSwing", "hit", "damage", "death", "queueCleared", "replan", "handDraw"].forEach((t) => L.check(types[t] > 0, `drained turn exercised ${t}`));
  L.check(events.find((e) => e.type === "recovery").heals.length > 0, "drained turn exercised a heal");
  // The spies themselves see presentation outside the drain: a replayed turn would count.
  g.ev("__spy.active = true; updateUnitHealthBar(playerFlank); __spy.active = false;");
  L.check(Object.keys(JSON.parse(g.ev("JSON.stringify(__spy.mutations)"))).length > 0, "spies detect a presentation call (sanity)");

  // --- negative 1: the guard trips for presentation entry points while the core flag is raised ---------
  const n = L.bootIntro();
  const guardMessages = {};
  GUARDED_CALLS.forEach((call) => {
    guardMessages[call] = n.ev(`turnCoreDepth += 1; (function () { try { ${call}; return "NO THROW"; } catch (e) { return e.message; } finally { turnCoreDepth -= 1; } })()`);
    L.check(guardMessages[call].startsWith("Presentation call inside the turn core: "), `guard trips for ${call}: ${guardMessages[call]}`);
  });
  L.check(n.ev("turnCoreDepth") === 0 && n.ev("isTurnCoreRunning()") === false, "flag restored");

  // --- negative 2: an impure rules function makes the REAL drain throw ----------------------------------
  const impure = {};
  for (const [label, patch] of [
    ["recovery rules call showUnitHealPopup", "globalThis.applyTurnEndRecoveryRules = ((orig) => function () { const r = orig(); showUnitHealPopup(player, 1); return r; })(applyTurnEndRecoveryRules)"],
    ["tick rules call renderActionQueue", "globalThis.recordBattleDebugTick = ((orig) => function (...a) { renderActionQueue(); return orig(...a); })(recordBattleDebugTick)"],
    ["tick rules read unit.element (throwing getter installed for the drain)", "globalThis.recordBattleDebugTick = ((orig) => function (...a) { void player.element; return orig(...a); })(recordBattleDebugTick)"],
  ]) {
    const x = L.bootIntro();
    setupFight(x);
    x.ev(INSTALL_SPIES);
    x.ev(patch);
    let message = "NO THROW";
    x.ev("__spy.begin()");
    try { L.drainTurn(x); } catch (e) { message = String(e && e.message).split("\n")[0]; } finally { x.ev("__spy.end()"); }
    L.check(message !== "NO THROW", `impure core detected: ${label}`);
    impure[label] = message;
  }

  return {
    header: L.REQ_HEADER,
    spiedElements: "> 50 (document tree + six units' sprite, health bar, intent tags, hidden tag)",
    drainCounters: spy,
    drainedEventTypes: types,
    guardMessages,
    impureCoreDetected: impure,
  };
}
module.exports = { id: ID, run };
