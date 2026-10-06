"use strict";
// REQUIREMENT — search-benchmark picks (two hand-placed commander boards; the search is called directly, then the chosen
// plan is played as ONE scripted real turn to confirm it)
// Boot hand (intro, seed 1, commander): Attack, Move, Attack, Defend, Defend.
// S4a OBVIOUS WIN: P1 (6,6) next to the only enemy E1 (5,5, 3 HP) which plans an Attack; P2 / P3 far. The plain
//     [P1 Attack] wins (evaluated); the search picks a win too (predicted score win) and the real turn kills E1 (outcome
//     "player"). Recorded once: it prefers the win in which P1 defends E1's swing and P2 closes in to strike (damage
//     received 1 instead of 3: the score's damage term).
// S4b OBVIOUS SURVIVAL: P1 (6,6, 3 HP) next to E1 (5,5) and E2 (5,7), both planning an Attack (2 x 3 = 6 damage, 2 x 1
//     when defended). A plan with P1 attacking first loses P1 (evaluated: P1 defeated); the search's plan keeps every wolf
//     alive with P1's first slot a Defend or a Move; the real turn confirms P1 survives.
// Both chosen plans pass the real validator, and the prediction equals the real turn.
const T = require("./_s.cjs");

const ID = "s4-search-picks";
const { SR, check } = T;
const LIMITS = { maxCandidates: 80, maxEvaluations: 80, maxMsPerDecision: 5000 };

function pick(g) {
  const handle = SR.createGameSearchHandle(g);
  const d = SR.searchDecide(null, { handle, limits: LIMITS, now: T.fixedClock(), round: 1, maxRounds: 2 });
  check(handle.validate(d.orders).ok === true, "the chosen plan passes the real validator");
  const predicted = T.unitLine(handle.evaluate(d.orders).units);
  return { handle, d, predicted };
}
const firstSlot = (orders, unit) => (orders.find((o) => o.unit === unit && "action" in o) ?? {}).action ?? null;

function run() {
  const out = {};
  // S4a
  const gw = T.board([{ row: 6, col: 6 }, { row: 9, col: 2 }, { row: 9, col: 9 }, { row: 5, col: 5, health: 3 }, null, null], [{ unitId: "enemy", action: "Attack" }]);
  const w = pick(gw);
  check(w.d.best.score.tuple[0] === 1, `S4a: predicted win (${JSON.stringify(w.d.best.score)})`);
  const plain = w.handle.evaluate([{ unit: "P1", action: "Attack" }]);
  check(plain.ok && plain.units.every((u) => u.team !== "enemy" || u.defeated), "S4a: the plain P1 Attack also wins");
  check(SR.scoreOutcome(w.handle.state(), plain.units, [{ unit: "P1", action: "Attack" }]).tuple[0] === 1, "S4a: scored as a win");
  const realWin = T.playTurn(gw, w.d.orders);
  check(realWin === w.predicted, `S4a: prediction ${w.predicted} = real ${realWin}`);
  check(T.S.J(gw, "window.devTest.observeBattle().outcome") === "player", "S4a: the real turn wins");
  out.win = { orders: w.d.orders, score: w.d.best.score, real: realWin, plainAttack: T.unitLine(plain.units), evaluated: w.d.stats.evaluated };

  // S4b
  const gs = T.board([{ row: 6, col: 6, health: 3 }, { row: 10, col: 1 }, { row: 10, col: 10 }, { row: 5, col: 5 }, { row: 5, col: 7 }, null],
    [{ unitId: "enemy", action: "Attack" }, { unitId: "enemySupport", action: "Attack" }]);
  const s = pick(gs);
  const naive = T.unitLine(s.handle.evaluate([{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }]).units);
  check(/P1:\d+,\d+:-?\d+x/.test(naive), `S4b: attacking first loses P1 (${naive})`);
  check(s.d.best.score.tuple[2] === 3, `S4b: every wolf survives (${JSON.stringify(s.d.best.score)})`);
  check(["Defend", "Move"].includes(firstSlot(s.d.orders, "P1")), `S4b: P1 defends or steps away first (${JSON.stringify(s.d.orders)})`);
  const realSurvive = T.playTurn(gs, s.d.orders);
  check(realSurvive === s.predicted && !/P1:[^ ]*x/.test(realSurvive), `S4b: prediction ${s.predicted} = real ${realSurvive}, P1 alive`);
  out.survival = { orders: s.d.orders, score: s.d.best.score, naive, real: realSurvive, evaluated: s.d.stats.evaluated };
  out.hands = T.reportSearchHands(ID, [gw, gs]);
  return { header: "REQUIREMENT — search-benchmark picks", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
