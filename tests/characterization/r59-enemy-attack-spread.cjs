"use strict";
// REQUIREMENT — enemy planner (hard assertions; evidence in the golden)
// R59 ATTACK SPREAD: one enemy wolf no longer takes every pooled Attack, and the Attack target comes from a scan of the
//     player wolves' health. Hand-authored boards, no randomized hands:
//       spread  P1 (8,8) alone; E1 (8,5) and E2 (5,8) are each one 3-tile Move from adjacent (E3 absent); pool Move x2 +
//               Attack x3 (rules epm:2,epd:0,epa:3). Before: the first wolf to step adjacent took all 3 Attacks. Now a
//               wolf that already holds an Attack waits while an idle wolf can still close in: no wolf plans 3 Attacks and
//               at least 2 wolves attack.
//       scan    E1 (8,7) is adjacent to P1 (8,8, 10 HP) and P2 (7,7, 3 HP); pool Attack x3. The first Attack is the finishing
//               blow on P2, the plan then stops aiming at the dead P2, so the other two hit P1.
const C = require("./_cmd.cjs");
const L = require("./_lib.cjs");
const { PV, S } = C;
const { check, same } = S;

const ID = "r59-enemy-attack-spread";

function board(rules, setups) {
  const g = C.bootCommander(rules);
  g.ev("devTestObstaclesDisabled = true; clearArenaObstacles();");
  L.resetUnits(g, setups);
  PV.queueCards(g, "player", ["Defend"]);
  return g;
}

async function run() {
  const out = {};

  const a = board("epm:2,epd:0,epa:3", [{ row: 8, col: 8, direction: "topRight" }, null, null,
    { row: 8, col: 5, direction: "topRight" }, { row: 5, col: 8, direction: "bottomRight" }]);
  const planA = C.packQueue(a);
  const attacksBy = {};
  planA.filter((p) => p.action === "Attack").forEach((p) => { attacksBy[p.unit] = (attacksBy[p.unit] ?? 0) + 1; });
  check(Object.keys(attacksBy).length >= 2 && Math.max(...Object.values(attacksBy)) <= 2, `spread: Attacks per wolf ${JSON.stringify(attacksBy)} (no wolf takes all 3, at least 2 attack)`);
  check(planA.length === 5, "spread: the whole hand is placed");
  C.checkAccounting(C.one(PV.L.drainTurn(a), "enemyAccounting"), "spread");
  out.spread = { plan: planA, attacksBy };

  const b = board("epm:0,epd:0,epa:3", [{ row: 8, col: 8, direction: "topRight" }, { row: 7, col: 7, direction: "topRight", health: 3 }, null,
    { row: 8, col: 7, direction: "topRight" }]);
  const planB = C.packQueue(b);
  const hits = C.ofType(PV.L.drainTurn(b), "hit").filter((h) => h.attacker === "E1").map((h) => h.target);
  same(hits, ["P2", "P1", "P1"], "scan: finishing blow on the 3-HP wolf first, then the healthy one (no Attack aimed at the dead wolf)");
  out.scan = { plan: planB, hitTargets: hits };

  const handsGenerated = S.reportStepHands(ID, S.handsOf(a) + S.handsOf(b));
  return { header: C.REQ_HEADER_CMD, handsGenerated, cases: out };
}
module.exports = { id: ID, run };
