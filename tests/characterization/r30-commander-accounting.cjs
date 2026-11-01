"use strict";
// REQUIREMENT — enemy-action experiment (hard assertions; evidence in the golden)
// R30: ENEMY-ACTION ACCOUNTING under commander, one hand-authored turn per case (drained headlessly through the real
//      turn core), with the exact reasons, the invariants (assigned = spent + forfeited + unplayed; budget = assigned
//      + unassigned; spent <= budget), the turn-start events (enemyBudget / unassigned) agreeing with the turn-end
//      enemyAccounting, and the exact "Enemy actions" battle-note block pinned in the golden:
//        no-valid-assignment  default numbers, every enemy wolf wounded (3/10) within flee range of P1: fleeing wolves
//                             never Attack (not even speculatively at a far target), so the pool's Attacks have no
//                             valid use. (A healthy wolf with no adjacent target now plans a speculative Attack, so
//                             the old far-board setup no longer leaves any Attack unassigned.);
//        pool-limit           budget 5, pool Move 2 only: the pool has only 2 actions;
//        budget-zero          budget 0: nothing assigned, the enemy passes;
//        unplayed             P1 (1 HP) alone next to E1: E1's first Attack kills it in tick 1, the battle ends with
//                             E1's other planned actions still queued.
//      (forfeit: r29.) Controls under the current preset (the far board and the unplayed board): no commander-only
//      events or fields and no "Enemy actions" block; the existing fixtures (c9, c10, r8, r9, r15 ...) pin that the
//      current events and battle notes are byte-identical to before.
const C = require("./_cmd.cjs");
const { PV, S } = C;
const { check, same } = S;

const ID = "r30-commander-accounting";
const LAST_STAND = (g) => {
  PV.L.resetUnits(g, [{ row: 5, col: 4, direction: "topRight", health: 1 }, null, null, { row: 4, col: 4, direction: "bottomLeft" }]);
  PV.queueCards(g, "player", ["Attack"]);
  return ["P1:Attack"];
};
const ALL_FLEEING = (g) => {
  PV.L.resetUnits(g, [{ row: 5, col: 4, direction: "topRight" }, null, null,
    { row: 5, col: 6, direction: "bottomLeft", health: 3 }, { row: 3, col: 5, direction: "bottomLeft", health: 3 }, { row: 7, col: 5, direction: "topLeft", health: 3 }]);
  PV.queueCards(g, "player", ["Defend"]);
  return ["P1:Defend"];
};
const CASES = [
  { id: "no-valid-assignment", rules: "", setup: ALL_FLEEING, expect: { reasons: ["no-valid-assignment"] } },
  { id: "pool-limit", rules: "epd:0,epa:0", setup: (g) => PV.BOARDS.plain.setup(g), expect: { reasons: ["pool-limit"] } },
  { id: "budget-zero", rules: "eab:0", setup: (g) => PV.BOARDS.plain.setup(g), expect: { reasons: ["budget-zero"], assigned: 0 } },
  { id: "unplayed", rules: "", setup: LAST_STAND, expect: { unplayedAtLeast: 1, winner: "enemy" } },
];

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  for (const def of CASES) {
    const g = track(C.bootCommander(def.rules));
    const orders = def.setup(g);
    const plan = C.packQueue(g);
    const events = PV.L.drainTurn(g);
    const note = g.ev("lastBattleDebugReport");
    const budgetEvent = C.one(events, "enemyBudget");
    const unassigned = C.one(events, "unassigned");
    const acc = C.one(events, "enemyAccounting");
    const counts = C.checkAccounting(acc, def.id);
    same(budgetEvent.assigned, plan, `${def.id}: enemyBudget.assigned = the frozen plan`);
    check(budgetEvent.budget === acc.budget && budgetEvent.poolSize === acc.pool.length && unassigned.count === acc.unassigned, `${def.id}: turn-start events agree with the turn-end accounting`);
    same(unassigned.reasons, acc.reasons, `${def.id}: same reasons at turn start and turn end`);
    same(acc.reasons.map((r) => r.code), def.expect.reasons ?? acc.reasons.map((r) => r.code), `${def.id}: reason codes`);
    if (def.expect.assigned !== undefined) check(acc.assigned === def.expect.assigned, `${def.id}: assigned ${acc.assigned}`);
    if (def.id === "no-valid-assignment") {
      const r = acc.reasons[0];
      check(r.count === acc.unassigned && r.actions.length > 0 && r.actions.every((a) => a === "Attack"), `no-valid-assignment: the unplaceable pool actions are Attacks (${r.actions.join(",")})`);
      check(r.message === `the planner could place no valid use for ${r.actions.length} pool action(s): ${r.actions.join(", ")}`, "no-valid-assignment: exact message");
    }
    if (def.id === "pool-limit") {
      check(acc.budget === 5 && acc.pool.length === 2 && acc.reasons[0].count === 3 && acc.reasons[0].message === "the pool has only 2 actions", "pool-limit: budget 5 > pool 2, x3, exact message");
    }
    if (def.id === "budget-zero") {
      check(acc.spent === 0 && acc.reasons[0].message === "the enemy action budget is 0" && C.ofType(events, "consumed").every((e) => e.actions.every((x) => !/^E/.test(x.unit))), "budget-zero: the enemy passes");
    }
    if (def.id === "unplayed") {
      const outcome = C.one(events, "outcome");
      check(outcome.winner === "enemy" && acc.unplayed >= def.expect.unplayedAtLeast && acc.forfeited === 0, `unplayed: the battle ended with ${acc.unplayed} planned action(s) still queued`);
      same(acc.unplayedActions, plan.slice(acc.spent), "unplayed: exactly the plan after the spent actions");
    }
    const block = C.enemyNoteBlock(note);
    check(block.length === 8 && block[block.length - 1].startsWith("Check: assigned"), `${def.id}: the note ends with the Enemy actions block`);
    out[def.id] = { rules: def.rules || "(defaults)", orders, plan, accounting: counts, reasons: acc.reasons, enemyActionsNote: block };
  }

  // controls under the current preset
  const controls = {};
  [["far board", (g) => PV.BOARDS.plain.setup(g)], ["last stand", LAST_STAND]].forEach(([label, setup]) => {
    const g = track(C.bootCurrent());
    setup(g);
    const events = PV.L.drainTurn(g);
    C.checkCurrentUntouched(events, g.ev("lastBattleDebugReport"), `current ${label}`);
    controls[label] = { events: PV.summarizeEvents(events), noCommanderEvents: true, noEnemyActionsBlock: true };
  });

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, x) => n + S.handsOf(x), 0));
  return { header: C.REQ_HEADER_CMD, handsGenerated, cases: out, currentControls: controls };
}
module.exports = { id: ID, run };
