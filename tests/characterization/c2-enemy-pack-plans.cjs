"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C2: planEnemyPackTurn on three hand-placed setups (obstacles cleared, grid 16). Records the full
// ordered queue as (E1/E2/E3, action), the focus target and every wolf's packObjective.
const { HEADER, freshClearBoard, packQueue, focus, units } = require("./_lib.cjs");

const ID = "c2-enemy-pack-plans";
// order: [P1, P2, P3, E1, E2, E3]
const SETUPS = {
  "A-far-healthy": [
    { row: 12, col: 6, direction: "topRight" }, { row: 12, col: 8, direction: "topRight" }, { row: 13, col: 7, direction: "topRight" },
    { row: 3, col: 6, direction: "bottomLeft" }, { row: 3, col: 8, direction: "bottomLeft" }, { row: 2, col: 10, direction: "bottomLeft" },
  ],
  "B-contact": [
    { row: 6, col: 6, direction: "topRight" }, { row: 6, col: 9, direction: "topRight" }, { row: 8, col: 6, direction: "topRight" },
    { row: 5, col: 6, direction: "bottomLeft" }, { row: 6, col: 10, direction: "topLeft" }, { row: 4, col: 8, direction: "bottomLeft" },
  ],
  "C-wounded-flee": [
    { row: 8, col: 6, direction: "topRight" }, { row: 9, col: 9, direction: "topRight" }, null,
    { row: 5, col: 7, direction: "bottomLeft" }, { row: 6, col: 6, direction: "bottomLeft", health: 2 }, { row: 4, col: 5, direction: "bottomLeft" },
  ],
};

async function run() {
  const out = { header: HEADER, setups: {} };
  for (const [name, setup] of Object.entries(SETUPS)) {
    const g = freshClearBoard(setup);
    g.ev(`planEnemyPackTurn(units.filter((u) => u.team === "enemy" && u.type === "wolf"), units.filter((u) => u.team === "player"))`);
    const u = units(g);
    out.setups[name] = {
      placement: Object.fromEntries(Object.entries(u).map(([id, s]) => [id, { row: s.row, col: s.col, health: s.health, isActive: s.isActive }])),
      queue: packQueue(g),
      queueLength: packQueue(g).length,
      focusTarget: focus(g),
      packObjectives: { E1: u.E1.packObjective, E2: u.E2.packObjective, E3: u.E3.packObjective },
      isFleeing: { E1: u.E1.isFleeing, E2: u.E2.isFleeing, E3: u.E3.isFleeing },
    };
  }
  return out;
}
module.exports = { id: ID, run };
