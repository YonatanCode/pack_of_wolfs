// Battle scenario definition for the Intro battle.
// This object defines the grid layout, terrain, unit spawns, and other scenario-specific parameters.
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

window.BATTLE_SCENARIOS.intro = deepFreeze({
  // Unique identifier for this scenario (must match file name and appear in loader registry).
  id: "intro",

  // Human-readable label shown in the UI (e.g., in scenario picker, logs).
  label: "Intro: open ground",

  // Version number to invalidate cached state if scenario rules change.
  scenarioVersion: 1,

  // Grid dimensions: square arena of gridSize × gridSize tiles.
  gridSize: 12,

  // Seeds the gameplay random stream (hand draws). Terrain is authored (see terrain below), not generated.
  seed: 1,

  // Terrain configuration.
  terrain: {
    // Base tile ID: every cell in the grid uses this single grass tile.
    // Value 22 is GRASS_BASE_TILES[0] in script.js; no decor, flowers, trees, ponds, or dirt.
    baseTile: 22,

    // Rock positions: [row, col] pairs placed on the outer ring only.
    // All 4 rocks are positioned at the side edges (row 0/11 or col 0/11).
    // The central 6×6 block (rows 3–8, cols 3–8) remains completely clear.
    // Rocks do not overlap any spawn cells.
    rocks: [[5, 0], [6, 0], [5, 11], [6, 11]]
  },

  // Unit spawn positions for both player and enemy packs.
  spawns: {
    // Player pack: three wolves facing "topRight" (toward enemy).
    player: {
      primary: { row: 11, col: 5, direction: "topRight" },
      support: { row: 11, col: 3, direction: "topRight" },
      flank: { row: 11, col: 8, direction: "topRight" }
    },

    // Enemy pack: three wolves facing "bottomLeft" (toward player).
    enemy: {
      primary: { row: 0, col: 5, direction: "bottomLeft" },
      support: { row: 0, col: 7, direction: "bottomLeft" },
      flank: { row: 0, col: 2, direction: "bottomLeft" }
    }
  }
});
})();
