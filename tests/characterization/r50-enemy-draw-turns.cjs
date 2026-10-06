"use strict";
// REQUIREMENT — commanderdraw enemy draw (hard assertions; evidence in the golden)
// R50a FROZEN PLAN, DRY RUN = PLAY (seed 1, untouched intro board): queueing, removing a queued card, a reshuffle and
//      re-queueing never redraw (no draw call; plan, drawn pool and stream position unchanged). dryRunTurn leaves the live
//      battle unchanged (full live fingerprint incl. the enemy stream) and draws only on its copy; the real Play turn has
//      the same events and the same final BattleState (incl. rng.enemyDrawState and enemyPack.drawnPool); its only draw is
//      the turn end's, equal to the copy's.
// R50b UNPLACEABLE DRAWS -> UNASSIGNED: seed 1's first drawn list has an Attack the planner cannot place: enemyBudget
//      carries the drawn list as the pool, unassigned = no-valid-assignment x1 [Attack], the accounting invariants hold, no
//      refund: turn 2 starts from a fresh draw of exactly the budget (nothing carried over). Budget 0 (eab:0): the draw is
//      empty, consumes no stream value, reason budget-zero. Budget 10 (eab:10): 10 drawn actions, cap raised to 4.
// R50c FORFEIT, NO CASUALTY REDRAW (lethal board, seed 1): E1 dies in tick 1 and its remaining frozen action is forfeited;
//      no replan, no draw during the ticks (the only draw is the turn end's), spent <= budget, preview = play, and the
//      "Enemy actions" note block names the drawn list.
const D = require("./_draw.cjs");
const { S, PV, C } = D;
const { check, same, J } = S;

const ID = "r50-enemy-draw-turns";

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  // ---- R50a ------------------------------------------------------------------------------------------------------------
  const g = track(D.boot(D.DRAW));
  D.installDrawSpy(g);
  const plan0 = C.packQueue(g);
  const store0 = D.drawStore(g);
  check(C.frozen(g) === true, "R50a: the boot plan is frozen");
  PV.L.queueByIndex(g, "player", [0]);
  g.ev("removeUnitActionAt(player, 0)");
  check(J(g, "applyPlayerOrders([{ reshuffle: true }])").ok === true, "R50a: reshuffle");
  const orders = [...PV.L.queueByIndex(g, "player", [0, 0]), ...PV.L.queueByIndex(g, "playerSupport", [0])];
  same(D.takeDrawCalls(g), [], "R50a: edits, a reshuffle and re-queueing never draw");
  same(C.packQueue(g), plan0, "R50a: the frozen plan is unchanged");
  same(D.drawStore(g), store0, "R50a: the drawn pool and stream position are unchanged");
  const fp = PV.liveFingerprint(g);
  const preview = PV.dryRun(g);
  check(preview.ok === true, "R50a: preview ran");
  same(PV.liveFingerprint(g), fp, "R50a: the preview leaves the live battle unchanged (incl. the enemy stream)");
  same(D.drawStore(g), store0, "R50a: the live enemy stream did not move during the preview");
  const copyDraws = D.takeDrawCalls(g);
  check(copyDraws.length === 1 && copyDraws[0].startsWith("copy:"), "R50a: the preview drew once, on its copy (its turn end)");
  const events = await PV.L.playTurn(g);
  same(preview.result.events, events, "R50a: preview events = played events");
  same(preview.result.finalState, PV.snapshot(g), "R50a: preview final BattleState = played (incl. enemy stream and drawn pool)");
  const liveDraws = D.takeDrawCalls(g);
  same(liveDraws, [copyDraws[0].replace("copy:", "live:")], "R50a: the played turn's only draw is the turn end's, equal to the copy's");
  out.frozen = { orders, plan0, pool0: store0.pool, nextPool: D.drawStore(g).pool, finalStateHash: PV.sha256(JSON.stringify(PV.snapshot(g))), eventHash: PV.L.hashEvents(events) };

  // ---- R50b ------------------------------------------------------------------------------------------------------------
  const budget1 = C.one(events, "enemyBudget");
  same(budget1.pool, store0.pool, "R50b: the turn's pool is the drawn list");
  const un1 = C.one(events, "unassigned");
  same(un1.reasons.map((r) => [r.code, r.count, r.actions ?? null]), [["no-valid-assignment", 1, ["Attack"]]], "R50b: the unplaceable Attack is unassigned (no-valid-assignment)");
  const acc1 = C.checkAccounting(C.one(events, "enemyAccounting"), "R50b turn 1");
  PV.L.queueByIndex(g, "playerFlank", [0]);
  const events2 = PV.L.drainTurn(g);
  const budget2 = C.one(events2, "enemyBudget");
  check(budget2.budget === 5 && budget2.pool.length === 5, "R50b: turn 2 starts from a fresh draw of exactly the budget (no refund, no carry-over)");
  same(budget2.pool, out.frozen.nextPool, "R50b: turn 2 uses the list drawn at turn 1's end");
  const acc2 = C.checkAccounting(C.one(events2, "enemyAccounting"), "R50b turn 2");
  out.unassigned = { turn1: acc1, turn2: { pool: budget2.pool, ...acc2 } };

  const z = track(D.boot(`${D.DRAW}&rules=eab:0`));
  const zSeed = z.ev("deriveEnemyDrawSeed(1)");
  same(D.drawStore(z), { state: zSeed, pool: [] }, "R50b: budget 0 draws an empty list and consumes no stream value");
  PV.L.queueByIndex(z, "player", [0]);
  const zEvents = PV.L.drainTurn(z);
  same(C.one(zEvents, "unassigned").reasons.map((r) => r.code), ["budget-zero"], "R50b: budget 0 -> budget-zero");
  check(D.drawStore(z).state === zSeed, "R50b: budget 0: the stream never moves");
  const t = track(D.boot(`${D.DRAW}&rules=eab:10`));
  const tPool = D.drawStore(t).pool;
  check(tPool.length === 10 && Object.values(D.counts(tPool)).every((n) => n <= 4), "R50b: budget 10 draws 10 actions, cap raised to 4");
  out.edgeBudgets = { eab0: C.checkAccounting(C.one(zEvents, "enemyAccounting"), "R50b eab:0"), eab10Pool: tPool, eab10Plan: C.packQueue(t) };

  // ---- R50c ------------------------------------------------------------------------------------------------------------
  const l = track(D.boot(D.DRAW));
  const lOrders = PV.BOARDS.lethal.setup(l);
  const lPlan = C.packQueue(l);
  const e1Plan = lPlan.filter((e) => e.unit === "E1").map((e) => e.action);
  check(e1Plan.length >= 2, `R50c: E1 has several frozen actions (${e1Plan.join(",")})`);
  D.installDrawSpy(l);
  C.installPlannerSpy(l);
  const lPreview = PV.dryRun(l);
  check(lPreview.ok === true, "R50c: preview ran");
  D.takeDrawCalls(l);
  const lEvents = await PV.L.playTurn(l);
  same(lPreview.result.events, lEvents, "R50c: preview events = played events");
  same(lPreview.result.finalState, PV.snapshot(l), "R50c: preview final state = played final state");
  check(C.ofType(lEvents, "replan").length === 0, "R50c: no mid-turn replan");
  check(C.plannerCalls(l).live === 1 && D.drawCalls(l).length === 1, "R50c: the only live planning and draw is the turn end's");
  const death = C.ofType(lEvents, "death").find((e) => e.unit === "E1");
  check(death && death.tick === 1, "R50c: E1 dies in tick 1");
  const e1Spent = (lEvents.find((e) => e.type === "consumed" && e.tick === 1)?.actions ?? []).filter((x) => x.unit === "E1").length;
  same(C.ofType(lEvents, "forfeited"), [{ type: "forfeited", unit: "E1", tick: 1, actions: e1Plan.slice(e1Spent) }], "R50c: E1's remaining actions are forfeited");
  const lAcc = C.checkAccounting(C.one(lEvents, "enemyAccounting"), "R50c");
  check(lAcc.spent <= 5, "R50c: spent <= budget");
  const block = C.enemyNoteBlock(l.ev("lastBattleDebugReport"));
  check(block[0] === "Enemy actions (commanderdraw, experimental: commander + random enemy action draw):" && block[1].startsWith("Budget 5 | drawn 5: "), "R50c: note block names the drawn list");
  out.forfeit = { orders: lOrders, plan: lPlan, accounting: lAcc, note: block };

  out.hands = D.reportDrawHands(ID, ctxs);
  return { header: D.REQ_HEADER_DRAW, result: out };
}

module.exports = { id: ID, run };
