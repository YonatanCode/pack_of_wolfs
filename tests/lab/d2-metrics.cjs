"use strict";
// REQUIREMENT — L2 metrics (hand-written BattleRecord arrays only; no game is loaded, no battle is run)
// D2a WILSON EDGES: n = 0 -> [0, 1]; all wins (5/5, 1/1) -> hi exactly 1, lo = n / (n + z^2); no wins (0/10) -> lo exactly
//     0; 5/10 -> [0.236593, 0.763407] (textbook value); every interval inside [0, 1]; invalid counts throw RangeError.
// D2b SUMMARY: two strategies over six hand-written records (win / loss / draw / timeout / error); counts, winRate,
//     interval, meanTurns (per battle) and meanBudget / meanPlanned / meanExecuted / meanWasted (per turn slot), and the
//     fixtureOnly label; strategies come out in sorted key order whatever the input order.
// D2d L3 MEANS: per-slot meanUnspentBudget / meanNotExecuted / meanAttacksHit / meanAttacksMissed / meanReshuffles,
//     total reshuffles and turnSlots (the n of the per-turn means); a slot written in the L2 shape (no L3 fields) is left
//     out of those means only (gamma).
// D2c EMPTY / INVALID: summarize([]) = {}; a record without strategy or with an unknown result throws TypeError.
const { summarize, wilson95, Z95 } = require("../../tools/lab/metrics.cjs");

const ID = "d2-metrics";
function check(cond, msg) { if (!cond) throw new Error(`d2 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
const near = (a, b) => Math.abs(a - b) < 1e-6;

// L3 slot: executed excludes misses; planned = executed + attacksMissed + wasted; hit counts are hand-picked.
const turn = (budget, planned, executed, attacksMissed = 0, reshuffles = 0, attacksHit = 0) => ({ turn: 0, status: "ran", budget, planned, executed,
  wasted: planned - executed - attacksMissed, unspentBudget: budget - planned, notExecuted: planned - executed, attacksHit, attacksMissed, reshuffles });
const l2Turn = (budget, planned, executed) => ({ turn: 0, status: "ran", budget, planned, executed, wasted: planned - executed });
const rec = (strategy, result, perTurn, fixtureOnly = true) => ({ strategy, result, turns: perTurn.length, perTurn, fixtureOnly, rulesHash: "h" });

// Hand-written: "beta" first on purpose (output must still be sorted).
const RECORDS = [
  rec("beta", "loss", [turn(5, 5, 4, 1, 1, 2), turn(5, 3, 3, 0, 0, 1), turn(5, 2, 0, 2, 0, 0)]),
  rec("alpha", "win", [turn(5, 2, 2, 0, 0, 1), turn(5, 4, 3, 1, 1, 1)]),
  rec("alpha", "draw", [turn(5, 5, 5, 0, 0, 2)]),
  rec("alpha", "timeout", [turn(5, 1, 1), turn(5, 0, 0)]),
  rec("alpha", "error", [turn(5, 3, 0)]),
  rec("beta", "win", [turn(5, 5, 5, 0, 1, 3)], false),
  rec("gamma", "win", [l2Turn(5, 2, 2), turn(5, 4, 2, 1, 1, 1)]),
];

function run() {
  // D2a
  same(wilson95(0, 0), [0, 1], "D2a: n = 0");
  const allWins5 = wilson95(5, 5);
  check(allWins5[1] === 1 && near(allWins5[0], 5 / (5 + Z95 * Z95)), `D2a: 5/5 -> ${allWins5}`);
  const allWins1 = wilson95(1, 1);
  check(allWins1[1] === 1 && near(allWins1[0], 1 / (1 + Z95 * Z95)), `D2a: 1/1 -> ${allWins1}`);
  const none10 = wilson95(0, 10);
  check(none10[0] === 0 && near(none10[1], 0.277533), `D2a: 0/10 -> ${none10}`);
  same(wilson95(5, 10), [0.236593, 0.763407], "D2a: 5/10 textbook interval");
  const table = { "0/0": wilson95(0, 0), "1/1": allWins1, "5/5": allWins5, "0/10": none10, "5/10": wilson95(5, 10), "1/3": wilson95(1, 3), "29/30": wilson95(29, 30) };
  Object.entries(table).forEach(([k, [lo, hi]]) => check(lo >= 0 && hi <= 1 && lo <= hi, `D2a: ${k} inside [0, 1]`));
  const invalid = [[3, 2], [-1, 4], [1.5, 3], [0, -1]].map(([w, n]) => {
    try { wilson95(w, n); } catch (e) { check(e instanceof RangeError, `D2a: wilson95(${w}, ${n}) throws RangeError`); return `${w}/${n}: refused`; }
    throw new Error(`D2a: wilson95(${w}, ${n}) was accepted`);
  });

  // D2b
  const summary = summarize(RECORDS);
  same(Object.keys(summary), ["alpha", "beta", "gamma"], "D2b: sorted strategies");
  const a = summary.alpha;
  same([a.n, a.wins, a.losses, a.draws, a.timeouts, a.errors], [4, 1, 0, 1, 1, 1], "D2b: alpha counts");
  check(a.winRate === 0.25 && JSON.stringify(a.winRateWilson95) === JSON.stringify(wilson95(1, 4)), "D2b: alpha win rate + interval");
  check(a.meanTurns === 1.5, "D2b: alpha meanTurns (2 + 1 + 2 + 1) / 4");
  check(a.meanBudget === 5 && a.meanPlanned === 2.5 && a.meanExecuted === 1.833333 && a.meanWasted === 0.5, "D2b: alpha per-turn means (6 turns: planned 15, executed 11, missed 1, wasted 3)");
  check(a.fixtureOnly === true, "D2b: alpha labelled fixtureOnly");
  const b = summary.beta;
  same([b.n, b.wins, b.losses, b.winRate, b.meanTurns, b.meanPlanned, b.meanExecuted, b.meanWasted], [2, 1, 1, 0.5, 2, 3.75, 3, 0], "D2b: beta (every unexecuted action was a miss: wasted 0)");
  check(b.fixtureOnly === true, "D2b: beta has a fixture battle, so it is labelled fixtureOnly");

  // D2d (alpha: 6 slots: unspent 3+1+0+4+5+2 = 15, notExecuted 0+1+0+0+0+3 = 4, hit 1+1+2 = 4, missed 1, reshuffles 1)
  same([a.turnSlots, a.meanUnspentBudget, a.meanNotExecuted, a.meanAttacksHit, a.meanAttacksMissed, a.reshuffles, a.meanReshuffles],
    [6, 2.5, 0.666667, 0.666667, 0.166667, 1, 0.166667], "D2d: alpha L3 means");
  // beta: 4 slots: unspent 0+2+3+0 = 5, notExecuted 1+0+2+0 = 3, hit 2+1+0+3 = 6, missed 1+0+2+0 = 3, reshuffles 1+0+0+1 = 2
  same([b.turnSlots, b.meanUnspentBudget, b.meanNotExecuted, b.meanAttacksHit, b.meanAttacksMissed, b.reshuffles, b.meanReshuffles],
    [4, 1.25, 0.75, 1.5, 0.75, 2, 0.5], "D2d: beta L3 means");
  const c = summary.gamma;
  same([c.turnSlots, c.meanPlanned, c.meanUnspentBudget, c.meanNotExecuted, c.meanAttacksHit, c.meanAttacksMissed, c.reshuffles, c.meanReshuffles],
    [2, 3, 1, 2, 1, 1, 1, 1], "D2d: gamma: the L2-shaped slot counts for meanPlanned but not for the L3 means");

  // D2c
  same(summarize([]), {}, "D2c: empty input");
  const bad = [[{ result: "win", perTurn: [], turns: 0 }], [{ strategy: "x", result: "victory", perTurn: [], turns: 0 }], [{ strategy: "x", result: "win", turns: 0 }]].map((input) => {
    try { summarize(input); } catch (e) { check(e instanceof TypeError, "D2c: TypeError"); return e.message; }
    throw new Error(`D2c: accepted ${JSON.stringify(input)}`);
  });

  return { header: "REQUIREMENT — L2 metrics", fixtureOnly: true, wilson: table, invalid, summary, invalidSummaries: bad };
}

module.exports = { id: ID, run };
