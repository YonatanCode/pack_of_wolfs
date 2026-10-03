"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C3: an attacker's intended adjacent target leaves; another opposing unit is adjacent.
// getLiveAttackTarget (script.js:6380) falls back to ANY adjacent enemy. One hand-authored tick each.
const { HEADER, freshClearBoard, units, runTick } = require("./_lib.cjs");

const ID = "c3-attack-target-switch";

const CASES = {
  // Control: intended target stays (Hunt would not move it; no queue). E1 hits P1.
  "control-target-stays": {
    setup: [{ row: 5, col: 4, direction: "bottomLeft" }, { row: 4, col: 3, direction: "topRight" }, null,
      { row: 4, col: 4, direction: "bottomLeft" }],
    playerQueues: {}, enemyQueue: ["Attack"],
  },
  // Same geometry as the built-in intent-target-fallback scenario: P1 Dodges away, P2 stays adjacent.
  "intended-moves-away-other-adjacent": {
    setup: [{ row: 5, col: 4, direction: "bottomLeft", movementMode: "Dodge" }, { row: 4, col: 3, direction: "topRight" }, null,
      { row: 4, col: 4, direction: "bottomLeft" }],
    playerQueues: { player: ["Move"] }, enemyQueue: ["Attack"],
  },
  // Intended target leaves and nobody else is adjacent: the swing whiffs.
  "intended-moves-away-nobody-adjacent": {
    setup: [{ row: 5, col: 4, direction: "bottomLeft", movementMode: "Dodge" }, null, null,
      { row: 4, col: 4, direction: "bottomLeft" }],
    playerQueues: { player: ["Move"] }, enemyQueue: ["Attack"],
  },
};

async function run() {
  const out = { header: HEADER, cases: {} };
  for (const [name, c] of Object.entries(CASES)) {
    const g = freshClearBoard(c.setup);
    const q = c.playerQueues.player ?? [];
    g.ev(`queueDevTestActions(${JSON.stringify(q)}, ${JSON.stringify(c.enemyQueue)})`);
    const before = units(g);
    await runTick(g);
    const after = units(g);
    out.cases[name] = {
      damageTaken: Object.fromEntries(Object.keys(after).map((id) => [id, before[id].health - after[id].health]).filter(([, d]) => d !== 0)),
      positionsAfter: Object.fromEntries(["P1", "P2", "E1"].map((id) => [id, [after[id].row, after[id].col]])),
      healthAfter: Object.fromEntries(Object.keys(after).map((id) => [id, after[id].health])),
    };
  }
  return out;
}
module.exports = { id: ID, run };
