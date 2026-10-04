"use strict";
// REQUIREMENT — enemy-action experiment (hard assertions; evidence in the golden)
// R29: FORFEIT ON DEATH, NO EXTRA BUDGET. Hand-authored lethal board (_preview BOARDS.lethal: 1-HP E1 between P1 and
//      P2 dies in tick 1, E2 / E3 survive; orders as hand cards), commander preset with the default numbers (budget 5).
//      The frozen plan is computed when the orders are queued (the board reset started a new planning phase). Played
//      for real (Play) after a preview:
//        - no mid-turn replan (no "replan" event, no live planning during the ticks);
//        - E1's remaining planned actions are FORFEITED (forfeited event: unit, tick, actions) and never executed;
//        - the survivors' queues after tick 1 are exactly their frozen plans minus the actions they consumed;
//        - enemy actions spent <= budget, and the accounting invariants hold (enemyAccounting event);
//        - the next turn's plan is a fresh plan from the full configured budget (equals a planner run on a copy of
//          the end state); a second turn (headless drain) starts with budget 5 again (nothing carries over);
//        - the preview equals the played turn; the "Enemy actions" note block is pinned in the golden.
//      Control (current preset, same board): today's casualty replan from a fresh pool, recorded as characterization
//      (replan queue, total enemy actions consumed), with no commander-only events / fields / note block.
const C = require("./_cmd.cjs");
const { PV, S } = C;
const { check, same, J } = S;

const ID = "r29-commander-forfeit";
const ENEMIES = ["E1", "E2", "E3"];
const enemyConsumedAt = (events, tick) => (events.find((e) => e.type === "consumed" && e.tick === tick)?.actions ?? []).filter((x) => ENEMIES.includes(x.unit));
const totalEnemyConsumed = (events) => C.ofType(events, "consumed").reduce((n, e) => n + e.actions.filter((x) => ENEMIES.includes(x.unit)).length, 0);

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- commander
  const g = track(C.bootCommander());
  const orders = PV.BOARDS.lethal.setup(g);
  check(C.frozen(g) === true, "queueing the orders planned and froze the plan of the new phase");
  const plan0 = C.packQueue(g);
  const planOf = (id) => plan0.filter((e) => e.unit === id).map((e) => e.action);
  check(planOf("E1").length >= 2, `E1 has several planned actions (${planOf("E1").join(",")})`);
  C.installPlannerSpy(g);
  const preview = PV.dryRun(g);
  check(preview.ok, "preview ran");
  const events = await PV.L.playTurn(g);
  const note = g.ev("lastBattleDebugReport");
  same(preview.result.events, events, "preview events = played events");
  same(preview.result.finalState, PV.snapshot(g), "preview final state = played final state");

  check(C.ofType(events, "replan").length === 0, "commander: no mid-turn replan event");
  check(C.plannerCalls(g).live === 1, "commander: the only live planning is the turn end's (next phase)");
  const death = C.ofType(events, "death").find((e) => e.unit === "E1");
  check(death && death.tick === 1, "E1 dies in tick 1");
  const e1Spent = enemyConsumedAt(events, 1).filter((x) => x.unit === "E1").length;
  const forfeited = C.ofType(events, "forfeited");
  same(forfeited, [{ type: "forfeited", unit: "E1", tick: 1, actions: planOf("E1").slice(e1Spent) }], "E1's remaining actions are forfeited (unit, tick, actions)");
  check(C.ofType(events, "consumed").every((e) => e.tick === 1 || e.actions.every((x) => x.unit !== "E1")), "forfeited actions are never executed");
  const tickEnd1 = events.find((e) => e.type === "tickEnd" && e.tick === 1);
  ["E2", "E3"].forEach((id) => {
    const spent = enemyConsumedAt(events, 1).filter((x) => x.unit === id).length;
    same(tickEnd1.queues[id], planOf(id).slice(spent), `${id}: queue after tick 1 = its frozen plan minus what it consumed (untouched)`);
  });
  const acc = C.one(events, "enemyAccounting");
  const counts = C.checkAccounting(acc, "commander forfeit turn");
  check(counts.assigned === plan0.length && counts.forfeited === planOf("E1").length - e1Spent && counts.spent === totalEnemyConsumed(events), "accounting matches the events");
  check(counts.spent <= 5 && totalEnemyConsumed(events) <= 5, `enemy actions spent ${counts.spent} <= budget 5 (a casualty creates no budget)`);

  const plan1 = C.packQueue(g);
  const fresh = J(g, `withBattleState(snapshotBattleState(), () => { planEnemyPackTurnRules(units.filter((u) => u.team === "enemy" && u.type === "wolf"), units.filter((u) => u.team === "player")); return getPackQueueData(); })`);
  same(plan1, fresh, "the next turn's plan is a fresh plan from the configured budget / pool");
  check(C.previewPlan(events).planned === true && C.frozen(g) === true, "the next phase's plan is frozen");
  const turn2Orders = [...PV.L.queueByIndex(g, "playerSupport", [0]), ...PV.L.queueByIndex(g, "playerFlank", [0])];
  same(C.packQueue(g), plan1, "queueing turn-2 orders keeps the frozen plan");
  const events2 = PV.L.drainTurn(g);
  const budget2 = C.one(events2, "enemyBudget");
  check(budget2.budget === 5, "turn 2 starts with the full budget 5 again (nothing carried over)");
  same(budget2.assigned, plan1, "turn 2 is assigned the fresh plan");
  const counts2 = C.checkAccounting(C.one(events2, "enemyAccounting"), "commander turn 2");

  // ---- current (control, characterization)
  const c = track(C.bootCurrent());
  same(PV.BOARDS.lethal.setup(c), orders, "control: same orders");
  const cPlan0 = C.packQueue(c);
  const cEvents = await PV.L.playTurn(c);
  const cNote = c.ev("lastBattleDebugReport");
  C.checkCurrentUntouched(cEvents, cNote, "current control");
  const replans = C.ofType(cEvents, "replan");
  check(replans.length >= 1 && replans[0].tick === 1, "current: the casualty replans from a fresh pool in tick 1");

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, x) => n + S.handsOf(x), 0));
  return {
    header: C.REQ_HEADER_CMD,
    handsGenerated,
    board: PV.BOARDS.lethal.description,
    orders,
    commander: {
      frozenPlan: plan0,
      forfeited: forfeited.map(({ type, ...rest }) => rest),
      queuesAfterTick1: Object.fromEntries(["E2", "E3"].map((id) => [id, tickEnd1.queues[id]])),
      accounting: counts,
      enemyActionsNote: C.enemyNoteBlock(note),
      events: PV.summarizeEvents(events),
      nextTurnPlan: plan1,
      turn2: { orders: turn2Orders, accounting: counts2 },
    },
    currentCharacterization: {
      planBeforePlay: cPlan0,
      replanQueues: replans.map((r) => r.queue),
      enemyActionsConsumed: totalEnemyConsumed(cEvents),
      events: PV.summarizeEvents(cEvents),
    },
  };
}
module.exports = { id: ID, run };
