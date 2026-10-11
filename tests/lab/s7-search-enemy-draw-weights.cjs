"use strict";
// REQUIREMENT — search-benchmark isolation under commanderdraw with NON-DEFAULT enemy draw weights (ENGINE-NOTES section
// 13.1; hand-placed board; the search is called directly; one scripted real turn afterwards to compare the prediction)
// s6's checks, under ?preset=commanderdraw&rules=dwm:0,dwa:3,dwd:1 (Move excluded, Attack-heavy). The enemy plan is the game's
// own drawn plan with those weights (one live planning right after the board is placed, frozen); the search reads that
// CURRENT frozen plan (allowed) and nothing after it.
// S7a ISOLATION: a full searchDecide leaves the live battle byte-identical (incl. the enemy draw store) and makes NO draw
//     anywhere (no hand / Math.random draw, drawEnemyPlanPool never called, live or on a copy).
// S7b NEUTRAL COPY: every evaluation's copy carries rng.enemyDrawState = NEUTRAL_ENEMY_DRAW_STATE and the live drawn pool
//     (the weighted list: no Move).
// S7c NO LEAK: moving the live enemy stream changes neither evaluate() nor the decision; no seed / rng / random / stream /
//     draw key in state() or evaluate(); the live enemy stream position never appears as a value.
// S7d PREDICTION = PLAY: the predicted units for the chosen plan equal the units after the REAL turn, whose turn end then
//     draws exactly one new list (live), again without Move.
const T = require("./_s.cjs");

const ID = "s7-search-enemy-draw-weights";
const { SR, TG, check, same } = T;
const DRAW = "?scenario=intro&seed=1&preset=commanderdraw&rules=dwm:0,dwa:3,dwd:1";
const BOARD = [{ row: 6, col: 6, health: 4 }, { row: 9, col: 2 }, { row: 9, col: 9 }, { row: 5, col: 5, health: 4 }, { row: 5, col: 7 }, { row: 2, col: 9, isHidden: true }];
const ZERO = { mathRandom: 0, liveHand: 0, randomAction: 0, draw: 0, reshuffle: 0 };

const drawStore = (g) => T.S.J(g, "getEnemyDrawState()");
function installDrawSpies(g) {
  g.ev(`globalThis.__edraw = []; globalThis.__copyRng = [];
    (function () { const o = drawEnemyPlanPool; drawEnemyPlanPool = function () { __edraw.push(battleStateSwap !== null ? "copy" : "live"); return o.apply(this, arguments); }; })();
    (function () { const o = withBattleState; withBattleState = function (state, fn) { __copyRng.push({ enemyDrawState: state.rng.enemyDrawState, drawnPool: state.enemyPack.drawnPool }); return o.apply(this, arguments); }; })();`);
}
function keyWalk(v, path, found) {
  if (Array.isArray(v)) v.forEach((x, i) => keyWalk(x, `${path}[${i}]`, found));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => { if (/seed|rng|random|stream|draw/i.test(k)) found.push(`${path}.${k}`); keyWalk(x, `${path}.${k}`, found); });
  return found;
}
const values = (v, out = []) => { if (v && typeof v === "object") Object.values(v).forEach((x) => values(x, out)); else out.push(v); return out; };

function boardDraw() {
  const g = T.S.boot(DRAW);
  TG.board(g, BOARD, null);
  g.ev("updateEnemyIntentPreview()"); // the game's own planning moment for the placed board: one live draw, frozen
  check(g.ev("getEnemyPlanState().frozen") === true && Array.isArray(drawStore(g).pool), "the placed board has a frozen drawn plan");
  same(T.S.J(g, "getActiveEnemyDrawWeights()"), { Move: 0, Attack: 3, Defend: 1 }, "the battle runs under the link's enemy weights");
  check(drawStore(g).pool.length === 5 && !drawStore(g).pool.includes("Move"), `the weighted plan has 5 actions and no Move (${drawStore(g).pool})`);
  return g;
}

function run() {
  const out = {};
  const contexts = [];

  // S7a / S7b / S7d
  const g = boardDraw();
  contexts.push(g);
  T.installSpies(g);
  installDrawSpies(g);
  const before = T.fingerprint(g);
  const storeBefore = drawStore(g);
  const handle = SR.createGameSearchHandle(g);
  const d = SR.searchDecide(null, { handle, limits: T.LIMITS, now: T.fixedClock(), round: 1, maxRounds: 2 });
  check(T.fingerprint(g) === before, "S7a: live battle unchanged by the search");
  same(drawStore(g), storeBefore, "S7a: live enemy stream and drawn pool unchanged");
  same(T.spies(g), ZERO, "S7a: no hand / Math.random draw during the search");
  same(T.S.J(g, "__edraw"), [], "S7a: no enemy draw during the search (live or copy)");
  check(d.stats.evaluated > 0 && d.orders.length > 0, "S7a: the search evaluated and chose a plan");
  const copies = T.S.J(g, "__copyRng");
  check(copies.length === d.stats.evaluated, "S7b: one copy per evaluation");
  check(copies.every((c) => c.enemyDrawState === SR.NEUTRAL_ENEMY_DRAW_STATE && JSON.stringify(c.drawnPool) === JSON.stringify(storeBefore.pool)),
    "S7b: every copy has the neutral enemy stream and the live (current) drawn pool");
  check(storeBefore.state !== SR.NEUTRAL_ENEMY_DRAW_STATE, "S7b: the neutral position is not the live one");
  const predicted = T.unitLine(handle.evaluate(d.orders).units);
  g.ev("__edraw.length = 0");
  const real = T.playTurn(g, d.orders);
  check(predicted === real, `S7d: prediction ${predicted} != real turn ${real}`);
  same(T.S.J(g, "__edraw"), ["live"], "S7d: the real turn's end draws exactly one new list");
  check(!drawStore(g).pool.includes("Move"), "S7d: the new list is drawn with the same weights (no Move)");
  out.decision = { pool: storeBefore.pool, orders: d.orders, stats: d.stats, predicted, real };

  // S7c
  const h = boardDraw();
  contexts.push(h);
  const hh = SR.createGameSearchHandle(h);
  const X = [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }];
  const r1 = hh.evaluate(X);
  const d1 = SR.searchDecide(null, { handle: hh, limits: T.LIMITS, now: T.fixedClock(), round: 1, maxRounds: 2 });
  const view = hh.state();
  const livePos = drawStore(h).state;
  same(keyWalk({ view, r1 }, "$", []), [], "S7c: no seed / rng / random / stream / draw key in state() or evaluate()");
  check(!values({ view, r1 }).some((x) => x === livePos || x === String(livePos)), "S7c: the live enemy stream position does not appear as a value");
  h.ev("getEnemyDrawState().state = 123456789"); // test-side: move the LIVE enemy stream elsewhere
  same(hh.evaluate(X), r1, "S7c: evaluate does not depend on the live enemy stream");
  same(SR.searchDecide(null, { handle: hh, limits: T.LIMITS, now: T.fixedClock(), round: 1, maxRounds: 2 }).orders, d1.orders, "S7c: the decision does not depend on the live enemy stream");
  out.streamIndependent = { orders: X, units: T.unitLine(r1.units), decision: d1.orders };

  out.hands = T.reportSearchHands(ID, contexts);
  return { header: "REQUIREMENT — search-benchmark isolation under commanderdraw with non-default enemy weights", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
