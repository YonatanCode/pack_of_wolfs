"use strict";
// REQUIREMENT — L2 metrics (hand-written BattleRecord arrays only; no game is loaded, no battle is run)
// D2a WILSON EDGES: n = 0 -> [0, 1]; all wins (5/5, 1/1) -> hi exactly 1, lo = n / (n + z^2); no wins (0/10) -> lo exactly
//     0; 5/10 -> [0.236593, 0.763407] (textbook value); every interval inside [0, 1]; invalid counts throw RangeError.
// D2b SUMMARY: two strategies over six hand-written records (win / loss / draw / timeout / error); counts, winRate,
//     interval, meanTurns (per battle) and meanBudget / meanPlanned / meanExecuted / meanWasted (per turn slot), and the
//     fixtureOnly label; strategies come out in sorted key order whatever the input order.
// D2c EMPTY / INVALID: summarize([]) = {}; a record without strategy or with an unknown result throws TypeError.
const { summarize, wilson95, Z95 } = require("../../tools/lab/metrics.cjs");

const ID = "d2-metrics";
function check(cond, msg) { if (!cond) throw new Error(`d2 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
const near = (a, b) => Math.abs(a - b) < 1e-6;

const turn = (budget, planned, executed) => ({ turn: 0, status: "ran", budget, planned, executed, wasted: planned - executed });
const rec = (strategy, result, perTurn, fixtureOnly = true) => ({ strategy, result, turns: perTurn.length, perTurn, fixtureOnly, rulesHash: "h" });

// Hand-written: "beta" first on purpose (output must still be sorted).
const RECORDS = [
  rec("beta", "loss", [turn(5, 5, 4), turn(5, 3, 3), turn(5, 2, 0)]),
  rec("alpha", "win", [turn(5, 2, 2), turn(5, 4, 3)]),
  rec("alpha", "draw", [turn(5, 5, 5)]),
  rec("alpha", "timeout", [turn(5, 1, 1), turn(5, 0, 0)]),
  rec("alpha", "error", [turn(5, 3, 0)]),
  rec("beta", "win", [turn(5, 5, 5)], false),
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
  same(Object.keys(summary), ["alpha", "beta"], "D2b: sorted strategies");
  const a = summary.alpha;
  same([a.n, a.wins, a.losses, a.draws, a.timeouts, a.errors], [4, 1, 0, 1, 1, 1], "D2b: alpha counts");
  check(a.winRate === 0.25 && JSON.stringify(a.winRateWilson95) === JSON.stringify(wilson95(1, 4)), "D2b: alpha win rate + interval");
  check(a.meanTurns === 1.5, "D2b: alpha meanTurns (2 + 1 + 2 + 1) / 4");
  check(a.meanBudget === 5 && a.meanPlanned === 2.5 && a.meanExecuted === 1.833333 && a.meanWasted === 0.666667, "D2b: alpha per-turn means (6 turns: planned 15, executed 11)");
  check(a.fixtureOnly === true, "D2b: alpha labelled fixtureOnly");
  const b = summary.beta;
  same([b.n, b.wins, b.losses, b.winRate, b.meanTurns, b.meanPlanned, b.meanExecuted, b.meanWasted], [2, 1, 1, 0.5, 2, 3.75, 3, 0.75], "D2b: beta");
  check(b.fixtureOnly === true, "D2b: beta has a fixture battle, so it is labelled fixtureOnly");

  // D2c
  same(summarize([]), {}, "D2c: empty input");
  const bad = [[{ result: "win", perTurn: [], turns: 0 }], [{ strategy: "x", result: "victory", perTurn: [], turns: 0 }], [{ strategy: "x", result: "win", turns: 0 }]].map((input) => {
    try { summarize(input); } catch (e) { check(e instanceof TypeError, "D2c: TypeError"); return e.message; }
    throw new Error(`D2c: accepted ${JSON.stringify(input)}`);
  });

  return { header: "REQUIREMENT — L2 metrics", fixtureOnly: true, wilson: table, invalid, summary, invalidSummaries: bad };
}

module.exports = { id: ID, run };
