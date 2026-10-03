"use strict";
// REQUIREMENT — P1b acceptance
// R1: the real boot route (?scenario=intro&seed=1) produces the authored intro battlefield, and
// ?mode=world still boots the original procedural world path. Hard assertions; the golden only
// stores the evidence that was checked.
const { REQ_HEADER, SPAWNS, check, same, bootScenario, hand, seeds, loadGame, evJson } = require("./_scn.cjs");

const ID = "r1-intro-layout";

async function run() {
  const g = bootScenario(1);
  const def = evJson(g, "window.BATTLE_SCENARIOS.intro");
  check(def && def.id === "intro", "window.BATTLE_SCENARIOS.intro registered");
  same(seeds(g), { scenarioId: "intro", scenarioVersion: def.scenarioVersion, seed: 1, handSeed: 1 }, "boot seeds");
  check(g.ev("GRID_SIZE") === 12, "grid is 12x12");
  const terrain = evJson(g, "terrainTiles");
  check(terrain.length === 12 && terrain.every((r) => r.length === 12), "terrain matrix is 12x12");
  const base = terrain[0][0];
  check(terrain.every((r) => r.every((t) => t === base)), "uniform base tile");
  const key = (r, c) => g.ev(`getGridPositionKey(${r},${c})`);
  const rocks = [[5, 0], [6, 0], [5, 11], [6, 11]];
  same(evJson(g, "[...hillTileKeys].sort()"), rocks.map(([r, c]) => key(r, c)).sort(), "exactly the 4 rocks");
  same(def.terrain.rocks, rocks, "scenario rock list is the 4 expected rocks");
  check(evJson(g, "pondTileKeys.size") === 0, "no ponds");
  check(evJson(g, "treeTileKeys.size") === 0, "no trees");
  check(evJson(g, "flowerTileKeys.size") === 0, "no flowers");
  check(g.ev("enemyMode") === "wolves", "enemyMode wolves");

  const unitVars = { P1: "player", P2: "playerSupport", P3: "playerFlank", E1: "enemy", E2: "enemySupport", E3: "enemyFlank" };
  const pos = evJson(g, `({ ${Object.entries(unitVars).map(([id, v]) => `${id}: { row: ${v}.row, col: ${v}.col, direction: ${v}.direction, active: isUnitActive(${v}), health: ${v}.health, max: ${v}.maxHealth, type: ${v}.type }`).join(",")} })`);
  Object.keys(SPAWNS).forEach((id) => {
    same({ row: pos[id].row, col: pos[id].col, direction: pos[id].direction }, SPAWNS[id], `${id} spawn exact`);
    check(pos[id].active && pos[id].health === pos[id].max && pos[id].type === "wolf", `${id} active full-health wolf`);
  });
  same(def.spawns, { player: { primary: SPAWNS.P1, support: SPAWNS.P2, flank: SPAWNS.P3 }, enemy: { primary: SPAWNS.E1, support: SPAWNS.E2, flank: SPAWNS.E3 } }, "scenario spawn definition");
  const cells = Object.values(pos).map((p) => `${p.row},${p.col}`);
  check(new Set(cells).size === 6, "six distinct spawn cells");
  // clear central 6x6 (rows/cols 3..8): no rock, pond, tree, flower, unit
  for (let r = 3; r <= 8; r += 1) for (let c = 3; c <= 8; c += 1) {
    check(!g.ev(`hillTileKeys.has(${JSON.stringify(key(r, c))})`), `central cell ${r},${c} has no rock`);
    check(!cells.includes(`${r},${c}`), `central cell ${r},${c} has no unit`);
  }
  check(hand(g).length === 5, "hand drawn on boot");
  check(g.ev("document.getElementById('restart-battle').hidden") === false, "#restart-battle visible in a scenario");

  // ?mode=world: original procedural path
  const w = loadGame({ query: "?mode=world", scenarios: true });
  check(seeds(w).scenarioId === null, "world mode: no active scenario");
  check(w.ev("window.devTest.restartBattle()") === false, "world mode: restartBattle refused");
  check(evJson(w, "window.devTest.world()") && typeof evJson(w, "window.devTest.world()") === "object", "world mode: world state exists");
  check(hand(w).length === 5, "world mode: hand still drawn");
  check(w.ev("document.getElementById('restart-battle').hidden") === true, "#restart-battle hidden in ?mode=world");
  const wTerrain = evJson(w, "terrainTiles");
  const wSets = evJson(w, "[hillTileKeys.size, pondTileKeys.size, treeTileKeys.size, flowerTileKeys.size]");
  check(JSON.stringify(wTerrain) !== JSON.stringify(terrain), "world terrain differs from intro terrain");
  check(wSets.some((n) => n > 0) && !(wSets[0] === 4 && wSets[1] === 0 && wSets[2] === 0 && wSets[3] === 0), "world terrain has procedural features");
  check(seeds(w).handSeed !== null, "world mode: hand stream seeded");
  // no-query default (original headless boot) is also the world path
  const d = loadGame({ scenarios: true });
  check(seeds(d).scenarioId === null && hand(d).length === 5, "no location at all: world boot");

  return {
    header: REQ_HEADER,
    checked: { grid: 12, baseTile: base, rocks, spawns: SPAWNS, centralClear: "rows/cols 3..8", enemyMode: "wolves", seeds: seeds(g), restartButtonHidden: false },
    worldMode: { scenarioId: null, features: { hills: wSets[0], ponds: wSets[1], trees: wSets[2], flowers: wSets[3] }, handSize: 5, restartButtonHidden: true },
  };
}
module.exports = { id: ID, run };
