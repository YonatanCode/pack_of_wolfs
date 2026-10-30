// Battle scenario definition for the Wilds battle.
// It recreates the original starting arena: a 16x16 board with procedurally generated terrain (grass/dirt patches,
// water, rocks that block movement and sight, flowers and trees), made repeatable by a FIXED terrain seed.
// Edits to this file change the scenario and therefore the build ID.
// See window.BATTLE_SCENARIOS for the loader contract.

(function () {
window.BATTLE_SCENARIOS = window.BATTLE_SCENARIOS || {};

// Deep freeze helper: recursively freeze all objects and arrays
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (obj[prop] !== null && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

window.BATTLE_SCENARIOS.wilds = deepFreeze({
  // Unique identifier for this scenario (must match file name and appear in loader registry).
  id: "wilds",

  // Human-readable label shown in the UI (e.g., in scenario picker, logs).
  label: "Wilds: trees, water and rocks",

  // Version number to invalidate cached state if scenario rules change.
  scenarioVersion: 1,

  // Grid dimensions: square arena of gridSize × gridSize tiles (the original arena size).
  gridSize: 16,

  // Seeds the gameplay random stream (hand draws). Separate from the terrain seed below.
  seed: 1,

  // Terrain configuration.
  terrain: {
    // Generated terrain: script.js runs the existing procedural generator (generateTerrain) at world origin (0, 0)
    // with spawn clearing, drawing ONLY from a stream seeded with this fixed terrain seed, so the map is identical on
    // every load. Seed 33 was chosen by inspecting the generated maps: a river through the middle, two rock
    // formations (one with a level-2 crest), three trees, flowers and dirt patches, every walkable cell connected and
    // all six spawn cells clear. Changing the seed (or the generator) changes the map.
    generated: { seed: 33 }
  },

  // Unit spawn positions for both player and enemy packs: the original arena's spawn cells
  // (centre column 7 of 16, roles at offsets 0 / -2 / +2), which the generator keeps clear of water, rocks and trees.
  spawns: {
    // Player pack: three wolves on the bottom row facing "topRight" (toward enemy).
    player: {
      primary: { row: 15, col: 7, direction: "topRight" },
      support: { row: 15, col: 5, direction: "topRight" },
      flank: { row: 15, col: 9, direction: "topRight" }
    },

    // Enemy pack: three wolves on the top row facing "bottomLeft" (toward player).
    enemy: {
      primary: { row: 0, col: 7, direction: "bottomLeft" },
      support: { row: 0, col: 5, direction: "bottomLeft" },
      flank: { row: 0, col: 9, direction: "bottomLeft" }
    }
  }
});
})();
