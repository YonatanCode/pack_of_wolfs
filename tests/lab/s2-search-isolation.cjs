"use strict";
// REQUIREMENT — search-benchmark isolation (hand-placed boards; the search is called directly; one scripted real turn per
// board afterwards to compare the prediction)
// S2a COMMANDER: a full searchDecide on a hand-placed board leaves the live battle byte-identical (fingerprint: BattleState
//     incl. the hand-stream position, observation, frozen plan flag, last turn log, notes, settings / preset stores, hand
//     view, selection, busy flags) and makes NO random draw anywhere: Math.random 0, live hand stream 0, randomAction 0
//     (no hand card drawn even on a copy: the evaluation stops at the turn-end recovery step), drawPlayerHandToSize 0,
//     reshufflePlayerHandData 0.
// S2b CURRENT preset: the same (the door functions replan the enemy preview on the copy only).
// S2c NOTHING ABOUT THE STREAM: evaluate(X) gives the same result after the live hand stream is moved to another
//     position (the copy runs on a fixed neutral stream and never draws), and neither state() nor evaluate() returns a
//     key named like seed / rng / random / stream, nor the live stream position as a value (the hand seed is the public
//     scenario seed 1 here, too small to test as a value).
// S2d PREDICTION = PLAY: the search's predicted units for its chosen plan equal the units after the REAL turn
//     (runHeadlessTurn with those orders), on both boards.
// S2e REFUSALS change nothing: evaluate([reshuffle]) is refused before any game call (reshuffle-not-evaluated);
//     evaluate of a card not in the hand is refused by the real validator (card-not-in-hand); fingerprint unchanged.
const T = require("./_s.cjs");

const ID = "s2-search-isolation";
const { SR, check, same } = T;
const BOARD = [{ row: 6, col: 6, health: 4 }, { row: 9, col: 2 }, { row: 9, col: 9 }, { row: 5, col: 5, health: 4 }, { row: 5, col: 7 }, { row: 2, col: 9, isHidden: true }];
const PLAN = [{ unitId: "enemy", action: "Attack" }, { unitId: "enemySupport", action: "Move" }, { unitId: "enemyFlank", action: "Move" }];
const ZERO = { mathRandom: 0, liveHand: 0, randomAction: 0, draw: 0, reshuffle: 0 };

function keyWalk(v, path, found) {
  if (Array.isArray(v)) v.forEach((x, i) => keyWalk(x, `${path}[${i}]`, found));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => { if (/seed|rng|random|stream/i.test(k)) found.push(`${path}.${k}`); keyWalk(x, `${path}.${k}`, found); });
  return found;
}
const values = (v, out = []) => { if (v && typeof v === "object") Object.values(v).forEach((x) => values(x, out)); else out.push(v); return out; };

function isolatedSearch(g, label) {
  T.installSpies(g);
  const before = T.fingerprint(g);
  const handle = T.SR.createGameSearchHandle(g);
  const d = SR.searchDecide(null, { handle, limits: T.LIMITS, now: T.fixedClock(), round: 1, maxRounds: 2 });
  check(T.fingerprint(g) === before, `${label}: live battle unchanged by the search`);
  same(T.spies(g), ZERO, `${label}: no random draw during the search`);
  check(d.stats.evaluated > 0 && d.orders.length > 0, `${label}: the search evaluated and chose a plan`);
  const predicted = T.unitLine(handle.evaluate(d.orders).units);
  check(T.fingerprint(g) === before, `${label}: live battle unchanged by the re-evaluation`);
  const real = T.playTurn(g, d.orders);
  check(predicted === real, `${label}: prediction ${predicted} != real turn ${real}`);
  return { orders: d.orders, stats: d.stats, predicted, real, spiesDuringSearch: ZERO };
}

function run() {
  const out = {};
  const contexts = [];
  // S2a / S2d commander
  const gc = T.board(BOARD, PLAN);
  contexts.push(gc);
  out.commander = isolatedSearch(gc, "S2a");
  // S2b / S2d current
  const gu = T.board(BOARD, PLAN, { query: T.CURRENT });
  contexts.push(gu);
  out.current = isolatedSearch(gu, "S2b");

  // S2c
  const g = T.board(BOARD, PLAN);
  contexts.push(g);
  const handle = SR.createGameSearchHandle(g);
  const X = [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }];
  const r1 = handle.evaluate(X);
  const view = handle.state();
  const liveState = g.ev("handRandom.getState()");
  const leaks = keyWalk({ view, r1 }, "$", []);
  same(leaks, [], "S2c: no seed / rng / random / stream key in state() or evaluate()");
  check(!values({ view, r1 }).some((x) => x === liveState || x === String(liveState)), "S2c: the live stream position does not appear as a value");
  same(Object.keys(r1).sort(), ["ok", "units"], "S2c: evaluate returns only units");
  g.ev("handRandom = createSeededRandom(123456789)"); // test-side: move the LIVE stream elsewhere
  const r2 = handle.evaluate(X);
  same(r2, r1, "S2c: the evaluation does not depend on the live hand stream");
  out.streamIndependent = { orders: X, units: T.unitLine(r1.units) };

  // S2e
  const before = T.fingerprint(g);
  T.installSpies(g);
  const refusedReshuffle = handle.evaluate([{ reshuffle: true }]);
  const refusedCard = handle.evaluate([{ unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }]);
  check(refusedReshuffle.ok === false && refusedReshuffle.reason === "reshuffle-not-evaluated", "S2e: reshuffle never evaluated");
  check(refusedCard.ok === false && refusedCard.stage === "validate" && refusedCard.reason === "card-not-in-hand", "S2e: the real validator refuses a third Attack");
  check(T.fingerprint(g) === before, "S2e: refusals change nothing");
  same(T.spies(g), ZERO, "S2e: refusals draw nothing");
  out.refusals = { reshuffle: refusedReshuffle.reason, thirdAttack: `${refusedCard.reason}@${refusedCard.index}` };
  out.hands = T.reportSearchHands(ID, contexts);
  return { header: "REQUIREMENT — search-benchmark isolation", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
