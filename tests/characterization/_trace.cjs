"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// Shared tracing helpers for c9 (state trace) and c10 (presentation-call trace). Not a fixture itself.
//
// Everything here is OBSERVATION ONLY. All wrappers call straight through to the original function with
// the original `this`/arguments and return its return value unchanged (async functions return the very
// same promise), so game behaviour and virtual timing are not changed. c10 proves this on every run by
// executing each case twice (without / with the presentation wrappers) and asserting identical state
// traces and identical virtual-clock/step usage.
//
// HOW INTERCEPTION WORKS: script.js is a classic script run in a vm context; its top-level `function x(){}`
// declarations are properties of the context's global object, and every call inside script.js is an
// identifier lookup resolved against that global at call time. Assigning `ctx.x = wrapper` therefore
// intercepts calls made from inside script.js (c10 asserts every wrapped name was actually hit).
// `const`/`let` top-level bindings (handRandom, actionsList, ...) are NOT global properties; they are read
// or written through g.ev().
//
// PRESENTATION TRACE (Trace B): the list is in CALL-START order, each entry stamped with the virtual clock
// (performance.now() of the harness, advancing 40 ms per rAF frame / jumping to timer due-times). COMPLETION
// order is deliberately not recorded: completion of an animation is a pure function of its start time and
// its (deterministic) duration, so start order + start timestamps determine it; and the rules/animation
// split under test promises the same calls in the same order at the same virtual times, which is what a
// refactor must preserve. Timestamps of synchronous calls made outside runLimited() are the idle clock.
//
// HAND-RNG POSITION: the hand stream is a mulberry32 closure held in the script's `let handRandom`, so its
// internal state is not readable. We install a counting pass-through wrapper (wrapping seedHandRandom, which
// every scenario load / restart calls, so the count starts at 0 exactly when the stream is seeded) and then
// report {seed, draws, next3}, where next3 is computed from a THROWAWAY re-seeded copy
// (createSeededRandom(handSeed), skip `draws` values, read 3). The live stream is never consumed by an
// observation. c9 verifies once (self-check) that next3 equals what the live stream then produces.

const { plain } = require("../harness/util.cjs");

const HEADER = "CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.";

/** Names whose calls (Trace B) are recorded, in the order they are listed in the task. */
const PRESENTATION_NAMES = [
  "moveUnitToTile", "playUnitAnimation", "playUnitAnimationCycles", "playUnitHitReaction", "playUnitDeath",
  "showUnitDamagePopup", "showUnitHealPopup", "showUnitMissPopup", "renderEnemyPackIntentTags",
  "renderActionQueue", "renderPlayerTimeline", "updateUnitHealthBar", "refillAvailableActions",
  "shakeArenaSoon", "showGameResult", "concludeBattle",
];
/** Rule-ordering markers (not presentation, but they pin where rules run relative to presentation). */
const ORDER_MARKER_NAMES = ["planEnemyPackTurn", "applyTurnEndRecovery", "updateEnemyIntentPreview"];

// ---- state-side instrumentation -----------------------------------------------------------------

const HAND_EXPR = "Array.from(actionsList.children).map((i) => i.dataset.action)";

/** Count hand-stream draws from the moment of seeding. Idempotent. Call BEFORE the seeding load. */
function installHandRngCounter(g) {
  if (g.ctx.__handCounterInstalled) return;
  const orig = g.ctx.seedHandRandom;
  if (typeof orig !== "function") throw new Error("seedHandRandom is not a global function");
  g.ev("var __handDraws = 0;");
  g.ctx.seedHandRandom = function (...args) {
    const r = orig.apply(this, args);
    g.ev("(function(){ const inner = handRandom; __handDraws = 0; handRandom = function () { __handDraws += 1; return inner(); }; })()");
    return r;
  };
  g.ctx.__handCounterInstalled = true;
}

/** {seed, draws, next3}; next3 comes from a throwaway copy, the live stream is untouched. */
function handRngPosition(g) {
  return plain(JSON.parse(g.ev(`JSON.stringify((function(){
    const draws = __handDraws; const peek = createSeededRandom(handSeed);
    for (let i = 0; i < draws; i += 1) peek();
    return { seed: handSeed, draws, next3: [peek(), peek(), peek()].map((v) => Math.round(v * 1e6) / 1e6) };
  })())`)));
}

/** Make the result message readable (the stub DOM otherwise returns a throwaway element per query). */
function installResultMessageProbe(g) {
  g.ev(`(function(){
    const msg = document.createElement("div");
    const orig = gameResultOverlay.querySelector;
    gameResultOverlay.querySelector = function (sel) { return sel === ".game-result-message" ? msg : orig.call(gameResultOverlay, sel); };
    globalThis.__resultMsg = msg;
  })()`);
}

/** Call-through async wrapper around executeActionTick: onBegin before, onEnd after the tick (state recording). */
function installTickHook(g, onBegin, onEnd) {
  const orig = g.ctx.executeActionTick;
  g.ctx.executeActionTick = async function (...args) {
    onBegin();
    const r = await orig.apply(this, args);
    onEnd();
    return r;
  };
}

const RAW_STATE = `JSON.stringify((function(){
  const all = [["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]];
  const id = (u) => getBattleDebugUnitId(u);
  const units = {};
  all.forEach(([k,u]) => { units[k] = { row:u.row, col:u.col, direction:u.direction, health:u.health, isDefeated:!!u.isDefeated,
    isActive:isUnitActive(u), movementMode:u.movementMode ?? null, turnsSinceHit:u.turnsSinceHit, tookDamageThisTurn:u.tookDamageThisTurn,
    isFleeing:!!u.isFleeing, packObjective:u.packObjective ?? null,
    queue: u.team === "player" ? [...getUnitActionQueue(u)] : enemyPackActionQueue.filter((e) => e.unit === u).map((e) => e.action) }; });
  return { units, pack: enemyPackActionQueue.map((e) => [id(e.unit), e.action]),
    focus: enemyPackFocusTarget ? id(enemyPackFocusTarget) : null, hand: ${HAND_EXPR},
    reshuffle: reshuffleChargesRemaining, overlayHidden: gameResultOverlay.hidden,
    msg: { text: __resultMsg.textContent, win: __resultMsg.classList.contains("is-win"), lose: __resultMsg.classList.contains("is-lose") } };
})())`;

const objText = (o) => (o === null || o === undefined ? "-" : JSON.stringify(o).replace(/"/g, ""));

/** One full state snapshot in a compact, line-per-unit, human-diffable form. */
function stateSnapshot(g, label) {
  const raw = JSON.parse(g.ev(RAW_STATE));
  const units = {};
  Object.entries(raw.units).forEach(([k, u]) => {
    units[k] = `r${u.row} c${u.col} ${u.direction} hp${u.health} ${u.isDefeated ? "DEFEATED" : u.isActive ? "alive" : "inactive"}`
      + ` mv=${u.movementMode ?? "-"} tsh=${u.turnsSinceHit} dmg=${u.tookDamageThisTurn ? 1 : 0} flee=${u.isFleeing ? 1 : 0}`
      + ` obj=${objText(u.packObjective)} q=[${u.queue.join(",")}]`;
  });
  return plain({
    label,
    units,
    packQueue: `len=${raw.pack.length} ${raw.pack.map(([u, a]) => `${u}:${a}`).join(" ")}`.trim(),
    focus: raw.focus,
    hand: raw.hand.join(","),
    reshuffleChargesRemaining: raw.reshuffle,
    resultOverlay: raw.overlayHidden ? "hidden" : `shown msg=${JSON.stringify(raw.msg.text)} win=${raw.msg.win} lose=${raw.msg.lose}`,
    handRng: (({ seed, draws, next3 }) => `seed=${seed} draws=${draws} next3=${next3.join(",")}`)(handRngPosition(g)),
  });
}

// ---- presentation-call trace (Trace B) ----------------------------------------------------------

function createPresentationTrace(g) {
  const events = [];
  const originals = new Map();
  const unitId = g.ctx.getBattleDebugUnitId;
  const isUnit = (v) => v && typeof v === "object" && "team" in v && "element" in v && "row" in v;
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
  const stamp = () => `t=${g.clock.now}`;
  const hand = () => g.ev(HAND_EXPR).join(",");

  function install() {
    [...PRESENTATION_NAMES, ...ORDER_MARKER_NAMES].forEach((name) => {
      const orig = g.ctx[name];
      if (typeof orig !== "function") throw new Error(`trace: ${name} is not a global function`);
      originals.set(name, orig);
      g.ctx[name] = name === "refillAvailableActions"
        ? function (...args) {
          const slot = events.push(null) - 1;
          const before = hand();
          const r = orig.apply(this, args);
          events[slot] = `${stamp()} refillAvailableActions hand [${before}] -> [${hand()}]`;
          return r;
        }
        : function (...args) {
          events.push(`${stamp()} ${name} ${args.map(red).join(" ")}`.trimEnd());
          return orig.apply(this, args);
        };
    });
  }
  function uninstall() {
    originals.forEach((orig, name) => { g.ctx[name] = orig; });
    originals.clear();
  }
  const mark = (text) => events.push(`${stamp()} ---- ${text}`);
  return { events, install, uninstall, mark };
}

module.exports = {
  HEADER, PRESENTATION_NAMES, ORDER_MARKER_NAMES,
  installHandRngCounter, handRngPosition, installResultMessageProbe, installTickHook, stateSnapshot, createPresentationTrace,
};
