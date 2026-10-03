"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C4: like scenario pack-replans-after-teammate-deaths (script.js:7722). A tick kills E1 and E2; the pack
// is then replanned MID-TURN (executeActionTick -> planEnemyPackTurn, which starts from a fresh 5-action
// doctrine pool). Records the FULL enemy queue before and after the death tick, its length, and an
// explicit replan check. Pool size is NOT asserted: only what the planner actually emitted is recorded.
const { HEADER, freshClearBoard, packQueue, focus, units, runTick } = require("./_lib.cjs");

const ID = "c4-replan-after-death";

const E3_POSITIONS = {
  // E3 far from the players: observed queue after the death is 3 entries (Attack is never assignable).
  "survivor-far": { row: 5, col: 14, direction: "bottomLeft" },
  // E3 six tiles from P1: observed queue after the death is 5 entries.
  "survivor-mid": { row: 5, col: 10, direction: "bottomLeft" },
  // E3 diagonal-adjacent to P1: observed queue after the death is 3 entries (Attack, Attack, Defend).
  "survivor-adjacent": { row: 4, col: 4, direction: "bottomRight" },
};

async function runCase(e3) {
  const g = freshClearBoard([
    { row: 5, col: 5, direction: "topLeft" }, { row: 5, col: 1, direction: "topRight" }, { isActive: false },
    { row: 5, col: 6, direction: "bottomLeft", health: 1 }, { row: 5, col: 2, direction: "bottomRight", health: 1 },
    e3,
  ]);
  g.ev(`queueDevTestPackActions([{unitId:"enemy",action:"Defend"},{unitId:"enemySupport",action:"Defend"},{unitId:"enemyFlank",action:"Defend"}]);
    getUnitActionQueue(player).push("Attack"); getUnitActionQueue(playerSupport).push("Attack");`);
  const queueBefore = packQueue(g);
  const unitsBefore = units(g);
  await runTick(g);
  const queueAfter = packQueue(g);
  const u = units(g);
  return {
    queueBefore, queueBeforeLength: queueBefore.length,
    queueAfter, queueAfterLength: queueAfter.length,
    replan: {
      afterQueueHasNoE1E2Entries: queueAfter.every((e) => e.unit !== "E1" && e.unit !== "E2"),
      afterQueueUnits: [...new Set(queueAfter.map((e) => e.unit))],
      afterQueueDiffersFromBefore: JSON.stringify(queueAfter) !== JSON.stringify(queueBefore),
    },
    focusAfter: focus(g),
    defeated: Object.fromEntries(Object.entries(u).map(([id, s]) => [id, s.isDefeated])),
    healthBefore: Object.fromEntries(Object.entries(unitsBefore).map(([id, s]) => [id, s.health])),
    healthAfter: Object.fromEntries(Object.entries(u).map(([id, s]) => [id, s.health])),
    positionsAfter: Object.fromEntries(Object.entries(u).map(([id, s]) => [id, [s.row, s.col]])),
    packObjectivesAfter: { E3: u.E3.packObjective },
  };
}

async function run() {
  const out = { header: HEADER, cases: {} };
  for (const [name, e3] of Object.entries(E3_POSITIONS)) out.cases[name] = await runCase(e3);
  return out;
}
module.exports = { id: ID, run };
