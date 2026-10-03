"use strict";
// REQUIREMENT — P1d acceptance
// Shared helpers for the P1d turn-lifecycle fixtures (r8..r12). Not a fixture itself.
// Read-only reuse of the c9/c10 instrumentation (_trace.cjs) and of _lib/_scn helpers.
const { loadGame } = require("../harness/load-game.cjs");
const { sha256 } = require("../harness/util.cjs");
const T = require("./_trace.cjs");
const { resetUnits } = require("./_lib.cjs");
const { check, same } = require("./_scn.cjs");

const REQ_HEADER = "REQUIREMENT — P1d acceptance";
const UNIT_IDS = ["P1", "P2", "P3", "E1", "E2", "E3"];
const UNIT_VARS = { P1: "player", P2: "playerSupport", P3: "playerFlank", E1: "enemy", E2: "enemySupport", E3: "enemyFlank" };

/**
 * Real boot route (?scenario=intro&seed=1 + scenarios/*.js) plus the c9 instrumentation, exactly as
 * _cases.runCase does it: hand-RNG draw counter installed before a second loadScenario("intro", 1), and
 * the result-message probe, so T.stateSnapshot() works. harnessSeed re-seeds the harness Math.random only.
 */
function bootIntro({ harnessSeed } = {}) {
  const g = loadGame({ query: "?scenario=intro&seed=1", scenarios: true, ...(harnessSeed === undefined ? {} : { seed: harnessSeed }) });
  T.installHandRngCounter(g);
  g.ev('loadScenario("intro", 1)');
  T.installResultMessageProbe(g);
  return g;
}

const domHand = (g) => JSON.parse(g.ev("JSON.stringify(Array.from(actionsList.children).map((i) => i.dataset.action))"));
const dataHand = (g) => JSON.parse(g.ev("JSON.stringify(playerHand)"));

/** Queue hand cards (by hand INDEX at call time) for one wolf through the real UI path; returns the card names. */
function queueByIndex(g, unitVar, indices) {
  const h = domHand(g);
  g.ev(`setPlayerSelected(${unitVar})`);
  indices.forEach((i) => g.ev(`applyPlayerAction(${JSON.stringify(h[i])})`));
  return indices.map((i) => h[i]);
}
const pushOrders = (g, unitVar, actions) => g.ev(actions.map((a) => `getUnitActionQueue(${unitVar}).push(${JSON.stringify(a)})`).join(";"));

const turnEvents = (g) => JSON.parse(g.ev("JSON.stringify(window.devTest.getTurnEventLog())"));

/** Full lifecycle through the real presentation driver (executePlayerActionQueue). Returns the turn's events. */
async function playTurn(g) {
  await g.runLimited(() => g.ev("executePlayerActionQueue()"));
  check(g.ev("isExecutingActionQueue") === false, "turn finished");
  return turnEvents(g);
}

/** Full lifecycle drained headlessly (fixture-only driver, no replay). Returns the turn's events. */
function drainTurn(g) {
  const out = JSON.parse(g.ev("JSON.stringify(window.devTest.drainTurnCore())"));
  check(Array.isArray(out), "drainTurnCore ran a turn");
  return out;
}

const hashEvents = (events) => sha256(JSON.stringify(events));

/** One compact, human-diffable line per event. */
function fmtEvent(e) {
  const { type, ...rest } = e;
  return [type, ...Object.entries(rest).map(([k, v]) => `${k}=${JSON.stringify(v).replace(/"/g, "")}`)].join(" ");
}

/** Every unit id that appears anywhere in an event log (ids live in known fields and keys). */
function collectIds(events) {
  const ids = new Set();
  const add = (v) => { if (typeof v === "string") ids.add(v); };
  events.forEach((e) => {
    ["unit", "attacker", "target", "focus"].forEach((k) => add(e[k]));
    ["renderUnits", "units", "render"].forEach((k) => (e[k] ?? []).forEach(add));
    if (e.alive) [...e.alive.player, ...e.alive.enemy].forEach(add);
    ["planned", "queues"].forEach((k) => { if (e[k] && !Array.isArray(e[k]) && typeof e[k] === "object") Object.keys(e[k]).forEach(add); });
    (e.queue ?? []).forEach((q) => add(q.unit));
    (e.actions ?? []).forEach((a) => add(a.unit));
    (e.heals ?? []).forEach((h) => add(h.unit));
  });
  return [...ids].sort();
}

module.exports = {
  REQ_HEADER, UNIT_IDS, UNIT_VARS, T, check, same, resetUnits, loadGame,
  bootIntro, domHand, dataHand, queueByIndex, pushOrders, turnEvents, playTurn, drainTurn, hashEvents, fmtEvent, collectIds,
};
