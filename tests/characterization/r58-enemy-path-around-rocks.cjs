"use strict";
// REQUIREMENT — enemy planner (hard assertions; evidence in the golden)
// R58 PATH AROUND ROCKS: an engaging enemy wolf measures its distance to its goal as the walkable step-count (the BFS field
//     that routes around hills, water and trees), not Manhattan. One hand-authored board, no randomized hands:
//       a 5-tile hill wall (col 5, rows 3-7) stands directly east of E3 (5,4); P1 is behind it at (5,10); the pool is Move x3
//       (rules epm:3,epd:0,epa:0). With Manhattan every step looks worse or blocked (the wolf is boxed in); with the
//       walkable field E3 plans Moves along the wall toward its open end, and its walkable distance to P1 shrinks.
const C = require("./_cmd.cjs");
const L = require("./_lib.cjs");
const { PV, S } = C;
const { check } = S;

const ID = "r58-enemy-path-around-rocks";

async function run() {
  const g = C.bootCommander("epm:3,epd:0,epa:0");
  g.ev("devTestObstaclesDisabled = true; clearArenaObstacles();");
  for (let row = 3; row <= 7; row += 1) g.ev(`hillTileKeys.add(getGridPositionKey(${row}, 5))`);
  L.resetUnits(g, [{ row: 5, col: 10, direction: "topRight" }, null, null, null, null, { row: 5, col: 4, direction: "bottomLeft" }]);
  PV.queueCards(g, "player", ["Defend"]);
  const walk = (row, col) => g.ev(`getFieldDistance(buildWalkableDistanceField(5, 10), ${row}, ${col})`);
  const before = walk(5, 4);
  const plan = C.packQueue(g);
  const events = PV.L.drainTurn(g);
  const after = L.units(g).E3;

  check(plan.length > 0 && plan.every((p) => p.unit === "E3" && p.action === "Move"), "E3 plans Moves (it is not boxed in)");
  check(after.row !== 5 || after.col !== 4, `E3 left its start (${after.row},${after.col})`);
  check(walk(after.row, after.col) < before, `E3's walkable distance to P1 shrank (${before} -> ${walk(after.row, after.col)})`);
  C.checkAccounting(C.one(events, "enemyAccounting"), ID);

  const handsGenerated = S.reportStepHands(ID, S.handsOf(g));
  return { header: C.REQ_HEADER_CMD, handsGenerated, plan, walkBefore: before, walkAfter: walk(after.row, after.col), e3After: { row: after.row, col: after.col } };
}
module.exports = { id: ID, run };
