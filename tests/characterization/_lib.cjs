"use strict";
// Shared helpers for characterization fixtures. Not a fixture itself.
const { loadGame } = require("../harness/load-game.cjs");
const { plain } = require("../harness/util.cjs");

const HEADER = "CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.";

/** Evaluate an expression in the game scope and return a plain JSON copy. */
function evJson(g, expr) {
  const out = g.ev(`JSON.stringify(${expr})`);
  return out === undefined ? null : plain(JSON.parse(out));
}

const UNIT_SNAP = `(function(){
  const all = [["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]];
  const o = {};
  all.forEach(([id,u]) => { o[id] = {
    row:u.row, col:u.col, direction:u.direction, health:u.health, isDefeated:!!u.isDefeated,
    isActive:isUnitActive(u), turnsSinceHit:u.turnsSinceHit, tookDamageThisTurn:u.tookDamageThisTurn,
    packObjective: u.packObjective ?? null, isFleeing: !!u.isFleeing,
    queue: u.team === "player" ? [...getUnitActionQueue(u)]
      : enemyPackActionQueue.filter((e) => e.unit === u).map((e) => e.action) }; });
  return o;
})()`;
const PACK_QUEUE = `enemyPackActionQueue.map((e) => ({ unit: getBattleDebugUnitId(e.unit), action: e.action }))`;
const FOCUS = `(enemyPackFocusTarget ? { row: enemyPackFocusTarget.row, col: enemyPackFocusTarget.col,
  unit: getBattleDebugUnitId(enemyPackFocusTarget) } : null)`;

const units = (g) => evJson(g, UNIT_SNAP);
const packQueue = (g) => evJson(g, PACK_QUEUE);
const focus = (g) => evJson(g, FOCUS);

/** Fresh context, clear board exactly as runDevTestScenario does, then hand-place all six units. */
function freshClearBoard(setups = [], { seed } = {}) {
  const g = loadGame(seed === undefined ? {} : { seed });
  g.ev("devTestObstaclesDisabled = true; clearArenaObstacles();");
  if (setups.length) resetUnits(g, setups);
  return g;
}

/** setups: [P1,P2,P3,E1,E2,E3] -> resetDevTest(P1,E1,P2,E2,P3,E3). Missing entries default to inactive. */
function resetUnits(g, setups) {
  const [p1, p2, p3, e1, e2, e3] = Array.from({ length: 6 }, (_, i) => setups[i] ?? { isActive: false });
  g.ev(`resetDevTest(${[p1, e1, p2, e2, p3, e3].map((s) => JSON.stringify(s)).join(",")})`);
}

async function runTurn(g) {
  return g.runLimited(() => g.ev("window.devTest.runTurn()"));
}
async function runTick(g) {
  return g.runLimited(() => g.ev("window.devTest.runTick()"));
}

module.exports = { HEADER, evJson, units, packQueue, focus, freshClearBoard, resetUnits, runTurn, runTick, loadGame, plain };
