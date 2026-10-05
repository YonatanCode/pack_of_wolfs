"use strict";
/*
 * Battle Lab metrics (L2, dev-only). Pure functions over BattleRecord arrays (tools/lab/CONTRACT.md "Report").
 *
 * summarize(battles) -> { <strategy>: { n, wins, losses, draws, timeouts, errors, winRate, winRateWilson95: [lo, hi],
 *   meanTurns, meanBudget, meanPlanned, meanExecuted, meanWasted, fixtureOnly } }, strategies in sorted key order.
 *   - n = battles of that strategy; winRate = wins / n (draws, timeouts and errors are non-wins); null when n = 0.
 *   - winRateWilson95: Wilson score interval, z = 1.959963984540054; n = 0 -> [0, 1] (no information).
 *   - meanTurns = mean turn slots per battle; meanBudget / meanPlanned / meanExecuted / meanWasted = means over every
 *     recorded turn slot of the strategy (null when there is none).
 *   - fixtureOnly: true when any battle of the strategy is a hand-authored fixture (a label, never evidence).
 * Numbers are rounded to 6 decimals so the serialised report is stable.
 */
const Z95 = 1.959963984540054;
const RESULTS = ["win", "loss", "draw", "timeout", "error"];
const round6 = (x) => (x === null ? null : Math.round(x * 1e6) / 1e6 + 0); // + 0 turns -0 into 0

/** Wilson score interval for `wins` successes out of `n` trials, clamped to [0, 1]. */
function wilson95(wins, n) {
  if (!Number.isInteger(n) || n < 0 || !Number.isInteger(wins) || wins < 0 || wins > n) {
    throw new RangeError(`wilson95: need integers 0 <= wins <= n (got wins=${wins}, n=${n})`);
  }
  if (n === 0) return [0, 1];
  const p = wins / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  const lo = wins === 0 ? 0 : Math.max(0, centre - half);
  const hi = wins === n ? 1 : Math.min(1, centre + half);
  return [round6(lo), round6(hi)];
}

const mean = (xs) => (xs.length ? round6(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function summarize(battles) {
  if (!Array.isArray(battles)) throw new TypeError("summarize: battles must be an array");
  const groups = new Map();
  battles.forEach((b, i) => {
    if (!b || typeof b.strategy !== "string" || !b.strategy) throw new TypeError(`summarize: battles[${i}] has no strategy`);
    if (!RESULTS.includes(b.result)) throw new TypeError(`summarize: battles[${i}] has an unknown result ${JSON.stringify(b.result)}`);
    if (!Array.isArray(b.perTurn)) throw new TypeError(`summarize: battles[${i}] has no perTurn array`);
    if (!groups.has(b.strategy)) groups.set(b.strategy, []);
    groups.get(b.strategy).push(b);
  });
  const out = {};
  [...groups.keys()].sort().forEach((strategy) => {
    const list = groups.get(strategy);
    const count = (r) => list.filter((b) => b.result === r).length;
    const n = list.length;
    const wins = count("win");
    const turns = list.flatMap((b) => b.perTurn);
    out[strategy] = {
      n,
      wins,
      losses: count("loss"),
      draws: count("draw"),
      timeouts: count("timeout"),
      errors: count("error"),
      winRate: n ? round6(wins / n) : null,
      winRateWilson95: wilson95(wins, n),
      meanTurns: mean(list.map((b) => b.turns)),
      meanBudget: mean(turns.map((t) => t.budget)),
      meanPlanned: mean(turns.map((t) => t.planned)),
      meanExecuted: mean(turns.map((t) => t.executed)),
      meanWasted: mean(turns.map((t) => t.wasted)),
      fixtureOnly: list.some((b) => b.fixtureOnly === true),
    };
  });
  return out;
}

module.exports = { summarize, wilson95, Z95, RESULTS };
