"use strict";
// REQUIREMENT — enemy planner (hard assertions; evidence in the golden)
// R57 SPECULATIVE ATTACK: the planner no longer assigns an Attack only to a wolf that is adjacent in its planned position.
//     Priority is adjacent Attack > Move > Attack at the focus target > Defend, so a wolf that cannot approach (no Move in
//     the pool, or boxed in) still commits its Attacks (they resolve against live positions: a hit if either side closed
//     the gap, a Miss otherwise). One hand-authored board, no randomized hands:
//       lone-far-wolf   reported battle: only E3 alive and far, pool Defend x2 + Attack x3 (no Move): all 5 are placed,
//                       the three Attacks first, none unassigned (before: Defend x2 and Attack x3 no-valid-assignment);
//       fleeing-wolf    the same pool for a wounded E3 within flee range: a fleeing wolf never Attacks, the Attacks stay
//                       unassigned (no-valid-assignment).
const C = require("./_cmd.cjs");
const { PV, S } = C;
const { check, same } = S;

const ID = "r57-enemy-speculative-attack";
const FAR = { row: 5, col: 4, direction: "bottomLeft" };
const CASES = [
  { id: "lone-far-wolf", enemy: { ...FAR }, expectPlan: ["Attack", "Attack", "Attack", "Defend", "Defend"], expectReasons: [] },
  { id: "fleeing-wolf", enemy: { ...FAR, health: 3 }, expectPlan: ["Defend", "Defend"], expectReasons: ["no-valid-assignment"] },
];

async function run() {
  const ctxs = [];
  const out = {};

  for (const def of CASES) {
    const g = C.bootCommander("epm:0,epd:2,epa:3");
    ctxs.push(g);
    const near = def.id === "fleeing-wolf";
    PV.L.resetUnits(g, [{ row: 5, col: near ? 7 : 12, direction: "topRight" }, null, null, null, null, def.enemy]);
    PV.queueCards(g, "player", ["Defend"]);
    const plan = C.packQueue(g);
    const events = PV.L.drainTurn(g);
    same(plan.map((p) => p.action), def.expectPlan, `${def.id}: planned actions`);
    check(plan.every((p) => p.unit === "E3"), `${def.id}: every action is E3's`);
    const unassigned = C.one(events, "unassigned");
    same(unassigned.reasons.map((r) => r.code), def.expectReasons, `${def.id}: unassigned reasons`);
    C.checkAccounting(C.one(events, "enemyAccounting"), def.id);
    out[def.id] = { plan, reasons: unassigned.reasons };
  }

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, x) => n + S.handsOf(x), 0));
  return { header: C.REQ_HEADER_CMD, handsGenerated, cases: out };
}
module.exports = { id: ID, run };
