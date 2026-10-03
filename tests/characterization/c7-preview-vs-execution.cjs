"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C7: getPlayerMovePreviewTarget (script.js:3512) predicts the destination assuming other units stand
// still at their start tiles. Then the same Move executes (devTest.runTick) while an enemy moves too.
// Records predicted vs actual.
const { HEADER, freshClearBoard, units, runTick, evJson } = require("./_lib.cjs");

const ID = "c7-preview-vs-execution";

const CASES = {
  "enemy-idle": { enemyQueue: [] },
  "enemy-moves-same-tick": { enemyQueue: ["Move"] },
};

async function run() {
  const out = { header: HEADER, cases: {} };
  for (const [name, c] of Object.entries(CASES)) {
    const g = freshClearBoard([
      { row: 5, col: 3, direction: "bottomRight", movementMode: "Hunt" }, null, null,
      { row: 5, col: 8, direction: "topLeft" },
    ]);
    g.ev(`queueDevTestActions(["Move"], ${JSON.stringify(c.enemyQueue)})`);
    const predicted = evJson(g, "getPlayerMovePreviewTarget(player)");
    const start = units(g);
    await runTick(g);
    const after = units(g);
    out.cases[name] = {
      start: { P1: [start.P1.row, start.P1.col], E1: [start.E1.row, start.E1.col] },
      predicted,
      actual: { row: after.P1.row, col: after.P1.col, direction: after.P1.direction },
      enemyActual: [after.E1.row, after.E1.col],
      matches: predicted.row === after.P1.row && predicted.col === after.P1.col,
    };
  }
  return out;
}
module.exports = { id: ID, run };
