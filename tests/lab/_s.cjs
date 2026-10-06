"use strict";
// Shared helpers for the search-benchmark fixtures (s1..s5). Not a fixture itself.
// Testing boundary (tools/lab/CONTRACT.md, BOTS.md "search-benchmark"): hand-placed boards only (resetDevTest through
// the existing TG.board helper, scripted first-turn enemy plan), hand-written views and fixed limits. The search is
// exercised by calling searchDecide / the handle directly; s5 adds at most one scripted-driver style battle of ONE turn.
// No generated board, no batch, no sweep. Each context boots through S.boot (hand counter); the s-fixtures keep their own
// hand ledger (reportSearchHands, limit 60 in total).
const S = require("../characterization/_settings.cjs");
const TG = require("../characterization/_targets.cjs");
const SR = require("../../tools/lab/search.cjs");

const COMMANDER = "?scenario=intro&seed=1&preset=commander";
const CURRENT = "?scenario=intro&seed=1";
const SEARCH_HAND_LIMIT = 60;
const ledger = {};

function check(cond, msg) { if (!cond) throw new Error(`search fixture check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

/** Booted context with a hand-placed board. setups [P1,P2,P3,E1,E2,E3] (null = absent); plan = scripted enemy plan
 *  entries { unitId: "enemy" | "enemySupport" | "enemyFlank", action } (frozen under commander). hand: optional hand data. */
function board(setups, plan = [], { query = COMMANDER, hand = null } = {}) {
  const g = S.boot(query);
  TG.board(g, setups, plan);
  if (hand) g.ev(`playerHand.splice(0, playerHand.length, ...${JSON.stringify(hand)})`);
  return g;
}

/** Counting spies (installed in the game context): Math.random, the LIVE hand stream (wrapped, getState kept),
 *  randomAction (every hand-card draw, live or copy), drawPlayerHandToSize and reshufflePlayerHandData. */
function installSpies(g) {
  g.ev(`globalThis.__spy = { mathRandom: 0, liveHand: 0, randomAction: 0, draw: 0, reshuffle: 0 };
    (function () { const m = Math.random; Math.random = function () { __spy.mathRandom += 1; return m(); }; })();
    (function () { const live = handRandom; const w = function () { __spy.liveHand += 1; return live(); }; w.getState = () => live.getState(); handRandom = w; })();
    (function () { const o = randomAction; randomAction = function () { __spy.randomAction += 1; return o.apply(this, arguments); }; })();
    (function () { const o = drawPlayerHandToSize; drawPlayerHandToSize = function () { __spy.draw += 1; return o.apply(this, arguments); }; })();
    (function () { const o = reshufflePlayerHandData; reshufflePlayerHandData = function () { __spy.reshuffle += 1; return o.apply(this, arguments); }; })();`);
}
const spies = (g) => S.J(g, "__spy");

/** Full live fingerprint (string): BattleState incl. the hand-stream position, observation, frozen flag, last turn log,
 *  battle notes, settings / preset stores, hand view, selection, busy flags. */
const fingerprint = (g) => g.ev(`JSON.stringify({ snap: snapshotBattleState(), obs: observeBattle(), handState: handRandom.getState(), handSeed,
  frozen: getEnemyPlanState().frozen, last: lastTurnEventLog, report: lastBattleDebugReport, log: activeBattleDebugLog,
  rules: getRulesState(), preset: getRulesPresetState(), view: playerHandViewItems.map((i) => i.dataset.action),
  selected: getSelectedPlayerUnit() ? getBattleDebugUnitId(getSelectedPlayerUnit()) : null,
  busy: [isExecutingActionQueue, turnCoreDepth, turnDriverDepth, battleStateSwap === null] })`);

/** Units after a turn as compact strings ("P1:6,6:1" / "E1:5,5:0x" for defeated). */
const unitLine = (list) => list.map((u) => `${u.id}:${u.row},${u.col}:${u.health}${u.defeated ? "x" : ""}`).join(" ");
const liveUnits = (g) => unitLine(S.J(g, "window.devTest.observeBattle().units"));

/** Plays ONE scripted turn on the live board with the given orders (the real door) -> unit line after it. */
function playTurn(g, orders) {
  const r = S.J(g, `window.devTest.runHeadlessTurn(${JSON.stringify(orders)})`);
  check(r && r.ok === true, `the real turn accepted the orders (${JSON.stringify(r)})`);
  return unitLine(r.observation.units);
}

const fixedClock = (t = 0) => () => t;
const LIMITS = { maxCandidates: 300, maxEvaluations: 300, maxMsPerDecision: 5000 };

function reportSearchHands(id, contexts) {
  ledger[id] = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  check(total <= SEARCH_HAND_LIMIT, `search fixtures hand ledger: ${total} hands (limit ${SEARCH_HAND_LIMIT})`);
  return ledger[id];
}

module.exports = { S, TG, SR, COMMANDER, CURRENT, check, same, board, installSpies, spies, fingerprint, unitLine, liveUnits, playTurn, fixedClock, LIMITS, reportSearchHands };
