"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C5: UNIT_RECOVERY_SAFE_TURNS (=2) recovery. devTest.runTurn does NOT call applyTurnEndRecovery (only
// executePlayerActionQueue's finally does, and that also invokes the enemy planner). So each scripted
// turn here is: hand-authored queues -> window.devTest.runTurn() -> applyTurnEndRecovery() called
// directly, mirroring executePlayerActionQueue's finally block order (turn end -> recovery).
// Pairs: P1 vs E1 at (5,5)/(5,6); P2 (starts at 6 HP) vs E2 at (10,10)/(10,11).
const { HEADER, freshClearBoard, units, runTurn } = require("./_lib.cjs");

const ID = "c5-two-turn-recovery";

const TURNS = [
  { label: "T1: E1 hits P1; E2 defends", enemy: [["enemy", "Attack"], ["enemySupport", "Defend"]] },
  { label: "T2: E2 hits P2 (P2 was due to heal); E1 defends", enemy: [["enemy", "Defend"], ["enemySupport", "Attack"]] },
  { label: "T3: everyone defends", enemy: [["enemy", "Defend"], ["enemySupport", "Defend"]] },
];

async function run() {
  const g = freshClearBoard([
    { row: 5, col: 5, direction: "bottomRight" }, { row: 10, col: 10, direction: "bottomRight", health: 6 }, null,
    { row: 5, col: 6, direction: "topLeft" }, { row: 10, col: 11, direction: "topLeft" }, null,
  ]);
  const snap = () => {
    const u = units(g);
    return Object.fromEntries(["P1", "P2", "E1", "E2"].map((id) => [id,
      { health: u[id].health, turnsSinceHit: u[id].turnsSinceHit, tookDamageThisTurn: u[id].tookDamageThisTurn }]));
  };
  const out = { header: HEADER, recoveryDriver: "runTurn + direct applyTurnEndRecovery() per turn", safeTurns: g.ev("UNIT_RECOVERY_SAFE_TURNS"), start: snap(), turns: [] };
  for (const t of TURNS) {
    g.ev(`queueDevTestPackActions(${JSON.stringify(t.enemy.map(([unitId, action]) => ({ unitId, action })))})`);
    await runTurn(g);
    const afterTurn = snap();
    g.ev("applyTurnEndRecovery()");
    out.turns.push({ label: t.label, afterTurnBeforeRecovery: afterTurn, afterRecovery: snap() });
  }
  return out;
}
module.exports = { id: ID, run };
