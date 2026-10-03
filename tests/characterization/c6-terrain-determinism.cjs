"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C6: generateTerrain(GRID_SIZE=16, seed, x, y, true) as buildArena calls it (script.js:2737).
// Hashes (sha256, hex, first 16 chars shown alongside counts) of: sorted pond/hill/tree/flower key sets,
// hill levels (sorted key=level), and terrainTiles. Each seed uses a fresh context; each is also
// generated twice in the same context to record the repeat-identical flag.
const crypto = require("node:crypto");
const { HEADER, loadGame, evJson } = require("./_lib.cjs");

const ID = "c6-terrain-determinism";
const SEEDS = [{ seed: 12345, x: 0, y: 0 }, { seed: 987654321, x: 2, y: -1 }, { seed: 42, x: -3, y: 4 }];
const h = (s) => crypto.createHash("sha256").update(s).digest("hex");

const DUMP = `(function(size,seed,x,y){
  generateTerrain(size, seed, x, y, true);
  const sorted = (s) => [...s].sort();
  return { pond: sorted(pondTileKeys), hill: sorted(hillTileKeys), tree: sorted(treeTileKeys), flower: sorted(flowerTileKeys),
    levels: [...hillTileLevels.entries()].map(([k,v]) => k + "=" + v).sort(), tiles: terrainTiles };
})`;

async function run() {
  const out = { header: HEADER, gridSize: 16, seeds: [] };
  for (const s of SEEDS) {
    const g = loadGame();
    const call = `${DUMP}(16, ${s.seed}, ${s.x}, ${s.y})`;
    const a = evJson(g, call);
    const b = evJson(g, call);
    const hashes = (d) => ({
      pond: h(JSON.stringify(d.pond)), hill: h(JSON.stringify(d.hill)), tree: h(JSON.stringify(d.tree)),
      flower: h(JSON.stringify(d.flower)), hillLevels: h(JSON.stringify(d.levels)), terrainTiles: h(JSON.stringify(d.tiles)),
    });
    out.seeds.push({
      ...s,
      counts: { pond: a.pond.length, hill: a.hill.length, tree: a.tree.length, flower: a.flower.length, hillLevels: a.levels.length },
      hashes: hashes(a),
      repeatIdentical: JSON.stringify(hashes(a)) === JSON.stringify(hashes(b)),
    });
  }
  return out;
}
module.exports = { id: ID, run };
