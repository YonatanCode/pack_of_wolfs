"use strict";
// REQUIREMENT — P2a acceptance (hard assertions; evidence in the golden)
// R23a: the player budget (activeRules.playerActionBudget) is enforced by queueing / isUnitActionQueueFull.
// R23b: hand size drives the refill count; reshuffle charges come from the settings (and reset on restart).
// R23c: enemy budget 0 IS supported: a hand-authored 1-turn completes with only player actions (the enemy passes),
//       while the same board with the default settings has the enemy act (control).
// R23d: enemy budget / pool: plans are composed only from the pool and never exceed min(budget, pool size);
//       budget > pool is allowed (warning) and neither the budget nor the pool is resized.
const P = require("./_settings.cjs");
const { check, same, J, hand, SPAWNS, placeFight } = P;
const { resetUnits, packQueue } = require("./_lib.cjs");

const ID = "r23-budgets-in-play";
const SETUP_B = [
  { row: 6, col: 6, direction: "topRight" }, { row: 6, col: 9, direction: "topRight" }, { row: 8, col: 6, direction: "topRight" },
  { row: 5, col: 6, direction: "bottomLeft" }, { row: 6, col: 10, direction: "topLeft" }, { row: 4, col: 8, direction: "bottomLeft" }];
const PACK = `units.filter((u) => u.team === "enemy" && u.type === "wolf")`;
const PLAYERS = `units.filter((u) => u.team === "player")`;

async function run() {
  const ctxs = [];
  const mk = (q) => { const g = P.boot(q); ctxs.push(g); return g; };
  const out = {};

  // ---- R23a: player budget 3 (hand 5)
  const a = mk(P.linkOf({ playerActionBudget: 3 }));
  a.ev("setPlayerSelected(player)");
  for (let i = 0; i < 5; i += 1) a.ev("applyPlayerAction(playerHand[0])");
  check(a.ev("getQueuedPlayerActionTotal()") === 3 && a.ev("isUnitActionQueueFull(player)") === true && hand(a).length === 2, "budget 3: only 3 cards queued, 2 stay in the hand");
  a.ev("setPlayerSelected(playerSupport); applyPlayerAction(playerHand[0])");
  check(a.ev("getQueuedPlayerActionTotal()") === 3 && a.ev("isUnitActionQueueFull(playerSupport)") === true && hand(a).length === 2, "the budget is shared by the whole pack");
  out.playerBudget3 = { queued: a.ev("getQueuedPlayerActionTotal()"), handLeft: hand(a).length };
  const a8 = mk(P.linkOf({ playerActionBudget: 8, handSize: 8 }));
  a8.ev("setPlayerSelected(player)");
  for (let i = 0; i < 9; i += 1) a8.ev("applyPlayerAction(playerHand[0])");
  check(a8.ev("getQueuedPlayerActionTotal()") === 8 && hand(a8).length === 0, "budget 8 with hand 8: all 8 cards queue");
  const w = P.J(a8, "window.devTest.getRulesLinkStatus()"); check(w.status === "applied", "link applied");
  check(J(a8, "validateSettings(window.devTest.getActiveSettings())").warnings.length === 0, "budget 8 = hand 8: no warning");
  out.playerBudget8 = { queued: 8 };

  // ---- R23b: hand size and reshuffle charges
  const b = mk(P.linkOf({ handSize: 7, reshuffleCharges: 1 }));
  check(hand(b).length === 7, "initial hand has handSize cards");
  b.ev(`consumeAvailableAction(playerHand[0]); consumeAvailableAction(playerHand[0]); consumeAvailableAction(playerHand[0])`);
  check(hand(b).length === 4, "3 played");
  const drawsBefore = b.ev("window.__drawn");
  b.ev("refillAvailableActions()");
  check(hand(b).length === 7 && b.ev("window.__drawn") === drawsBefore + 1, "refill tops the hand up to handSize (7)");
  b.ev("reshuffleActions()");
  check(b.ev("reshuffleChargesRemaining") === 0 && hand(b).length === 7, "1 reshuffle charge spent, hand of 7");
  const afterSpent = hand(b);
  b.ev("reshuffleActions()");
  same(hand(b), afterSpent, "no charges left: the reshuffle is a no-op");
  b.ev("window.devTest.restartBattle()");
  check(b.ev("reshuffleChargesRemaining") === 1, "restart restores the charge from the settings");
  const b0 = mk(P.linkOf({ reshuffleCharges: 0 }));
  const h0 = hand(b0); b0.ev("reshuffleActions()");
  check(b0.ev("reshuffleChargesRemaining") === 0 && JSON.stringify(hand(b0)) === JSON.stringify(h0), "0 charges: reshuffle never works");
  out.handAndCharges = { hand7: 7, charges1: true, charges0: true };

  // ---- R23c: enemy budget 0 (hand-authored 1-turn each: control with defaults, then budget 0)
  const turn = async (g, label) => {
    placeFight(g);
    const attackIndex = hand(g).indexOf("Attack");
    check(attackIndex >= 0, `${label}: the seeded hand holds an Attack`);
    g.ev(`setPlayerSelected(player); applyPlayerAction("Attack")`);
    check(g.ev("hasQueuedPlayerActions()") === true, `${label}: orders queued`);
    await g.runLimited(() => g.ev("executePlayerActionQueue()"));
    check(g.ev("isExecutingActionQueue") === false, `${label}: the turn completed`);
    return { p1Health: g.ev("player.health"), e1Health: g.ev("enemy.health"), enemyAt: J(g, "[[enemy.row, enemy.col], [enemySupport.row, enemySupport.col], [enemyFlank.row, enemyFlank.col]]"),
      packQueueAfter: packQueue(g).length, enemyActed: J(g, "getTurnEventLog().filter((e) => e.type === 'consumed').reduce((n, e) => n + e.actions.filter((x) => /^E/.test(x.unit)).length, 0)"),
      hand: hand(g).length };
  };
  const control = await turn(mk(), "control (default settings)");
  const zero = await turn(mk(P.linkOf({ enemyActionBudget: 0 })), "enemy budget 0");
  check(control.p1Health < 10 || control.enemyActed > 0, `control: with the default settings the enemy acts (P1 health ${control.p1Health}, enemy actions consumed ${control.enemyActed})`);
  check(zero.p1Health === 10 && zero.e1Health === 7 && zero.enemyActed === 0 && zero.hand === 5, `budget 0: only the player acted (E1 ${zero.e1Health}, P1 ${zero.p1Health}, enemy actions consumed ${zero.enemyActed}), hand refilled`);
  check(zero.packQueueAfter === 0, "budget 0: the enemy plan is empty");
  same(zero.enemyAt, [[5, 6], [0, 7], [0, 2]], "budget 0: no enemy wolf moved");
  out.zeroEnemyBudget = { control, zero };

  // ---- R23d: pool restriction and budget vs pool
  const plan = (patch) => {
    const g = mk(P.linkOf(patch));
    resetUnits(g, SETUP_B);
    g.ev(`planEnemyPackTurn(${PACK}, ${PLAYERS})`);
    const pack = packQueue(g).map((e) => e.action);
    const single = J(g, "planEnemyTurn(enemy, player)");
    return { g, pack, single, rules: J(g, "({ budget: activeRules.enemyActionBudget, pool: activeRules.enemyActionPool })") };
  };
  const onlyFrom = (list, pool) => { const c = {}; pool.forEach((x) => { c[x] = (c[x] ?? 0) + 1; }); const u = {}; list.forEach((x) => { u[x] = (u[x] ?? 0) + 1; }); return Object.entries(u).every(([k, n]) => n <= (c[k] ?? 0)); };
  const atk = plan({ enemyActionBudget: 2, poolMove: 0, poolDefend: 0, poolAttack: 2 });
  same(atk.pack, ["Attack", "Attack"], "pool Attack x2, budget 2: pack plan is exactly two Attacks");
  same(atk.single, ["Attack", "Attack"], "pool Attack x2, budget 2: single plan is exactly two Attacks");
  const def1 = plan({ enemyActionBudget: 2, poolMove: 0, poolDefend: 1, poolAttack: 0 });
  check(def1.pack.length <= 1 && def1.single.length <= 1 && def1.pack.concat(def1.single).every((x) => x === "Defend"), "pool Defend x1, budget 2: at most one action, only Defend");
  const big = plan({ enemyActionBudget: 5, poolMove: 0, poolDefend: 0, poolAttack: 2 });
  check(big.pack.length <= 2 && big.single.length <= 2 && big.pack.concat(big.single).every((x) => x === "Attack"), "budget 5 > pool 2: plan <= pool size, Attack only");
  same(big.rules, { budget: 5, pool: ["Attack", "Attack"] }, "budget > pool: neither the budget nor the pool is resized");
  same(J(big.g, "validateSettings(window.devTest.getActiveSettings()).warnings.map((w) => w.message)"), ["the enemy can plan at most 2 actions (pool size); neither budget nor pool is resized"], "warning for budget > pool");
  const none = plan({ enemyActionBudget: 3, poolMove: 0, poolDefend: 0, poolAttack: 0 });
  check(none.pack.length === 0 && none.single.length === 0, "empty pool with budget 3: the enemy plans nothing");
  same(none.rules, { budget: 3, pool: [] }, "empty pool: not resized");
  same(J(none.g, "validateSettings(window.devTest.getActiveSettings()).warnings.map((w) => w.message)"), ["the enemy has nothing to plan"], "warning for an empty pool");
  const dflt = plan({});
  const POOL = ["Move", "Move", "Defend", "Attack", "Attack"];
  check(dflt.pack.length <= 5 && onlyFrom(dflt.pack, POOL) && onlyFrom(dflt.single, POOL), "default pool: plans composed only from the pool counts");
  const mixed = plan({ enemyActionBudget: 4, poolMove: 1, poolDefend: 1, poolAttack: 1 });
  check(mixed.pack.length <= 3 && onlyFrom(mixed.pack, ["Move", "Defend", "Attack"]) && mixed.single.length <= 3 && onlyFrom(mixed.single, ["Move", "Defend", "Attack"]), "pool 1/1/1 with budget 4: at most 3 actions, each action at most once");
  out.plans = { attack2: atk.pack, defend1: def1.pack, budget5Pool2: big.pack, emptyPool: none.pack, defaultPlan: dflt.pack, mixed111: mixed.pack };

  const total = ctxs.reduce((n, c) => n + P.handsOf(c), 0);
  P.reportHands(ID, total);
  return { header: P.REQ_HEADER_P2A, handsGenerated: total, turnsPlayed: 2, ...out };
}
module.exports = { id: ID, run };
