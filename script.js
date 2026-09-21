const DEFAULT_GRID_SIZE = 16;
const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 18;
let GRID_SIZE = DEFAULT_GRID_SIZE;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;
const WOLF_FRAME_SIZE = 64;
const STAG_FRAME_WIDTH = 32;
const STAG_FRAME_HEIGHT = 41;
const ISO_X_STEP = TILE_WIDTH / 2;
const ISO_Y_STEP = TILE_HEIGHT / 4;
const TILE_OPAQUE_TOP = 8;
const TILE_OPAQUE_FULL_TOP = 16;
const TILE_OPAQUE_FULL_BOTTOM = 24;
const DEFAULT_UNIT_TYPE = "wolf";
const PLAYER_MOVE_SPEED = 60;
const PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES = 5;
const PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES = 2;
const UNIT_MAX_HEALTH = 10;
const UNIT_RECOVERY_SAFE_TURNS = 2;
const UNIT_RECOVERY_HEAL_AMOUNT = 1;
const UNIT_ATTACK_DAMAGE = 3;
const UNIT_DEFENDED_DAMAGE = Math.ceil(UNIT_ATTACK_DAMAGE / 3);
const UNIT_HIT_REACTION_MS = 220;
const TILE_PATH = "isometric tileset/separated images";
const WOLF_PATH = "wolf/no effects";
const STAG_PATH = "stag";
const WOLF_DIRECTIONS = {
  bottomLeft: 0,
  bottomRight: 1,
  topLeft: 2,
  topRight: 3,
};
const STAG_DIRECTIONS = {
  bottomLeft: "SW",
  bottomRight: "SE",
  topLeft: "NW",
  topRight: "NE",
};
const ENEMY_MODES = ["wolves", "stag"];
const DEFAULT_ENEMY_MODE = "wolves";
const ACTIONS = ["Move", "Attack", "Defend"];
const ACTION_SLOT_COUNT = 5;
const ACTION_QUEUE_SLOT_COUNT = 5;
const RESHUFFLE_CHARGES_PER_BATTLE = 2;
const ACTION_ICONS = {
  Move: "assets/icons/move.svg",
  Attack: "assets/icons/attack.svg",
  Defend: "assets/icons/defend.svg",
};
const MOVE_ACTION_TILE_COUNT = 3;
const DIRECTION_TILE_DELTAS = {
  topLeft: { row: 0, col: -1 },
  topRight: { row: -1, col: 0 },
  bottomRight: { row: 0, col: 1 },
  bottomLeft: { row: 1, col: 0 },
};
const ANGLED_MOVEMENT_TILE_DELTAS = {
  top: { row: -1, col: -1 },
  right: { row: -1, col: 1 },
  bottom: { row: 1, col: 1 },
  left: { row: 1, col: -1 },
};
const MOVEMENT_TILE_DELTAS = {
  ...DIRECTION_TILE_DELTAS,
  ...ANGLED_MOVEMENT_TILE_DELTAS,
};
const MOVEMENT_DIRECTIONS = Object.keys(MOVEMENT_TILE_DELTAS);
const ATTACK_TILE_DELTAS = [
  ...Object.values(DIRECTION_TILE_DELTAS),
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];
const ACTION_ANIMATIONS = {
  Attack: { animationName: "bite", cycles: 1 },
  Defend: { animationName: "howl", cycles: 1 },
};
const ENEMY_PLAN_ACTION_COUNT = 5;
const ENEMY_AGGRESSIVE_DOCTRINE = ["Move", "Move", "Defend", "Attack", "Attack"];
const ENEMY_LOW_HEALTH_RATIO = 0.35;
// A wounded wolf bolts when a player is within this range and only rejoins the
// pack once it has opened up at least the (larger) safe range — the gap between
// the two values is intentional hysteresis so it commits to retreating instead
// of flip-flopping on the boundary.
const ENEMY_FLEE_TRIGGER_RANGE = 4;
const ENEMY_FLEE_SAFE_RANGE = 7;
const CLOSE_ICON = "assets/icons/close.svg";
const CLOCKWISE_DIRECTIONS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const PLAYER_MOVEMENT_MODES = ["Dodge", "Flank", "Hunt"];
const DEFAULT_PLAYER_MOVEMENT_MODE = "Hunt";
const unitDefinitions = {
  wolf: {
    className: "wolf",
    frameWidth: WOLF_FRAME_SIZE,
    frameHeight: WOLF_FRAME_SIZE,
    footX: 35,
    footY: 40,
    nudgeX: 4,
    nudgeY: -1,
    animations: {
      idle: { file: "wolf-idle.png", frames: 4, frameMs: 180 },
      run: { file: "wolf-run.png", frames: 8, frameMs: 95 },
      bite: { file: "wolf-bite.png", frames: 15, frameMs: 70 },
      howl: { file: "wolf-howl.png", frames: 9, frameMs: 115 },
      death: { file: "wolf-death.png", frames: 12, frameMs: 105 },
    },
    getAnimationSrc: (animationName) => `${WOLF_PATH}/${unitDefinitions.wolf.animations[animationName].file}`,
    getBackgroundPosition: (frameIndex, direction) => {
      const directionRow = WOLF_DIRECTIONS[direction] ?? WOLF_DIRECTIONS.bottomLeft;
      return `-${frameIndex * WOLF_FRAME_SIZE}px -${directionRow * WOLF_FRAME_SIZE}px`;
    },
    getPreloadDirections: () => [null],
  },
  stag: {
    className: "stag",
    frameWidth: STAG_FRAME_WIDTH,
    frameHeight: STAG_FRAME_HEIGHT,
    footX: 16,
    footY: 36,
    nudgeX: 0,
    nudgeY: 0,
    animations: {
      idle: {
        frames: 24,
        frameMs: 220,
        frameSequence: [
          0, 1, 0, 1, 0, 1, 0, 1,
          0, 1, 0, 1, 0, 1, 0, 1,
          2, 3, 4, 5, 5, 5, 5, 4, 3, 2,
          0, 1, 0, 1, 0, 1,
          0, 1, 0, 1, 0, 1,
          12, 13, 14, 14, 14, 14, 13, 12,
          0, 1, 0, 1, 0, 1, 0, 1,
          0, 1, 0, 1, 0, 1, 0, 1,
          20, 21, 22, 23, 23, 22, 22, 22, 22, 23, 22, 21, 20,
        ],
      },
      walk: { frames: 11, frameMs: 110 },
      run: { frames: 10, frameMs: 80 },
    },
    getAnimationSrc: (animationName, direction) => {
      const directionSuffix = STAG_DIRECTIONS[direction] ?? STAG_DIRECTIONS.bottomLeft;
      return `${STAG_PATH}/critter_stag_${directionSuffix}_${animationName}.png`;
    },
    getBackgroundPosition: (frameIndex) => `-${frameIndex * STAG_FRAME_WIDTH}px 0`,
    getPreloadDirections: () => Object.keys(STAG_DIRECTIONS),
  },
};

const EASING = {
  linear: (t) => t,
  cubicEaseOut: (t) => 1 - Math.pow(1 - t, 3),
};

const wait = (duration) => new Promise((resolve) => {
  setTimeout(resolve, duration);
});

const arena = document.querySelector("#arena");
const animationButtons = document.querySelectorAll("[data-animation]");
const directionButtons = document.querySelectorAll("[data-direction]");
const enemyModeButtons = document.querySelectorAll("[data-enemy-mode]");
const actionsList = document.querySelector("#actions-list");
const actionQueueList = document.querySelector("#action-queue-list");
const executeQueueButton = document.querySelector("#execute-queue");
const reshuffleButton = document.querySelector("#reshuffle-actions");
const devToolsToggle = document.querySelector("#toggle-dev-tools");
const debugControls = document.querySelector(".debug-controls");
const devTestScenariosList = document.querySelector("#dev-test-scenarios");
const devTestStatus = document.querySelector("#dev-test-status");
const copyBattleDebugButton = document.querySelector("#copy-battle-debug");
const battleDebugStatus = document.querySelector("#battle-debug-status");
const arenaSizeInput = document.querySelector("#arena-size-input");
const applyArenaSizeButton = document.querySelector("#apply-arena-size");
const arenaSizeStatus = document.querySelector("#arena-size-status");
const gameResultOverlay = document.querySelector("#game-result-overlay");
const restartButton = document.querySelector("#restart-button");
const tutorialToggle = document.querySelector("#toggle-tutorial");
const tutorialOverlay = document.querySelector("#tutorial-overlay");
const tutorialCloseButton = document.querySelector("#tutorial-close");
const tutorialCoachCatcher = document.querySelector("#tutorial-coach");
const tutorialSpotlight = document.querySelector("#tutorial-spotlight");
const tutorialCoachCard = document.querySelector("#tutorial-coach-card");
const tutorialCoachBody = document.querySelector("#tutorial-coach-body");
const tutorialCoachProgress = document.querySelector("#tutorial-coach-progress");
const tutorialNextButton = document.querySelector("#tutorial-next");
const tutorialSkipButton = document.querySelector("#tutorial-skip");
const tileElements = [];
const unitActionQueues = new WeakMap();
let reshuffleChargesRemaining = RESHUFFLE_CHARGES_PER_BATTLE;
let hoveredTile = null;
let hoveredHillBlock = null; // top cube highlighted under the cursor in hill-edit mode
let selectedPlayerUnit = null;
let isDevToolsEnabled = false;
let playerActionMenu = null;
let playerMovePreview = null;
let playerMovePreviewTile = null;
let isExecutingActionQueue = false;
let isGuidedTutorialActive = false;
let enemyMode = DEFAULT_ENEMY_MODE;
let activeBattleDebugLog = null;
let lastBattleDebugReport = "";

let boardWidth = 0;
let boardHeight = 0;
let xOffset = 0;
const player = createWolf({ row: GRID_SIZE - 1, col: 4, direction: "topRight", team: "player" });
const playerSupport = createWolf({ row: GRID_SIZE - 1, col: 2, direction: "topRight", team: "player" });
const playerFlank = createWolf({ row: GRID_SIZE - 1, col: 7, direction: "topRight", team: "player" });
const enemy = createWolf({ row: 0, col: 4, direction: "bottomLeft", team: "enemy" });
const enemySupport = createWolf({ row: 0, col: 6, direction: "bottomLeft", team: "enemy" });
const enemyFlank = createWolf({ row: 0, col: 1, direction: "bottomLeft", team: "enemy" });
const units = [player, playerSupport, playerFlank, enemy, enemySupport, enemyFlank];
const enemyPackActionQueue = [];
let enemyPackFocusTarget = null;
const unitAnimationPreloads = preloadUnitAnimations();

updateArenaMetrics();

function updateArenaMetrics() {
  boardWidth = (GRID_SIZE + GRID_SIZE) * ISO_X_STEP;
  boardHeight = (GRID_SIZE + GRID_SIZE - 2) * ISO_Y_STEP + TILE_HEIGHT;
  xOffset = boardWidth / 2;
  document.documentElement.style.setProperty("--arena-width", `${boardWidth}px`);
  document.documentElement.style.setProperty("--arena-height", `${boardHeight}px`);
}

function hasQueuedPlayerActions() {
  return getQueuedPlayerActionTotal() > 0;
}

function hasMovingPlayerUnits() {
  return getAliveUnitsByTeam("player").some((unit) => unit.movementFrameRequest !== null);
}

function getPlayerTimelineUnits() {
  return [player, playerSupport, playerFlank];
}

function getQueuedPlayerActionTotal() {
  return getPlayerTimelineUnits().reduce((total, unit) => total + getUnitActionQueue(unit).length, 0);
}

// --- Terrain generation -----------------------------------------------------
// Instead of picking a random tile per cell (which looks like visual noise),
// terrain is generated as coherent patches: a smooth value-noise field is
// thresholded into grass vs. dirt regions, so neighbouring tiles tend to share
// the same ground type and patches read as deliberate shapes.

const TERRAIN_GRASS = "grass";
const TERRAIN_DIRT = "dirt";

// Clean base tiles per terrain type (verified against the tileset: plain brown
// blocks vs. plain green-topped blocks). Decoration tiles sit only on grass.
const GRASS_BASE_TILES = [22, 23, 24, 27, 40];
const DIRT_BASE_TILES = [0, 1, 2, 3, 4, 6, 8, 18];
const GRASS_DECOR_TILES = [28, 32, 36];
const GRASS_DECOR_CHANCE = 0.12;
// Half-green/half-brown tiles used on grass cells that border dirt, so the seam
// between the two terrain types reads as a blended edge instead of a hard cut.
const GRASS_EDGE_TILES = [26, 20];

// Water: an impassable feature laid down from a single GLOBAL noise field that
// spans the whole overworld, not a per-arena shape. Every arena samples the same
// continuous field at its own world position, so a lake that reaches one arena's
// edge continues seamlessly into the neighbour on the map (the shorelines line
// up because both arenas read the same field at the shared coordinate). The
// field is deterministic (seeded once, world-wide) so previews match battles.
// (Movement path-builders stop at water; the AI scores goals by straight-line
// distance and would otherwise stall walking into the shoreline.)
const WORLD_WATER_SEED = 0x5eed_0a7e; // fixed → stable world water
// Lattice cell size in tiles for the water field. Larger than the terrain scale
// so lakes are big, coherent, and likely to bridge the ~GRID_SIZE-wide seams.
// Tuned with WATER_RATIO for ~6% coverage: most arenas get a lake, none flood.
const WATER_NOISE_SCALE = 8;
// Share of the field that becomes water. Value noise clusters near 0.5, so a
// threshold well below 0.5 keeps water to occasional lakes, not a flooded board.
const WATER_RATIO = 0.2;
// Smallest allowed water body, in tiles. The raw noise throws off lots of single
// and double-tile specks; anything below this reads as a stray puddle, so we
// treat it as land. Enforced in world-lattice space so a body spanning an arena
// seam is measured whole and stays continuous (see isWorldWaterBody).
const MIN_WATER_TILES = 20;
// Single source of truth for where the six wolves start (enemy on row 0, player
// on the bottom row). Both getDefaultDevUnitSetup (placement) and
// getArenaSpawnCells (water-clearing) read this, so the two can never drift out
// of sync — a mismatch here used to leave a wolf standing in a lake. Columns are
// offsets from the arena's centre column.
const SPAWN_COL_OFFSETS = {
  player: { primary: 0, support: -2, flank: 3 },
  enemy: { primary: 0, support: 2, flank: -3 },
};

function getSpawnRow(team, size) {
  return team === "player" ? size - 1 : 0;
}

function getSpawnColumn(team, role, size) {
  const centerCol = Math.floor((size - 1) / 2);
  const offset = SPAWN_COL_OFFSETS[team]?.[role] ?? 0;
  return Math.min(size - 1, Math.max(0, centerCol + offset));
}

// --- Side-based spawns ---------------------------------------------------
// The player travels into an arena from one of four directions; the pack lines
// the outermost edge tiles of THAT side of the diamond, and the enemy lines the
// opposite side. The arena is an isometric diamond whose four sides are:
//   row 0    = top-right side (from the top corner (0,0) to the right corner (0,N-1))
//   col 0    = top-left side  (top corner (0,0) to the left corner (N-1,0))
//   col N-1  = bottom-right side (right corner (0,N-1) to the bottom corner (N-1,N-1))
//   row N-1  = bottom-left side  (left corner (N-1,0) to the bottom corner (N-1,N-1))
// This table maps travel direction -> the player's side; it is the single place
// to flip if a direction ever reads mirrored on screen.
const SPAWN_EDGE_BY_TRAVEL = {
  topRight: { axis: "row", line: 0 }, // top-right side
  topLeft: { axis: "col", line: 0 }, // top-left side
  bottomRight: { axis: "col", line: "max" }, // bottom-right side
  bottomLeft: { axis: "row", line: "max" }, // bottom-left side
};
// Sprite facing (from DIRECTION_TILE_DELTAS) each side uses to look inward toward
// the arena centre / the opposite side. Keyed by the side's travel direction.
const FACING_BY_TRAVEL = {
  topRight: "bottomLeft", // top-right side looks down-left
  bottomLeft: "topRight", // bottom-left side looks up-right
  topLeft: "bottomRight", // top-left side looks down-right
  bottomRight: "topLeft", // bottom-right side looks up-left
};
const OPPOSITE_TRAVEL = {
  topRight: "bottomLeft",
  bottomLeft: "topRight",
  topLeft: "bottomRight",
  bottomRight: "topLeft",
};
// Offsets from the middle of a side for the three roles, so the pack spreads
// along the edge (centred on the side, never crammed into a corner).
const SPAWN_SIDE_OFFSETS = { primary: 0, support: -2, flank: 2 };
// The first/default arena (no travel yet) uses a fixed intro layout: player on
// the bottom side (row N-1, tiles 241-256 on a 16-grid), enemy on the top-right
// side (row 0). Expressed as the travel keys whose sides land there, so the
// edge/facing tables are reused.
const DEFAULT_SPAWN_TRAVEL = { player: "bottomLeft", enemy: "topRight" };
// Which direction the arena was entered from; drives side spawns. null until the
// player first travels, so the bootstrap node (0,0) battle uses DEFAULT_SPAWN_TRAVEL.
let currentEntryCorner = null;

// A team/role's spawn cell + facing for side-based spawns. After travel the
// player lines the side it entered from (facing back toward the arena it came
// from, i.e. the OPPOSITE of the travel direction) and the enemy the far side;
// before any travel both use the fixed default layout. Packs sit on the
// outermost edge line (no inset), roles spread along the side from its middle,
// and facing points inward toward the centre.
function getEntryCornerSetup(team, role, entryCorner, size) {
  const travel = SPAWN_EDGE_BY_TRAVEL[entryCorner]
    ? (team === "player" ? OPPOSITE_TRAVEL[entryCorner] : entryCorner)
    : DEFAULT_SPAWN_TRAVEL[team];
  const edge = SPAWN_EDGE_BY_TRAVEL[travel] ?? SPAWN_EDGE_BY_TRAVEL.bottomLeft;
  const line = edge.line === "max" ? size - 1 : edge.line;
  const center = Math.floor((size - 1) / 2);
  const spread = center + (SPAWN_SIDE_OFFSETS[role] ?? 0);
  const along = Math.min(size - 1, Math.max(0, spread));

  return {
    row: edge.axis === "row" ? line : along,
    col: edge.axis === "col" ? line : along,
    direction: FACING_BY_TRAVEL[travel] ?? "topRight",
  };
}

// Water sprites 104-114 are an AUTOTILE set: each cell's sprite is chosen by
// which of its four isometric edges border LAND. The four edge directions map
// to the diagonal move deltas, checked in this fixed canonical order so the
// lookup keys below always match the order filter() produces.
const POND_EDGE_DIRECTIONS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
// No land touching: open water. 104 and 114 are interchangeable "waves"
// variants; for now we use only 104 (drop 114 back in to vary the surface).
const POND_OPEN_WATER_TILES = [104];
// Comma-joined set of ground-touching edges -> shoreline sprite. 113 is a lone
// water cell ringed by land on all sides (won't occur with the current pond,
// kept for completeness). Combinations with no dedicated art (opposite corners,
// or three edges at once) fall back to open water.
const POND_SHORELINE_TILES = {
  "topRight": 105,
  "topLeft": 106,
  "bottomRight": 107,
  "bottomLeft": 108,
  "topLeft,topRight": 109,
  "bottomRight,bottomLeft": 110,
  "topLeft,bottomLeft": 111,
  "topRight,bottomRight": 112,
  "topLeft,topRight,bottomRight,bottomLeft": 113,
};

// Rock formations retain the hill footprints and their movement/LOS rules.
// Editor levels select small or tall artwork instead of stacking terrain cubes.
const HILL_HEIGHT_LEVELS = 1;
const ROCK_TILES = {
  // Rounded boulders and irregular clusters; exclude slabs and paving-like rocks.
  edge: [65, 67],
  interior: [64, 68],
};
// Flower clusters scattered on plain grass — purely decorative, no
// movement/LOS effect (unlike rocks/hills).
const FLOWER_TILES = [41, 42, 44, 46];
const FLOWER_RATIO = 0.03; // ~3% of eligible grass tiles

// Trees: 0-3 per arena, placed only on cells surrounded mostly by grass. Block
// movement (see isBlockedTile) but NOT line of sight, unlike hills — a tree is
// a single static sprite (not a tileset index), swapped for transparency once
// a unit stands behind it (not yet implemented).
const TREE_IMAGE_PATH = "isometric tileset/Tree.png";
// Outline sprite shown wherever the tree fades transparent, so its silhouette
// stays readable even when hiding a unit — see refreshTreeTransparency.
const TREE_OUTLINE_IMAGE_PATH = "isometric tileset/Tree_outline.png";
const TREE_COUNT_RANGE = [0, 3];
const TREE_DENSITY_RADIUS = 1; // checks the 3x3 neighbourhood around a candidate
const TREE_DENSITY_MIN_RATIO = 0.8; // that neighbourhood must be mostly grass
const TREE_MIN_SPACING = 3; // tiles apart (Manhattan), so trees don't cluster

// A tree visually overlaps units standing "behind" it on screen — checked in
// projected screen space (not row/col) since this grid's row/col axes run
// diagonally on screen: moving row-1 alone drifts up-RIGHT (see projectTile),
// not straight up. "Steps" below is how many true-vertical tiles (row-1,
// col-1 together) the sprite reaches above its base; tune alongside
// .tree-block's scale/anchor.
const TREE_TRANSPARENCY_ROW_SPAN = 6;
const TREE_TRANSPARENCY_HEIGHT_PX = TREE_TRANSPARENCY_ROW_SPAN * ISO_Y_STEP * 2;
const TREE_TRANSPARENCY_HALF_WIDTH_PX = TILE_WIDTH; // ~half the tree sprite's on-screen width
const HILL_INTERIOR_MARGIN = 1; // keep the footprint off the spawn-edge rows/cols
// Footprint templates as (row, col) offsets from an anchor — each is a crescent
// or bend, so the hill never looks like a solid block. Used by the legacy
// "shapes" generator (see HILL_GENERATOR). One is chosen per seed.
const HILL_SHAPES = [
  [[0, 0], [1, 1], [2, 1], [3, 0]],
  [[0, 0], [1, -1], [2, -1], [3, 0]],
  [[0, 0], [0, 1], [1, 2], [1, 3]],
  [[0, 0], [0, -1], [1, -2], [1, -3]],
  [[0, 0], [1, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 1], [1, 2]],
];

// Hill placement style. "grown" builds organic blobs/ridges (8-20 tiles, edge-
// anchored, taller in the middle) modelled on hand-authored layouts; "shapes"
// is the legacy small-arc placement above. Swap to A/B the two.
const HILL_GENERATOR = "grown"; // "grown" | "shapes"
// Grown-hill tuning (all seeded off terrainRandom, so deterministic per node).
const HILL_COUNT_RANGE = [1, 2]; // how many separate hills per arena
const HILL_SIZE_RANGE = [8, 20]; // footprint tiles per hill
const HILL_ALLOW_EDGES = true; // let hills hug the board edge (still off spawns/water)

// Lattice cell size in tiles: larger -> bigger, smoother patches.
const TERRAIN_NOISE_SCALE = 3.5;
// Share of the field that becomes dirt. Value noise clusters around 0.5, so a
// threshold below 0.5 keeps grass dominant with scattered brown patches.
const TERRAIN_DIRT_RATIO = 0.4;

// Per-cell tile index for the current arena. Regenerated by generateTerrain().
let terrainTiles = [];

// Keys ("row,col") of impassable pond tiles for the current arena. Rebuilt by
// generateTerrain() so the lookup stays correct after an arena-size change.
let pondTileKeys = new Set();

// Keys ("row,col") of the arena's hill footprint. A hill is impassable AND
// blocks line of sight (water blocks neither sight nor — for now — anything the
// pond doesn't). Rebuilt alongside the water in generateTerrain().
let hillTileKeys = new Set();

// Keys ("row,col") of cells with a flower overlay. Decorative only — never
// consulted by movement/LOS, unlike hillTileKeys/pondTileKeys. Rebuilt
// alongside the rest of the terrain in generateTerrain().
let flowerTileKeys = new Set();

// Keys ("row,col") of the arena's tree cells. A tree is impassable but does
// NOT block line of sight (unlike a hill) — see isBlockedTile/hasLineOfSight.
// Rebuilt alongside the rest of the terrain in generateTerrain().
let treeTileKeys = new Set();

// Per-tile hill height ("row,col" -> level, 1 or 2), authored by the hill-editor
// dev tool. renderArenaHill falls back to HILL_HEIGHT_LEVELS for any hill tile
// without an entry, so seeded hills are unaffected.
let hillTileLevels = new Map();

// Hill-editor dev tool: whether click-to-draw is active, and a snapshot of the
// terrain taken when it turns on so removing an authored hill restores the tile.
let isHillEditMode = false;
let hillEditTerrainSnapshot = null;

// While a dev-test scenario runs, terrain regenerations produce no water/hill so
// mechanics scenarios play on a clean board even if they resize the arena (which
// re-stamps terrain). The live game never sets this. See runDevTestScenario.
let devTestObstaclesDisabled = false;

function isPondTile(row, col) {
  return pondTileKeys.has(getGridPositionKey(row, col));
}

function isHillTile(row, col) {
  return hillTileKeys.has(getGridPositionKey(row, col));
}

function isTreeTile(row, col) {
  return treeTileKeys.has(getGridPositionKey(row, col));
}

// A cell a unit can neither walk through nor stand on: water, hill, or tree.
// Movement path-builders, the walkable distance field, and the AI slot/goal
// pickers all route around these. Water-only concerns (autotiling, the grass
// frame) keep calling isPondTile directly.
function isBlockedTile(row, col) {
  return isPondTile(row, col) || isHillTile(row, col) || isTreeTile(row, col);
}

// Line of sight between two cells, blocked ONLY by hills (water is see-over).
// Densely samples the segment between the cell centres; if it crosses any hill
// tile that isn't an endpoint, sight is blocked. Endpoints are excluded so a
// unit standing on/next to a hill is still seen. Symmetric in its arguments.
function hasLineOfSight(fromRow, fromCol, toRow, toCol) {
  const deltaRow = toRow - fromRow;
  const deltaCol = toCol - fromCol;
  const samples = Math.ceil(Math.hypot(deltaRow, deltaCol) * 4);

  for (let i = 1; i < samples; i += 1) {
    const t = i / samples;
    const row = Math.round(fromRow + deltaRow * t);
    const col = Math.round(fromCol + deltaCol * t);

    if (isHillTile(row, col) && !(row === fromRow && col === fromCol) && !(row === toRow && col === toCol)) {
      return false;
    }
  }

  return true;
}

// Recompute every live unit's concealment: a unit is hidden when a hill blocks
// the line of sight from EVERY living enemy (symmetric — players and enemies
// hide the same way). With no living enemies a unit is never hidden. Callers
// keep this fresh at plan time and after each executed move. Concealment hides
// enemy intentions and dims sprites; known positions remain targetable.
function refreshHiddenStates() {
  const alive = units.filter(isUnitAlive);

  alive.forEach((unit) => {
    const foes = alive.filter((other) => other.team !== unit.team);
    unit.isHidden =
      foes.length > 0 &&
      foes.every((foe) => !hasLineOfSight(foe.row, foe.col, unit.row, unit.col));
  });
}

// Whether a unit is currently concealed from its foes (hidden behind a hill).
function isUnitHidden(unit) {
  return Boolean(unit.isHidden);
}

// Empty the arena's impassable/sight-blocking terrain. Used by the dev-test
// runner so mechanics scenarios play on a clean field (the live arena now
// always seeds a hill + water, which would otherwise sit on scenario tiles).
// Terrain-specific scenarios regenerate their own obstacles afterwards.
function clearArenaObstacles() {
  pondTileKeys = new Set();
  hillTileKeys = new Set();
  hillTileLevels = new Map();
  flowerTileKeys = new Set();
  treeTileKeys = new Set();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function tileSrc(index) {
  return `${TILE_PATH}/tile_${String(index).padStart(3, "0")}.png`;
}

// Map an arena cell (row, col) in the arena at world (worldX, worldY) to a
// CONTINUOUS global iso-lattice coordinate. Derived from the same constants as
// worldCellScreenOffset()/projectTile(): a world step shifts the whole arena by
// GRID_SIZE along the diagonal axes, and a cell projects at (col-row, col+row).
// Neighbouring arenas therefore map to adjacent regions of one shared space, so
// the water field is automatically continuous across every seam.
function worldTileToGlobal(worldX, worldY, row, col) {
  return {
    gx: (worldX - worldY) * GRID_SIZE + (col - row),
    gy: -(worldX + worldY) * GRID_SIZE + (col + row),
  };
}

// Deterministic hash of an integer lattice point -> [0, 1). Same point always
// yields the same value regardless of which arena samples it, which is what
// makes the field agree across seams.
function waterLatticeValue(ix, iy) {
  let h = (Math.imul(ix | 0, 0x9e3779b1) ^ Math.imul(iy | 0, 0x85ebca77) ^ WORLD_WATER_SEED) >>> 0;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

// Smooth (bilinear + smoothstep) value noise over the global water lattice.
function sampleWaterNoise(gx, gy) {
  const sx = gx / WATER_NOISE_SCALE;
  const sy = gy / WATER_NOISE_SCALE;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);

  const top = lerp(waterLatticeValue(x0, y0), waterLatticeValue(x0 + 1, y0), tx);
  const bottom = lerp(waterLatticeValue(x0, y0 + 1), waterLatticeValue(x0 + 1, y0 + 1), tx);
  return lerp(top, bottom, ty);
}

// The single source of truth for "is there water here" — a pure function of the
// global coordinate, used identically by the fill and the shoreline autotiler
// (including one cell past an arena edge) so seams never disagree.
function isWorldWater(gx, gy) {
  return sampleWaterNoise(gx, gy) < WATER_RATIO;
}

// Water-adjacency steps in global lattice space. A (row,col) edge neighbour maps
// to a (±1, ±1) diagonal step in (gx, gy) because the lattice is rotated 45°
// from the tile grid (see worldTileToGlobal), so these are the four cells that
// share a shoreline edge with (gx, gy).
const WATER_BODY_STEPS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// The body-aware water test: true only if this global cell belongs to a
// connected body of at least MIN_WATER_TILES tiles. Flood-fills the raw field
// from the cell, exiting as soon as the body is provably big enough, so the cost
// stays bounded (~a handful of cells) no matter how large the real lake is.
// Depends only on (gx, gy), so adjacent arenas agree on every shared cell and a
// cross-seam lake is measured as one body — never trimmed at the boundary.
function isWorldWaterBody(gx, gy) {
  if (!isWorldWater(gx, gy)) {
    return false;
  }

  const visited = new Set([`${gx},${gy}`]);
  let frontier = [[gx, gy]];

  while (frontier.length > 0 && visited.size < MIN_WATER_TILES) {
    const nextFrontier = [];

    for (const [cx, cy] of frontier) {
      for (const [dx, dy] of WATER_BODY_STEPS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;

        if (visited.has(key) || !isWorldWater(nx, ny)) {
          continue;
        }

        visited.add(key);
        nextFrontier.push([nx, ny]);
      }
    }

    frontier = nextFrontier;
  }

  return visited.size >= MIN_WATER_TILES;
}

function pickTerrainTile(type) {
  if (type === TERRAIN_DIRT) {
    return DIRT_BASE_TILES[Math.floor(terrainRandom() * DIRT_BASE_TILES.length)];
  }

  if (terrainRandom() < GRASS_DECOR_CHANCE) {
    return GRASS_DECOR_TILES[Math.floor(terrainRandom() * GRASS_DECOR_TILES.length)];
  }

  return GRASS_BASE_TILES[Math.floor(terrainRandom() * GRASS_BASE_TILES.length)];
}

function oppositeTerrain(type) {
  return type === TERRAIN_GRASS ? TERRAIN_DIRT : TERRAIN_GRASS;
}

// Build a coarse lattice of random values, then sample it with smooth
// (bilinear + smoothstep) interpolation so the field varies gradually. Returns
// a grid of terrain TYPES (grass/dirt), not yet resolved to tile sprites.
// Seeded PRNG (mulberry32) so an arena's terrain is reproducible from its world
// node — the darkened map preview shows the exact terrain you'll fight on.
function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Terrain generation pulls all its randomness from here. generateTerrain swaps
// in a seeded source while it runs, then restores Math.random for everything
// else, so only terrain becomes deterministic.
let terrainRandom = Math.random;

function generateTerrainTypes(size) {
  const latticeSize = Math.ceil(size / TERRAIN_NOISE_SCALE) + 2;
  const lattice = [];

  for (let y = 0; y <= latticeSize; y += 1) {
    const rowValues = [];
    for (let x = 0; x <= latticeSize; x += 1) {
      rowValues.push(terrainRandom());
    }
    lattice.push(rowValues);
  }

  const types = [];

  for (let row = 0; row < size; row += 1) {
    const typeRow = [];

    for (let col = 0; col < size; col += 1) {
      const sampleX = col / TERRAIN_NOISE_SCALE;
      const sampleY = row / TERRAIN_NOISE_SCALE;
      const x0 = Math.floor(sampleX);
      const y0 = Math.floor(sampleY);
      const tx = smoothstep(sampleX - x0);
      const ty = smoothstep(sampleY - y0);

      const top = lerp(lattice[y0][x0], lattice[y0][x0 + 1], tx);
      const bottom = lerp(lattice[y0 + 1][x0], lattice[y0 + 1][x0 + 1], tx);
      const value = lerp(top, bottom, ty);

      typeRow.push(value < TERRAIN_DIRT_RATIO ? TERRAIN_DIRT : TERRAIN_GRASS);
    }

    types.push(typeRow);
  }

  return types;
}

const ORTHOGONAL_NEIGHBOURS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// Count orthogonal neighbours of (row, col) that share its terrain type. Cells
// off the edge of the board are ignored (not counted as same or opposite).
function countSameTypeNeighbours(types, size, row, col) {
  const type = types[row][col];
  let count = 0;

  for (const [dr, dc] of ORTHOGONAL_NEIGHBOURS) {
    const r = row + dr;
    const c = col + dc;

    if (r >= 0 && r < size && c >= 0 && c < size && types[r][c] === type) {
      count += 1;
    }
  }

  return count;
}

// Remove lone single-type tiles: any cell whose every orthogonal neighbour is
// the opposite type is a speckle, so flip it to match its surroundings. Each
// pass reads from a snapshot so flips don't cascade mid-pass; repeating until
// stable lets a freshly-flipped cell expose a new orphan next to it. The guard
// caps iterations so a pathological field can never loop forever.
function smoothLoneTiles(types, size) {
  let changed = true;
  let guard = 0;
  const maxPasses = size;

  while (changed && guard < maxPasses) {
    changed = false;
    guard += 1;

    const snapshot = types.map((typeRow) => typeRow.slice());

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (countSameTypeNeighbours(snapshot, size, row, col) === 0) {
          types[row][col] = oppositeTerrain(snapshot[row][col]);
          changed = true;
        }
      }
    }
  }

  return types;
}

function hasNeighbourOfType(types, size, row, col, targetType) {
  for (const [dr, dc] of ORTHOGONAL_NEIGHBOURS) {
    const r = row + dr;
    const c = col + dc;

    if (r >= 0 && r < size && c >= 0 && c < size && types[r][c] === targetType) {
      return true;
    }
  }

  return false;
}

// Generate an arena's terrain. worldX/worldY place it in the global water field
// (default origin for the DOM-free dev-test harness, which passes only a seed).
// clearSpawns keeps the unit spawn cells dry — set only for the LIVE arena, so
// map previews render the raw field and seams stay continuous.
function generateTerrain(size, seed = null, worldX = 0, worldY = 0, clearSpawns = false) {
  terrainRandom = seed === null ? Math.random : createSeededRandom(seed);

  try {
    return generateTerrainTiles(size, worldX, worldY, clearSpawns);
  } finally {
    terrainRandom = Math.random;
  }
}

function generateTerrainTiles(size, worldX = 0, worldY = 0, clearSpawns = false) {
  // Cleared up front, not just at the top of stampTrees: stampHill and
  // stampFlowers both consult isBlockedTile (which now checks treeTileKeys
  // too), and they run BEFORE stampTrees. Without this, they'd read whatever
  // tree layout the previous generateTerrain() call left behind, making their
  // own seeded-RNG draw counts depend on unrelated prior state.
  treeTileKeys = new Set();

  const types = generateTerrainTypes(size);
  smoothLoneTiles(types, size);

  terrainTiles = types.map((typeRow, row) =>
    typeRow.map((type, col) => {
      // Grass cells touching dirt get the blended edge tile; everything else
      // picks a normal tile from its terrain pool.
      if (type === TERRAIN_GRASS && hasNeighbourOfType(types, size, row, col, TERRAIN_DIRT)) {
        return GRASS_EDGE_TILES[Math.floor(terrainRandom() * GRASS_EDGE_TILES.length)];
      }

      return pickTerrainTile(type);
    }),
  );

  stampWater(size, worldX, worldY, clearSpawns);
  stampHill(size);
  stampFlowers(size, types);
  stampTrees(size, types);

  return terrainTiles;
}

// Scatter flower overlays across plain grass, from the same seeded stream as
// the rest of the terrain. Skips any cell the water/hill passes already
// claimed, and — like stampHill — produces nothing while a dev-test scenario
// wants a clean board.
function stampFlowers(size, types) {
  flowerTileKeys = new Set();

  if (devTestObstaclesDisabled) {
    return;
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (types[row][col] !== TERRAIN_GRASS || isBlockedTile(row, col)) {
        continue;
      }

      if (terrainRandom() < FLOWER_RATIO) {
        flowerTileKeys.add(getGridPositionKey(row, col));
      }
    }
  }
}

// Whether the TREE_DENSITY_RADIUS neighbourhood around (row, col) is mostly
// grass — the "a lot of green tiles" gate for tree placement. Out-of-bounds
// neighbours are excluded from both the count and the denominator.
function isGrassDense(types, size, row, col) {
  let total = 0;
  let grassCount = 0;

  for (let dr = -TREE_DENSITY_RADIUS; dr <= TREE_DENSITY_RADIUS; dr += 1) {
    for (let dc = -TREE_DENSITY_RADIUS; dc <= TREE_DENSITY_RADIUS; dc += 1) {
      const r = row + dr;
      const c = col + dc;

      if (r < 0 || r >= size || c < 0 || c >= size) {
        continue;
      }

      total += 1;
      if (types[r][c] === TERRAIN_GRASS) {
        grassCount += 1;
      }
    }
  }

  return total > 0 && grassCount / total >= TREE_DENSITY_MIN_RATIO;
}

function isTooCloseToExistingTree(row, col) {
  for (const key of treeTileKeys) {
    const [existingRow, existingCol] = key.split(",").map(Number);
    if (Math.abs(existingRow - row) + Math.abs(existingCol - col) < TREE_MIN_SPACING) {
      return true;
    }
  }

  return false;
}

// Place 0-3 trees on grass-dense cells, from the same seeded stream as the
// rest of the terrain. Skips water/hill/flower/spawn cells and the board-edge
// margin (like stampHill), and keeps trees spaced apart. Like stampHill, this
// produces nothing while a dev-test scenario wants a clean board.
function stampTrees(size, types) {
  treeTileKeys = new Set();

  if (devTestObstaclesDisabled) {
    return;
  }

  const spawnCells = new Set(
    getArenaSpawnCells(size).map(([r, c]) => getGridPositionKey(r, c)),
  );
  const lo = HILL_INTERIOR_MARGIN;
  const hi = size - HILL_INTERIOR_MARGIN;
  const candidates = [];

  for (let row = lo; row < hi; row += 1) {
    for (let col = lo; col < hi; col += 1) {
      const key = getGridPositionKey(row, col);

      if (
        types[row][col] !== TERRAIN_GRASS ||
        isBlockedTile(row, col) ||
        flowerTileKeys.has(key) ||
        spawnCells.has(key)
      ) {
        continue;
      }

      if (isGrassDense(types, size, row, col)) {
        candidates.push([row, col]);
      }
    }
  }

  const [minCount, maxCount] = TREE_COUNT_RANGE;
  const targetCount = minCount + Math.floor(terrainRandom() * (maxCount - minCount + 1));

  while (treeTileKeys.size < targetCount && candidates.length > 0) {
    const index = Math.floor(terrainRandom() * candidates.length);
    const [row, col] = candidates.splice(index, 1)[0];

    if (isTooCloseToExistingTree(row, col)) {
      continue;
    }

    treeTileKeys.add(getGridPositionKey(row, col));
  }
}

// Place this arena's hills from the seeded stream (terrainRandom, deterministic
// per node). Footprint cells go into hillTileKeys (impassable + sight-blocking),
// their per-tile height into hillTileLevels, and their ground tile is set to
// dirt (rock sprites draw on top in the live arena; the dirt is what
// shows in the map preview and around the base). Dispatches on HILL_GENERATOR.
function stampHill(size) {
  hillTileKeys = new Set();
  hillTileLevels = new Map(); // drop any editor-authored heights on regen

  if (devTestObstaclesDisabled) {
    return;
  }

  if (HILL_GENERATOR === "grown") {
    stampGrownHills(size);
  } else {
    stampArcHills(size);
  }
}

// Mark a cell as hill ground: impassable, dirt underfoot.
function addHillTile(row, col) {
  hillTileKeys.add(getGridPositionKey(row, col));
  terrainTiles[row][col] = pickTerrainTile(TERRAIN_DIRT);
}

// Grown hills: 1-2 organic blobs, each a randomised 4-neighbour flood from a
// seed cell up to a target size, kept off water, spawn cells, and (optionally)
// the board edge. Heights are then a 2-high core with a 1-high skirt.
function stampGrownHills(size) {
  const spawnCells = new Set(
    getArenaSpawnCells(size).map(([r, c]) => getGridPositionKey(r, c)),
  );
  const lo = HILL_ALLOW_EDGES ? 0 : HILL_INTERIOR_MARGIN;
  const hi = HILL_ALLOW_EDGES ? size : size - HILL_INTERIOR_MARGIN;

  const baseValidCell = (row, col) =>
    row >= lo && row < hi && col >= lo && col < hi &&
    !isPondTile(row, col) &&
    !hillTileKeys.has(getGridPositionKey(row, col)) &&
    !spawnCells.has(getGridPositionKey(row, col));

  const [minCount, maxCount] = HILL_COUNT_RANGE;
  const hillCount = minCount + Math.floor(terrainRandom() * (maxCount - minCount + 1));

  for (let hill = 0; hill < hillCount; hill += 1) {
    // Keep separate hills a tile apart so they don't merge into one giant blob:
    // forbid cells adjacent to any already-placed hill.
    const buffer = hill === 0 ? null : hillAdjacencyBuffer();
    const isValidCell = (row, col) =>
      baseValidCell(row, col) && !(buffer && buffer.has(getGridPositionKey(row, col)));
    growOneHill(size, isValidCell);
  }

  applyHillHeights();
}

// Cells orthogonally adjacent to an existing hill — the no-grow moat that keeps
// a second hill from touching the first.
function hillAdjacencyBuffer() {
  const buffer = new Set();
  hillTileKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    for (const { row: dr, col: dc } of WALKABLE_FIELD_DELTAS) {
      buffer.add(getGridPositionKey(row + dr, col + dc));
    }
  });
  return buffer;
}

function growOneHill(size, isValidCell) {
  const [minSize, maxSize] = HILL_SIZE_RANGE;
  const targetSize = minSize + Math.floor(terrainRandom() * (maxSize - minSize + 1));

  let seed = null;
  for (let attempt = 0; attempt < 24 && !seed; attempt += 1) {
    const row = Math.floor(terrainRandom() * size);
    const col = Math.floor(terrainRandom() * size);
    if (isValidCell(row, col)) {
      seed = [row, col];
    }
  }
  if (!seed) {
    return;
  }

  const frontier = [];
  const pushNeighbours = (row, col) => {
    for (const { row: dr, col: dc } of WALKABLE_FIELD_DELTAS) {
      if (isValidCell(row + dr, col + dc)) {
        frontier.push([row + dr, col + dc]);
      }
    }
  };

  let placed = 0;
  addHillTile(seed[0], seed[1]);
  placed += 1;
  pushNeighbours(seed[0], seed[1]);

  while (placed < targetSize && frontier.length > 0) {
    const [row, col] = frontier.splice(Math.floor(terrainRandom() * frontier.length), 1)[0];
    if (!isValidCell(row, col)) {
      continue; // already claimed by this hill via another frontier entry
    }
    addHillTile(row, col);
    placed += 1;
    pushNeighbours(row, col);
  }
}

// Height grammar (learned from hand-authored hills): a tile whose four orthogonal
// neighbours are ALL hill sits in the interior and rises to level 2; every other
// (perimeter) tile is level 1. Small/thin hills stay flat; fat ones get a crown.
function applyHillHeights() {
  hillTileKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const interior = WALKABLE_FIELD_DELTAS.every(({ row: dr, col: dc }) =>
      hillTileKeys.has(getGridPositionKey(row + dr, col + dc)),
    );
    hillTileLevels.set(key, interior ? 2 : 1);
  });
}

// Legacy generator: one small arc template placed at a seeded interior anchor.
function stampArcHills(size) {
  const shape = HILL_SHAPES[Math.floor(terrainRandom() * HILL_SHAPES.length)];
  const lo = HILL_INTERIOR_MARGIN;
  const hi = size - HILL_INTERIOR_MARGIN;
  const attempts = 16;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const anchorRow = lo + Math.floor(terrainRandom() * (hi - lo));
    const anchorCol = lo + Math.floor(terrainRandom() * (hi - lo));
    const cells = shape.map(([dr, dc]) => [anchorRow + dr, anchorCol + dc]);

    const fits = cells.every(([r, c]) =>
      r >= lo && r < hi && c >= lo && c < hi && !isPondTile(r, c),
    );

    if (fits) {
      cells.forEach(([r, c]) => addHillTile(r, c));
      return;
    }
  }
}

// The exact cells the six wolves start on for a given arena size, from the same
// formula getDefaultDevUnitSetup uses to place them.
function getArenaSpawnCells(size) {
  const cells = [];
  for (const team of ["player", "enemy"]) {
    for (const role of ["primary", "support", "flank"]) {
      const { row, col } = getDefaultDevUnitSetup(team, role, size);
      cells.push([row, col]);
    }
  }
  return cells;
}

// A cell a unit spawns on. Water is kept off these in the live arena so nobody
// starts in a lake.
function isSpawnCell(size, row, col) {
  return getArenaSpawnCells(size).some(([r, c]) => r === row && c === col);
}

// Lay this arena's water down from the global field: mark every water cell,
// autotile each one's shoreline sprite, then force the non-water 8-neighbours to
// grass so lakes sit in a green frame instead of butting against dirt patches.
function stampWater(size, worldX, worldY, clearSpawns) {
  pondTileKeys = new Set();

  if (devTestObstaclesDisabled) {
    return;
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (clearSpawns && isSpawnCell(size, row, col)) {
        continue; // keep spawns dry; leaves the field untouched elsewhere
      }

      const { gx, gy } = worldTileToGlobal(worldX, worldY, row, col);

      if (isWorldWaterBody(gx, gy)) {
        pondTileKeys.add(getGridPositionKey(row, col));
      }
    }
  }

  pondTileKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    terrainTiles[row][col] = getWaterTileForCell(row, col, size, worldX, worldY);
  });

  pondTileKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);

    ATTACK_TILE_DELTAS.forEach((delta) => {
      const r = row + delta.row;
      const c = col + delta.col;

      if (r >= 0 && r < size && c >= 0 && c < size && !isPondTile(r, c)) {
        terrainTiles[r][c] = pickTerrainTile(TERRAIN_GRASS);
      }
    });
  });
}

// Choose a water cell's sprite by which of its four isometric edges border land.
// On-board neighbours read the stamped set (so shorelines respect spawn-clearing
// and hills); OFF-board neighbours sample the global field one cell past the
// edge, so a lake continuing into the next arena draws no phantom shore.
function getWaterTileForCell(row, col, size, worldX, worldY) {
  const groundEdges = POND_EDGE_DIRECTIONS.filter((direction) => {
    const delta = DIRECTION_TILE_DELTAS[direction];
    const r = row + delta.row;
    const c = col + delta.col;

    if (r >= 0 && r < size && c >= 0 && c < size) {
      return !isPondTile(r, c);
    }

    const { gx, gy } = worldTileToGlobal(worldX, worldY, r, c);
    return !isWorldWaterBody(gx, gy);
  });

  if (groundEdges.length === 0) {
    return POND_OPEN_WATER_TILES[(row + col) % POND_OPEN_WATER_TILES.length];
  }

  return POND_SHORELINE_TILES[groundEdges.join(",")] ?? POND_OPEN_WATER_TILES[0];
}

function projectTile(row, col) {
  return {
    x: (col - row) * ISO_X_STEP + xOffset,
    y: (col + row) * ISO_Y_STEP,
  };
}

function createUnit({
  row,
  col,
  direction,
  team,
  type = DEFAULT_UNIT_TYPE,
  movementMode = DEFAULT_PLAYER_MOVEMENT_MODE,
  isActive = true,
}) {
  return {
    element: document.createElement("div"),
    healthBar: null,
    intentTags: null,
    hiddenTag: null,
    type,
    isActive,
    row,
    col,
    direction,
    movementMode,
    team,
    health: UNIT_MAX_HEALTH,
    maxHealth: UNIT_MAX_HEALTH,
    turnsSinceHit: 0,
    tookDamageThisTurn: false,
    isFleeing: false,
    isHidden: false,
    packObjective: null,
    isDefeated: false,
    hasPlayedDeathAnimation: false,
    deathAnimationPromise: null,
    animationFrameRequest: null,
    movementFrameRequest: null,
    animationComplete: null,
    animationStartedAt: 0,
    animationName: "idle",
    idleStartFrame: getRandomIdleStartFrame(type),
    x: 0,
    y: 0,
  };
}

function createWolf(options) {
  return createUnit({ ...options, type: "wolf" });
}

function getUnitDefinition(unitOrType) {
  const type = typeof unitOrType === "string" ? unitOrType : unitOrType.type;

  return unitDefinitions[type] ?? unitDefinitions[DEFAULT_UNIT_TYPE];
}

function getUnitAnimation(unitOrType, animationName) {
  return getUnitDefinition(unitOrType).animations[animationName] ?? null;
}

function getUnitAnimationFrameCount(animation) {
  return animation.frameSequence?.length ?? animation.frames;
}

function getUnitAnimationFrameIndex(animation, sequenceIndex) {
  return animation.frameSequence?.[sequenceIndex] ?? sequenceIndex;
}

function getRandomIdleStartFrame(type) {
  const idleAnimation = getUnitAnimation(type, "idle");

  if (type !== "wolf" || !idleAnimation) {
    return 0;
  }

  return Math.floor(Math.random() * getUnitAnimationFrameCount(idleAnimation));
}

function getUnitAnimationStartFrame(unit, animationName, animation) {
  if (animationName !== "idle") {
    return 0;
  }

  return unit.type === "wolf" ? (unit.idleStartFrame ?? 0) % getUnitAnimationFrameCount(animation) : 0;
}

function isUnitAnimationSupported(unitOrType, animationName) {
  return Boolean(getUnitAnimation(unitOrType, animationName));
}

function getUnitAnimationSrc(unitOrType, animationName, direction = "bottomLeft") {
  const definition = getUnitDefinition(unitOrType);

  return definition.getAnimationSrc(animationName, direction);
}

function getUnitAnimationPreloadKey(type, animationName, direction = null) {
  return [type, animationName, direction].filter(Boolean).join(":");
}

function preloadUnitAnimations() {
  const preloads = new Map();

  Object.entries(unitDefinitions).forEach(([type, definition]) => {
    Object.keys(definition.animations).forEach((animationName) => {
      definition.getPreloadDirections().forEach((direction) => {
        const image = new Image();
        const loaded = new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });

        image.src = getUnitAnimationSrc(type, animationName, direction ?? "bottomLeft");
        preloads.set(getUnitAnimationPreloadKey(type, animationName, direction), {
          image,
          ready: image.decode ? image.decode().catch(() => loaded).then(() => undefined) : loaded,
        });
      });
    });
  });

  return preloads;
}

// No randomized hand should ever contain more than this many of the same
// action — too many duplicates makes a draw feel degenerate and removes choice.
const MAX_SAME_ACTION = 3;

// Tally how many of each action are currently in the shared hand.
function countAvailableActions() {
  const counts = {};

  Array.from(actionsList.children).forEach((item) => {
    const action = item.dataset.action;
    counts[action] = (counts[action] ?? 0) + 1;
  });

  return counts;
}

// Pick a random action, skipping any type that has already hit MAX_SAME_ACTION
// in the hand being built. `counts` maps action -> how many are placed so far;
// the caller increments it as each draw lands. If every type is somehow capped
// (can't happen at the current slot count) we fall back to an unconstrained
// pick so we never return undefined.
function randomAction(counts = {}) {
  const eligible = ACTIONS.filter((action) => (counts[action] ?? 0) < MAX_SAME_ACTION);
  const pool = eligible.length > 0 ? eligible : ACTIONS;

  return pool[Math.floor(Math.random() * pool.length)];
}

function createIcon(src, className) {
  const icon = document.createElement("img");

  icon.className = className;
  icon.src = src;
  icon.alt = "";
  icon.draggable = false;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createActionContent(action) {
  const label = document.createElement("span");
  const fragment = document.createDocumentFragment();

  label.className = "action-label";
  label.textContent = action;

  fragment.append(createIcon(ACTION_ICONS[action], "action-icon"), label);
  return fragment;
}

function createActionCountBadge() {
  const badge = document.createElement("span");

  badge.className = "action-count-badge";
  badge.setAttribute("aria-hidden", "true");
  return badge;
}

function createAvailableActionItem(action) {
  const item = document.createElement("li");

  item.className = "available-action";
  item.dataset.action = action;
  item.append(createActionContent(action));
  return item;
}

function refillAvailableActions() {
  const emptySlotCount = ACTION_SLOT_COUNT - getAvailableActionTotal();

  if (emptySlotCount <= 0) {
    return;
  }

  // Count actions already in the hand so the new draws keep the whole hand
  // (kept + drawn) within MAX_SAME_ACTION per type, not just the new slots.
  const counts = countAvailableActions();

  const newItems = Array.from({ length: emptySlotCount }, (_, index) => {
    const action = randomAction(counts);
    counts[action] = (counts[action] ?? 0) + 1;

    const item = createAvailableActionItem(action);
    item.style.setProperty("--slide-delay", `${(emptySlotCount - 1 - index) * 120}ms`);
    return item;
  });

  actionsList.prepend(...newItems);
  updatePlayerActionControls();
}

function canReshuffle() {
  return reshuffleChargesRemaining > 0 && !isExecutingActionQueue;
}

function updateReshuffleControl() {
  if (!reshuffleButton) {
    return;
  }

  reshuffleButton.disabled = !canReshuffle();
  reshuffleButton.dataset.chargesRemaining = String(reshuffleChargesRemaining);
  reshuffleButton.setAttribute(
    "aria-label",
    `Reshuffle: discard the pack's actions and draw a fresh hand (${reshuffleChargesRemaining} left)`,
  );

  const countLabel = reshuffleButton.querySelector(".reshuffle-charge-count");

  if (countLabel) {
    countLabel.textContent = String(reshuffleChargesRemaining);
  }
}

// Spends one battle charge to discard the whole pack's current hand (every
// wolf's queued actions plus the shared pool) and draw a fresh set. This is a
// planning-only reset: no turn is consumed and no enemy acts.
function reshuffleActions() {
  if (!canReshuffle()) {
    return;
  }

  reshuffleChargesRemaining -= 1;

  getPlayerTimelineUnits().forEach(clearUnitActionQueue);
  actionsList.replaceChildren();
  refillAvailableActions();

  renderActionQueue(getSelectedPlayerUnit());
  updatePlayerActionControls();
  updateEnemyIntentPreview();
  updateReshuffleControl();
}

function fillAvailableActions(action) {
  const items = Array.from({ length: ACTION_SLOT_COUNT }, () => createAvailableActionItem(action));

  actionsList.replaceChildren(...items);
  updatePlayerActionControls();
}

function addAvailableAction(action) {
  actionsList.prepend(createAvailableActionItem(action));
}

// Deal a fresh hand that contains at least one of every action type, so the
// guided tutorial can showcase Move, Attack and Defend. Remaining slots are
// filled randomly. Affects only the shared hand, not queued unit actions.
function seedTutorialActionHand() {
  const fillerCount = Math.max(0, ACTION_SLOT_COUNT - ACTIONS.length);

  // The hand starts with one of every action, so seed the cap counter with
  // those before drawing the random fillers.
  const counts = {};
  ACTIONS.forEach((action) => {
    counts[action] = 1;
  });

  const fillers = Array.from({ length: fillerCount }, () => {
    const action = randomAction(counts);
    counts[action] = (counts[action] ?? 0) + 1;
    return action;
  });
  const hand = [...ACTIONS, ...fillers];

  actionsList.replaceChildren(...hand.map(createAvailableActionItem));
  updatePlayerActionControls();
}

function getUnitActionQueue(unit) {
  if (!unitActionQueues.has(unit)) {
    unitActionQueues.set(unit, []);
  }

  return unitActionQueues.get(unit);
}

function isUnitActionQueueFull(unit) {
  if (unit.team === "player") {
    return getQueuedPlayerActionTotal() >= ACTION_QUEUE_SLOT_COUNT;
  }

  return getUnitActionQueue(unit).length >= ACTION_QUEUE_SLOT_COUNT;
}

function getAvailableActionCount(action) {
  return Array.from(actionsList.children).filter((item) => item.dataset.action === action).length;
}

function getAvailableActionTotal() {
  return actionsList.children.length;
}

function updateActionQueueControls() {
  updateReshuffleControl();

  if (!executeQueueButton) {
    return;
  }

  executeQueueButton.disabled =
    isExecutingActionQueue ||
    !hasQueuedPlayerActions() ||
    hasMovingPlayerUnits();
}

function getPlayerUnitId(unit) {
  if (unit === player) return "player";
  if (unit === playerSupport) return "playerSupport";
  if (unit === playerFlank) return "playerFlank";
  return "";
}

function getPlayerUnitById(unitId) {
  if (unitId === "player") return player;
  if (unitId === "playerSupport") return playerSupport;
  if (unitId === "playerFlank") return playerFlank;
  return null;
}

function getPlayerUnitLabel(unit) {
  if (unit === playerSupport) return "support wolf";
  if (unit === playerFlank) return "flank wolf";
  return "lead wolf";
}

function renderActionQueue() {
  renderPlayerTimeline();
}

function renderPlayerTimeline() {
  const selectedUnit = getSelectedPlayerUnit();
  const rows = getPlayerTimelineUnits().map((unit) => {
    const row = document.createElement("li");
    const chip = document.createElement("button");
    const actions = document.createElement("ol");
    const unitId = getPlayerUnitId(unit);
    const unitLabel = getPlayerUnitLabel(unit);
    const actionQueue = getUnitActionQueue(unit);

    row.className = "action-timeline-row";
    row.classList.toggle("is-selected", unit === selectedUnit);
    row.dataset.unitId = unitId;

    chip.type = "button";
    chip.className = "timeline-unit-chip";
    chip.dataset.playerTimelineUnit = unitId;
    chip.setAttribute("aria-label", `Select ${unitLabel} timeline`);
    chip.setAttribute("aria-pressed", String(unit === selectedUnit));
    chip.textContent = unit === playerFlank ? "P3" : unit === playerSupport ? "P2" : "P1";

    actions.className = "action-timeline-actions";
    actions.setAttribute("aria-label", `${unitLabel} queued actions`);

    actionQueue.forEach((action, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const content = document.createElement("span");
      const closeIcon = createIcon(CLOSE_ICON, "action-remove-icon");

      item.className = "action-queue-slot";
      button.type = "button";
      button.className = "action-queue-button";
      button.dataset.unitId = unitId;
      button.dataset.actionIndex = index;
      button.disabled = isExecutingActionQueue;
      button.setAttribute("aria-label", `Remove ${action} from ${unitLabel} timeline`);
      content.className = "action-queue-action";
      closeIcon.classList.add("action-queue-close");

      content.append(createActionContent(action));
      button.append(content, closeIcon);
      item.append(button);
      actions.append(item);
    });

    row.append(chip, actions);
    return row;
  });

  actionQueueList.replaceChildren(...rows);
  updateActionQueueControls();
  updatePlayerMovePreview();
}

function queueUnitAction(unit, action) {
  const actionQueue = getUnitActionQueue(unit);

  if (isUnitActionQueueFull(unit)) {
    return false;
  }

  actionQueue.push(action);
  renderActionQueue();

  if (unit.team === "player") {
    updateEnemyIntentPreview();
  }

  return true;
}

function removeUnitActionAt(unit, index) {
  const actionQueue = getUnitActionQueue(unit);
  const [removedAction] = actionQueue.splice(index, 1);

  if (!removedAction) {
    return;
  }

  addAvailableAction(removedAction);
  renderActionQueue();

  if (unit.team === "player") {
    updatePlayerActionControls();
    updateEnemyIntentPreview();
  }
}

function createPlayerActionMenu() {
  const menu = document.createElement("div");
  const movementModeSelector = createPlayerMovementModeSelector();

  menu.className = "player-action-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Player wolf actions");
  menu.append(movementModeSelector);

  ACTIONS.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-button action-button";
    button.append(createActionContent(action));
    button.append(createActionCountBadge());
    button.dataset.playerAction = action;
    button.addEventListener("click", () => {
      applyPlayerAction(action);
    });
    menu.append(button);
  });

  return menu;
}

function createPlayerMovementModeSelector() {
  const selector = document.createElement("div");
  const label = document.createElement("div");
  const track = document.createElement("div");

  selector.className = "movement-mode-selector";
  selector.dataset.playerMovementSelector = "true";
  selector.setAttribute("aria-label", "Player movement mode");

  label.className = "movement-mode-label";
  label.dataset.playerMovementLabel = "true";

  track.className = "movement-mode-track";

  PLAYER_MOVEMENT_MODES.forEach((mode) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "movement-mode-dot";
    button.dataset.playerMovementMode = mode;
    button.setAttribute("aria-label", `Set movement mode to ${mode}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setPlayerMovementMode(mode);
    });
    track.append(button);
  });

  selector.append(label, track);
  return selector;
}

function consumeAvailableAction(action) {
  const matchingItem = Array.from(actionsList.children).find(
    (item) => item.dataset.action === action,
  );

  if (!matchingItem) {
    return false;
  }

  const rects = new Map(
    Array.from(actionsList.children).map((item) => [item, item.getBoundingClientRect().top]),
  );

  matchingItem.remove();

  Array.from(actionsList.children).forEach((item) => {
    const oldTop = rects.get(item);
    if (oldTop === undefined) return;
    const newTop = item.getBoundingClientRect().top;
    const delta = oldTop - newTop;
    if (Math.abs(delta) < 0.5) return;

    item.style.animation = "none";
    item.style.transform = `translateY(${delta}px)`;
    item.style.transition = "none";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.style.transition = "transform 200ms ease-out";
        item.style.transform = "";
        item.addEventListener(
          "transitionend",
          () => {
            item.style.transition = "";
          },
          { once: true },
        );
      });
    });
  });

  return true;
}

function positionPlayerActionMenu() {
  if (!playerActionMenu) {
    return;
  }

  const selectedUnit = getSelectedPlayerUnit();

  if (!selectedUnit) {
    playerActionMenu.hidden = true;
    return;
  }

  const arenaRect = arena.getBoundingClientRect();
  const stageRect = arena.parentElement.getBoundingClientRect();
  const scaleX = arenaRect.width / boardWidth;
  const scaleY = arenaRect.height / boardHeight;

  playerActionMenu.style.left = `${arenaRect.left - stageRect.left + selectedUnit.x * scaleX - 64}px`;
  playerActionMenu.style.top = `${arenaRect.top - stageRect.top + selectedUnit.y * scaleY - 4}px`;
  playerActionMenu.style.zIndex = 30;
}

function updatePlayerActionControls() {
  if (!playerActionMenu) {
    return;
  }

  const hasAnyAvailableAction = getAvailableActionTotal() > 0;
  const selectedUnit = getSelectedPlayerUnit();

  playerActionMenu.querySelectorAll("[data-player-action]").forEach((button) => {
    const action = button.dataset.playerAction;
    const availableCount = getAvailableActionCount(action);
    const badge = button.querySelector(".action-count-badge");

    if (badge) {
      badge.textContent = availableCount;
    }

    button.hidden = availableCount === 0;
    button.disabled =
      isExecutingActionQueue ||
      !selectedUnit ||
      isUnitActionQueueFull(selectedUnit) ||
      availableCount === 0;
    button.setAttribute("aria-label", `${action} (${availableCount} available)`);
  });

  if (selectedUnit && !hasAnyAvailableAction) {
    clearPlayerSelection();
    renderActionQueue(null);
    playerActionMenu.hidden = true;
  }

  playerActionMenu.querySelectorAll("[data-player-movement-mode]").forEach((button) => {
    button.disabled = isExecutingActionQueue || !selectedUnit || selectedUnit.movementFrameRequest !== null;
  });

  renderPlayerMovementModeSelector();
}

function getSelectedPlayerUnit() {
  if (!selectedPlayerUnit || selectedPlayerUnit.team !== "player" || !isUnitAlive(selectedPlayerUnit)) {
    return null;
  }

  return selectedPlayerUnit;
}

function clearPlayerSelection() {
  if (!selectedPlayerUnit) {
    return;
  }

  selectedPlayerUnit.isSelected = false;
  selectedPlayerUnit.element.classList.remove("is-selected");
  updateUnitHealthBar(selectedPlayerUnit);
  selectedPlayerUnit = null;
}

function setPlayerSelected(unitOrNull) {
  const nextUnit = unitOrNull && unitOrNull.team === "player" && isUnitAlive(unitOrNull)
    ? unitOrNull
    : null;

  if (selectedPlayerUnit && selectedPlayerUnit !== nextUnit) {
    selectedPlayerUnit.isSelected = false;
    selectedPlayerUnit.element.classList.remove("is-selected");
    updateUnitHealthBar(selectedPlayerUnit);
  }

  selectedPlayerUnit = nextUnit;

  if (selectedPlayerUnit) {
    selectedPlayerUnit.isSelected = true;
    selectedPlayerUnit.element.classList.add("is-selected");
    updateUnitHealthBar(selectedPlayerUnit);
  }

  if (playerActionMenu) {
    playerActionMenu.hidden = !selectedPlayerUnit;
    positionPlayerActionMenu();
  }

  renderActionQueue(selectedPlayerUnit);
  updateActiveDirection(getDevPreviewUnit().direction);
  updatePlayerActionControls();
  updateAnimationControls();
}

function rotatePlayerClockwise() {
  const selectedUnit = getSelectedPlayerUnit();

  if (!selectedUnit || isExecutingActionQueue || selectedUnit.movementFrameRequest !== null) {
    updatePlayerActionControls();
    return;
  }

  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(selectedUnit.direction);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % CLOCKWISE_DIRECTIONS.length;

  selectedUnit.direction = CLOCKWISE_DIRECTIONS[nextIndex];
  updateActiveDirection(selectedUnit.direction);
  playUnitAnimation(selectedUnit, selectedUnit.animationName, true);
  updatePlayerMovePreview();
  updateEnemyIntentPreview();
}

function rotateDevPreviewUnitClockwise() {
  const unit = getDevPreviewUnit();

  if (!unit || isExecutingActionQueue || unit.movementFrameRequest !== null) {
    updatePlayerActionControls();
    return;
  }

  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(unit.direction);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % CLOCKWISE_DIRECTIONS.length;

  unit.direction = CLOCKWISE_DIRECTIONS[nextIndex];
  updateActiveDirection(unit.direction);
  playUnitAnimation(unit, unit.animationName, true);

  if (unit.team === "player") {
    updatePlayerMovePreview();
    updateEnemyIntentPreview();
  }
}

function setPlayerMovementMode(mode) {
  const selectedUnit = getSelectedPlayerUnit();

  if (
    isExecutingActionQueue ||
    !selectedUnit ||
    selectedUnit.movementFrameRequest !== null ||
    !PLAYER_MOVEMENT_MODES.includes(mode)
  ) {
    updatePlayerActionControls();
    return;
  }

  selectedUnit.movementMode = mode;
  renderPlayerMovementModeSelector();
  updatePlayerMovePreview();
}

function renderPlayerMovementModeSelector() {
  if (!playerActionMenu) {
    return;
  }

  const selector = playerActionMenu.querySelector("[data-player-movement-selector]");
  const label = playerActionMenu.querySelector("[data-player-movement-label]");
  const selectedUnit = getSelectedPlayerUnit();
  const modeIndex = PLAYER_MOVEMENT_MODES.indexOf(selectedUnit?.movementMode ?? player.movementMode);

  if (!selector || !label) {
    return;
  }

  const safeModeIndex = modeIndex === -1 ? 0 : modeIndex;

  label.textContent = PLAYER_MOVEMENT_MODES[safeModeIndex];

  selector.querySelectorAll("[data-player-movement-mode]").forEach((button) => {
    const isActive = button.dataset.playerMovementMode === PLAYER_MOVEMENT_MODES[safeModeIndex];

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateEnemyIntentPreview() {
  if (isExecutingActionQueue) {
    return;
  }

  if (enemyMode === "stag") {
    clearEnemyPackActionQueue();
    renderEnemyPackIntentTags();
    return;
  }

  const enemyUnits = units.filter((unit) => unit.team === "enemy");
  const playerUnits = units.filter((unit) => unit.team === "player");

  if (!hasAliveUnitsByTeam("player") || !hasAliveUnitsByTeam("enemy")) {
    clearEnemyPackActionQueue();
    renderEnemyPackIntentTags(enemyUnits);
    return;
  }

  planEnemyPackTurn(enemyUnits, playerUnits);
}

function updatePlayerTileLabels() {
  tileElements.forEach((tile) => {
    const tileNumber = tile.dataset.tileNumber;
    let label = `Move wolf to tile ${tileNumber}`;

    if (isFriendlyTile(tile)) {
      label = `Select friendly wolf on tile ${tileNumber}`;
    } else if (isEnemyTile(tile)) {
      label = `Enemy unit occupies tile ${tileNumber}`;
    }

    tile.setAttribute("aria-label", label);
  });
}

function applyPlayerAction(action) {
  const selectedUnit = getSelectedPlayerUnit();

  if (isExecutingActionQueue) {
    updatePlayerActionControls();
    return;
  }

  if (!selectedUnit || isUnitActionQueueFull(selectedUnit)) {
    updatePlayerActionControls();
    return;
  }

  if (!consumeAvailableAction(action)) {
    updatePlayerActionControls();
    return;
  }

  queueUnitAction(selectedUnit, action);
  updatePlayerActionControls();
}

// ============================================================================
// OVERWORLD MAP — pure lattice state machine (DOM-free, headless-testable).
//
// Arenas live on an (x, y) lattice. The four on-screen corners map to the four
// iso diagonals, and each is one cardinal step along a world axis: the axes run
// ALONG the diagonals, so topRight/bottomLeft are opposites on the x axis and
// topLeft/bottomRight are opposites on the y axis. That keeps the lattice
// gap-free and makes "a corner then its opposite" return to the same cell.
//
// The battle layer never touches this state directly — it reads the current
// node to set up an arena and reports win/loss back, so the whole world loop is
// plain data that the headless dev-test harness can exercise without a DOM.
// ============================================================================

// The four edge-adjacent directions (screen diagonals) — these are the arena
// edges the territory outline is built from.
const WORLD_CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

// All eight travel directions — the four edge neighbours plus the four
// vertex neighbours (straight up/down/left/right on screen) that complete the
// ring. `facing` maps each to one of the wolf's four sprite rows so the run
// animation points the right way.
const WORLD_MOVES = {
  topRight: { x: 1, y: 0, facing: "topRight" },
  topLeft: { x: 0, y: 1, facing: "topLeft" },
  bottomRight: { x: 0, y: -1, facing: "bottomRight" },
  bottomLeft: { x: -1, y: 0, facing: "bottomLeft" },
  top: { x: 1, y: 1, facing: "topRight" },
  bottom: { x: -1, y: -1, facing: "bottomLeft" },
  right: { x: 1, y: -1, facing: "bottomRight" },
  left: { x: -1, y: 1, facing: "topLeft" },
};
const WORLD_MOVE_KEYS = Object.keys(WORLD_MOVES);

// The world is bounded: from the home cell in the middle, the player can travel
// at most this many steps along each axis (each of the four corner directions).
// Reaching an edge blocks further expansion that way.
const WORLD_MAX_DISTANCE = 5;

function worldCoordKey(x, y) {
  return `${x},${y}`;
}

function isWithinWorldBounds(x, y) {
  return Math.abs(x) <= WORLD_MAX_DISTANCE && Math.abs(y) <= WORLD_MAX_DISTANCE;
}

// Manhattan distance from home (0, 0) — the tunable basis for difficulty.
function worldNodeDistance(x, y) {
  return Math.abs(x) + Math.abs(y);
}

// Every node is the standard three-wolves encounter for now. Per-node enemy
// variety (stag duels, etc.) returns with the levels work.
function pickEnemyModeForNode() {
  return DEFAULT_ENEMY_MODE;
}

// Stable per-cell seed so a node's terrain is identical every time it's
// rendered (preview) or entered (battle).
function worldNodeSeed(x, y) {
  return (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
}

function createWorldNode(x, y, overrides = {}) {
  return {
    x,
    y,
    cleared: false,
    enemyMode: pickEnemyModeForNode(x, y),
    difficulty: worldNodeDistance(x, y),
    seed: worldNodeSeed(x, y),
    ...overrides,
  };
}

// Fresh run: the home cell (0, 0) is the first fight, using the default enemy
// so it matches the arena the game boots into. Winning it opens the map.
function createWorld() {
  const world = { x: 0, y: 0, facing: "bottomLeft", nodes: {} };
  world.nodes[worldCoordKey(0, 0)] = createWorldNode(0, 0, {
    enemyMode: DEFAULT_ENEMY_MODE,
  });
  return world;
}

function getWorldNode(world, x, y) {
  return world.nodes[worldCoordKey(x, y)] ?? null;
}

function getCurrentWorldNode(world) {
  return getWorldNode(world, world.x, world.y);
}

function neighborCoord(x, y, direction) {
  const delta = WORLD_MOVES[direction];

  if (!delta) {
    throw new Error(`Unknown direction: ${direction}`);
  }

  return { x: x + delta.x, y: y + delta.y };
}

// Move the pack into the neighbouring cell for the chosen corner, creating that
// node the first time it's reached. Returns the node and whether entering it
// starts a battle (uncleared) or is safe passage (already cleared), or null if
// that corner would leave the bounded world (the player is at an edge).
function expandToCorner(world, corner) {
  const { x, y } = neighborCoord(world.x, world.y, corner);

  if (!isWithinWorldBounds(x, y)) {
    return null;
  }

  const key = worldCoordKey(x, y);

  if (!world.nodes[key]) {
    world.nodes[key] = createWorldNode(x, y);
  }

  world.x = x;
  world.y = y;
  world.facing = WORLD_MOVES[corner].facing; // face the way the pack travelled

  const node = world.nodes[key];
  return { node, isBattle: !node.cleared };
}

// Mark the cell the pack is standing in as cleared — call this on a battle win.
function clearCurrentWorldCell(world) {
  const node = getCurrentWorldNode(world);

  if (node) {
    node.cleared = true;
  }

  return node;
}

// The live run. The battle layer reads this to set up arenas and reports
// outcomes back through concludeBattle().
let worldState = createWorld();

const worldStage = arena ? arena.parentElement : null;
const WORLD_MAP_MAX_SCALE = 3;
const WORLD_VIEW_SPAN = 2; // arenas from the centre to each viewport edge (fixed zoom)
const WORLD_TRAVEL_MS = 620; // wolf run-in before the arena transition

// Cache generated terrain per node seed — the map now draws many cells, so this
// avoids regenerating identical terrain every render.
const worldTerrainCache = new Map();

// Latest map layout (so the travel animation knows the current scale/centre)
// and a guard so a corner can't be re-triggered mid-run.
let worldMapLayout = null;
let isWorldTraveling = false;

// Tear down the current arena and build the one described by a world node:
// fresh terrain, the node's enemy type, and a full-health pack (arenas are
// self-contained — no carry-over damage).
function startArena(node, entryCorner = currentEntryCorner) {
  hideWorldMap();

  if (gameResultOverlay) {
    gameResultOverlay.hidden = true;
  }

  // Set before buildArena so water-clearing and spawn placement both use it.
  currentEntryCorner = entryCorner;

  // TEMP debug (remove once corner mapping is confirmed): what you clicked and
  // where each pack lands, so a mis-mapping is obvious from the console.
  {
    const p = getEntryCornerSetup("player", "primary", entryCorner, GRID_SIZE);
    const e = getEntryCornerSetup("enemy", "primary", entryCorner, GRID_SIZE);
    console.log(`[spawn] entryCorner=${entryCorner} | player primary=(${p.row},${p.col}) facing ${p.direction} | enemy primary=(${e.row},${e.col})`);
  }

  reshuffleChargesRemaining = RESHUFFLE_CHARGES_PER_BATTLE;

  if (node && node.enemyMode && ENEMY_MODES.includes(node.enemyMode)) {
    enemyMode = node.enemyMode;
  }

  // Mirror the proven build sequence (bootstrap / arena-size change).
  buildArena();
  resetDevTest();
  refillAvailableActions();
  updateEnemyIntentPreview();
  updateReshuffleControl();
  resizeArena();
  syncEnemyModeControls();
}

function hideWorldMap() {
  if (worldStage) {
    worldStage.classList.remove("is-zoomed-out");
  }

  if (arena) {
    arena.style.transform = "";
    arena.style.zIndex = "";
    arena.style.transition = "";
  }

  clearWorldNeighbors();
}

function openWorldMap() {
  if (gameResultOverlay) {
    gameResultOverlay.hidden = true;
  }

  if (worldStage) {
    worldStage.classList.add("is-zoomed-out");
  }

  // Only the initial zoom-out animates; moving around the map snaps instantly.
  renderWorldMap(true);
}

// Player picked a corner on the map: the wolf runs into that tile, then we
// resolve it. A fresh cell starts a battle; a previously-cleared cell is safe
// passage (re-centre the map). Edge corners are blocked. Ignored mid-run.
async function chooseCorner(corner) {
  if (isWorldTraveling) {
    return;
  }

  const { x, y } = neighborCoord(worldState.x, worldState.y, corner);

  if (!isWithinWorldBounds(x, y)) {
    return; // world edge — nowhere to run to
  }

  isWorldTraveling = true;

  try {
    await animateTravel(corner);
  } finally {
    isWorldTraveling = false;
  }

  const result = expandToCorner(worldState, corner);

  if (!result) {
    return;
  }

  if (result.isBattle) {
    startArena(result.node, corner);
  } else {
    renderWorldMap(); // fixed layout → lands exactly where the pan ended
  }
}

// Camera pan: the wolf runs in place (run sprite, facing the travel direction)
// while the whole map slides one arena step the opposite way, so the chosen
// tile glides in to the wolf. Resolves when the slide finishes.
function animateTravel(corner) {
  if (!worldStage || !worldMapLayout) {
    return wait(0);
  }

  const { x, y } = neighborCoord(worldState.x, worldState.y, corner);
  const { ox, oy } = worldCellScreenOffset(x, y);
  const scale = worldMapLayout.scale;
  const panX = -ox * scale;
  const panY = -oy * scale;

  const marker = worldStage.querySelector(".world-current-marker");
  if (marker) {
    const facing = WORLD_MOVES[corner].facing;
    const directionRow = WOLF_DIRECTIONS[facing] ?? WOLF_DIRECTIONS.bottomLeft;
    marker.style.backgroundImage = `url("${WOLF_PATH}/wolf-run.png")`;
    marker.style.backgroundPositionY = `-${directionRow * WOLF_FRAME_SIZE}px`;
    marker.classList.add("is-running"); // runs in place; the map moves under it
  }

  // Slide every map element (the live arena, the neighbours, the outline) by
  // the same pan, composed in front of each element's own placement transform.
  const pan = `translate(${panX}px, ${panY}px)`;
  const panEls = [
    ...(arena ? [arena] : []),
    ...worldStage.querySelectorAll(".world-neighbor, .world-territory-outline"),
  ];
  panEls.forEach((el) => {
    el.style.transition = `transform ${WORLD_TRAVEL_MS}ms linear`;
    el.style.transform = `${pan} ${el.style.transform}`.trim();
  });

  return wait(WORLD_TRAVEL_MS);
}

function clearWorldNeighbors() {
  if (!worldStage) {
    return;
  }

  worldStage
    .querySelectorAll(".world-neighbor, .world-territory-outline, .world-current-marker")
    .forEach((el) => el.remove());
}

// Generate a node's terrain without disturbing the live arena's terrain/water/
// hill. Cached by size+world-position since water depends on where the arena
// sits in the global field (previews use the raw field — clearSpawns stays off).
// Returns { tiles, hillKeys, hillLevels } for the given arena node: the same
// ground tiles and hill (rock) overlay data the live arena would generate for
// that seed, so the world-map preview can render exactly what the arena will
// look like when entered.
function terrainTilesForSeed(size, seed, worldX = 0, worldY = 0) {
  const cacheKey = `${size}:${seed}:${worldX}:${worldY}`;
  const cached = worldTerrainCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const savedTerrain = terrainTiles;
  const savedPond = pondTileKeys;
  const savedHill = hillTileKeys;
  const savedHillLevels = hillTileLevels;
  const savedFlowers = flowerTileKeys;
  const savedTrees = treeTileKeys;

  // clearSpawns MUST match what happens when this node is actually entered
  // (paintCenterTerrain always passes true) — otherwise the pond footprint
  // differs at spawn cells, which shifts how many seeded-RNG draws stampWater
  // consumes before hills/flowers/trees are placed, desyncing every stamp
  // that follows and making the preview diverge from the real arena.
  generateTerrain(size, seed, worldX, worldY, true);
  const result = {
    tiles: terrainTiles.map((typeRow) => typeRow.slice()),
    hillKeys: new Set(hillTileKeys),
    hillLevels: new Map(hillTileLevels),
    flowerKeys: new Set(flowerTileKeys),
    treeKeys: new Set(treeTileKeys),
  };

  terrainTiles = savedTerrain;
  pondTileKeys = savedPond;
  hillTileKeys = savedHill;
  hillTileLevels = savedHillLevels;
  flowerTileKeys = savedFlowers;
  treeTileKeys = savedTrees;
  worldTerrainCache.set(cacheKey, result);
  return result;
}

// A flat all-dirt grid used to render hidden (unseen) arenas — shows the arena's
// shape/size without revealing its real terrain. Cached (same for every cell).
let dirtTileGridCache = null;
function dirtTileGrid(size) {
  if (!dirtTileGridCache || dirtTileGridCache.length !== size) {
    const dirt = DIRT_BASE_TILES[7];
    dirtTileGridCache = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => dirt),
    );
  }

  return dirtTileGridCache;
}

// A terrain-only iso layer (no units, anchors, labels, or interactivity) used
// to preview a neighbouring arena. hillKeys/hillLevels/flowerKeys are optional
// — omitted for the unseen (dirt-placeholder) grid, which has no real terrain
// features to draw.
function buildWorldTerrainLayer(tiles, hillKeys = null, hillLevels = null, flowerKeys = null, treeKeys = null) {
  const layer = document.createElement("div");
  layer.className = "tile-layer";

  for (let row = 0; row < tiles.length; row += 1) {
    for (let col = 0; col < tiles[row].length; col += 1) {
      const tile = document.createElement("div");
      const img = document.createElement("img");
      const position = projectTile(row, col);

      tile.className = "tile";
      tile.style.left = `${position.x}px`;
      tile.style.top = `${position.y}px`;
      tile.style.zIndex = row + col;
      img.src = tileSrc(tiles[row][col]);
      img.alt = "";
      img.draggable = false;
      tile.append(img);
      layer.append(tile);
    }
  }

  if (hillKeys) {
    layer.append(...buildHillBlocks(hillKeys, hillLevels));
  }

  if (flowerKeys) {
    layer.append(...buildFlowerBlocks(flowerKeys));
  }

  if (treeKeys) {
    layer.append(...buildTreeBlocks(treeKeys));
  }

  return layer;
}

// Repaint the live (centre) arena's tiles to match a node's terrain, without
// touching units — used so the centre always shows the cell you're standing on.
function paintCenterTerrain(node) {
  if (!node) {
    return;
  }

  generateTerrain(GRID_SIZE, node.seed, node.x, node.y, true);

  tileElements.forEach((tile) => {
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    const img = tile.querySelector("img");

    if (img && terrainTiles[row] && terrainTiles[row][col] != null) {
      img.src = tileSrc(terrainTiles[row][col]);
    }
  });

  renderArenaHill(arena?.querySelector(".tile-layer"));
  renderArenaFlowers(arena?.querySelector(".tile-layer"));
  renderArenaTrees(arena?.querySelector(".tile-layer"));
  refreshConcealmentVisuals(); // the new cell's hill may conceal a unit differently
}

// Screen offset (unscaled px) of a cell relative to the current one. World axes
// run along the iso diagonals, so one step is half an arena in each screen
// direction — adjacent arenas tile edge-to-edge.
function worldCellScreenOffset(x, y) {
  const dx = x - worldState.x;
  const dy = y - worldState.y;

  return {
    ox: (dx - dy) * GRID_SIZE * ISO_X_STEP,
    oy: -(dx + dy) * GRID_SIZE * ISO_Y_STEP,
  };
}

// Fixed zoom centred on the current cell: shows a neighbourhood of about
// WORLD_VIEW_SPAN arenas each way, at a consistent size, and pans as you move.
function computeWorldMapLayout() {
  const stepX = GRID_SIZE * ISO_X_STEP;
  const stepY = GRID_SIZE * ISO_Y_STEP;
  const scale = Math.min(
    WORLD_MAP_MAX_SCALE,
    (window.innerWidth * 0.96) / (2 * WORLD_VIEW_SPAN * stepX + boardWidth),
    (window.innerHeight * 0.92) / (2 * WORLD_VIEW_SPAN * stepY + boardHeight),
  );

  return { scale, cx: 0, cy: 0 }; // centred on the current cell
}

// Every arena to draw: all in-bounds cells whose diamond falls within the
// viewport (so the whole bounded world is present as you pan). Adjacent cells
// carry their corner so they're clickable.
function collectWorldMapCells(layout) {
  const stageW = worldStage.clientWidth || window.innerWidth;
  const stageH = worldStage.clientHeight || window.innerHeight;
  const marginX = boardWidth * layout.scale;
  const marginY = boardHeight * layout.scale;

  // All eight surrounding directions are travel choices (the full ring).
  const cornerByKey = {};
  WORLD_MOVE_KEYS.forEach((direction) => {
    const { x, y } = neighborCoord(worldState.x, worldState.y, direction);

    if (isWithinWorldBounds(x, y)) {
      cornerByKey[worldCoordKey(x, y)] = direction;
    }
  });

  const cells = [];

  for (let x = -WORLD_MAX_DISTANCE; x <= WORLD_MAX_DISTANCE; x += 1) {
    for (let y = -WORLD_MAX_DISTANCE; y <= WORLD_MAX_DISTANCE; y += 1) {
      const { ox, oy } = worldCellScreenOffset(x, y);
      const sx = stageW / 2 + (ox - layout.cx) * layout.scale;
      const sy = stageH / 2 + (oy - layout.cy) * layout.scale;

      if (sx < -marginX || sx > stageW + marginX || sy < -marginY || sy > stageH + marginY) {
        continue; // off-screen — cull
      }

      cells.push({ x, y, corner: cornerByKey[worldCoordKey(x, y)] ?? null });
    }
  }

  return cells;
}

function worldCellTransform(ox, oy, layout) {
  const tx = (ox - layout.cx) * layout.scale;
  const ty = (oy - layout.cy) * layout.scale;

  return `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${layout.scale})`;
}

// Build one arena on the map. Cleared and adjacent cells render full terrain;
// everything else in the world is a heavily-darkened silhouette (unseen). Only
// the four adjacent cells are clickable.
function buildWorldCell(cell, layout, animate) {
  const { x, y, corner } = cell;
  const node = getWorldNode(worldState, x, y);
  const cleared = Boolean(node && node.cleared);
  const revealed = cleared || Boolean(corner); // cleared history + current neighbours
  const seed = node ? node.seed : worldNodeSeed(x, y);
  const { ox, oy } = worldCellScreenOffset(x, y);

  const el = document.createElement("div");
  el.className = "arena world-neighbor";
  el.classList.toggle("is-cleared", cleared);
  el.classList.toggle("is-unseen", !revealed);
  el.classList.toggle("is-entering", Boolean(animate));
  el.style.transform = worldCellTransform(ox, oy, layout);
  // Stack by isometric depth: arenas lower on screen sit in front.
  el.style.zIndex = String(1000 + Math.round(oy));

  // Revealed cells show their real terrain (ground + rock overlay, matching
  // exactly what the live arena will generate for this seed); hidden cells
  // show plain dirt with no overlay.
  const inner = document.createElement("div");
  inner.className = "world-neighbor-board";

  if (revealed) {
    const { tiles, hillKeys, hillLevels, flowerKeys, treeKeys } = terrainTilesForSeed(GRID_SIZE, seed, x, y);
    inner.append(buildWorldTerrainLayer(tiles, hillKeys, hillLevels, flowerKeys, treeKeys));
  } else {
    inner.append(buildWorldTerrainLayer(dirtTileGrid(GRID_SIZE)));
  }

  el.append(inner);

  if (corner) {
    el.classList.add("is-choice");
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.setAttribute("aria-label", `${cleared ? "Travel to" : "Fight in"} the ${corner} arena`);

    // Diamond-shaped hit area (CSS clip-path) so overlapping rectangular boxes
    // don't steal each other's clicks/hover over their transparent corners.
    const hit = document.createElement("div");
    hit.className = "world-neighbor-hit";
    el.append(hit);

    const choose = () => chooseCorner(corner);
    el.addEventListener("click", choose);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
      }
    });
  }

  return el;
}

// Outline the won territory as one shape: for each cleared cell, draw its
// rhombus edges only where the neighbour in that direction isn't also cleared.
// Edges shared by two cleared cells cancel, leaving just the outer perimeter.
const TERRITORY_EDGES = [
  { corner: "topRight", a: [0, -1], b: [1, 0] }, // top → right
  { corner: "bottomRight", a: [1, 0], b: [0, 1] }, // right → bottom
  { corner: "bottomLeft", a: [0, 1], b: [-1, 0] }, // bottom → left
  { corner: "topLeft", a: [-1, 0], b: [0, -1] }, // left → top
];

// Vertical placement of the territory outline, in arena-local px (scales with
// the map zoom). 0 centres it on the lattice cell; positive moves it down.
// Tune to sit it on the terrain.
const WORLD_TERRITORY_NUDGE_Y = 0;

// Size of the current-cell wolf marker, relative to the map's per-tile scale.
const WORLD_MARKER_SCALE = 2.4;

function buildTerritoryOutline(layout) {
  const svgNS = "http://www.w3.org/2000/svg";
  const stageW = worldStage.clientWidth || window.innerWidth;
  const stageH = worldStage.clientHeight || window.innerHeight;

  // Rhombus half-extents (one lattice step) and the offset that recentres it on
  // the painted terrain (which sits slightly higher than the arena box centre).
  const hx = GRID_SIZE * ISO_X_STEP * layout.scale;
  const hy = GRID_SIZE * ISO_Y_STEP * layout.scale;
  const nudgeY = WORLD_TERRITORY_NUDGE_Y * layout.scale;

  const segments = [];

  Object.values(worldState.nodes).forEach((node) => {
    if (!node.cleared) {
      return;
    }

    const { ox, oy } = worldCellScreenOffset(node.x, node.y);
    const sx = stageW / 2 + (ox - layout.cx) * layout.scale;
    const sy = stageH / 2 + (oy - layout.cy) * layout.scale + nudgeY;

    TERRITORY_EDGES.forEach(({ corner, a, b }) => {
      const { x, y } = neighborCoord(node.x, node.y, corner);
      const neighbour = getWorldNode(worldState, x, y);

      if (neighbour && neighbour.cleared) {
        return; // interior edge between two owned cells — skip
      }

      segments.push(
        `M ${sx + a[0] * hx} ${sy + a[1] * hy} L ${sx + b[0] * hx} ${sy + b[1] * hy}`,
      );
    });
  });

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "world-territory-outline");
  svg.setAttribute("width", stageW);
  svg.setAttribute("height", stageH);
  svg.setAttribute("viewBox", `0 0 ${stageW} ${stageH}`);

  // Light highlight on the arena the pack is standing on (drawn under the
  // outline stroke). Current cell offset is (0, 0).
  const ccx = stageW / 2 - layout.cx * layout.scale;
  const ccy = stageH / 2 - layout.cy * layout.scale + nudgeY;
  const highlight = document.createElementNS(svgNS, "polygon");
  highlight.setAttribute("class", "world-current-fill");
  highlight.setAttribute(
    "points",
    `${ccx},${ccy - hy} ${ccx + hx},${ccy} ${ccx},${ccy + hy} ${ccx - hx},${ccy}`,
  );
  svg.append(highlight);

  if (segments.length) {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("class", "world-territory-path");
    path.setAttribute("d", segments.join(" "));
    svg.append(path);
  }

  return svg;
}

// Zoomed-out map: keep the live arena as the current cell, draw every explored
// cell plus every in-bounds arena in view (unseen ones darkened). The zoom is
// fixed and centred on the current cell, so the layout is identical every render
// — the travel pan lands exactly where the re-render draws (no jump).
// animate=true plays the entry fade (initial open only).
function renderWorldMap(animate = false) {
  if (!worldStage) {
    return;
  }

  paintCenterTerrain(getCurrentWorldNode(worldState));
  clearWorldNeighbors();

  const layout = computeWorldMapLayout();
  worldMapLayout = layout; // remembered for the travel animation
  const cells = collectWorldMapCells(layout);

  if (arena) {
    if (!animate) {
      arena.style.transition = "none"; // snap, don't slide, when navigating
    }

    arena.style.transform = worldCellTransform(0, 0, layout);
    arena.style.zIndex = "1000"; // current cell sits at depth 0

    if (!animate) {
      void arena.offsetWidth; // commit the snap before re-enabling transitions
      arena.style.transition = "";
    }
  }

  cells.forEach((cell) => {
    if (cell.x === worldState.x && cell.y === worldState.y) {
      return; // the current cell is the live arena
    }

    worldStage.append(buildWorldCell(cell, layout, animate));
  });

  worldStage.append(buildTerritoryOutline(layout));
  worldStage.append(buildCurrentMarker(layout));
}

function markerTransform(dx, dy, scale) {
  return `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale})`;
}

// A single wolf standing in the middle of the current arena (idle), facing the
// way the pack last travelled, to mark where you're moving from.
function buildCurrentMarker(layout) {
  const stageW = worldStage.clientWidth || window.innerWidth;
  const stageH = worldStage.clientHeight || window.innerHeight;
  const nudgeY = WORLD_TERRITORY_NUDGE_Y * layout.scale;
  const sx = stageW / 2 - layout.cx * layout.scale;
  const sy = stageH / 2 - layout.cy * layout.scale + nudgeY;
  const directionRow = WOLF_DIRECTIONS[worldState.facing] ?? WOLF_DIRECTIONS.bottomLeft;

  const marker = document.createElement("div");
  marker.className = "world-current-marker";
  marker.style.width = `${WOLF_FRAME_SIZE}px`;
  marker.style.height = `${WOLF_FRAME_SIZE}px`;
  marker.style.backgroundImage = `url("${WOLF_PATH}/wolf-idle.png")`;
  marker.style.backgroundPositionX = "0px";
  marker.style.backgroundPositionY = `-${directionRow * WOLF_FRAME_SIZE}px`;
  marker.style.left = `${sx}px`;
  marker.style.top = `${sy}px`;
  marker.style.transform = markerTransform(0, 0, layout.scale * WORLD_MARKER_SCALE);
  return marker;
}

function buildArena() {
  const tileLayer = document.createElement("div");
  const unitLayer = document.createElement("div");

  tileElements.length = 0;
  playerMovePreviewTile = null;
  playerActionMenu?.remove();
  tileLayer.className = "tile-layer";
  unitLayer.className = "unit-layer";

  const initialNode = getCurrentWorldNode(worldState);
  generateTerrain(GRID_SIZE, initialNode?.seed ?? null, initialNode?.x ?? 0, initialNode?.y ?? 0, true);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const tile = document.createElement("div");
      const img = document.createElement("img");
      const anchor = document.createElement("div");
      const label = document.createElement("span");
      const position = projectTile(row, col);
      const tileNumber = row * GRID_SIZE + col + 1;

      tile.className = "tile";
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", `Move wolf to tile ${tileNumber}`);
      tile.tabIndex = 0;
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.tileNumber = tileNumber;
      tile.style.left = `${position.x}px`;
      tile.style.top = `${position.y}px`;
      tile.style.zIndex = row + col;

      img.src = tileSrc(terrainTiles[row][col]);
      img.alt = "";
      img.draggable = false;

      anchor.className = "tile-anchor";
      label.className = "tile-number";
      label.textContent = tileNumber;

      tile.append(img, anchor, label);
      tileLayer.append(tile);
      tileElements.push(tile);
    }
  }

  renderArenaHill(tileLayer);
  renderArenaFlowers(tileLayer);
  renderArenaTrees(tileLayer);

  units.filter(isUnitActive).forEach((unit) => {
    placeUnit(unitLayer, unit);
    unit.element.classList.add(unit.team);
  });

  playerMovePreview = createPlayerMovePreview();
  unitLayer.append(playerMovePreview);

  playerActionMenu = createPlayerActionMenu();
  arena.replaceChildren(tileLayer, unitLayer);
  arena.parentElement.append(playerActionMenu);
  positionPlayerActionMenu();
  updatePlayerMovePreview();
  refreshConcealmentVisuals(); // a hill can conceal a unit from the very first frame
}

// One rock sprite per blocked cell, using the same depth as the former hills.
// Coordinate hashing keeps artwork stable without consuming generation RNG.
function rockTileForCell(row, col, hillLevels = hillTileLevels) {
  const levels = hillLevels.get(getGridPositionKey(row, col)) ?? HILL_HEIGHT_LEVELS;
  const tiles = levels > 1 ? ROCK_TILES.interior : ROCK_TILES.edge;
  const hash = (Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663)) >>> 0;
  return tiles[hash % tiles.length];
}

// Build the rock-sprite overlay blocks for a hill footprint. Shared by the live
// arena (renderArenaHill) and the world-map preview (buildWorldCell) so any
// terrain feature drawn as an overlay — not baked into terrainTiles, the way
// water is — renders identically in both places instead of only in the live
// arena.
function buildHillBlocks(hillKeys, hillLevels) {
  const blocks = [];

  hillKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const position = projectTile(row, col);
    const depth = GRID_SIZE * 2 + row + col + 20;
    const block = document.createElement("div");
    const img = document.createElement("img");

    block.className = "hill-block hill-block--top rock";
    block.dataset.row = row;
    block.dataset.col = col;
    block.style.left = `${position.x}px`;
    block.style.top = `${position.y}px`;
    block.style.zIndex = depth;
    img.src = tileSrc(rockTileForCell(row, col, hillLevels));
    img.alt = "";
    img.draggable = false;

    block.append(img);
    blocks.push(block);
  });

  return blocks;
}

function renderArenaHill(layer) {
  if (!layer) {
    return;
  }

  layer.querySelectorAll(".hill-block").forEach((el) => el.remove());
  layer.append(...buildHillBlocks(hillTileKeys, hillTileLevels));
}

// One flower sprite per decorated cell. Coordinate hashing (same technique as
// rockTileForCell) keeps the art stable across re-renders without consuming
// generation RNG.
function flowerTileForCell(row, col) {
  const hash = (Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663)) >>> 0;
  return FLOWER_TILES[hash % FLOWER_TILES.length];
}

// Build the flower-sprite overlay blocks for a set of cells. Shared by the
// live arena (renderArenaFlowers) and the world-map preview (buildWorldCell),
// same as buildHillBlocks — same z-index/offset scheme as rocks, since a
// flower is drawn the same way: a sprite overlaid on its grass tile.
function buildFlowerBlocks(flowerKeys) {
  const blocks = [];

  flowerKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const position = projectTile(row, col);
    const depth = GRID_SIZE * 2 + row + col + 20;
    const block = document.createElement("div");
    const img = document.createElement("img");

    block.className = "flower-block";
    block.dataset.row = row;
    block.dataset.col = col;
    block.style.left = `${position.x}px`;
    block.style.top = `${position.y}px`;
    block.style.zIndex = depth;
    img.src = tileSrc(flowerTileForCell(row, col));
    img.alt = "";
    img.draggable = false;

    block.append(img);
    blocks.push(block);
  });

  return blocks;
}

function renderArenaFlowers(layer) {
  if (!layer) {
    return;
  }

  layer.querySelectorAll(".flower-block").forEach((el) => el.remove());
  layer.append(...buildFlowerBlocks(flowerTileKeys));
}

// Build the tree-sprite overlay blocks for a set of cells. Shared by the live
// arena (renderArenaTrees) and the world-map preview (buildWorldCell), same
// pattern as buildFlowerBlocks — a single static image, no per-cell variant.
function buildTreeBlocks(treeKeys) {
  const blocks = [];

  treeKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const position = projectTile(row, col);
    const depth = GRID_SIZE * 2 + row + col + 20;
    const block = document.createElement("div");
    const img = document.createElement("img");
    const outline = document.createElement("img");

    block.className = "tree-block";
    block.dataset.row = row;
    block.dataset.col = col;
    block.style.left = `${position.x}px`;
    block.style.top = `${position.y}px`;
    block.style.zIndex = depth;
    img.className = "tree-sprite";
    img.src = TREE_IMAGE_PATH;
    img.alt = "";
    img.draggable = false;
    outline.className = "tree-outline";
    outline.src = TREE_OUTLINE_IMAGE_PATH;
    outline.alt = "";
    outline.draggable = false;

    block.append(img, outline);
    blocks.push(block);
  });

  return blocks;
}

function renderArenaTrees(layer) {
  if (!layer) {
    return;
  }

  layer.querySelectorAll(".tree-block").forEach((el) => el.remove());
  layer.append(...buildTreeBlocks(treeTileKeys));
}

// The height (in the same local px projectTile uses, above the tree's base)
// at which the tree should be fully transparent, so a unit hiding behind it
// stays visible — or null if nothing currently occludes it. When several
// units are behind the tree, the lowest one (closest to the base) sets the
// fade point: taller occluders sit above it, already inside the fully
// transparent region, so they're revealed for free.
function findTreeFadeStopPx(treeRow, treeCol) {
  const treePos = projectTile(treeRow, treeCol);
  let fadeStopPx = null;

  units.forEach((unit) => {
    if (!isUnitAlive(unit)) {
      return;
    }

    const unitPos = projectTile(unit.row, unit.col);
    const dx = Math.abs(unitPos.x - treePos.x);
    const dy = treePos.y - unitPos.y; // positive when the unit is above the tree on screen

    if (dx > TREE_TRANSPARENCY_HALF_WIDTH_PX || dy <= 0 || dy > TREE_TRANSPARENCY_HEIGHT_PX) {
      return;
    }

    if (fadeStopPx === null || dy < fadeStopPx) {
      fadeStopPx = dy;
    }
  });

  return fadeStopPx;
}

// Fade each occluding tree from fully opaque at its base to fully transparent
// at the height of the unit hiding behind it, via a mask gradient (a flat
// on/off opacity would hide the whole tree, not just the part in front of the
// unit). The outline sprite gets the opposite mask — transparent where the
// tree sprite is still opaque, opaque where the tree sprite has faded — so it
// only fills in the part of the silhouette the tree itself no longer shows.
// Skipped entirely when --tree-outline-opacity is 0 (nothing to show). Call
// after any unit position change, alongside concealment.
function refreshTreeTransparency() {
  const layer = arena?.querySelector(".tile-layer");

  layer?.querySelectorAll(".tree-block").forEach((block) => {
    const row = Number(block.dataset.row);
    const col = Number(block.dataset.col);
    const sprite = block.querySelector(".tree-sprite");
    const outline = block.querySelector(".tree-outline");
    const outlineOpacity = outline
      ? Number(getComputedStyle(outline).getPropertyValue("--tree-outline-opacity"))
      : 0;
    const fadeStopPx = findTreeFadeStopPx(row, col);

    if (fadeStopPx === null || !(outlineOpacity > 0)) {
      if (sprite) {
        sprite.style.maskImage = "";
        sprite.style.webkitMaskImage = "";
      }
      if (outline) {
        outline.style.maskImage = "";
        outline.style.webkitMaskImage = "";
        outline.classList.remove("is-visible");
      }
      return;
    }

    const spriteGradient = `linear-gradient(to top, black 0px, transparent ${fadeStopPx}px)`;
    const outlineGradient = `linear-gradient(to top, transparent 0px, black ${fadeStopPx}px)`;

    if (sprite) {
      sprite.style.maskImage = spriteGradient;
      sprite.style.webkitMaskImage = spriteGradient;
    }
    if (outline) {
      outline.style.maskImage = outlineGradient;
      outline.style.webkitMaskImage = outlineGradient;
      outline.classList.add("is-visible");
    }
  });
}

// --- Hill editor (dev tool) ----------------------------------------------
// Repaint one tile's ground sprite from the current terrainTiles value.
function repaintTileSprite(row, col) {
  const img = tileElements[row * GRID_SIZE + col]?.querySelector("img");
  if (img) {
    img.src = tileSrc(terrainTiles[row][col]);
  }
}

function setHillEditMode(enabled) {
  isHillEditMode = enabled;
  if (enabled) {
    // Snapshot terrain so removing an authored hill restores the original tile.
    hillEditTerrainSnapshot = terrainTiles.map((row) => row.slice());
  }
  arena?.classList.toggle("hill-edit", enabled);
}

// Click cycle for one tile: none -> level 1 -> level 2 -> none. Adding sets the
// ground to dirt (like stampHill); removing restores the snapshotted terrain.
function cycleHillTileAt(row, col) {
  if (
    !Number.isInteger(row) || !Number.isInteger(col) ||
    row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE
  ) {
    return;
  }

  const key = getGridPositionKey(row, col);
  const level = hillTileLevels.get(key) ?? (hillTileKeys.has(key) ? HILL_HEIGHT_LEVELS : 0);

  if (level === 0) {
    hillTileKeys.add(key);
    hillTileLevels.set(key, 1);
    terrainTiles[row][col] = pickTerrainTile(TERRAIN_DIRT);
    repaintTileSprite(row, col);
  } else if (level === 1) {
    hillTileLevels.set(key, 2);
  } else {
    hillTileKeys.delete(key);
    hillTileLevels.delete(key);
    if (hillEditTerrainSnapshot?.[row]) {
      terrainTiles[row][col] = hillEditTerrainSnapshot[row][col];
      repaintTileSprite(row, col);
    }
  }

  renderArenaHill(arena?.querySelector(".tile-layer"));
  refreshConcealmentVisuals(); // hills change line of sight
}

// Group hill tiles into connected hills (4-neighbour) and export the full terrain
// grid plus normalized shape templates. Consumed by the Copy button.
function buildHillLayoutExport() {
  const steps = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const visited = new Set();
  const hills = [];

  hillTileKeys.forEach((startKey) => {
    if (visited.has(startKey)) {
      return;
    }

    const component = [];
    const stack = [startKey];
    visited.add(startKey);

    while (stack.length > 0) {
      const [r, c] = stack.pop().split(",").map(Number);
      component.push({ row: r, col: c });

      for (const [dr, dc] of steps) {
        const nKey = getGridPositionKey(r + dr, c + dc);
        if (hillTileKeys.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          stack.push(nKey);
        }
      }
    }

    const anchorRow = Math.min(...component.map((t) => t.row));
    const anchorCol = Math.min(...component.map((t) => t.col));
    const tiles = component
      .map(({ row, col }) => ({
        row,
        col,
        level: hillTileLevels.get(getGridPositionKey(row, col)) ?? HILL_HEIGHT_LEVELS,
      }))
      .sort((a, b) => a.row - b.row || a.col - b.col);

    hills.push({
      anchor: { row: anchorRow, col: anchorCol },
      tiles,
      shape: tiles.map((t) => [t.row - anchorRow, t.col - anchorCol, t.level]),
    });
  });

  hills.sort((a, b) => a.anchor.row - b.anchor.row || a.anchor.col - b.anchor.col);

  return {
    size: GRID_SIZE,
    entryCorner: currentEntryCorner,
    terrain: terrainTiles.map((row) => row.slice()),
    hills,
  };
}

// Round-trip: apply an exported layout's hills (tiles + levels) to the current
// arena and re-render. Lets an authored layout be reloaded to verify or seed a
// test. Terrain grid in the export is context only; ground under hills is dirt.
function loadHillLayout(layout) {
  hillTileKeys = new Set();
  hillTileLevels = new Map();

  (layout?.hills ?? []).forEach((hill) => {
    (hill.tiles ?? []).forEach(({ row, col, level }) => {
      if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) {
        return;
      }
      const key = getGridPositionKey(row, col);
      hillTileKeys.add(key);
      hillTileLevels.set(key, level ?? 1);
      if (terrainTiles[row]) {
        terrainTiles[row][col] = pickTerrainTile(TERRAIN_DIRT);
        repaintTileSprite(row, col);
      }
    });
  });

  renderArenaHill(arena?.querySelector(".tile-layer"));
  refreshConcealmentVisuals();
}

function placeUnit(unitLayer, unit) {
  const definition = getUnitDefinition(unit);
  const tilePosition = projectTile(unit.row, unit.col);
  const anchorX = tilePosition.x;
  const anchorY = tilePosition.y + TILE_HEIGHT / 2;

  unit.element.hidden = false;
  unit.element.className = `unit ${definition.className}`;
  unit.element.style.setProperty("--unit-frame-width", `${definition.frameWidth}px`);
  unit.element.style.setProperty("--unit-frame-height", `${definition.frameHeight}px`);
  unit.element.style.setProperty("--unit-foot-x", `${definition.footX}px`);
  unit.element.style.setProperty("--unit-foot-y", `${definition.footY}px`);
  unit.element.style.setProperty("--unit-nudge-x", `${definition.nudgeX}px`);
  unit.element.style.setProperty("--unit-nudge-y", `${definition.nudgeY}px`);
  unit.healthBar = createUnitHealthBar();
  unit.intentTags = createUnitIntentTags();
  unit.hiddenTag = createUnitHiddenTag();
  setUnitPosition(unit, anchorX, anchorY);
  updateUnitDepth(unit);
  unitLayer.append(unit.element, unit.healthBar, unit.intentTags, unit.hiddenTag);
  updateUnitHealthBar(unit);
  updateUnitConcealment(unit);
}

function createUnitHealthBar() {
  const bar = document.createElement("div");
  const fill = document.createElement("div");

  bar.className = "unit-health-bar";
  bar.hidden = true;
  bar.setAttribute("aria-hidden", "true");
  fill.className = "unit-health-bar-fill";

  bar.append(fill);
  return bar;
}

function positionUnitHealthBar(wolf) {
  if (!wolf.healthBar) {
    return;
  }

  wolf.healthBar.style.left = `${wolf.x}px`;
  wolf.healthBar.style.top = `${wolf.y}px`;
}

function createUnitHiddenTag() {
  const tag = document.createElement("div");

  tag.className = "unit-hidden-tag";
  tag.hidden = true;
  tag.setAttribute("aria-hidden", "true");
  tag.textContent = "Hidden";
  return tag;
}

function positionUnitHiddenTag(wolf) {
  if (!wolf.hiddenTag) {
    return;
  }

  wolf.hiddenTag.style.left = `${wolf.x}px`;
  wolf.hiddenTag.style.top = `${wolf.y}px`;
}

// Toggle a unit's concealment marking from its current isHidden flag: dim the
// sprite and show the "Hidden" tag. Defeated/inactive units never show it.
function updateUnitConcealment(unit) {
  const hidden = isUnitActive(unit) && isUnitAlive(unit) && isUnitHidden(unit);

  if (unit.element) {
    unit.element.classList.toggle("unit--hidden", hidden);
  }

  if (unit.hiddenTag) {
    unit.hiddenTag.hidden = !hidden;
  }
}

// Recompute concealment for all units and repaint their markings. Call after any
// position change (moves) or plan, since one unit moving can hide/reveal another.
function refreshConcealmentVisuals() {
  refreshHiddenStates();
  refreshTreeTransparency();
  units.forEach(updateUnitConcealment);
  units.filter((unit) => unit.team === "enemy").forEach((unit) => {
    renderUnitIntentTags(unit, enemyMode === "wolves"
      ? getEnemyPackActionsForUnit(unit)
      : getUnitActionQueue(unit));
  });
}

function createUnitIntentTags() {
  const tags = document.createElement("div");

  tags.className = "unit-intent-tags";
  tags.hidden = true;
  tags.setAttribute("aria-hidden", "true");
  return tags;
}

function positionUnitIntentTags(wolf) {
  if (!wolf.intentTags) {
    return;
  }

  wolf.intentTags.style.left = `${wolf.x}px`;
  wolf.intentTags.style.top = `${wolf.y}px`;
}

function renderUnitIntentTags(unit, actions = getUnitActionQueue(unit)) {
  if (!unit.intentTags) {
    return;
  }

  const concealIntent = unit.team === "enemy" && isUnitHidden(unit);
  const visibleActions = isUnitAlive(unit) && !concealIntent
    ? actions.slice(0, ACTION_QUEUE_SLOT_COUNT)
    : [];
  const tags = visibleActions.map((action, index) => {
    const tag = document.createElement("span");
    const label = document.createElement("span");

    tag.className = `unit-intent-tag intent-${action.toLowerCase()}`;
    tag.style.setProperty("--intent-index", index);
    label.className = "unit-intent-label";
    label.textContent = action;
    tag.append(createIcon(ACTION_ICONS[action], "unit-intent-icon"), label);
    return tag;
  });

  unit.intentTags.hidden = visibleActions.length === 0;
  unit.intentTags.replaceChildren(...tags);
}

function updateUnitHealthBarDepth(wolf) {
  if (!wolf.healthBar) {
    return;
  }

  wolf.healthBar.style.zIndex = Number(wolf.element.style.zIndex || 0) + 1;
}

function updateUnitIntentTagsDepth(wolf) {
  if (!wolf.intentTags) {
    return;
  }

  wolf.intentTags.style.zIndex = Number(wolf.element.style.zIndex || 0) + 2;
}

function updateUnitHiddenTagDepth(wolf) {
  if (!wolf.hiddenTag) {
    return;
  }

  wolf.hiddenTag.style.zIndex = Number(wolf.element.style.zIndex || 0) + 3;
}

function updateUnitHealthBar(wolf) {
  if (!wolf.healthBar) {
    return;
  }

  const healthRatio = Math.max(0, Math.min(1, wolf.health / wolf.maxHealth));
  const shouldShow = !wolf.isDefeated && (wolf.health < wolf.maxHealth || wolf.isSelected);

  wolf.healthBar.hidden = !shouldShow;
  wolf.healthBar.classList.toggle("is-health-high", healthRatio > 0.6);
  wolf.healthBar.classList.toggle("is-health-mid", healthRatio > 0.3 && healthRatio <= 0.6);
  wolf.healthBar.classList.toggle("is-health-low", healthRatio <= 0.3);
  wolf.healthBar
    .querySelector(".unit-health-bar-fill")
    .style.setProperty("--unit-health-fill-width", `${healthRatio * 100}%`);
}

function damageUnit(wolf, damageAmount) {
  if (wolf.isDefeated) {
    return { damaged: false, defeated: false, damageTaken: 0 };
  }

  const nextHealth = Math.max(0, wolf.health - damageAmount);
  const damageTaken = wolf.health - nextHealth;

  if (nextHealth === wolf.health) {
    return { damaged: false, defeated: false, damageTaken: 0 };
  }

  wolf.health = nextHealth;

  if (wolf.health === 0) {
    wolf.isDefeated = true;
    updateUnitDepth(wolf);
    updateUnitHealthBar(wolf);
    return { damaged: true, defeated: true, damageTaken };
  }

  updateUnitHealthBar(wolf);
  return { damaged: true, defeated: false, damageTaken };
}

function showUnitDamagePopup(wolf, damageAmount) {
  if (!wolf.element.parentElement || damageAmount <= 0) {
    return;
  }

  const popup = document.createElement("div");

  popup.className = "unit-damage-popup";
  popup.textContent = `-${damageAmount}`;
  popup.style.left = `${wolf.x}px`;
  popup.style.top = `${wolf.y}px`;
  popup.style.zIndex = Number(wolf.element.style.zIndex || 0) + 3;
  popup.setAttribute("aria-hidden", "true");
  popup.addEventListener("animationend", () => popup.remove(), { once: true });

  wolf.element.parentElement.append(popup);
}

function showUnitHealPopup(wolf, healAmount) {
  if (!wolf.element.parentElement || healAmount <= 0) {
    return;
  }

  const popup = document.createElement("div");

  popup.className = "unit-damage-popup unit-heal-popup";
  popup.textContent = `+${healAmount}`;
  popup.style.left = `${wolf.x}px`;
  popup.style.top = `${wolf.y}px`;
  popup.style.zIndex = Number(wolf.element.style.zIndex || 0) + 3;
  popup.setAttribute("aria-hidden", "true");
  popup.addEventListener("animationend", () => popup.remove(), { once: true });

  wolf.element.parentElement.append(popup);
}

function showUnitMissPopup(wolf) {
  if (!wolf.element.parentElement) {
    return;
  }

  const popup = document.createElement("div");

  popup.className = "unit-damage-popup unit-miss-popup";
  popup.textContent = "Miss";
  popup.style.left = `${wolf.x}px`;
  popup.style.top = `${wolf.y}px`;
  popup.style.zIndex = Number(wolf.element.style.zIndex || 0) + 3;
  popup.setAttribute("aria-hidden", "true");
  popup.addEventListener("animationend", () => popup.remove(), { once: true });

  wolf.element.parentElement.append(popup);
}

function getTileAnchor(row, col) {
  const tilePosition = projectTile(row, col);

  return {
    x: tilePosition.x,
    y: tilePosition.y + TILE_HEIGHT / 2,
  };
}

function setUnitPosition(unit, x, y) {
  unit.x = x;
  unit.y = y;
  unit.element.style.left = `${x}px`;
  unit.element.style.top = `${y}px`;
  positionUnitHealthBar(unit);
  positionUnitIntentTags(unit);
  positionUnitHiddenTag(unit);

  if (unit === getSelectedPlayerUnit()) {
    positionPlayerActionMenu();
  }
}

function updateUnitDepth(unit) {
  const liveUnitDepth = GRID_SIZE * 2 + unit.row + unit.col + 20;

  unit.element.style.zIndex = unit.isDefeated ? liveUnitDepth - 2 : liveUnitDepth;
  updateUnitHealthBarDepth(unit);
  updateUnitIntentTagsDepth(unit);
  updateUnitHiddenTagDepth(unit);

  if (unit === getSelectedPlayerUnit()) {
    positionPlayerActionMenu();
  }
}

function createPlayerMovePreview() {
  const preview = document.createElement("div");

  preview.className = "unit wolf move-preview";
  preview.style.setProperty("--unit-frame-width", `${WOLF_FRAME_SIZE}px`);
  preview.style.setProperty("--unit-frame-height", `${WOLF_FRAME_SIZE}px`);
  preview.style.setProperty("--unit-foot-x", "35px");
  preview.style.setProperty("--unit-foot-y", "40px");
  preview.style.setProperty("--unit-nudge-x", "4px");
  preview.style.setProperty("--unit-nudge-y", "-1px");
  preview.hidden = true;
  preview.setAttribute("aria-hidden", "true");
  return preview;
}

function getQueuedMoveActionCount(unit) {
  return getUnitActionQueue(unit).filter((action) => action === "Move").length;
}

function getTileElementAt(row, col) {
  return tileElements.find(
    (tile) => Number(tile.dataset.row) === row && Number(tile.dataset.col) === col,
  );
}

function setPlayerMovePreviewTile(tile) {
  if (playerMovePreviewTile === tile) {
    return;
  }

  if (playerMovePreviewTile) {
    playerMovePreviewTile.classList.remove("is-move-preview");
  }

  playerMovePreviewTile = tile;

  if (playerMovePreviewTile) {
    playerMovePreviewTile.classList.add("is-move-preview");
  }
}

function setMovePreviewFrame(direction, fallbackUnit = getSelectedPlayerUnit() ?? player) {
  const directionRow = WOLF_DIRECTIONS[direction] ?? WOLF_DIRECTIONS[fallbackUnit.direction];

  playerMovePreview.style.backgroundImage = `url("${getUnitAnimationSrc("wolf", "idle")}")`;
  playerMovePreview.style.backgroundPosition = `0 -${directionRow * WOLF_FRAME_SIZE}px`;
}

function updatePlayerMovePreview(unit = getSelectedPlayerUnit()) {
  if (!playerMovePreview) {
    return;
  }

  const selectedUnit = unit === getSelectedPlayerUnit() ? unit : getSelectedPlayerUnit();

  if (!selectedUnit || isExecutingActionQueue || getQueuedMoveActionCount(selectedUnit) === 0) {
    playerMovePreview.hidden = true;
    setPlayerMovePreviewTile(null);
    return;
  }

  const target = getPlayerMovePreviewTarget(selectedUnit);
  const anchor = getTileAnchor(target.row, target.col);

  playerMovePreview.hidden = false;
  playerMovePreview.style.left = `${anchor.x}px`;
  playerMovePreview.style.top = `${anchor.y}px`;
  playerMovePreview.style.zIndex = GRID_SIZE * 2 + target.row + target.col + 21;
  setPlayerMovePreviewTile(getTileElementAt(target.row, target.col));
  setMovePreviewFrame(target.direction ?? selectedUnit.direction, selectedUnit);
}

function getPlayerMovePreviewTarget(playerUnit = getSelectedPlayerUnit() ?? player) {
  const actionQueue = getUnitActionQueue(playerUnit);
  const previewStates = new Map(
    units.map((unit) => [
      unit,
      {
        row: unit.row,
        col: unit.col,
        direction: unit.direction,
      },
    ]),
  );
  let target = previewStates.get(playerUnit);
  let direction = playerUnit.direction;

  actionQueue.forEach((action, actionIndex) => {
    if (action !== "Move") {
      return;
    }

    const plan = getPlayerMovePlanFromSnapshot(playerUnit, getFriendlyFocusTarget(playerUnit), previewStates, {
      actionQueue: actionQueue.slice(actionIndex + 1),
    });

    target = plan.target;
    direction = target.direction ?? direction;
    previewStates.set(playerUnit, {
      row: target.row,
      col: target.col,
      direction,
    });
  });

  return { ...target, direction };
}

function resizeArena() {
  const viewportPadding = 0.86;
  const availableWidth = window.innerWidth * viewportPadding;
  const availableHeight = window.innerHeight * viewportPadding;
  const scale = Math.min(4, availableWidth / boardWidth, availableHeight / boardHeight);

  document.documentElement.style.setProperty("--arena-scale", scale.toFixed(3));
  document.documentElement.style.setProperty("--arena-scale-inverse", (1 / scale).toFixed(4));
}

function setUnitFrame(unit, frameIndex, direction = unit.direction) {
  const definition = getUnitDefinition(unit);

  unit.element.style.backgroundPosition = definition.getBackgroundPosition(frameIndex, direction);
}

function getDevPreviewUnit() {
  return enemyMode === "stag" ? enemy : getSelectedPlayerUnit() ?? player;
}

function updateAnimationControls(unit = getDevPreviewUnit()) {
  animationButtons.forEach((button) => {
    const animationName = button.dataset.animation;
    const isSupported = isUnitAnimationSupported(unit, animationName);

    button.disabled = !isSupported || isExecutingActionQueue;
    button.classList.toggle("is-active", isSupported && unit.animationName === animationName);
    button.setAttribute("aria-disabled", String(button.disabled));
  });
}

function updateActiveDirection(direction) {
  directionButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.direction === direction);
  });
}

function getArenaPoint(event) {
  const rect = arena.getBoundingClientRect();
  const scaleX = rect.width / boardWidth;
  const scaleY = rect.height / boardHeight;

  return {
    x: (event.clientX - rect.left) / scaleX,
    y: (event.clientY - rect.top) / scaleY,
  };
}

function isPointInsideTileArtwork(tile, point) {
  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);
  const tilePosition = projectTile(row, col);
  const localX = point.x - (tilePosition.x - TILE_WIDTH / 2);
  const localY = point.y - tilePosition.y;

  if (localX < 0 || localX > TILE_WIDTH || localY < TILE_OPAQUE_TOP || localY > TILE_HEIGHT) {
    return false;
  }

  let inset = 0;

  if (localY < TILE_OPAQUE_FULL_TOP) {
    inset = (TILE_OPAQUE_FULL_TOP - localY) * 2;
  } else if (localY > TILE_OPAQUE_FULL_BOTTOM) {
    inset = (localY - TILE_OPAQUE_FULL_BOTTOM) * 2;
  }

  return localX >= inset && localX <= TILE_WIDTH - inset;
}

function getTileAtPoint(point) {
  let matchingTile = null;
  let matchingDepth = -1;

  tileElements.forEach((tile) => {
    if (!isPointInsideTileArtwork(tile, point)) {
      return;
    }

    const depth = Number(tile.dataset.row) + Number(tile.dataset.col);

    if (depth >= matchingDepth) {
      matchingTile = tile;
      matchingDepth = depth;
    }
  });

  return matchingTile;
}

function getTileFromPointerEvent(event) {
  return getTileAtPoint(getArenaPoint(event));
}

function isPointerInsideUnit(unit, event) {
  const rect = unit.element.getBoundingClientRect();

  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function getFriendlyUnitFromPointerEvent(event) {
  const point = getArenaPoint(event);

  return getAliveUnitsByTeam("player")
    .filter((unit) => isPointerInsideUnit(unit, event))
    .sort((unit, otherUnit) => {
      return (
        Math.hypot(point.x - unit.x, point.y - unit.y) -
        Math.hypot(point.x - otherUnit.x, point.y - otherUnit.y)
      );
    })[0] ?? null;
}

function setHoveredTile(tile) {
  if (hoveredTile === tile) {
    return;
  }

  if (hoveredTile) {
    hoveredTile.classList.remove("is-hovered");
  }

  hoveredTile = tile;
  arena.classList.toggle("has-hovered-tile", Boolean(hoveredTile));

  if (hoveredTile) {
    hoveredTile.classList.add("is-hovered");
  }

  updateHoveredHillTop(tile);
}

// While drawing hills, highlight the top cube of the hovered hill so it's clear
// which stack a click will affect (the cube sits above its tile, hiding the
// tile's own hover tint).
function updateHoveredHillTop(tile) {
  if (hoveredHillBlock) {
    hoveredHillBlock.classList.remove("is-hovered");
    hoveredHillBlock = null;
  }

  if (!isHillEditMode || !tile) {
    return;
  }

  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);

  if (!isHillTile(row, col)) {
    return;
  }

  const top = arena
    ?.querySelector(".tile-layer")
    ?.querySelector(`.hill-block--top[data-row="${row}"][data-col="${col}"]`);

  if (top) {
    top.classList.add("is-hovered");
    hoveredHillBlock = top;
  }
}

function getDirectionFromDelta(deltaX, deltaY) {
  if (deltaY < 0) {
    return deltaX < 0 ? "topLeft" : "topRight";
  }

  return deltaX < 0 ? "bottomLeft" : "bottomRight";
}

function isAdjacentTile(rowA, colA, rowB, colB) {
  return ATTACK_TILE_DELTAS.some((delta) => {
    return rowA + delta.row === rowB && colA + delta.col === colB;
  });
}

function isUnitActive(unit) {
  return unit.isActive !== false;
}

function isUnitAlive(unit) {
  return isUnitActive(unit) && !unit.isDefeated && unit.health > 0;
}

function getAliveUnitsByTeam(team) {
  return units.filter((unit) => unit.team === team && isUnitAlive(unit));
}

function hasAliveUnitsByTeam(team) {
  return getAliveUnitsByTeam(team).length > 0;
}

function areOpposingUnits(unitA, unitB) {
  return unitA.team !== unitB.team;
}

function getUnitsAtPosition(row, col, { includeDefeated = false } = {}) {
  return units.filter((unit) => {
    return (
      isUnitActive(unit) &&
      unit.row === row &&
      unit.col === col &&
      (includeDefeated || isUnitAlive(unit))
    );
  });
}

function getBlockingUnitAtPosition(row, col) {
  return getUnitsAtPosition(row, col, { includeDefeated: true })[0] ?? null;
}

function isGridPosition(row, col) {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function getTileInDirection(row, col, direction, tileCount) {
  const delta = MOVEMENT_TILE_DELTAS[direction];
  let targetRow = row;
  let targetCol = col;

  if (!delta) {
    return { row: targetRow, col: targetCol };
  }

  for (let step = 0; step < tileCount; step += 1) {
    const nextRow = targetRow + delta.row;
    const nextCol = targetCol + delta.col;

    if (
      !isGridPosition(nextRow, nextCol) ||
      isBlockedTile(nextRow, nextCol) ||
      getBlockingUnitAtPosition(nextRow, nextCol)
    ) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
  }

  return { row: targetRow, col: targetCol };
}

function getTileInDirectionForPlan(row, col, direction, tileCount, planningUnit) {
  const delta = MOVEMENT_TILE_DELTAS[direction];
  let targetRow = row;
  let targetCol = col;

  if (!delta) {
    return { row: targetRow, col: targetCol };
  }

  for (let step = 0; step < tileCount; step += 1) {
    const nextRow = targetRow + delta.row;
    const nextCol = targetCol + delta.col;
    const blockingUnit = getBlockingUnitAtPosition(nextRow, nextCol);

    if (
      !isGridPosition(nextRow, nextCol) ||
      isBlockedTile(nextRow, nextCol) ||
      (blockingUnit && blockingUnit !== planningUnit)
    ) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
  }

  return { row: targetRow, col: targetCol };
}

function getFacingDirectionForMove(startRow, startCol, targetRow, targetCol, fallbackDirection) {
  const startAnchor = getTileAnchor(startRow, startCol);
  const targetAnchor = getTileAnchor(targetRow, targetCol);

  if (startRow === targetRow && startCol === targetCol) {
    return fallbackDirection;
  }

  return getDirectionFromDelta(targetAnchor.x - startAnchor.x, targetAnchor.y - startAnchor.y);
}

function getGridDistance(rowA, colA, rowB, colB) {
  return Math.abs(rowA - rowB) + Math.abs(colA - colB);
}

// Orthogonal steps for the walkable BFS. 4-neighbour is deliberate: on open
// ground the step-count equals Manhattan distance, so movement away from
// obstacles is identical to the old getGridDistance scoring — only tiles whose
// shortest walkable route bends around water get a higher number.
const WALKABLE_FIELD_DELTAS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

// Flood the walkable board from (targetRow, targetCol) and return a size×size
// grid of step-counts to the target. Walls are pond tiles and board edges ONLY
// — units are NOT walls (movement resolution handles unit collisions; treating
// units as distance-walls causes odd mutual avoidance). Unreached tiles stay
// Infinity. Used so the move scorer can route units around impassable terrain
// instead of stalling in a local Manhattan minimum.
function buildWalkableDistanceField(targetRow, targetCol, size = GRID_SIZE) {
  const field = Array.from({ length: size }, () => new Array(size).fill(Infinity));

  if (
    targetRow < 0 ||
    targetRow >= size ||
    targetCol < 0 ||
    targetCol >= size ||
    isBlockedTile(targetRow, targetCol)
  ) {
    return field;
  }

  field[targetRow][targetCol] = 0;
  let frontier = [{ row: targetRow, col: targetCol }];

  while (frontier.length > 0) {
    const nextFrontier = [];

    frontier.forEach(({ row, col }) => {
      const nextDistance = field[row][col] + 1;

      WALKABLE_FIELD_DELTAS.forEach((delta) => {
        const nextRow = row + delta.row;
        const nextCol = col + delta.col;

        if (
          nextRow < 0 ||
          nextRow >= size ||
          nextCol < 0 ||
          nextCol >= size ||
          isBlockedTile(nextRow, nextCol) ||
          field[nextRow][nextCol] <= nextDistance
        ) {
          return;
        }

        field[nextRow][nextCol] = nextDistance;
        nextFrontier.push({ row: nextRow, col: nextCol });
      });
    });

    frontier = nextFrontier;
  }

  return field;
}

// Safe lookup into a walkable distance field; off-field tiles read as Infinity.
function getFieldDistance(field, row, col) {
  return field?.[row]?.[col] ?? Infinity;
}

function getBestMoveDirectionToward(row, col, targetRow, targetCol, planningUnit) {
  const currentDistance = getGridDistance(row, col, targetRow, targetCol);
  let bestDirection = null;
  let bestTarget = { row, col };
  let bestDistance = currentDistance;

  MOVEMENT_DIRECTIONS.forEach((direction) => {
    const target = getTileInDirectionForPlan(
      row,
      col,
      direction,
      MOVE_ACTION_TILE_COUNT,
      planningUnit,
    );
    const didMove = target.row !== row || target.col !== col;

    if (!didMove) {
      return;
    }

    const distance = getGridDistance(target.row, target.col, targetRow, targetCol);

    if (distance < bestDistance) {
      bestDirection = getFacingDirectionForMove(row, col, target.row, target.col, planningUnit.direction);
      bestTarget = target;
      bestDistance = distance;
    }
  });

  return bestDirection ? { direction: bestDirection, target: bestTarget } : null;
}

function consumeDoctrineAction(doctrinePool, action) {
  const actionIndex = doctrinePool.indexOf(action);

  if (actionIndex === -1) {
    return false;
  }

  doctrinePool.splice(actionIndex, 1);
  return true;
}

function pushEnemyPlannedAction(actionQueue, doctrinePool, action) {
  if (!consumeDoctrineAction(doctrinePool, action)) {
    return false;
  }

  actionQueue.push(action);
  return true;
}

function clearEnemyPackActionQueue() {
  enemyPackActionQueue.length = 0;
  enemyPackFocusTarget = null;
}

function getEnemyPackActionsForUnit(unit) {
  return enemyPackActionQueue
    .filter((entry) => entry.unit === unit)
    .map((entry) => entry.action);
}

function renderEnemyPackIntentTags(enemyUnits = units.filter((unit) => unit.team === "enemy" && isUnitActive(unit))) {
  enemyUnits.forEach((unit) => {
    renderUnitIntentTags(unit, getEnemyPackActionsForUnit(unit));
  });
}

function planEnemyPackTurn(enemyUnits, playerUnits) {
  const aliveEnemies = enemyUnits.filter((unit) => isUnitAlive(unit) && unit.type === "wolf");
  const alivePlayers = playerUnits.filter(isUnitAlive);

  clearEnemyPackActionQueue();

  if (aliveEnemies.length === 0 || alivePlayers.length === 0) {
    renderEnemyPackIntentTags(enemyUnits);
    return enemyPackActionQueue;
  }

  // Concealment hides intentions, not locations: both packs can still pursue.
  refreshHiddenStates();
  const targetedPlayers = alivePlayers;
  enemyPackFocusTarget = getBestPackFocusTarget(aliveEnemies, targetedPlayers);

  const plannedStates = new Map(aliveEnemies.map((unit) => [
    unit,
    { row: unit.row, col: unit.col, direction: unit.direction },
  ]));

  assignEnemyPackObjectives(aliveEnemies, enemyPackFocusTarget, targetedPlayers, plannedStates);

  const reservedMoveTargets = new Set();
  const doctrinePool = [...ENEMY_AGGRESSIVE_DOCTRINE];

  while (enemyPackActionQueue.length < ENEMY_PLAN_ACTION_COUNT) {
    const assignment = getBestEnemyPackAction(
      aliveEnemies,
      enemyPackFocusTarget,
      plannedStates,
      reservedMoveTargets,
      enemyPackActionQueue,
      doctrinePool,
      targetedPlayers,
    );

    if (!assignment) {
      break;
    }

    consumeDoctrineAction(doctrinePool, assignment.action);
    enemyPackActionQueue.push({ unit: assignment.unit, action: assignment.action });

    if (assignment.action === "Move") {
      const previousState = plannedStates.get(assignment.unit);

      plannedStates.set(assignment.unit, {
        row: assignment.target.row,
        col: assignment.target.col,
        direction: assignment.facingDirection ?? previousState.direction,
      });
      reservedMoveTargets.add(getGridPositionKey(assignment.target.row, assignment.target.col));
    }
  }

  renderEnemyPackIntentTags(enemyUnits);
  return enemyPackActionQueue;
}

function getBestPackFocusTarget(enemyUnits, playerUnits) {
  return [...playerUnits].sort((target, otherTarget) => {
    return getPackFocusTargetScore(target, enemyUnits) - getPackFocusTargetScore(otherTarget, enemyUnits);
  })[0] ?? null;
}

function getPackFocusTargetScore(target, enemyUnits) {
  const distances = enemyUnits.map((unit) => getGridDistance(unit.row, unit.col, target.row, target.col));
  const nearestDistance = Math.min(...distances);
  const attackOpportunity = enemyUnits.some((unit) => {
    return isAdjacentTile(unit.row, unit.col, target.row, target.col);
  });

  return target.health * 5 + nearestDistance * 2 - (attackOpportunity ? 8 : 0);
}

function getNearestPlayerDistanceFrom(row, col, players) {
  return players.reduce((nearest, player) => {
    return Math.min(nearest, getGridDistance(row, col, player.row, player.col));
  }, Infinity);
}

// A wounded wolf peels off instead of charging — mirroring how the player kites a
// low-HP unit. Hysteresis (trigger vs safe range) lives in ENEMY_FLEE_* so it
// commits to the retreat; it still pounces when an equally-wounded player is in reach.
function shouldEnemyFlee(unit, players) {
  if (players.length === 0) {
    return false;
  }

  const canFinishAdjacentTarget = players.some((player) => {
    return isAdjacentTile(unit.row, unit.col, player.row, player.col) && player.health <= unit.health;
  });

  if (canFinishAdjacentTarget) {
    return false;
  }

  if (unit.health / unit.maxHealth > ENEMY_LOW_HEALTH_RATIO) {
    return false;
  }

  const nearestDistance = getNearestPlayerDistanceFrom(unit.row, unit.col, players);

  return unit.isFleeing
    ? nearestDistance < ENEMY_FLEE_SAFE_RANGE
    : nearestDistance <= ENEMY_FLEE_TRIGGER_RANGE;
}

// The tiles surrounding the focus target that a wolf could actually stand on —
// on the board and not already occupied by another player. These become the
// encirclement slots so the pack spreads around the target instead of stacking.
function getReachableSurroundDeltas(focusTarget, players) {
  return ATTACK_TILE_DELTAS.filter((delta) => {
    const row = focusTarget.row + delta.row;
    const col = focusTarget.col + delta.col;

    return (
      isGridPosition(row, col) &&
      !isBlockedTile(row, col) &&
      !players.some((player) => player.row === row && player.col === col)
    );
  });
}

// Decide each wolf's intent for the turn: flee if wounded and threatened, otherwise
// engage from a distinct surround slot. Closest wolves claim the nearest open slots
// so the pack encircles rather than funnelling onto one tile.
function assignEnemyPackObjectives(enemyUnits, focusTarget, players, plannedStates) {
  const engagingUnits = [];

  enemyUnits.forEach((unit) => {
    const fleeing = shouldEnemyFlee(unit, players);

    unit.isFleeing = fleeing;
    unit.packObjective = fleeing
      ? { mode: "flee" }
      : { mode: "engage", slotDelta: { row: 0, col: 0 } };

    if (!fleeing) {
      engagingUnits.push(unit);
    }
  });

  if (!focusTarget) {
    return;
  }

  const availableDeltas = getReachableSurroundDeltas(focusTarget, players);
  const usedSlotKeys = new Set();
  const orderedUnits = [...engagingUnits].sort((unit, otherUnit) => {
    const state = plannedStates.get(unit);
    const otherState = plannedStates.get(otherUnit);

    return (
      getGridDistance(state.row, state.col, focusTarget.row, focusTarget.col) -
      getGridDistance(otherState.row, otherState.col, focusTarget.row, focusTarget.col)
    );
  });

  orderedUnits.forEach((unit) => {
    const state = plannedStates.get(unit);
    let bestDelta = null;
    let bestDistance = Infinity;

    availableDeltas.forEach((delta) => {
      const slotKey = getGridPositionKey(delta.row, delta.col);

      if (usedSlotKeys.has(slotKey)) {
        return;
      }

      const distance = getGridDistance(
        state.row,
        state.col,
        focusTarget.row + delta.row,
        focusTarget.col + delta.col,
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestDelta = delta;
      }
    });

    if (bestDelta) {
      usedSlotKeys.add(getGridPositionKey(bestDelta.row, bestDelta.col));
      unit.packObjective = { mode: "engage", slotDelta: { row: bestDelta.row, col: bestDelta.col } };
    }
  });
}

// The board tile an engaging wolf is steering toward: its assigned surround slot,
// or the focus tile itself when it has no slot (off-board slot / no focus).
function getEnemyPackGoalPosition(unit, focusTarget) {
  if (!focusTarget) {
    return null;
  }

  const objective = unit.packObjective;

  if (!objective || objective.mode !== "engage" || !objective.slotDelta) {
    return { row: focusTarget.row, col: focusTarget.col };
  }

  const row = focusTarget.row + objective.slotDelta.row;
  const col = focusTarget.col + objective.slotDelta.col;

  return isGridPosition(row, col) && !isBlockedTile(row, col)
    ? { row, col }
    : { row: focusTarget.row, col: focusTarget.col };
}

function getBestEnemyPackAction(
  enemyUnits,
  focusTarget,
  plannedStates,
  reservedMoveTargets,
  plannedActions,
  doctrinePool,
  players,
) {
  const attackAssignments = doctrinePool.includes("Attack")
    ? enemyUnits
      .filter((unit) => unit.packObjective?.mode !== "flee")
      .map((unit) => {
        const plannedState = plannedStates.get(unit);

        if (!plannedState) {
          return null;
        }

        const adjacentTargets = players.filter((playerUnit) => {
          return isAdjacentTile(plannedState.row, plannedState.col, playerUnit.row, playerUnit.col);
        });

        if (adjacentTargets.length === 0) {
          return null;
        }

        const target = adjacentTargets.includes(focusTarget)
          ? focusTarget
          : adjacentTargets.sort((playerUnit, otherPlayerUnit) => {
            return (
              playerUnit.health - otherPlayerUnit.health ||
              getGridDistance(unit.row, unit.col, playerUnit.row, playerUnit.col) -
                getGridDistance(unit.row, unit.col, otherPlayerUnit.row, otherPlayerUnit.col)
            );
          })[0];

        return {
          action: "Attack",
          score: (target === focusTarget ? 0 : 4) +
            getGridDistance(unit.row, unit.col, target.row, target.col) +
            getPlannedActionCountForUnit(unit, plannedActions) * 5,
          unit,
        };
      })
      .filter(Boolean)
      .sort((assignment, otherAssignment) => assignment.score - otherAssignment.score)
    : [];

  if (attackAssignments.length > 0) {
    return attackAssignments[0];
  }

  if (doctrinePool.includes("Move")) {
    const moveAssignment = enemyUnits
      .map((unit) => getEnemyPackMoveAssignment(
        unit,
        focusTarget,
        plannedStates,
        reservedMoveTargets,
        plannedActions,
        players,
      ))
      .filter(Boolean)
      .sort((assignment, otherAssignment) => otherAssignment.score - assignment.score)[0] ?? null;

    if (moveAssignment) {
      return moveAssignment;
    }
  }

  if (doctrinePool.includes("Defend")) {
    return getEnemyPackDefendAssignment(enemyUnits, plannedActions);
  }

  return null;
}

function getPlannedActionCountForUnit(unit, plannedActions) {
  return plannedActions.filter((entry) => entry.unit === unit).length;
}

function getEnemyPackDefendAssignment(enemyUnits, plannedActions) {
  return enemyUnits
    .map((unit) => {
      return {
        action: "Defend",
        score: unit.health / unit.maxHealth + getPlannedActionCountForUnit(unit, plannedActions),
        unit,
      };
    })
    .sort((assignment, otherAssignment) => assignment.score - otherAssignment.score)[0] ?? null;
}

function getEnemyPackMoveAssignment(unit, focusTarget, plannedStates, reservedMoveTargets, plannedActions, players) {
  const plannedState = plannedStates.get(unit);

  if (!plannedState) {
    return null;
  }

  const isFleeing = unit.packObjective?.mode === "flee";
  const goal = isFleeing ? null : getEnemyPackGoalPosition(unit, focusTarget);

  if (!isFleeing && !goal) {
    return null;
  }

  // Engaging wolves close on their surround slot; fleeing wolves try to grow the
  // gap to the nearest player. Both are scored as "improvement" so the same greedy
  // queue filler handles either intent.
  const currentMetric = isFleeing
    ? getNearestPlayerDistanceFrom(plannedState.row, plannedState.col, players)
    : getGridDistance(plannedState.row, plannedState.col, goal.row, goal.col);
  let bestAssignment = null;

  MOVEMENT_DIRECTIONS.forEach((direction) => {
    const target = getTileInDirectionForPackPlan(
      plannedState.row,
      plannedState.col,
      direction,
      MOVE_ACTION_TILE_COUNT,
      unit,
      plannedStates,
    );
    const targetKey = getGridPositionKey(target.row, target.col);
    const didMove = target.row !== plannedState.row || target.col !== plannedState.col;

    if (!didMove || reservedMoveTargets.has(targetKey)) {
      return;
    }

    const goalDistance = isFleeing
      ? 0
      : getGridDistance(target.row, target.col, goal.row, goal.col);
    const improvement = isFleeing
      ? getNearestPlayerDistanceFrom(target.row, target.col, players) - currentMetric
      : currentMetric - goalDistance;

    if (improvement <= 0) {
      return;
    }

    const facingDirection = getFacingDirectionForMove(
      plannedState.row,
      plannedState.col,
      target.row,
      target.col,
      plannedState.direction,
    );
    const score = improvement * 10 -
      goalDistance -
      getDirectionTurnCost(plannedState.direction, facingDirection) -
      getPlannedActionCountForUnit(unit, plannedActions) * 5;

    if (!bestAssignment || score > bestAssignment.score) {
      bestAssignment = { action: "Move", direction, facingDirection, score, target, unit };
    }
  });

  return bestAssignment;
}

function getTileInDirectionForPackPlan(row, col, direction, tileCount, planningUnit, plannedStates) {
  const delta = MOVEMENT_TILE_DELTAS[direction];
  let targetRow = row;
  let targetCol = col;

  if (!delta) {
    return { row: targetRow, col: targetCol };
  }

  for (let step = 0; step < tileCount; step += 1) {
    const nextRow = targetRow + delta.row;
    const nextCol = targetCol + delta.col;
    const blockingUnit = getPackPlanBlockingUnitAtPosition(nextRow, nextCol, planningUnit, plannedStates);

    if (!isGridPosition(nextRow, nextCol) || isBlockedTile(nextRow, nextCol) || blockingUnit) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
  }

  return { row: targetRow, col: targetCol };
}

function getPackPlanBlockingUnitAtPosition(row, col, planningUnit, plannedStates) {
  return units.find((unit) => {
    if (!isUnitActive(unit)) {
      return false;
    }

    const plannedState = plannedStates.get(unit);

    if (plannedState) {
      return unit !== planningUnit && plannedState.row === row && plannedState.col === col;
    }

    return unit !== planningUnit && isUnitAlive(unit) && unit.row === row && unit.col === col;
  }) ?? null;
}

function planEnemyTurn(enemyUnit, targetUnit) {
  const actionQueue = getUnitActionQueue(enemyUnit);

  actionQueue.length = 0;

  if (!isUnitAlive(enemyUnit) || !isUnitAlive(targetUnit)) {
    renderUnitIntentTags(enemyUnit);
    return actionQueue;
  }

  const isLowHealth = enemyUnit.health / enemyUnit.maxHealth <= ENEMY_LOW_HEALTH_RATIO;
  const doctrinePool = [...ENEMY_AGGRESSIVE_DOCTRINE];
  let plannedRow = enemyUnit.row;
  let plannedCol = enemyUnit.col;
  let hasDefended = false;

  while (actionQueue.length < ENEMY_PLAN_ACTION_COUNT) {
    if (isAdjacentTile(plannedRow, plannedCol, targetUnit.row, targetUnit.col)) {
      if (isLowHealth && !hasDefended) {
        if (pushEnemyPlannedAction(actionQueue, doctrinePool, "Defend")) {
          hasDefended = true;
          continue;
        }
      }

      if (pushEnemyPlannedAction(actionQueue, doctrinePool, "Attack")) {
        continue;
      }

      if (pushEnemyPlannedAction(actionQueue, doctrinePool, "Defend")) {
        hasDefended = true;
      }

      break;
    }

    const movePlan = getBestMoveDirectionToward(
      plannedRow,
      plannedCol,
      targetUnit.row,
      targetUnit.col,
      enemyUnit,
    );

    if (!movePlan) {
      pushEnemyPlannedAction(actionQueue, doctrinePool, "Defend");
      break;
    }

    const isFirstPlannedAction = actionQueue.length === 0;

    if (!pushEnemyPlannedAction(actionQueue, doctrinePool, "Move")) {
      pushEnemyPlannedAction(actionQueue, doctrinePool, "Defend");
      break;
    }

    if (isFirstPlannedAction) {
      enemyUnit.direction = movePlan.direction;
      playUnitAnimation(enemyUnit, enemyUnit.animationName);
    }

    plannedRow = movePlan.target.row;
    plannedCol = movePlan.target.col;
  }

  renderUnitIntentTags(enemyUnit);
  return actionQueue;
}

function getAttackDirection(attacker, target) {
  const attackerAnchor = getTileAnchor(attacker.row, attacker.col);
  const targetAnchor = getTileAnchor(target.row, target.col);

  return getDirectionFromDelta(targetAnchor.x - attackerAnchor.x, targetAnchor.y - attackerAnchor.y);
}

function getAdjacentAttackTargets(attacker) {
  return units.filter((unit) => {
    return (
      unit !== attacker &&
      isUnitAlive(unit) &&
      areOpposingUnits(attacker, unit) &&
      isAdjacentTile(attacker.row, attacker.col, unit.row, unit.col)
    );
  });
}

function getAttackTarget(attacker) {
  const adjacentTargets = getAdjacentAttackTargets(attacker);

  if (adjacentTargets.length <= 1) {
    return adjacentTargets[0] ?? null;
  }

  const facingDelta = DIRECTION_TILE_DELTAS[attacker.direction];

  if (!facingDelta) {
    return adjacentTargets[0];
  }

  return adjacentTargets.find((target) => {
    return attacker.row + facingDelta.row === target.row && attacker.col + facingDelta.col === target.col;
  }) ?? adjacentTargets[0];
}

function resolveAttack(attacker) {
  const target = getAttackTarget(attacker);

  if (!target) {
    return { target: null, damaged: false, defeated: false };
  }

  const damageResult = damageUnit(target, UNIT_ATTACK_DAMAGE);

  if (damageResult.defeated) {
    void playUnitDeath(target);
  } else if (damageResult.damaged) {
    void playUnitHitReaction(target);
  }

  return { target, ...damageResult };
}

function getUnitAnimationPreload(unit, animationName, direction = unit.direction) {
  const definition = getUnitDefinition(unit);
  const preloadDirection = definition.getPreloadDirections()[0] === null ? null : direction;

  return unitAnimationPreloads.get(getUnitAnimationPreloadKey(unit.type, animationName, preloadDirection));
}

function setUnitAnimationSprite(unit, animationName, direction = unit.direction) {
  const preload = getUnitAnimationPreload(unit, animationName, direction);
  const src = preload?.image.currentSrc || preload?.image.src || getUnitAnimationSrc(unit, animationName, direction);

  unit.element.style.backgroundImage = `url("${src}")`;
}

function waitForUnitAnimation(unit, animationName, direction = unit.direction) {
  return getUnitAnimationPreload(unit, animationName, direction)?.ready ?? Promise.resolve();
}

function stopUnitAnimation(unit) {
  if (unit.animationFrameRequest !== null) {
    cancelAnimationFrame(unit.animationFrameRequest);
    unit.animationFrameRequest = null;
  }

  if (unit.animationComplete) {
    unit.animationComplete();
    unit.animationComplete = null;
  }
}

function playUnitAnimation(unit, animationName, shouldUpdateButtons = false) {
  const animation = getUnitAnimation(unit, animationName);

  if (!animation) {
    updateAnimationControls();
    return;
  }

  if (unit.isDefeated && animationName !== "death") {
    return;
  }

  stopUnitAnimation(unit);

  unit.animationName = animationName;
  unit.animationStartedAt = performance.now();
  const startFrame = getUnitAnimationStartFrame(unit, animationName, animation);
  setUnitAnimationSprite(unit, animationName);
  setUnitFrame(unit, getUnitAnimationFrameIndex(animation, startFrame));

  if (shouldUpdateButtons) {
    updateAnimationControls(unit);
  }

  const animate = (timestamp) => {
    const elapsed = timestamp - unit.animationStartedAt;
    const absoluteFrame = Math.floor(elapsed / animation.frameMs);
    const sequenceIndex = (absoluteFrame + startFrame) % getUnitAnimationFrameCount(animation);
    const frameIndex = getUnitAnimationFrameIndex(animation, sequenceIndex);

    setUnitAnimationSprite(unit, animationName);
    setUnitFrame(unit, frameIndex);
    unit.animationFrameRequest = requestAnimationFrame(animate);
  };

  unit.animationFrameRequest = requestAnimationFrame(animate);
}

async function playUnitAnimationCycles(
  unit,
  animationName,
  cycleCount = 1,
  { shouldUpdateButtons = false, direction = unit.direction } = {},
) {
  const animation = getUnitAnimation(unit, animationName);

  if (!animation) {
    return Promise.resolve();
  }

  stopUnitAnimation(unit);
  await waitForUnitAnimation(unit, animationName, direction);

  const totalFrames = getUnitAnimationFrameCount(animation) * cycleCount;

  unit.animationName = animationName;
  unit.animationStartedAt = performance.now();
  setUnitAnimationSprite(unit, animationName, direction);
  setUnitFrame(unit, 0, direction);

  if (shouldUpdateButtons) {
    updateAnimationControls(unit);
  }

  return new Promise((resolve) => {
    const finish = () => {
      unit.animationComplete = null;
      unit.animationFrameRequest = null;
      resolve();
    };

    unit.animationComplete = finish;

    const animate = (timestamp) => {
      const elapsed = timestamp - unit.animationStartedAt;
      const absoluteFrame = Math.floor(elapsed / animation.frameMs);

      if (absoluteFrame >= totalFrames) {
        finish();
        return;
      }

      const sequenceIndex = absoluteFrame % getUnitAnimationFrameCount(animation);
      const frameIndex = getUnitAnimationFrameIndex(animation, sequenceIndex);

      setUnitFrame(unit, frameIndex, direction);
      unit.animationFrameRequest = requestAnimationFrame(animate);
    };

    unit.animationFrameRequest = requestAnimationFrame(animate);
  });
}

async function playUnitHitReaction(unit) {
  if (unit.isDefeated) {
    return;
  }

  unit.element.classList.remove("is-hit");
  // Restart the CSS flash if a unit is hit again before the previous blink fully settles.
  void unit.element.offsetWidth;
  unit.element.classList.add("is-hit");

  await wait(UNIT_HIT_REACTION_MS);

  unit.element.classList.remove("is-hit");
}

async function playUnitDeath(unit) {
  if (unit.deathAnimationPromise) {
    return unit.deathAnimationPromise;
  }

  unit.deathAnimationPromise = (async () => {
    unit.element.classList.remove("is-hit");

    if (unit.movementFrameRequest !== null) {
      cancelAnimationFrame(unit.movementFrameRequest);
      unit.movementFrameRequest = null;
    }

    if (!isUnitAnimationSupported(unit, "death")) {
      stopUnitAnimation(unit);
      unit.element.hidden = true;
      unit.animationName = "idle";
      unit.hasPlayedDeathAnimation = true;
      return;
    }

    await playUnitAnimationCycles(unit, "death", 1, {
      direction: unit.direction,
    });

    setUnitAnimationSprite(unit, "death");
    setUnitFrame(unit, getUnitAnimation(unit, "death").frames - 1);
    unit.animationName = "death";
    unit.hasPlayedDeathAnimation = true;
  })();

  return unit.deathAnimationPromise;
}

function showGameResult(didWin) {
  if (!gameResultOverlay) return;
  const message = gameResultOverlay.querySelector(".game-result-message");
  message.textContent = didWin ? "You Win!" : "You Lose";
  message.classList.toggle("is-win", didWin);
  message.classList.toggle("is-lose", !didWin);
  gameResultOverlay.hidden = false;
}

// Single seam every battle-resolution path funnels through (tick loop, dev-test
// loop, and the dev End-fight buttons). A win clears the current cell and opens
// the world map to expand; a loss shows the result overlay, whose "Play Again"
// re-fights the same arena (retry-on-loss).
function concludeBattle(didWin) {
  if (didWin) {
    clearCurrentWorldCell(worldState);
    openWorldMap();
  } else {
    showGameResult(false);
  }
}

// Dev lever: force the current battle to resolve now, without playing it out.
function devEndFight(didWin) {
  if (isExecutingActionQueue) {
    return;
  }

  concludeBattle(didWin);
}

function resetGame() {
  if (gameResultOverlay) gameResultOverlay.hidden = true;
  reshuffleChargesRemaining = RESHUFFLE_CHARGES_PER_BATTLE;
  resetDevTest();
  refillAvailableActions();
  updateEnemyIntentPreview();
  updateReshuffleControl();
}

function applyTurnEndRecovery() {
  [...getAliveUnitsByTeam("player"), ...getAliveUnitsByTeam("enemy")].forEach((unit) => {
    if (unit.tookDamageThisTurn) {
      unit.turnsSinceHit = 0;
      unit.tookDamageThisTurn = false;
      return;
    }

    unit.turnsSinceHit += 1;

    if (unit.turnsSinceHit >= UNIT_RECOVERY_SAFE_TURNS && unit.health < unit.maxHealth) {
      const previousHealth = unit.health;

      unit.health = Math.min(unit.maxHealth, unit.health + UNIT_RECOVERY_HEAL_AMOUNT);
      unit.turnsSinceHit = 0;
      updateUnitHealthBar(unit);
      showUnitHealPopup(unit, unit.health - previousHealth);
    }
  });
}

function getBattleDebugUnitId(unit) {
  if (unit === player) return "P1";
  if (unit === playerSupport) return "P2";
  if (unit === playerFlank) return "P3";
  if (unit === enemy) return "E1";
  if (unit === enemySupport) return "E2";
  if (unit === enemyFlank) return "E3";
  return unit.team === "player" ? "P?" : "E?";
}

function getBattleDebugUnitLabel(unit) {
  if (unit === player) return `lead ${unit.type}`;
  if (unit === playerSupport) return `support ${unit.type}`;
  if (unit === playerFlank) return `flank ${unit.type}`;
  if (unit === enemy) return `enemy ${unit.type}`;
  if (unit === enemySupport) return `enemy support ${unit.type}`;
  if (unit === enemyFlank) return `enemy flank ${unit.type}`;
  return `${unit.team} ${unit.type}`;
}

function getBattleDebugUnitName(unit) {
  return `${getBattleDebugUnitId(unit)} ${getBattleDebugUnitLabel(unit)}`;
}

function formatBattleDebugPosition(position) {
  return `${position.row},${position.col}`;
}

function getBattleDebugQueue(unit) {
  if (unit.team === "enemy") {
    return enemyPackActionQueue
      .filter((entry) => entry.unit === unit)
      .map((entry) => entry.action);
  }

  return [...getUnitActionQueue(unit)];
}

function getBattleDebugUnitSnapshot(unit) {
  return {
    id: getBattleDebugUnitId(unit),
    label: getBattleDebugUnitLabel(unit),
    row: unit.row,
    col: unit.col,
    direction: unit.direction,
    health: unit.health,
    maxHealth: unit.maxHealth,
    movementMode: unit.team === "player" ? unit.movementMode : "",
    isDefeated: unit.isDefeated,
    isHidden: isUnitHidden(unit),
    queue: getBattleDebugQueue(unit),
  };
}

function getBattleDebugUnitSnapshots() {
  return units
    .filter(isUnitActive)
    .map(getBattleDebugUnitSnapshot);
}

function formatBattleDebugUnitLine(snapshot, { includeQueue = false } = {}) {
  const defeated = snapshot.isDefeated ? " defeated" : "";
  const hidden = snapshot.isHidden ? " hidden" : "";
  const movementMode = snapshot.movementMode ? ` mode ${snapshot.movementMode}` : "";
  const queue = includeQueue ? ` queue: ${snapshot.queue.length ? snapshot.queue.join(", ") : "-"}` : "";

  return `${snapshot.id} ${snapshot.label} hp ${snapshot.health}/${snapshot.maxHealth}${defeated}${hidden} at ${formatBattleDebugPosition(snapshot)} facing ${snapshot.direction}${movementMode}${queue}`;
}

function beginBattleDebugLog() {
  refreshHiddenStates();
  activeBattleDebugLog = {
    enemyMode,
    gridSize: GRID_SIZE,
    terrain: { hills: [...hillTileKeys], water: [...pondTileKeys], trees: [...treeTileKeys] },
    before: getBattleDebugUnitSnapshots(),
    ticks: [],
    after: [],
  };
}

function recordBattleDebugTick(tickActions, startStates, moveTargets, damageResult) {
  if (!activeBattleDebugLog) {
    return;
  }

  const lines = tickActions.map(({ unit, action }) => {
    const start = startStates.get(unit);
    const end = { row: unit.row, col: unit.col };
    const movement = `${formatBattleDebugPosition(start)} -> ${formatBattleDebugPosition(end)}`;

    if (action === "Move") {
      const debug = moveTargets.get(unit)?.debug;
      return `${getBattleDebugUnitName(unit)} Move ${movement}${debug ? ` [${debug}]` : ""}`;
    }

    if (action === "Attack") {
      const hits = damageResult.hits.filter((hit) => hit.attacker === unit);
      const missed = damageResult.misses.includes(unit);

      if (hits.length > 0) {
        return hits
          .map((hit) => `${getBattleDebugUnitName(unit)} Attack ${movement} hit ${getBattleDebugUnitName(hit.target)} for ${hit.damage}`)
          .join("; ");
      }

      return `${getBattleDebugUnitName(unit)} Attack ${movement}${missed ? " missed" : " no target"}`;
    }

    return `${getBattleDebugUnitName(unit)} ${action} ${movement}`;
  });

  activeBattleDebugLog.ticks.push(lines);
}

function formatBattleDebugReport(log) {
  const lines = [
    "Battle note:",
    "",
    "Comment:",
    "",
    `Mode: ${log.enemyMode} | Grid: ${log.gridSize}x${log.gridSize}`,
    ...(log.terrain ? [
      `Hills: ${log.terrain.hills.join("; ") || "-"}`,
      `Water: ${log.terrain.water.join("; ") || "-"}`,
    ] : []),
    "",
    "Before:",
    ...log.before.map((snapshot) => formatBattleDebugUnitLine(snapshot, { includeQueue: true })),
    "",
    "Actions played:",
  ];

  if (log.ticks.length === 0) {
    lines.push("- No actions recorded.");
  } else {
    log.ticks.forEach((tickLines, index) => {
      lines.push(`Tick ${index + 1}: ${tickLines.join(" | ")}`);
    });
  }

  lines.push(
    "",
    "After:",
    ...log.after.map((snapshot) => formatBattleDebugUnitLine(snapshot)),
  );

  return lines.join("\n");
}

function updateBattleDebugControls(message = "") {
  if (copyBattleDebugButton) {
    copyBattleDebugButton.disabled = !lastBattleDebugReport;
  }

  if (battleDebugStatus) {
    battleDebugStatus.textContent = message || (lastBattleDebugReport ? "Last turn ready to copy." : "Play a turn to capture a note.");
  }
}

function finishBattleDebugLog() {
  if (!activeBattleDebugLog) {
    updateBattleDebugControls();
    return;
  }

  activeBattleDebugLog.after = getBattleDebugUnitSnapshots();
  lastBattleDebugReport = formatBattleDebugReport(activeBattleDebugLog);
  window.lastBattleDebugReport = lastBattleDebugReport;
  activeBattleDebugLog = null;
  updateBattleDebugControls("Last turn ready to copy.");
}

function copyTextWithSelectionFallback(text) {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function copyLastBattleDebugReport() {
  if (!lastBattleDebugReport) {
    updateBattleDebugControls("Play a turn first.");
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(lastBattleDebugReport);
    } else if (!copyTextWithSelectionFallback(lastBattleDebugReport)) {
      throw new Error("Clipboard copy failed");
    }

    updateBattleDebugControls("Copied last turn.");
  } catch (error) {
    if (copyTextWithSelectionFallback(lastBattleDebugReport)) {
      updateBattleDebugControls("Copied last turn.");
      return;
    }

    updateBattleDebugControls("Copy failed. Report is available as window.lastBattleDebugReport.");
  }
}

async function executePlayerActionQueue() {
  if (isExecutingActionQueue || !hasQueuedPlayerActions() || hasMovingPlayerUnits()) {
    updateActionQueueControls();
    return;
  }

  if (enemyMode === "wolves") {
    planEnemyPackTurn(
      units.filter((unit) => unit.team === "enemy" && unit.type === "wolf"),
      units.filter((unit) => unit.team === "player"),
    );
  } else {
    clearEnemyPackActionQueue();
    renderEnemyPackIntentTags();
  }
  beginBattleDebugLog();
  isExecutingActionQueue = true;
  setPlayerSelected(null);
  updatePlayerActionControls();

  try {
    const combatants = [
      ...getAliveUnitsByTeam("player").map((unit) => ({
        renderQueue: () => renderActionQueue(unit),
        shouldUpdateButtons: true,
        unit,
      })),
      ...getAliveUnitsByTeam("enemy").map((unit) => ({
        isEnemyPackCombatant: true,
        renderQueue: () => renderEnemyPackIntentTags(),
        unit,
      })),
    ];

    while (
      combatants.some((combatant) => hasCombatantQueuedActions(combatant)) &&
      hasAliveUnitsByTeam("player") &&
      hasAliveUnitsByTeam("enemy")
    ) {
      await executeActionTick(combatants);
    }
  } finally {
    isExecutingActionQueue = false;
    applyTurnEndRecovery();
    finishBattleDebugLog();
    refillAvailableActions();
    renderActionQueue(getSelectedPlayerUnit());
    updateEnemyIntentPreview();
    updatePlayerActionControls();
    syncEnemyModeControls();
    getAliveUnitsByTeam("player").forEach((unit) => {
      playUnitAnimation(unit, "idle", unit === player);
    });
    getAliveUnitsByTeam("enemy").forEach((unit) => {
      playUnitAnimation(unit, "idle");
    });

    if (!hasAliveUnitsByTeam("player")) {
      concludeBattle(false);
    } else if (!hasAliveUnitsByTeam("enemy")) {
      concludeBattle(true);
    }
  }
}

async function executeActionTick(combatants) {
  const startStates = new Map(
    units.map((unit) => [
      unit,
      {
        row: unit.row,
        col: unit.col,
        direction: unit.direction,
      },
    ]),
  );
  const tickActions = combatants
    .map(({ unit, renderQueue, shouldUpdateButtons = false, isEnemyPackCombatant = false }) => {
      if (!isUnitAlive(unit)) {
        return null;
      }

      const action = shiftCombatantAction({
        isEnemyPackCombatant,
        renderQueue,
        shouldUpdateButtons,
        unit,
      });

      if (!action) {
        return null;
      }

      return { unit, action, renderQueue, shouldUpdateButtons };
    })
    .filter(Boolean);

  if (tickActions.length === 0) {
    return;
  }

  const moveTargets = getTickMoveTargets(tickActions, startStates);
  const damageIntents = [];
  const moveActions = tickActions.filter(({ action }) => action === "Move");
  const nonMoveActions = tickActions.filter(({ action }) => action !== "Move");

  await Promise.all(moveActions.map(({ unit, shouldUpdateButtons }) => {
    const target = moveTargets.get(unit) ?? startStates.get(unit);

    return moveUnitToTile(unit, target.row, target.col, {
      direction: target.direction ?? startStates.get(unit).direction,
      skipBlockingCheck: true,
      shouldUpdateButtons,
    });
  }));

  await Promise.all(nonMoveActions.map(async (tickAction) => {
    const { unit, action, shouldUpdateButtons } = tickAction;
    const actionAnimation = ACTION_ANIMATIONS[action];

    if (!actionAnimation) {
      return;
    }

    let actionDirection = startStates.get(unit).direction;
    let attackTarget = null;

    if (action === "Attack") {
      attackTarget = getAttackIntentTarget(unit, startStates);
      actionDirection = attackTarget
        ? getAttackDirectionFromSnapshot(unit, attackTarget, startStates)
        : actionDirection;

      if (actionDirection) {
        unit.direction = actionDirection;

        if (unit === getSelectedPlayerUnit()) {
          updateActiveDirection(unit.direction);
        }
      }
    }

    if (action === "Defend") {
      shakeArenaSoon();
    }

    await playUnitAnimationCycles(unit, actionAnimation.animationName, actionAnimation.cycles, {
      shouldUpdateButtons,
      direction: actionDirection,
    });

    if (action === "Attack") {
      playUnitAnimation(unit, "idle", shouldUpdateButtons);
      const liveTarget = getLiveAttackTarget(unit, attackTarget, startStates);
      const targetIsDefending = tickActions.some((t) => t.unit === liveTarget && t.action === "Defend");
      damageIntents.push({
        attacker: unit,
        target: liveTarget,
        damage: targetIsDefending ? UNIT_DEFENDED_DAMAGE : UNIT_ATTACK_DAMAGE,
      });
    }
  }));

  const damageResult = await resolveTickDamage(damageIntents);
  recordBattleDebugTick(tickActions, startStates, moveTargets, damageResult);

  if (enemyMode === "wolves" && damageResult.defeated.some((unit) => unit.team === "enemy")) {
    planEnemyPackTurn(
      units.filter((unit) => unit.team === "enemy" && unit.type === "wolf"),
      units.filter((unit) => unit.team === "player"),
    );
  }

  tickActions.forEach(({ renderQueue }) => {
    renderQueue?.();
  });
}

function hasCombatantQueuedActions(combatant) {
  if (!isUnitAlive(combatant.unit)) {
    return false;
  }

  if (combatant.isEnemyPackCombatant) {
    return enemyPackActionQueue.some((entry) => entry.unit === combatant.unit);
  }

  return getUnitActionQueue(combatant.unit).length > 0;
}

function shiftCombatantAction(combatant) {
  if (combatant.isEnemyPackCombatant) {
    const entryIndex = enemyPackActionQueue.findIndex((entry) => entry.unit === combatant.unit);

    if (entryIndex === -1) {
      return null;
    }

    const [entry] = enemyPackActionQueue.splice(entryIndex, 1);

    return entry.action;
  }

  return getUnitActionQueue(combatant.unit).shift() ?? null;
}

function getTickMoveTargets(tickActions, startStates) {
  const movingUnits = new Set(
    tickActions
      .filter(({ action }) => action === "Move")
      .map(({ unit }) => unit),
  );
  const movePlans = tickActions
    .filter(({ action }) => action === "Move")
    .map(({ unit }) => {
      const startState = startStates.get(unit);
      const hasAttackIntent = hasQueuedAttackIntentAfterCurrentMove(unit);
      const attackTarget = hasAttackIntent
        ? getOpposingUnit(unit)
        : null;
      const isAttackIntent = Boolean(attackTarget);
      let plan = null;

      if (unit.team === "player") {
        plan = getPlayerMovePlanFromSnapshot(unit, getFriendlyFocusTarget(unit), startStates, {
          ignoredBlockingUnits: movingUnits,
        });
      } else if (unit.team === "enemy") {
        plan = getEnemyPackMovePlanFromSnapshot(unit, startStates, {
          ignoredBlockingUnits: movingUnits,
        });
      } else {
        const path = getMovePathFromSnapshot(
          startState.row,
          startState.col,
          startState.direction,
          MOVE_ACTION_TILE_COUNT,
          unit,
          startStates,
          { ignoredBlockingUnits: movingUnits },
        );
        const target = path[path.length - 1] ?? { row: startState.row, col: startState.col };

        plan = { unit, path, target };
      }

      return { ...plan, attackTarget, isAttackIntent };
    });

  movePlans.forEach((plan) => {
    const opposingAttackIntentPlan = movePlans.find((otherPlan) => {
      return (
        otherPlan !== plan &&
        plan.isAttackIntent &&
        otherPlan.isAttackIntent &&
        areOpposingUnits(plan.unit, otherPlan.unit)
      );
    });

    if (plan.isAttackIntent && !opposingAttackIntentPlan) {
      capMovePlanAtAttackRange(plan, startStates.get(plan.attackTarget));
    }
  });

  applyAttackIntentEngagementStops(movePlans, startStates);
  return resolveMovePlans(movePlans, startStates);
}

function resolveMovePlans(movePlans, startStates) {
  const liveUnits = units.filter((unit) => isUnitAlive(unit) && startStates.has(unit));
  const positions = new Map(liveUnits.map((unit) => {
    const startState = startStates.get(unit);

    return [unit, { row: startState.row, col: startState.col }];
  }));
  const activeUnits = new Set(
    movePlans
      .filter((plan) => plan.path.length > 1)
      .map((plan) => plan.unit),
  );
  const maxStep = Math.max(1, ...movePlans.map((plan) => plan.path.length));

  for (let step = 1; step < maxStep; step += 1) {
    const attempts = getMoveStepAttempts(movePlans, positions, activeUnits, step);

    if (attempts.length === 0) {
      continue;
    }

    const blockedUnits = getBlockedMoveStepUnits(attempts, positions, liveUnits);

    attempts.forEach((attempt) => {
      if (blockedUnits.has(attempt.unit)) {
        activeUnits.delete(attempt.unit);
        return;
      }

      positions.set(attempt.unit, { row: attempt.to.row, col: attempt.to.col });
    });
  }

  return new Map(movePlans.map((plan) => {
    const startState = startStates.get(plan.unit);
    const resolvedPosition = positions.get(plan.unit) ?? startState;
    const didMove = !areSameGridPosition(resolvedPosition, startState);
    const direction = didMove
      ? getFacingDirectionForMove(
        startState.row,
        startState.col,
        resolvedPosition.row,
        resolvedPosition.col,
        startState.direction,
      )
      : startState.direction;

    plan.target = {
      row: resolvedPosition.row,
      col: resolvedPosition.col,
      direction,
      ...(plan.debug ? {
        debug: `${plan.debug}${!areSameGridPosition(resolvedPosition, plan.target) ? "; movement shortened by engagement or collision" : ""}`,
      } : {}),
    };
    plan.path = getResolvedMovePath(plan.path, resolvedPosition);

    return [plan.unit, plan.target];
  }));
}

function getMoveStepAttempts(movePlans, positions, activeUnits, step) {
  return movePlans
    .filter((plan) => activeUnits.has(plan.unit))
    .map((plan) => {
      const from = positions.get(plan.unit);
      const to = plan.path[step];

      if (!from || !to || areSameGridPosition(from, to)) {
        activeUnits.delete(plan.unit);
        return null;
      }

      return {
        from,
        plan,
        to: { row: to.row, col: to.col },
        unit: plan.unit,
      };
    })
    .filter(Boolean);
}

function getBlockedMoveStepUnits(attempts, positions, liveUnits) {
  const attemptsByUnit = new Map(attempts.map((attempt) => [attempt.unit, attempt]));
  const blockedUnits = new Set();

  getMoveAttemptsByTarget(attempts).forEach((targetAttempts) => {
    if (targetAttempts.length <= 1) {
      return;
    }

    const winningAttempt = getContestedMoveTargetWinner(targetAttempts);

    targetAttempts.forEach(({ unit }) => {
      if (unit !== winningAttempt.unit) {
        blockedUnits.add(unit);
      }
    });
  });

  blockSwappingMoveAttempts(attempts, blockedUnits);
  blockStationaryOccupiedMoveAttempts(attempts, positions, liveUnits, attemptsByUnit, blockedUnits);
  propagateBlockedVacateAttempts(attempts, positions, liveUnits, attemptsByUnit, blockedUnits);

  return blockedUnits;
}

function getContestedMoveTargetWinner(attempts) {
  return [...attempts].sort(compareMoveTargetContestAttempts)[0];
}

function compareMoveTargetContestAttempts(attempt, otherAttempt) {
  return (
    getUnitMoveContestPriority(attempt.unit) - getUnitMoveContestPriority(otherAttempt.unit) ||
    units.indexOf(attempt.unit) - units.indexOf(otherAttempt.unit)
  );
}

function getUnitMoveContestPriority(unit) {
  return unit.team === "player" ? 0 : 1;
}

function getMoveAttemptsByTarget(attempts) {
  const attemptsByTarget = new Map();

  attempts.forEach((attempt) => {
    const key = getGridPositionKey(attempt.to.row, attempt.to.col);
    const targetAttempts = attemptsByTarget.get(key) ?? [];

    targetAttempts.push(attempt);
    attemptsByTarget.set(key, targetAttempts);
  });

  return attemptsByTarget;
}

function blockSwappingMoveAttempts(attempts, blockedUnits) {
  for (let index = 0; index < attempts.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < attempts.length; otherIndex += 1) {
      const attempt = attempts[index];
      const otherAttempt = attempts[otherIndex];

      if (
        areSameGridPosition(attempt.from, otherAttempt.to) &&
        areSameGridPosition(attempt.to, otherAttempt.from)
      ) {
        blockedUnits.add(attempt.unit);
        blockedUnits.add(otherAttempt.unit);
      }
    }
  }
}

function blockStationaryOccupiedMoveAttempts(
  attempts,
  positions,
  liveUnits,
  attemptsByUnit,
  blockedUnits,
) {
  attempts.forEach((attempt) => {
    const occupant = getUnitAtResolvedPosition(attempt.to, positions, liveUnits);

    if (!occupant || occupant === attempt.unit) {
      return;
    }

    const occupantAttempt = attemptsByUnit.get(occupant);

    if (!occupantAttempt || !areSameGridPosition(occupantAttempt.from, attempt.to)) {
      blockedUnits.add(attempt.unit);
    }
  });
}

function propagateBlockedVacateAttempts(
  attempts,
  positions,
  liveUnits,
  attemptsByUnit,
  blockedUnits,
) {
  let didBlockUnit = true;

  while (didBlockUnit) {
    didBlockUnit = false;

    attempts.forEach((attempt) => {
      if (blockedUnits.has(attempt.unit)) {
        return;
      }

      const occupant = getUnitAtResolvedPosition(attempt.to, positions, liveUnits);
      const occupantAttempt = occupant ? attemptsByUnit.get(occupant) : null;

      if (occupantAttempt && blockedUnits.has(occupant)) {
        blockedUnits.add(attempt.unit);
        didBlockUnit = true;
      }
    });
  }
}

function getUnitAtResolvedPosition(position, positions, liveUnits) {
  return liveUnits.find((unit) => {
    const unitPosition = positions.get(unit);

    return unitPosition && areSameGridPosition(unitPosition, position);
  }) ?? null;
}

function getResolvedMovePath(path, resolvedPosition) {
  const resolvedIndex = path.findIndex((position) => areSameGridPosition(position, resolvedPosition));

  if (resolvedIndex === -1) {
    return [{ row: resolvedPosition.row, col: resolvedPosition.col }];
  }

  return path.slice(0, resolvedIndex + 1);
}

function isAttackIntentEngagementTarget(unit, target, movePlans) {
  const plan = movePlans.find((movePlan) => movePlan.unit === unit);

  if (!plan?.isAttackIntent) {
    return false;
  }

  return movePlans.some((otherPlan) => {
    return (
      otherPlan !== plan &&
      otherPlan.isAttackIntent &&
      areOpposingUnits(plan.unit, otherPlan.unit) &&
      isAdjacentTile(target.row, target.col, otherPlan.target.row, otherPlan.target.col)
    );
  });
}

function getOpposingUnit(unit) {
  if (unit.team === "enemy") {
    const focusTarget = getEnemyPackFocusTarget();

    if (focusTarget) {
      return focusTarget;
    }
  }

  if (unit.team === "player") {
    return getFriendlyFocusTarget(unit);
  }

  return units.find((otherUnit) => {
    return otherUnit !== unit && areOpposingUnits(unit, otherUnit) && isUnitAlive(otherUnit);
  }) ?? null;
}

function getEnemyPackFocusTarget() {
  if (enemyPackFocusTarget && isUnitAlive(enemyPackFocusTarget)) {
    return enemyPackFocusTarget;
  }

  return getAliveUnitsByTeam("player")[0] ?? player;
}

// Hunt the nearest living enemy, including concealed enemies whose positions
// are still known. Hills continue to block movement and require a detour.
function getFriendlyFocusTarget(friendlyUnit = player) {
  return getAliveUnitsByTeam("enemy")
    .sort((unit, otherUnit) => {
      return (
        getGridDistance(friendlyUnit.row, friendlyUnit.col, unit.row, unit.col) -
        getGridDistance(friendlyUnit.row, friendlyUnit.col, otherUnit.row, otherUnit.col)
      );
    })[0] ?? null;
}

function hasQueuedAttackIntentAfterCurrentMove(unit) {
  if (unit.team === "enemy") {
    const nextNonMoveEntry = enemyPackActionQueue.find((entry) => {
      return entry.unit === unit && entry.action !== "Move";
    });

    return nextNonMoveEntry?.action === "Attack";
  }

  const nextNonMoveAction = getUnitActionQueue(unit).find((action) => action !== "Move");

  return nextNonMoveAction === "Attack";
}

function capMovePlanAtAttackRange(plan, targetStartState) {
  if (!targetStartState) {
    return;
  }

  const adjacentStep = plan.path.findIndex((position, step) => {
    return (
      step > 0 &&
      isAdjacentTile(position.row, position.col, targetStartState.row, targetStartState.col)
    );
  });

  if (adjacentStep === -1) {
    return;
  }

  stopMovePlanAtStep(plan, adjacentStep);
}

function applyAttackIntentEngagementStops(movePlans, startStates) {
  const engagedUnits = new Set();

  for (let planIndex = 0; planIndex < movePlans.length; planIndex += 1) {
    for (let otherIndex = planIndex + 1; otherIndex < movePlans.length; otherIndex += 1) {
      const plan = movePlans[planIndex];
      const otherPlan = movePlans[otherIndex];

      if (
        engagedUnits.has(plan.unit) ||
        engagedUnits.has(otherPlan.unit) ||
        !plan.isAttackIntent ||
        !otherPlan.isAttackIntent ||
        !areOpposingUnits(plan.unit, otherPlan.unit)
      ) {
        continue;
      }

      const endpoints = getAttackIntentContestEndpoints(plan, otherPlan, startStates) ??
        getBestAttackIntentEngagementEndpoints(plan, otherPlan, startStates);

      if (!endpoints) {
        continue;
      }

      stopMovePlanAtStep(plan, endpoints.step, startStates.get(plan.unit));
      stopMovePlanAtStep(otherPlan, endpoints.otherStep, startStates.get(otherPlan.unit));
      engagedUnits.add(plan.unit);
      engagedUnits.add(otherPlan.unit);
    }
  }
}

function getAttackIntentContestEndpoints(plan, otherPlan, startStates) {
  const collisionStep = getPathCollisionStep(plan.path, otherPlan.path);

  if (collisionStep === null) {
    return null;
  }

  const position = getPathStep(plan.path, collisionStep);
  const otherPosition = getPathStep(otherPlan.path, collisionStep);

  if (!areSameGridPosition(position, otherPosition)) {
    return null;
  }

  const winningAttempt = getContestedMoveTargetWinner([
    { unit: plan.unit, to: position },
    { unit: otherPlan.unit, to: otherPosition },
  ]);
  const step = winningAttempt.unit === plan.unit ? collisionStep : collisionStep - 1;
  const otherStep = winningAttempt.unit === otherPlan.unit ? collisionStep : collisionStep - 1;
  const endpoint = getPathStepOrStart(plan.path, step, startStates.get(plan.unit));
  const otherEndpoint = getPathStepOrStart(
    otherPlan.path,
    otherStep,
    startStates.get(otherPlan.unit),
  );

  if (
    !isAdjacentTile(endpoint.row, endpoint.col, otherEndpoint.row, otherEndpoint.col) ||
    !isValidEngagementEndpoint(endpoint, plan.unit, otherEndpoint, startStates, otherPlan.unit) ||
    !isValidEngagementEndpoint(otherEndpoint, otherPlan.unit, endpoint, startStates, plan.unit)
  ) {
    return null;
  }

  return { step, otherStep };
}

function getBestAttackIntentEngagementEndpoints(plan, otherPlan, startStates) {
  let bestEndpoints = null;
  let bestScore = -1;
  let bestBalance = Infinity;

  for (let step = 0; step < plan.path.length; step += 1) {
    const position = getPathStepOrStart(plan.path, step, startStates.get(plan.unit));

    for (let otherStep = 0; otherStep < otherPlan.path.length; otherStep += 1) {
      const otherPosition = getPathStepOrStart(
        otherPlan.path,
        otherStep,
        startStates.get(otherPlan.unit),
      );

      if (
        !isAdjacentTile(position.row, position.col, otherPosition.row, otherPosition.col) ||
        !isValidEngagementEndpoint(position, plan.unit, otherPosition, startStates, otherPlan.unit) ||
        !isValidEngagementEndpoint(otherPosition, otherPlan.unit, position, startStates, plan.unit)
      ) {
        continue;
      }

      if (
        getPathCollisionStep(
          getPathThroughStep(plan.path, step),
          getPathThroughStep(otherPlan.path, otherStep),
        ) !== null
      ) {
        continue;
      }

      const score = step + otherStep;
      const balance = Math.abs(step - otherStep);

      if (score > bestScore || (score === bestScore && balance < bestBalance)) {
        bestScore = score;
        bestBalance = balance;
        bestEndpoints = { step, otherStep };
      }
    }
  }

  return bestEndpoints;
}

function isValidEngagementEndpoint(position, unit, otherPosition, startStates, otherUnit = null) {
  const blockingUnit = getBlockingUnitAtSnapshotPosition(position.row, position.col, startStates);

  return (
    isGridPosition(position.row, position.col) &&
    !isBlockedTile(position.row, position.col) &&
    !areSameGridPosition(position, otherPosition) &&
    (
      !blockingUnit ||
      blockingUnit === unit ||
      (
        blockingUnit === otherUnit &&
        !areSameGridPosition(position, otherPosition)
      )
    )
  );
}

function getPathEngagementStep(path, otherPath) {
  const maxStep = Math.max(path.length, otherPath.length);

  for (let step = 1; step < maxStep; step += 1) {
    const position = getPathStep(path, step);
    const otherPosition = getPathStep(otherPath, step);

    if (isAdjacentTile(position.row, position.col, otherPosition.row, otherPosition.col)) {
      return { step, isSharedTile: false };
    }

    if (areSameGridPosition(position, otherPosition)) {
      return { step, isSharedTile: true };
    }
  }

  return null;
}

function stopMovePlanAtStep(plan, step, startState = null) {
  const target = getPathStepOrStart(plan.path, step, startState);
  const endIndex = Math.max(1, step + 1);

  plan.target = { ...target, direction: plan.target.direction };
  plan.path = plan.path.slice(0, endIndex);
}

function getPlayerMovePlanFromSnapshot(
  playerUnit,
  targetUnit,
  startStates,
  {
    actionQueue = getUnitActionQueue(playerUnit),
    ignoredBlockingUnits = new Set(),
  } = {},
) {
  return getMovementModeMovePlanFromSnapshot(
    playerUnit,
    targetUnit,
    startStates,
    playerUnit.movementMode,
    { actionQueue, ignoredBlockingUnits },
  );
}

function getHuntMovePlanFromSnapshot(
  movingUnit,
  targetUnit,
  startStates,
  { ignoredBlockingUnits = new Set() } = {},
) {
  return getMovementModeMovePlanFromSnapshot(movingUnit, targetUnit, startStates, "Hunt", {
    ignoredBlockingUnits,
  });
}

// Resolves a single enemy wolf's move at tick time from its turn objective:
// fleeing wolves Dodge away from the nearest player, engaging wolves Hunt toward
// their assigned surround slot. Falls back to the legacy "hunt the shared focus"
// behaviour whenever no objective was planned (e.g. dev-test queued actions).
function getEnemyPackMovePlanFromSnapshot(movingUnit, startStates, { ignoredBlockingUnits = new Set() } = {}) {
  const focusTarget = getEnemyPackFocusTarget();
  const objective = movingUnit.packObjective;
  const liveHuntTarget = getNearestUnitByDistance(
    movingUnit,
    getAliveUnitsByTeam("player"),
    startStates,
  ) ?? focusTarget;

  if (!objective) {
    return getHuntMovePlanFromSnapshot(movingUnit, liveHuntTarget, startStates, { ignoredBlockingUnits });
  }

  if (objective.mode === "flee") {
    const nearestPlayer = getNearestUnitByDistance(
      movingUnit,
      getAliveUnitsByTeam("player"),
      startStates,
    );

    if (!nearestPlayer) {
      return getHuntMovePlanFromSnapshot(movingUnit, liveHuntTarget, startStates, { ignoredBlockingUnits });
    }

    return getMovementModeMovePlanFromSnapshot(movingUnit, nearestPlayer, startStates, "Dodge", {
      ignoredBlockingUnits,
    });
  }

  const goal = getEnemyPackGoalPosition(movingUnit, liveHuntTarget);

  if (!goal) {
    return getHuntMovePlanFromSnapshot(movingUnit, liveHuntTarget, startStates, { ignoredBlockingUnits });
  }

  const goalState = {
    row: goal.row,
    col: goal.col,
    direction: (startStates.get(movingUnit) ?? movingUnit).direction,
  };

  // A real surround slot is a tile the wolf should OCCUPY — it's already the
  // attack-range tile beside the player, so "Occupy" lands the wolf ON it. When
  // getEnemyPackGoalPosition falls back to the focus tile itself, Hunt toward
  // the player instead (stand ADJACENT, don't pile onto the player's tile).
  const isSlotGoal = goal.row !== liveHuntTarget.row || goal.col !== liveHuntTarget.col;

  return getModeMovePlanFromTargetState(
    movingUnit,
    goalState,
    startStates,
    isSlotGoal ? "Occupy" : "Hunt",
    { ignoredBlockingUnits },
  );
}

function getNearestUnitByDistance(unit, candidates, startStates) {
  const fromState = startStates.get(unit) ?? unit;
  let nearest = null;
  let nearestDistance = Infinity;

  candidates.forEach((candidate) => {
    const state = startStates.get(candidate) ?? candidate;
    const distance = getGridDistance(fromState.row, fromState.col, state.row, state.col);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  });

  return nearest;
}

function getMovementModeMovePlanFromSnapshot(
  movingUnit,
  targetUnit,
  startStates,
  movementMode,
  {
    actionQueue = getUnitActionQueue(movingUnit),
    ignoredBlockingUnits = new Set(),
  } = {},
) {
  const startState = startStates.get(movingUnit);
  const targetStartState = startStates.get(targetUnit);
  const fallbackPath = [{ row: startState.row, col: startState.col }];
  const fallbackPlan = {
    unit: movingUnit,
    path: fallbackPath,
    target: { ...fallbackPath[0], direction: startState.direction },
  };

  if (!targetStartState || !isUnitAlive(targetUnit)) {
    fallbackPlan.debug = "no living target";
    return fallbackPlan;
  }

  const plan = getModeMovePlanFromTargetState(movingUnit, targetStartState, startStates, movementMode, {
    actionQueue,
    ignoredBlockingUnits,
  });
  plan.debug = `target ${getBattleDebugUnitId(targetUnit)} at ${formatBattleDebugPosition(targetStartState)}; ${plan.debug}`;
  return plan;
}

// Mode-based move planning toward a bare board position (not necessarily a unit).
// Lets the pack steer a wolf to its encirclement slot, or a fleeing wolf away from
// a chosen threat, while reusing the existing Hunt/Dodge/Flank scoring.
function getModeMovePlanFromTargetState(
  movingUnit,
  targetStartState,
  startStates,
  movementMode,
  {
    actionQueue = getUnitActionQueue(movingUnit),
    ignoredBlockingUnits = new Set(),
  } = {},
) {
  const startState = startStates.get(movingUnit);
  const fallbackPath = [{ row: startState.row, col: startState.col }];
  const fallbackPlan = {
    unit: movingUnit,
    path: fallbackPath,
    target: { ...fallbackPath[0], direction: startState.direction },
  };

  if (!targetStartState) {
    return fallbackPlan;
  }

  const context = getUnitMoveContext(movingUnit, targetStartState, startStates, actionQueue, {
    ignoredBlockingUnits,
  });
  const candidate = getMoveCandidateForMode(movementMode, context);
  const debug = candidate
    ? `planned ${formatBattleDebugPosition(candidate.target)}`
    : !Number.isFinite(context.currentDistance)
      ? "no terrain route to target"
      : context.candidates.length === 0
        ? "no open movement path"
        : `no move accepted by ${movementMode} scoring`;

  return candidate
    ? {
      unit: movingUnit,
      path: candidate.path,
      target: { ...candidate.target, direction: candidate.direction },
      debug,
    }
    : { ...fallbackPlan, debug };
}

function getUnitMoveContext(
  movingUnit,
  targetStartState,
  startStates,
  actionQueue,
  { ignoredBlockingUnits = new Set() } = {},
) {
  const startState = startStates.get(movingUnit);
  // Walkable BFS field rooted at the target. Both currentDistance and every
  // candidate.distance read from THIS field so comparisons stay consistent —
  // this is what lets a unit route around water instead of freezing in front
  // of it (a detour tile genuinely scores closer than the blocked start tile).
  const distanceField = buildWalkableDistanceField(targetStartState.row, targetStartState.col);
  const currentDistance = getFieldDistance(distanceField, startState.row, startState.col);
  const currentFrontRisk = isEnemyFrontArcPosition(
    startState.row,
    startState.col,
    targetStartState,
  );
  const currentEscapeRoutes = getEscapeRouteCountFromSnapshot(
    startState.row,
    startState.col,
    movingUnit,
    startStates,
    { ignoredBlockingUnits },
  );
  const candidates = getUnitMoveCandidatesFromSnapshot(movingUnit, targetStartState, startStates, {
    ignoredBlockingUnits,
    distanceField,
  });

  return {
    actionQueue,
    candidates,
    currentDistance,
    currentEscapeRoutes,
    currentFrontRisk,
    movingUnit,
    startState,
    targetStartState,
  };
}

function getUnitMoveCandidatesFromSnapshot(
  movingUnit,
  targetStartState,
  startStates,
  { ignoredBlockingUnits = new Set(), distanceField = null } = {},
) {
  const startState = startStates.get(movingUnit);
  // Fall back to a freshly-built field if a caller didn't supply one, so this
  // function stays correct in isolation; getUnitMoveContext passes the shared
  // field rooted at the same target.
  const field = distanceField
    ?? buildWalkableDistanceField(targetStartState.row, targetStartState.col);
  const candidates = [];

  MOVEMENT_DIRECTIONS.forEach((direction) => {
    const path = getMovePathFromSnapshot(
      startState.row,
      startState.col,
      direction,
      MOVE_ACTION_TILE_COUNT,
      movingUnit,
      startStates,
      { ignoredBlockingUnits },
    );

    path.slice(1).forEach((target, targetIndex) => {
      const steps = targetIndex + 1;
      const facingDirection = getFacingDirectionForMove(
        startState.row,
        startState.col,
        target.row,
        target.col,
        startState.direction,
      );
      const turnCost = getDirectionTurnCost(startState.direction, facingDirection);
      const distance = getFieldDistance(field, target.row, target.col);

      candidates.push({
        direction: facingDirection,
        distance,
        escapeRoutes: getEscapeRouteCountFromSnapshot(
          target.row,
          target.col,
          movingUnit,
          startStates,
          { ignoredBlockingUnits },
        ),
        frontRisk: isEnemyFrontArcPosition(target.row, target.col, targetStartState),
        isAdjacent: isAdjacentTile(
          target.row,
          target.col,
          targetStartState.row,
          targetStartState.col,
        ),
        path: path.slice(0, steps + 1),
        steps,
        target,
        turnCost,
      });
    });
  });

  return candidates;
}

function getMoveCandidateForMode(mode, context) {
  switch (mode) {
    case "Flank":
      return getFlankMoveCandidate(context);
    case "Dodge":
      return getDodgeMoveCandidate(context);
    case "Sneak":
      return getSneakMoveCandidate(context);
    case "Occupy":
      return getOccupyMoveCandidate(context);
    case "Hunt":
    default:
      return getHuntMoveCandidate(context);
  }
}

function getHuntMoveCandidate(context) {
  const currentIsAdjacent = isAdjacentTile(
    context.startState.row,
    context.startState.col,
    context.targetStartState.row,
    context.targetStartState.col,
  );

  return context.candidates
    .filter((candidate) => {
      return (
        candidate.distance < context.currentDistance ||
        (
          !currentIsAdjacent &&
          candidate.isAdjacent &&
          candidate.distance <= context.currentDistance
        )
      );
    })
    .sort(compareHuntMoveCandidates)[0] ?? null;
}

function compareHuntMoveCandidates(candidate, otherCandidate) {
  return (
    Number(otherCandidate.isAdjacent) - Number(candidate.isAdjacent) ||
    candidate.distance - otherCandidate.distance ||
    candidate.turnCost - otherCandidate.turnCost ||
    candidate.steps - otherCandidate.steps
  );
}

// Steering toward a goal TILE the unit should stand ON (an enemy surround slot),
// versus Hunt's "stand adjacent to a unit". Picks the reachable candidate
// closest to the goal by walkable distance — the goal tile itself is distance 0,
// so the unit lands on it instead of stopping one tile short (which is what
// Hunt's isAdjacent-first tiebreak would otherwise do). Ties: fewer turns, then
// fewer steps.
function getOccupyMoveCandidate(context) {
  return context.candidates
    .filter((candidate) => candidate.distance < context.currentDistance)
    .sort(compareOccupyMoveCandidates)[0] ?? null;
}

function compareOccupyMoveCandidates(candidate, otherCandidate) {
  return (
    candidate.distance - otherCandidate.distance ||
    candidate.turnCost - otherCandidate.turnCost ||
    candidate.steps - otherCandidate.steps
  );
}

function getFlankMoveCandidate(context) {
  const wantsAttackSetup = context.actionQueue[0] === "Attack";
  const isTooClose = isAdjacentTile(
    context.startState.row,
    context.startState.col,
    context.targetStartState.row,
    context.targetStartState.col,
  );
  const flankCandidates = context.candidates.filter((candidate) => {
    return !candidate.frontRisk;
  });
  const candidates = isTooClose
    ? flankCandidates.filter((candidate) => !candidate.isAdjacent)
    : flankCandidates;
  const selectedCandidates = candidates.length > 0
    ? candidates
    : flankCandidates.length > 0
      ? flankCandidates
      : context.candidates;

  return selectedCandidates
    .sort((candidate, otherCandidate) => compareFlankMoveCandidates(
      candidate,
      otherCandidate,
      isTooClose ? false : wantsAttackSetup,
    ))[0] ?? null;
}

function compareFlankMoveCandidates(candidate, otherCandidate, wantsAttackSetup) {
  const candidateSpacing = wantsAttackSetup
    ? (candidate.isAdjacent ? 0 : candidate.distance)
    : getFlankSpacingPenalty(candidate.distance);
  const otherSpacing = wantsAttackSetup
    ? (otherCandidate.isAdjacent ? 0 : otherCandidate.distance)
    : getFlankSpacingPenalty(otherCandidate.distance);

  return (
    candidateSpacing - otherSpacing ||
    candidate.distance - otherCandidate.distance ||
    candidate.turnCost - otherCandidate.turnCost ||
    candidate.steps - otherCandidate.steps
  );
}

function getFlankSpacingPenalty(distance) {
  if (distance >= 2 && distance <= 3) {
    return 0;
  }

  return Math.abs(distance - 2);
}

function getDodgeMoveCandidate(context) {
  const currentSafety = getDodgeSafetyScore({
    distance: context.currentDistance,
    escapeRoutes: context.currentEscapeRoutes,
    frontRisk: context.currentFrontRisk,
    isAdjacent: context.currentDistance <= 1,
  });
  const improvingDistanceCandidates = context.candidates.filter((candidate) => {
    return candidate.distance > context.currentDistance;
  });
  const safeCandidates = improvingDistanceCandidates.length > 0
    ? improvingDistanceCandidates
    : context.candidates.filter((candidate) => getDodgeSafetyScore(candidate) > currentSafety);

  return safeCandidates
    .sort(compareDodgeMoveCandidates)[0] ?? null;
}

function compareDodgeMoveCandidates(candidate, otherCandidate) {
  return (
    getDodgeSafetyScore(otherCandidate) - getDodgeSafetyScore(candidate) ||
    otherCandidate.distance - candidate.distance ||
    otherCandidate.escapeRoutes - candidate.escapeRoutes ||
    candidate.turnCost - otherCandidate.turnCost ||
    candidate.steps - otherCandidate.steps
  );
}

function getDodgeSafetyScore(candidate) {
  return (
    candidate.distance * 2 +
    candidate.escapeRoutes -
    (candidate.isAdjacent ? 4 : 0) -
    (candidate.frontRisk ? 2 : 0)
  );
}

function getSneakMoveCandidate(context) {
  const currentSneakScore = getSneakPositionScore({
    distance: context.currentDistance,
    escapeRoutes: context.currentEscapeRoutes,
    frontRisk: context.currentFrontRisk,
    isAdjacent: context.currentDistance <= 1,
    steps: 0,
    turnCost: 0,
  });
  const candidate = context.candidates
    .filter((item) => item.steps <= 1)
    .sort(compareSneakMoveCandidates)[0] ?? null;

  if (!candidate || getSneakPositionScore(candidate) >= currentSneakScore) {
    return null;
  }

  return candidate;
}

function compareSneakMoveCandidates(candidate, otherCandidate) {
  return getSneakPositionScore(candidate) - getSneakPositionScore(otherCandidate);
}

function getSneakPositionScore(candidate) {
  const spacingPenalty = Math.abs(candidate.distance - 2);

  return (
    spacingPenalty * 3 +
    candidate.steps +
    candidate.turnCost -
    candidate.escapeRoutes * 0.25 +
    (candidate.isAdjacent ? 2 : 0) +
    (candidate.frontRisk ? 3 : 0)
  );
}

function isEnemyFrontArcPosition(row, col, targetStartState) {
  const delta = DIRECTION_TILE_DELTAS[targetStartState.direction];

  if (!delta) {
    return false;
  }

  const frontRow = targetStartState.row + delta.row;
  const frontCol = targetStartState.col + delta.col;

  return Math.abs(row - frontRow) <= 1 && Math.abs(col - frontCol) <= 1;
}

function getEscapeRouteCountFromSnapshot(
  row,
  col,
  movingUnit,
  startStates,
  { ignoredBlockingUnits = new Set() } = {},
) {
  return Object.values(MOVEMENT_TILE_DELTAS).filter((delta) => {
    const nextRow = row + delta.row;
    const nextCol = col + delta.col;
    const blockingUnit = getBlockingUnitAtSnapshotPosition(nextRow, nextCol, startStates);

    return (
      isGridPosition(nextRow, nextCol) &&
      !isSnapshotMoveBlockedByUnit(blockingUnit, movingUnit, ignoredBlockingUnits)
    );
  }).length;
}

function getDirectionTurnCost(fromDirection, toDirection) {
  const fromIndex = CLOCKWISE_DIRECTIONS.indexOf(fromDirection);
  const toIndex = CLOCKWISE_DIRECTIONS.indexOf(toDirection);

  if (fromIndex === -1 || toIndex === -1) {
    return 0;
  }

  const distance = Math.abs(fromIndex - toIndex);

  return Math.min(distance, CLOCKWISE_DIRECTIONS.length - distance);
}

function getMovePathFromSnapshot(
  row,
  col,
  direction,
  tileCount,
  movingUnit,
  startStates,
  { ignoredBlockingUnits = new Set() } = {},
) {
  const delta = MOVEMENT_TILE_DELTAS[direction];
  let targetRow = row;
  let targetCol = col;
  const path = [{ row, col }];

  if (!delta) {
    return path;
  }

  for (let step = 0; step < tileCount; step += 1) {
    const nextRow = targetRow + delta.row;
    const nextCol = targetCol + delta.col;
    const blockingUnit = getBlockingUnitAtSnapshotPosition(nextRow, nextCol, startStates);

    if (
      !isGridPosition(nextRow, nextCol) ||
      isBlockedTile(nextRow, nextCol) ||
      isSnapshotMoveBlockedByUnit(blockingUnit, movingUnit, ignoredBlockingUnits)
    ) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
    path.push({ row: targetRow, col: targetCol });
  }

  return path;
}

function isSnapshotMoveBlockedByUnit(blockingUnit, movingUnit, ignoredBlockingUnits) {
  return (
    blockingUnit &&
    blockingUnit !== movingUnit &&
    !ignoredBlockingUnits.has(blockingUnit)
  );
}

function stopMovePlansBeforePathCollisions(movePlans, startStates) {
  for (let planIndex = 0; planIndex < movePlans.length; planIndex += 1) {
    for (let otherIndex = planIndex + 1; otherIndex < movePlans.length; otherIndex += 1) {
      const plan = movePlans[planIndex];
      const otherPlan = movePlans[otherIndex];
      const collisionStep = getPathCollisionStep(plan.path, otherPlan.path);

      if (collisionStep === null) {
        continue;
      }

      plan.target = getPathStepOrStart(plan.path, collisionStep - 1, startStates.get(plan.unit));
      otherPlan.target = getPathStepOrStart(
        otherPlan.path,
        collisionStep - 1,
        startStates.get(otherPlan.unit),
      );
      plan.path = plan.path.slice(0, collisionStep);
      otherPlan.path = otherPlan.path.slice(0, collisionStep);
    }
  }
}

function getPathCollisionStep(path, otherPath) {
  const maxStep = Math.max(path.length, otherPath.length);

  for (let step = 1; step < maxStep; step += 1) {
    const position = getPathStep(path, step);
    const previousPosition = getPathStep(path, step - 1);
    const otherPosition = getPathStep(otherPath, step);
    const otherPreviousPosition = getPathStep(otherPath, step - 1);

    if (areSameGridPosition(position, otherPosition)) {
      return step;
    }

    if (
      areSameGridPosition(position, otherPreviousPosition) &&
      areSameGridPosition(otherPosition, previousPosition)
    ) {
      return step;
    }
  }

  return null;
}

function getPathStep(path, step) {
  return path[Math.min(step, path.length - 1)];
}

function getPathThroughStep(path, step) {
  return path.slice(0, Math.max(1, step + 1));
}

function getPathStepOrStart(path, step, startState) {
  if (step < 0) {
    return { row: startState.row, col: startState.col };
  }

  const position = getPathStep(path, step);

  return { row: position.row, col: position.col };
}

function areSameGridPosition(position, otherPosition) {
  return position.row === otherPosition.row && position.col === otherPosition.col;
}

function getGridPositionKey(row, col) {
  return `${row},${col}`;
}

function getBlockingUnitAtSnapshotPosition(row, col, startStates) {
  return units.find((unit) => {
    if (!isUnitActive(unit)) {
      return false;
    }

    const startState = startStates.get(unit);

    return (
      startState &&
      startState.row === row &&
      startState.col === col &&
      isUnitAlive(unit)
    );
  }) ?? null;
}

function getAttackIntentTarget(attacker, startStates) {
  return getAttackTargetFromSnapshot(attacker, startStates);
}

function getLiveAttackTarget(attacker, intendedTarget, startStates) {
  if (
    intendedTarget &&
    isUnitAlive(intendedTarget) &&
    areOpposingUnits(attacker, intendedTarget) &&
    isAdjacentTile(attacker.row, attacker.col, intendedTarget.row, intendedTarget.col)
  ) {
    return intendedTarget;
  }

  return getAttackTarget(attacker) ?? getAttackTargetFromSnapshot(attacker, startStates);
}

function getAttackTargetFromSnapshot(attacker, startStates) {
  const attackerStart = startStates.get(attacker);
  const adjacentTargets = units.filter((unit) => {
    const targetStart = startStates.get(unit);

    return (
      unit !== attacker &&
      targetStart &&
      isUnitAlive(unit) &&
      areOpposingUnits(attacker, unit) &&
      isAdjacentTile(attackerStart.row, attackerStart.col, targetStart.row, targetStart.col)
    );
  });

  if (adjacentTargets.length <= 1) {
    return adjacentTargets[0] ?? null;
  }

  if (attacker.team === "enemy" && adjacentTargets.includes(enemyPackFocusTarget)) {
    return enemyPackFocusTarget;
  }

  const facingDelta = DIRECTION_TILE_DELTAS[attackerStart.direction];

  if (!facingDelta) {
    return adjacentTargets[0];
  }

  return adjacentTargets.find((target) => {
    const targetStart = startStates.get(target);

    return (
      attackerStart.row + facingDelta.row === targetStart.row &&
      attackerStart.col + facingDelta.col === targetStart.col
    );
  }) ?? adjacentTargets[0];
}

function getAttackDirectionFromSnapshot(attacker, target, startStates) {
  const attackerStart = startStates.get(attacker);
  const targetStart = startStates.get(target);
  const attackerAnchor = getTileAnchor(attackerStart.row, attackerStart.col);
  const targetAnchor = getTileAnchor(targetStart.row, targetStart.col);

  return getDirectionFromDelta(targetAnchor.x - attackerAnchor.x, targetAnchor.y - attackerAnchor.y);
}

async function resolveTickDamage(damageIntents) {
  const validIntents = damageIntents.filter(({ attacker, target }) => {
    return isAttackDamageStillValid(attacker, target);
  });
  // An attacker swung but the target slipped out of range (dodged) or was already
  // down — surface a "Miss" so a no-damage attack never reads as a silent bug.
  const missedAttackers = new Set(
    damageIntents
      .filter(({ attacker, target }) => !isAttackDamageStillValid(attacker, target))
      .map(({ attacker }) => attacker)
      .filter((attacker) => attacker && isUnitAlive(attacker)),
  );
  const damageByTarget = new Map();

  validIntents.forEach(({ target, damage }) => {
    damageByTarget.set(target, (damageByTarget.get(target) ?? 0) + damage);
  });

  missedAttackers.forEach((attacker) => showUnitMissPopup(attacker));

  const damageResults = Array.from(damageByTarget.entries()).map(([target, damage]) => {
    return {
      target,
      ...damageUnit(target, damage),
    };
  });

  damageResults.forEach(({ target, damageTaken }) => {
    if (damageTaken > 0) {
      target.tookDamageThisTurn = true;
    }

    showUnitDamagePopup(target, damageTaken);
  });

  damageResults.forEach(({ target, defeated }) => {
    if (defeated) {
      clearQueuedActionsForUnit(target);
    }
  });

  await Promise.all(damageResults.map(({ target, damaged, defeated }) => {
    if (defeated) {
      return playUnitDeath(target);
    }

    if (damaged) {
      return playUnitHitReaction(target);
    }

    return Promise.resolve();
  }));

  return {
    hits: validIntents.map(({ attacker, target, damage }) => ({ attacker, target, damage })),
    misses: Array.from(missedAttackers),
    defeated: damageResults.filter(({ defeated }) => defeated).map(({ target }) => target),
  };
}

function isAttackDamageStillValid(attacker, target) {
  return (
    attacker &&
    target &&
    isUnitAlive(target) &&
    areOpposingUnits(attacker, target) &&
    isAdjacentTile(attacker.row, attacker.col, target.row, target.col)
  );
}

function clearUnitActionQueue(unit) {
  getUnitActionQueue(unit).length = 0;
}

function clearQueuedActionsForUnit(unit) {
  clearUnitActionQueue(unit);

  if (unit === getSelectedPlayerUnit()) {
    setPlayerSelected(null);
  }

  for (let index = enemyPackActionQueue.length - 1; index >= 0; index -= 1) {
    if (enemyPackActionQueue[index].unit === unit) {
      enemyPackActionQueue.splice(index, 1);
    }
  }
}

function shakeArenaSoon() {
  setTimeout(() => {
    arena.classList.add("shaking");
    arena.addEventListener("animationend", () => arena.classList.remove("shaking"), { once: true });
  }, 600);
}

function moveUnitToTile(
  unit,
  row,
  col,
  {
    direction = null,
    shouldUpdateButtons = false,
    skipBlockingCheck = false,
  } = {},
) {
  const blockingUnit = skipBlockingCheck ? null : getBlockingUnitAtPosition(row, col);

  if (blockingUnit && blockingUnit !== unit) {
    return Promise.resolve(false);
  }

  if (unit.row === row && unit.col === col && unit.movementFrameRequest === null) {
    return Promise.resolve(false);
  }

  const start = { x: unit.x, y: unit.y };
  const target = getTileAnchor(row, col);
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const duration = Math.max(180, (distance / PLAYER_MOVE_SPEED) * 1000);
  const moveAnimation = getUnitAnimation(unit, "run") ?? getUnitAnimation(unit, "walk") ?? getUnitAnimation(unit, "idle");
  const minRunAnimationDuration =
    moveAnimation.frameMs * PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES;
  const runAnimationStopAt = Math.max(
    minRunAnimationDuration,
    duration - moveAnimation.frameMs * PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES,
  );
  const startedAt = performance.now();
  let hasStoppedRunAnimation = false;

  if (unit.movementFrameRequest !== null) {
    cancelAnimationFrame(unit.movementFrameRequest);
  }

  unit.direction = direction ?? getDirectionFromDelta(deltaX, deltaY);
  unit.row = row;
  unit.col = col;
  updatePlayerTileLabels();
  updateUnitDepth(unit);
  refreshConcealmentVisuals(); // a move can hide/reveal any unit, not just this one

  if (unit === getSelectedPlayerUnit()) {
    updatePlayerMovePreview();
    updateActiveDirection(unit.direction);
  }

  playUnitAnimation(unit, isUnitAnimationSupported(unit, "run") ? "run" : "walk", shouldUpdateButtons);

  return new Promise((resolve) => {
    const move = (timestamp) => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = EASING.cubicEaseOut(progress);
      const x = start.x + deltaX * easedProgress;
      const y = start.y + deltaY * easedProgress;

      setUnitPosition(unit, x, y);

      if (!hasStoppedRunAnimation && elapsed >= runAnimationStopAt) {
        hasStoppedRunAnimation = true;
        playUnitAnimation(unit, "idle", shouldUpdateButtons);
      }

      if (progress < 1) {
        unit.movementFrameRequest = requestAnimationFrame(move);
        return;
      }

      unit.movementFrameRequest = null;
      setUnitPosition(unit, target.x, target.y);
      updateActionQueueControls();
      resolve(true);
    };

    unit.movementFrameRequest = requestAnimationFrame(move);
    updateActionQueueControls();
  });
}

function movePlayerToTile(row, col, { direction = null, unit = player } = {}) {
  return moveUnitToTile(unit, row, col, {
    direction,
    shouldUpdateButtons: unit === getSelectedPlayerUnit() || unit === player,
  });
}

function getDevTestCombatants() {
  return [
    ...getAliveUnitsByTeam("player").map((unit) => ({
      renderQueue: () => renderActionQueue(unit),
      shouldUpdateButtons: true,
      unit,
    })),
    ...getAliveUnitsByTeam("enemy").map((unit) => ({
      isEnemyPackCombatant: true,
      renderQueue: () => renderEnemyPackIntentTags(),
      unit,
    })),
  ];
}

function clampArenaSize(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return GRID_SIZE;
  }

  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.round(parsedValue)));
}

function clampGridCoordinate(value) {
  return Math.min(GRID_SIZE - 1, Math.max(0, value));
}

function getDefaultDevUnitSetup(team, role = "primary", size = GRID_SIZE) {
  // Live arenas spawn each pack near the corner the player entered from; the
  // dev-test / obstacle-free path keeps the simple edge layout so scenarios that
  // rely on the default (enemy row 0, player bottom row) are unaffected.
  if (!devTestObstaclesDisabled) {
    return getEntryCornerSetup(team, role, currentEntryCorner, size);
  }

  return {
    row: getSpawnRow(team, size),
    col: getSpawnColumn(team, role, size),
    direction: team === "player" ? "topRight" : "bottomLeft",
  };
}

function setUnitType(unit, type) {
  const nextType = unitDefinitions[type] ? type : DEFAULT_UNIT_TYPE;

  if (unit.type === nextType) {
    return;
  }

  stopUnitAnimation(unit);
  unit.type = nextType;
  unit.animationName = "idle";
  unit.idleStartFrame = getRandomIdleStartFrame(nextType);
}

function setUnitActive(unit, isActive) {
  unit.isActive = isActive;
  unit.element.hidden = !isActive;

  if (!isActive) {
    stopUnitAnimation(unit);
    clearUnitActionQueue(unit);

    if (unit.healthBar) {
      unit.healthBar.hidden = true;
    }

    if (unit.intentTags) {
      unit.intentTags.hidden = true;
    }
  }
}

function resetUnitForDev(unit, setup = {}) {
  const type = setup.type ?? unit.type ?? DEFAULT_UNIT_TYPE;
  const isActive = setup.isActive ?? setup.active ?? unit.isActive ?? true;
  const row = clampGridCoordinate(setup.row ?? unit.row);
  const col = clampGridCoordinate(setup.col ?? unit.col);
  const direction = setup.direction ?? unit.direction;
  const movementMode = setup.movementMode ?? unit.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE;
  const health = setup.health ?? UNIT_MAX_HEALTH;
  const anchor = getTileAnchor(row, col);

  setUnitType(unit, type);
  setUnitActive(unit, isActive);

  if (unit.movementFrameRequest !== null) {
    cancelAnimationFrame(unit.movementFrameRequest);
    unit.movementFrameRequest = null;
  }

  stopUnitAnimation(unit);
  unit.element.classList.remove("is-hit");
  unit.row = row;
  unit.col = col;
  unit.direction = direction;
  unit.movementMode = movementMode;
  unit.health = Math.max(0, Math.min(unit.maxHealth, health));
  unit.isDefeated = unit.health === 0;
  unit.turnsSinceHit = 0;
  unit.tookDamageThisTurn = false;
  unit.isFleeing = false;
  unit.packObjective = null;
  unit.hasPlayedDeathAnimation = false;
  unit.deathAnimationPromise = null;
  clearUnitActionQueue(unit);
  setUnitPosition(unit, anchor.x, anchor.y);
  updateUnitDepth(unit);
  updateUnitHealthBar(unit);

  if (!isActive) {
    return;
  }

  if (unit.isDefeated) {
    if (isUnitAnimationSupported(unit, "death")) {
      setUnitAnimationSprite(unit, "death");
      setUnitFrame(unit, getUnitAnimation(unit, "death").frames - 1);
      unit.animationName = "death";
      unit.hasPlayedDeathAnimation = true;
    } else {
      unit.element.hidden = true;
      unit.animationName = "idle";
      unit.hasPlayedDeathAnimation = true;
    }
  } else {
    playUnitAnimation(unit, "idle", unit === getDevPreviewUnit());
  }

  if (unit === getSelectedPlayerUnit()) {
    renderPlayerMovementModeSelector();
  }
}

// The largest connected region of walkable tiles (4-neighbour flood, matching
// the movement BFS in WALKABLE_FIELD_DELTAS; walls are hills, water, and the
// board edge). A unit must start inside this region — otherwise it can be
// marooned on a little island pocket, able to shuffle a tile or two but never
// reach the fight. Recomputed each reconcile from the current terrain.
function getLargestWalkableRegion() {
  const visited = new Set();
  let largest = new Set();

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const startKey = getGridPositionKey(row, col);

      if (visited.has(startKey) || isBlockedTile(row, col)) {
        continue;
      }

      const region = new Set([startKey]);
      const stack = [[row, col]];
      visited.add(startKey);

      while (stack.length > 0) {
        const [r, c] = stack.pop();

        for (const { row: deltaRow, col: deltaCol } of WALKABLE_FIELD_DELTAS) {
          const nextRow = r + deltaRow;
          const nextCol = c + deltaCol;
          const key = getGridPositionKey(nextRow, nextCol);

          if (
            nextRow >= 0 &&
            nextRow < GRID_SIZE &&
            nextCol >= 0 &&
            nextCol < GRID_SIZE &&
            !visited.has(key) &&
            !isBlockedTile(nextRow, nextCol)
          ) {
            visited.add(key);
            region.add(key);
            stack.push([nextRow, nextCol]);
          }
        }
      }

      if (region.size > largest.size) {
        largest = region;
      }
    }
  }

  return largest;
}

// A cell a unit may start on: unclaimed by another spawn and part of the main
// walkable region — which already guarantees it is open ground, has a way out,
// and can reach the rest of the arena (never trapped on an isolated island).
function isStandableSpawnCell(row, col, occupied, mainRegion) {
  const key = getGridPositionKey(row, col);
  return mainRegion.has(key) && !occupied.has(key);
}

// Nearest standable cell to (row, col), searched in rings of growing Chebyshev
// radius. Ties prefer staying on the same edge row (so the formation hugs its
// spawn edge) and then the nearest column. Falls back to the original cell if
// the region is somehow full.
function findSafeSpawnCell(row, col, occupied, mainRegion) {
  if (isStandableSpawnCell(row, col, occupied, mainRegion)) {
    return { row, col };
  }

  for (let radius = 1; radius < GRID_SIZE; radius += 1) {
    let best = null;
    let bestScore = Infinity;

    for (let deltaRow = -radius; deltaRow <= radius; deltaRow += 1) {
      for (let deltaCol = -radius; deltaCol <= radius; deltaCol += 1) {
        if (Math.max(Math.abs(deltaRow), Math.abs(deltaCol)) !== radius) {
          continue; // only the ring's perimeter
        }

        const candidateRow = row + deltaRow;
        const candidateCol = col + deltaCol;

        if (!isStandableSpawnCell(candidateRow, candidateCol, occupied, mainRegion)) {
          continue;
        }

        const score = Math.abs(deltaRow) * GRID_SIZE + Math.abs(deltaCol);
        if (score < bestScore) {
          bestScore = score;
          best = { row: candidateRow, col: candidateCol };
        }
      }
    }

    if (best) {
      return best;
    }
  }

  return { row, col };
}

// After terrain (re)generation, nudge any active unit that a freshly placed hill
// or lake left on an obstacle, boxed in, or marooned on an isolated pocket onto
// the nearest cell of the main walkable region — so every wolf starts on open
// ground that can actually reach the fight. No-op when obstacles are absent or
// disabled (dev-test scenarios manage their own layout).
function reconcileSpawnPositions() {
  if (devTestObstaclesDisabled) {
    return;
  }

  if (hillTileKeys.size === 0 && pondTileKeys.size === 0 && treeTileKeys.size === 0) {
    return;
  }

  const mainRegion = getLargestWalkableRegion();

  if (mainRegion.size === 0) {
    return; // no walkable ground at all — nothing sane to relocate onto
  }

  const activeUnits = units.filter(isUnitActive);
  const occupied = new Set(
    activeUnits.map((unit) => getGridPositionKey(unit.row, unit.col)),
  );

  activeUnits.forEach((unit) => {
    if (mainRegion.has(getGridPositionKey(unit.row, unit.col))) {
      return; // already on the main landmass
    }

    occupied.delete(getGridPositionKey(unit.row, unit.col));
    const safe = findSafeSpawnCell(unit.row, unit.col, occupied, mainRegion);
    occupied.add(getGridPositionKey(safe.row, safe.col));

    unit.row = safe.row;
    unit.col = safe.col;
    const anchor = getTileAnchor(safe.row, safe.col);
    setUnitPosition(unit, anchor.x, anchor.y);
    updateUnitDepth(unit);
    updateUnitHealthBar(unit);
  });
}

function resetDevTest(
  playerSetup = {},
  enemySetup = {},
  playerSupportSetup = null,
  enemySupportSetup = null,
  playerFlankSetup = null,
  enemyFlankSetup = null,
) {
  const isStagMode = enemyMode === "stag";

  isExecutingActionQueue = false;
  clearEnemyPackActionQueue();
  enemyPackFocusTarget = null;
  setPlayerSelected(null);
  resetUnitForDev(player, {
    ...getDefaultDevUnitSetup("player"),
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
    health: UNIT_MAX_HEALTH,
    ...playerSetup,
  });
  resetUnitForDev(playerSupport, {
    ...getDefaultDevUnitSetup("player", "support"),
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
    health: UNIT_MAX_HEALTH,
    ...(playerSupportSetup ?? {}),
  });
  resetUnitForDev(playerFlank, {
    ...getDefaultDevUnitSetup("player", "flank"),
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
    health: UNIT_MAX_HEALTH,
    ...(playerFlankSetup ?? {}),
  });
  resetUnitForDev(enemy, {
    ...getDefaultDevUnitSetup("enemy"),
    type: isStagMode ? "stag" : "wolf",
    isActive: true,
    health: UNIT_MAX_HEALTH,
    ...enemySetup,
  });
  resetUnitForDev(enemySupport, {
    ...getDefaultDevUnitSetup("enemy", "support"),
    type: "wolf",
    isActive: !isStagMode,
    health: UNIT_MAX_HEALTH,
    ...(enemySupportSetup ?? {}),
  });
  resetUnitForDev(enemyFlank, {
    ...getDefaultDevUnitSetup("enemy", "flank"),
    type: "wolf",
    isActive: !isStagMode,
    health: UNIT_MAX_HEALTH,
    ...(enemyFlankSetup ?? {}),
  });
  reconcileSpawnPositions(); // keep nobody standing on / boxed in by an obstacle
  updatePlayerTileLabels();
  updateActiveDirection(getDevPreviewUnit().direction);
  renderActionQueue(getSelectedPlayerUnit());
  renderUnitIntentTags(enemy);
  renderUnitIntentTags(enemySupport);
  renderUnitIntentTags(enemyFlank);
  updatePlayerActionControls();
  updateAnimationControls();
  refreshConcealmentVisuals();

  return getDevTestState();
}

function queueDevTestActions(playerActions = [], enemyActions = []) {
  clearEnemyPackActionQueue();
  units.forEach((unit) => {
    clearUnitActionQueue(unit);
  });
  playerActions.forEach((action) => {
    getUnitActionQueue(player).push(action);
  });
  enemyActions.forEach((action) => {
    enemyPackActionQueue.push({ unit: enemy, action });
  });
  renderActionQueue(getSelectedPlayerUnit());
  renderEnemyPackIntentTags();

  return getDevTestState();
}

function queueDevTestPackActions(packActions = []) {
  const unitMap = { player, playerSupport, playerFlank, enemy, enemySupport, enemyFlank };

  clearEnemyPackActionQueue();
  units.forEach((unit) => {
    clearUnitActionQueue(unit);
  });
  packActions.forEach(({ unitId, action }) => {
    const unit = unitMap[unitId];

    if (unit) {
      enemyPackActionQueue.push({ unit, action });
    }
  });
  renderActionQueue(getSelectedPlayerUnit());
  renderEnemyPackIntentTags();

  return getDevTestState();
}

async function runDevTestTick() {
  isExecutingActionQueue = true;

  try {
    await executeActionTick(getDevTestCombatants());
  } finally {
    isExecutingActionQueue = false;
    updatePlayerActionControls();
    updateActionQueueControls();
    syncEnemyModeControls();
  }

  return getDevTestState();
}

async function runDevTestTurn() {
  isExecutingActionQueue = true;

  try {
    while (
      getDevTestCombatants().some(hasCombatantQueuedActions) &&
      hasAliveUnitsByTeam("player") &&
      hasAliveUnitsByTeam("enemy")
    ) {
      await executeActionTick(getDevTestCombatants());
    }
  } finally {
    isExecutingActionQueue = false;
    renderActionQueue(getSelectedPlayerUnit());
    renderEnemyPackIntentTags();
    updatePlayerActionControls();
    updateActionQueueControls();
    syncEnemyModeControls();

    if (!hasAliveUnitsByTeam("player")) {
      concludeBattle(false);
    } else if (!hasAliveUnitsByTeam("enemy")) {
      concludeBattle(true);
    }
  }

  return getDevTestState();
}

function getDevTestUnitState(unit) {
  return {
    type: unit.type,
    isActive: isUnitActive(unit),
    row: unit.row,
    col: unit.col,
    direction: unit.direction,
    health: unit.health,
    isDefeated: unit.isDefeated,
    animationName: unit.animationName,
    zIndex: Number(unit.element.style.zIndex || 0),
    actionQueue: [...getUnitActionQueue(unit)],
  };
}

function getDevTestState() {
  return {
    gridSize: GRID_SIZE,
    enemyMode,
    player: getDevTestUnitState(player),
    playerSupport: getDevTestUnitState(playerSupport),
    playerFlank: getDevTestUnitState(playerFlank),
    enemy: getDevTestUnitState(enemy),
    enemySupport: getDevTestUnitState(enemySupport),
    enemyFlank: getDevTestUnitState(enemyFlank),
    playerQueuedActionTotal: getQueuedPlayerActionTotal(),
    enemyPackQueue: enemyPackActionQueue.map((entry) => ({
      action: entry.action,
      unitTeam: entry.unit.team,
      unitRow: entry.unit.row,
      unitCol: entry.unit.col,
    })),
    enemyPackFocusTarget: enemyPackFocusTarget
      ? { row: enemyPackFocusTarget.row, col: enemyPackFocusTarget.col }
      : null,
    enemyIntentTags: enemy.intentTags
      ? Array.from(enemy.intentTags.querySelectorAll(".unit-intent-label")).map((tag) => tag.textContent)
      : [],
  };
}

const DEV_TEST_SCENARIOS = [
  {
    id: "double-attack",
    label: "Double attack",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Attack"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      !state.player.isDefeated &&
      !state.enemy.isDefeated
    ),
  },
  {
    id: "defend-blocks",
    label: "Defend blocks",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Defend"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === UNIT_MAX_HEALTH - UNIT_DEFENDED_DAMAGE &&
      state.enemy.health === 10 &&
      !state.player.isDefeated &&
      !state.enemy.isDefeated
    ),
  },
  {
    id: "double-ko",
    label: "Double KO",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight", health: 1 },
        { row: 4, col: 4, direction: "bottomLeft", health: 1 },
      );
      queueDevTestActions(["Attack", "Move"], ["Attack", "Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === 0 &&
      state.enemy.health === 0 &&
      state.player.isDefeated &&
      state.enemy.isDefeated &&
      state.player.actionQueue.length === 0 &&
      state.enemy.actionQueue.length === 0
    ),
  },
  {
    id: "move-away-dodge",
    label: "Move-away dodge",
    // A Dodge-mode unit that flees out of adjacency this tick avoids a queued attack
    // (attack resolves against post-move positions). This is the "I saw that coming" dodge.
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "bottomLeft", movementMode: "Dodge" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      // Fled out of the starting tile and took no damage.
      !(state.player.row === 5 && state.player.col === 4) &&
      state.player.health === 10 &&
      state.enemy.health === 10
    ),
  },
  {
    id: "move-into-range-hit",
    label: "Move-in hit",
    // A unit that steps into adjacency this tick IS hit by an opponent's queued attack
    // (attack resolves against post-move positions, not the pre-move snapshot).
    run: async () => {
      resetDevTest(
        { row: 8, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 5 &&
      state.player.col === 4 &&
      state.player.health === 10 - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "angled-move-path",
    label: "Angled move path",
    run: async () => {
      resetDevTest({ row: 5, col: 5, direction: "topLeft" });
      const startStates = new Map(units.map((unit) => [
        unit,
        { row: unit.row, col: unit.col, direction: unit.direction },
      ]));
      const path = getMovePathFromSnapshot(5, 5, "top", MOVE_ACTION_TILE_COUNT, player, startStates);

      return { ...getDevTestState(), path };
    },
    expect: (state) => {
      const target = state.path[state.path.length - 1];

      return target.row === 2 && target.col === 2;
    },
  },
  {
    id: "crossing-paths",
    label: "Crossing paths",
    run: async () => {
      resetDevTest(
        { row: 6, col: 4, direction: "topRight" },
        { row: 2, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 4 &&
      state.player.col === 4 &&
      state.enemy.row === 3 &&
      state.enemy.col === 4
    ),
  },
  {
    id: "adjacent-swap",
    label: "Adjacent swap",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 5 &&
      state.player.col === 4 &&
      state.enemy.row === 4 &&
      state.enemy.col === 4
    ),
  },
  {
    id: "friendly-follow-vacated",
    label: "Follow vacated tile",
    run: async () => {
      resetDevTest(
        { row: 8, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 0, col: 4, direction: "bottomLeft" },
        { row: 9, col: 4, direction: "topRight", movementMode: "Hunt" },
        { health: 0 },
      );
      getUnitActionQueue(player).push("Move");
      getUnitActionQueue(playerSupport).push("Move");
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 5 &&
      state.player.col === 4 &&
      state.playerSupport.row === 6 &&
      state.playerSupport.col === 4
    ),
  },
  {
    id: "friendly-stationary-blocker",
    label: "Stationary blocker",
    run: async () => {
      resetDevTest(
        { row: 8, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 0, col: 4, direction: "bottomLeft" },
        { row: 9, col: 4, direction: "topRight", movementMode: "Hunt" },
        { health: 0 },
      );
      getUnitActionQueue(playerSupport).push("Move");
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 8 &&
      state.player.col === 4 &&
      state.playerSupport.row === 9 &&
      state.playerSupport.col === 4
    ),
  },
  {
    id: "same-tile-contest-partial",
    label: "Same-tile contest",
    run: async () => {
      resetDevTest(
        { row: 8, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 2, col: 4, direction: "bottomLeft" },
        {},
        { health: 0 },
      );
      queueDevTestActions(["Move"], ["Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 5 &&
      state.player.col === 4 &&
      state.enemy.row === 4 &&
      state.enemy.col === 4
    ),
  },
  {
    id: "approach-contest-player-wins",
    label: "Approach contest",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 3, col: 4, direction: "bottomLeft" },
        {},
        { health: 0 },
      );
      queueDevTestActions(["Move"], ["Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 4 &&
      state.player.col === 4 &&
      state.enemy.row === 3 &&
      state.enemy.col === 4
    ),
  },
  {
    id: "approach-contest-attack",
    label: "Approach + attack",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 3, col: 4, direction: "bottomLeft" },
        {},
        { health: 0 },
      );
      queueDevTestActions(["Move", "Attack"], ["Move", "Attack"]);
      return runDevTestTurn();
    },
    expect: (state) => (
      state.player.row === 4 &&
      state.player.col === 4 &&
      state.enemy.row === 3 &&
      state.enemy.col === 4 &&
      state.player.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "hunt-flanks-friendly-blocker",
    label: "Hunt flanks blocker",
    run: async () => {
      resetDevTest(
        { row: 4, col: 4, direction: "topRight", movementMode: "Hunt" },
        { row: 3, col: 4, direction: "bottomLeft" },
        { row: 8, col: 4, direction: "topRight", movementMode: "Hunt" },
        { health: 0 },
      );
      getUnitActionQueue(playerSupport).push("Move", "Move", "Attack");
      return runDevTestTurn();
    },
    expect: (state) => (
      state.player.row === 4 &&
      state.player.col === 4 &&
      state.playerSupport.row === 4 &&
      (state.playerSupport.col === 3 || state.playerSupport.col === 5) &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "gap-engage",
    label: "Gap engage",
    run: async () => {
      resetDevTest(
        { row: 6, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move", "Attack"], ["Move", "Attack"]);
      return runDevTestTurn();
    },
    expect: (state) => (
      isAdjacentTile(state.player.row, state.player.col, state.enemy.row, state.enemy.col) &&
      state.player.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.player.actionQueue.length === 0 &&
      state.enemyPackQueue.length === 0
    ),
  },
  {
    id: "cross-engage",
    label: "Cross engage",
    run: async () => {
      resetDevTest(
        { row: 6, col: 4, direction: "topRight" },
        { row: 2, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move", "Attack"], ["Move", "Attack"]);
      return runDevTestTurn();
    },
    expect: (state) => (
      isAdjacentTile(state.player.row, state.player.col, state.enemy.row, state.enemy.col) &&
      state.player.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "same-tile-engage",
    label: "Same-tile engage",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 3, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move", "Attack"], ["Move", "Attack"]);
      return runDevTestTurn();
    },
    expect: (state) => (
      isAdjacentTile(state.player.row, state.player.col, state.enemy.row, state.enemy.col) &&
      state.player.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "post-move-contact",
    label: "Post-move contact",
    run: async () => {
      resetDevTest(
        { row: 6, col: 4, direction: "topRight" },
        { row: 3, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Attack"], ["Move"]);
      return runDevTestTick();
    },
    expect: (state) => (
      isAdjacentTile(state.player.row, state.player.col, state.enemy.row, state.enemy.col) &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "intent-target-fallback",
    label: "Intent fallback",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "bottomLeft", movementMode: "Dodge" },
        { row: 4, col: 4, direction: "bottomLeft" },
        { row: 4, col: 3, direction: "topRight" },
      );
      queueDevTestActions(["Move"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === UNIT_MAX_HEALTH &&
      state.playerSupport.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "dead-target",
    label: "Dead target",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight", health: 0 },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions([], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === 0 &&
      state.player.isDefeated &&
      state.enemy.health === 10
    ),
  },
  {
    id: "corpse-layer",
    label: "Corpse layer",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 5, col: 4, direction: "bottomLeft", health: 0, type: "wolf" },
      );
      return getDevTestState();
    },
    expect: (state) => (
      state.player.row === state.enemy.row &&
      state.player.col === state.enemy.col &&
      !state.player.isDefeated &&
      state.enemy.isDefeated &&
      state.player.zIndex > state.enemy.zIndex
    ),
  },
  {
    id: "enemy-extra-actions",
    label: "Enemy extras",
    run: async () => {
      resetDevTest(
        { row: 9, col: 4, direction: "topRight" },
        { row: 0, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Move", "Move", "Move"]);
      return runDevTestTurn();
    },
    expect: (state) => (
      state.player.row === 6 &&
      state.player.col === 4 &&
      state.enemy.row === 5 &&
      state.enemy.col === 4 &&
      state.enemy.actionQueue.length === 0
    ),
  },
  {
    id: "support-only-attack",
    label: "Support attacks",
    run: async () => {
      resetDevTest(
        {},
        { row: 4, col: 4, direction: "bottomLeft" },
        { row: 5, col: 4, direction: "topRight" },
      );
      getUnitActionQueue(playerSupport).push("Attack");
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === UNIT_MAX_HEALTH &&
      state.playerSupport.actionQueue.length === 0 &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE
    ),
  },
  {
    id: "player-shared-action-cap",
    label: "Players: 5-action cap",
    run: async () => {
      resetDevTest();
      const results = [
        queueUnitAction(player, "Move"),
        queueUnitAction(player, "Attack"),
        queueUnitAction(player, "Defend"),
        queueUnitAction(playerSupport, "Move"),
        queueUnitAction(playerSupport, "Attack"),
        queueUnitAction(playerSupport, "Defend"),
      ];

      return { ...getDevTestState(), capResults: results };
    },
    expect: (state) => (
      state.playerQueuedActionTotal === ACTION_QUEUE_SLOT_COUNT &&
      state.player.actionQueue.length === 3 &&
      state.playerSupport.actionQueue.length === 2 &&
      state.capResults.slice(0, ACTION_QUEUE_SLOT_COUNT).every(Boolean) &&
      state.capResults[ACTION_QUEUE_SLOT_COUNT] === false
    ),
  },
  {
    id: "both-players-attack",
    label: "Both players attack",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "topRight" },
        { row: 4, col: 4, direction: "bottomLeft" },
        { row: 4, col: 3, direction: "bottomRight" },
      );
      getUnitActionQueue(player).push("Attack");
      getUnitActionQueue(playerSupport).push("Attack");
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.actionQueue.length === 0 &&
      state.playerSupport.actionQueue.length === 0 &&
      state.enemy.health === UNIT_MAX_HEALTH - UNIT_ATTACK_DAMAGE * 2
    ),
  },
  {
    id: "pack-action-cap",
    label: "Pack: 5-action cap",
    run: async () => {
      resetDevTest();
      planEnemyPackTurn(
        units.filter((u) => u.team === "enemy"),
        units.filter((u) => u.team === "player"),
      );
      return getDevTestState();
    },
    expect: (state) => state.enemyPackQueue.length === 5,
  },
  {
    id: "pack-focus-weaker",
    label: "Pack: focus weaker",
    run: async () => {
      resetDevTest({}, {}, { health: 3 });
      planEnemyPackTurn(
        units.filter((u) => u.team === "enemy"),
        units.filter((u) => u.team === "player"),
      );
      return getDevTestState();
    },
    expect: (state) => (
      state.enemyPackFocusTarget !== null &&
      state.enemyPackFocusTarget.row === state.playerSupport.row &&
      state.enemyPackFocusTarget.col === state.playerSupport.col
    ),
  },
  {
    id: "pack-attack-non-focus-adjacent",
    label: "Pack: attack non-focus adjacent",
    run: async () => {
      resetDevTest(
        {},
        { row: 7, col: 2, health: 3 },
        { health: 1 },
        { row: 8, col: 4, health: 3 },
        {},
        { row: 8, col: 7, health: UNIT_MAX_HEALTH },
      );
      planEnemyPackTurn(
        units.filter((u) => u.team === "enemy"),
        units.filter((u) => u.team === "player"),
      );
      return getDevTestState();
    },
    expect: (state) => (
      state.enemyPackFocusTarget !== null &&
      state.enemyPackFocusTarget.row === state.playerSupport.row &&
      state.enemyPackQueue.some((entry) => (
        entry.action === "Attack" &&
        entry.unitRow === state.enemyFlank.row &&
        entry.unitCol === state.enemyFlank.col
      ))
    ),
  },
  {
    id: "pack-both-attack",
    label: "Pack: both attack",
    run: async () => {
      resetDevTest({ row: 5, col: 4, direction: "topRight" });
      queueDevTestPackActions([
        { unitId: "enemy", action: "Attack" },
        { unitId: "enemySupport", action: "Attack" },
      ]);
      resetUnitForDev(enemy, { row: 4, col: 3, direction: "bottomRight" });
      resetUnitForDev(enemySupport, { row: 4, col: 5, direction: "bottomLeft" });
      renderEnemyPackIntentTags();
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.health === 4 &&
      state.enemyPackQueue.length === 0
    ),
  },
  {
    id: "pack-multi-tick",
    label: "Pack: multi-tick",
    run: async () => {
      resetDevTest();
      planEnemyPackTurn(
        units.filter((u) => u.team === "enemy"),
        units.filter((u) => u.team === "player"),
      );
      return runDevTestTurn();
    },
    expect: (state) => (
      state.enemyPackQueue.length === 0 &&
      state.enemy.row > 0
    ),
  },
  {
    id: "pack-one-enemy",
    label: "Pack: 1 enemy",
    run: async () => {
      resetDevTest({}, {}, null, { health: 0 });
      planEnemyPackTurn(
        units.filter((u) => u.team === "enemy"),
        units.filter((u) => u.team === "player"),
      );
      return getDevTestState();
    },
    expect: (state) => (
      state.enemyPackQueue.length > 0 &&
      state.enemyPackQueue.length <= 5 &&
      state.enemyPackQueue.every((entry) => entry.unitRow === 0 && entry.unitCol === 4)
    ),
  },
  {
    // Regression: an engaging wolf must end its move ON its surround slot (the
    // attack-range tile beside the player), not one tile short. The pond removes
    // the cardinal slot below the player so the slot is the diagonal (4,7);
    // pre-fix the wolf stopped at (5,7), out of range, and its Attack whiffed.
    id: "pack-engage-reaches-slot",
    label: "Pack: engage reaches slot",
    run: async () => {
      setArenaTileCount(18);
      resetDevTest(
        { row: 3, col: 8, direction: "topLeft", movementMode: "Dodge" },
        { row: 7, col: 7, direction: "topRight" },
        { isActive: false },
        { isActive: false },
        { isActive: false },
        { isActive: false },
      );
      planEnemyPackTurn(
        units.filter((unit) => unit.team === "enemy"),
        units.filter((unit) => unit.team === "player"),
      );
      const state = await runDevTestTick();
      setArenaTileCount(DEFAULT_GRID_SIZE); // restore so later scenarios are unaffected
      return state;
    },
    expect: (state) => isAdjacentTile(
      state.enemy.row,
      state.enemy.col,
      state.player.row,
      state.player.col,
    ),
  },
  {
    // Regression: a pack plan is drawn once per turn, split across whoever is
    // alive at that instant. If two packmates die mid-turn, the survivor must
    // get a fresh plan reflecting the new pack size instead of replaying a
    // stale "Defend" queued back when it was competing with two packmates for
    // the doctrine's Move/Attack slots.
    id: "pack-replans-after-teammate-deaths",
    label: "Pack: replans after teammate deaths",
    run: async () => {
      resetDevTest(
        { row: 5, col: 5, direction: "topLeft" },
        { row: 5, col: 6, direction: "bottomLeft", health: 1 },
        { row: 5, col: 1, direction: "topRight", isActive: true },
        { row: 5, col: 2, direction: "bottomRight", health: 1, isActive: true },
        { isActive: false },
        { row: 5, col: 14, direction: "bottomLeft", isActive: true },
      );
      queueDevTestPackActions([
        { unitId: "enemy", action: "Defend" },
        { unitId: "enemySupport", action: "Defend" },
        { unitId: "enemyFlank", action: "Defend" },
      ]);
      getUnitActionQueue(player).push("Attack");
      getUnitActionQueue(playerSupport).push("Attack");
      return runDevTestTick();
    },
    expect: (state) => (
      state.enemy.isDefeated &&
      state.enemySupport.isDefeated &&
      state.enemyPackQueue.length > 0 &&
      state.enemyPackQueue.some((entry) => entry.action === "Move")
    ),
  },
  {
    id: "world-corner-math",
    label: "World: corner math + opposites cancel",
    run: async () => {
      const world = createWorld();
      const moves = WORLD_CORNERS.map((corner) => neighborCoord(0, 0, corner));
      // From home, walk a corner then its opposite and land back home.
      expandToCorner(world, "topRight");
      expandToCorner(world, "bottomLeft");
      return { moves, x: world.x, y: world.y };
    },
    expect: (state) => (
      state.moves.length === 4 &&
      // Every corner lands on a distinct neighbour cell.
      new Set(state.moves.map((m) => worldCoordKey(m.x, m.y))).size === 4 &&
      // topRight then bottomLeft returns to the origin.
      state.x === 0 && state.y === 0
    ),
  },
  {
    id: "world-expand-battle",
    label: "World: fresh cell starts a battle",
    run: async () => {
      const world = createWorld();
      const result = expandToCorner(world, "topRight");
      return {
        isBattle: result.isBattle,
        cleared: result.node.cleared,
        nodeCount: Object.keys(world.nodes).length,
      };
    },
    expect: (state) => (
      state.isBattle === true &&
      state.cleared === false &&
      // home + the newly created cell.
      state.nodeCount === 2
    ),
  },
  {
    id: "world-win-clears-cell",
    label: "World: winning clears the current cell",
    run: async () => {
      const world = createWorld();
      const before = expandToCorner(world, "topLeft");
      clearCurrentWorldCell(world);
      const after = getCurrentWorldNode(world);
      return { wasBattle: before.isBattle, clearedAfter: after.cleared };
    },
    expect: (state) => state.wasBattle === true && state.clearedAfter === true,
  },
  {
    id: "world-revisit-safe",
    label: "World: re-entering a cleared cell is safe passage",
    run: async () => {
      const world = createWorld();
      expandToCorner(world, "topRight"); // into a fresh cell (battle)
      clearCurrentWorldCell(world); // win it
      expandToCorner(world, "topRight"); // push out to a new frontier cell
      clearCurrentWorldCell(world);
      const back = expandToCorner(world, "bottomLeft"); // step back onto cleared ground
      return { isBattle: back.isBattle, x: world.x, y: world.y };
    },
    expect: (state) => state.isBattle === false && state.x === 1 && state.y === 0,
  },
  {
    id: "world-difficulty-scales",
    label: "World: difficulty scales with distance",
    run: async () => {
      const world = createWorld();
      const near = expandToCorner(world, "topRight").node; // distance 1
      const far = expandToCorner(world, "topRight").node; // distance 2
      return { home: getWorldNode(world, 0, 0).difficulty, near: near.difficulty, far: far.difficulty };
    },
    expect: (state) => state.home === 0 && state.near === 1 && state.far === 2,
  },
  {
    id: "world-safe-passage-nav",
    label: "World: navigating onto cleared ground stays on the map",
    run: async () => {
      // Drive the live loop: clear home, push out and clear a frontier cell,
      // then step back onto cleared ground — chooseCorner should relocate and
      // re-render the map (no battle) rather than start an arena.
      worldState = createWorld();
      clearCurrentWorldCell(worldState); // win home (0,0)
      expandToCorner(worldState, "topRight"); // into (1,0)
      clearCurrentWorldCell(worldState); // win it
      renderWorldMap(); // render path must not throw against the DOM
      await chooseCorner("bottomLeft"); // safe passage back to cleared (0,0)
      const result = { x: worldState.x, y: worldState.y };
      worldState = createWorld(); // restore a fresh run
      return result;
    },
    expect: (state) => state.x === 0 && state.y === 0,
  },
  {
    id: "world-terrain-seeded",
    label: "World: terrain is deterministic per seed",
    run: async () => {
      generateTerrain(8, 12345);
      const a = JSON.stringify(terrainTiles);
      generateTerrain(8, 12345);
      const b = JSON.stringify(terrainTiles);
      generateTerrain(8, 99999);
      const c = JSON.stringify(terrainTiles);
      // Restore the live arena's terrain for any later scenario.
      const node = getCurrentWorldNode(worldState);
      generateTerrain(GRID_SIZE, node?.seed ?? null, node?.x ?? 0, node?.y ?? 0, true);
      return { sameSeedMatches: a === b, diffSeedDiffers: a !== c };
    },
    expect: (state) => state.sameSeedMatches === true && state.diffSeedDiffers === true,
  },
  {
    id: "world-bounds-cap",
    label: "World: cannot expand past the edge",
    run: async () => {
      worldState = createWorld();
      // Walk to the +x edge.
      for (let i = 0; i < WORLD_MAX_DISTANCE; i += 1) {
        expandToCorner(worldState, "topRight");
        clearCurrentWorldCell(worldState);
      }
      const edgeX = worldState.x;
      const blocked = expandToCorner(worldState, "topRight"); // would exceed the bound
      const afterX = worldState.x;
      worldState = createWorld(); // restore a fresh run
      return { edgeX, blockedIsNull: blocked === null, afterX };
    },
    expect: (state) => (
      state.edgeX === WORLD_MAX_DISTANCE &&
      state.blockedIsNull === true &&
      state.afterX === WORLD_MAX_DISTANCE
    ),
  },
  {
    id: "world-marker-facing",
    label: "World: marker faces the way the pack travelled",
    run: async () => {
      worldState = createWorld();
      expandToCorner(worldState, "topRight");
      const afterTopRight = worldState.facing;
      expandToCorner(worldState, "topLeft");
      const afterTopLeft = worldState.facing;
      worldState = createWorld();
      return { afterTopRight, afterTopLeft };
    },
    expect: (state) => (
      state.afterTopRight === "topRight" && state.afterTopLeft === "topLeft"
    ),
  },
  {
    id: "world-eight-directions",
    label: "World: eight travel directions, diagonal facing mapped",
    run: async () => {
      const coords = WORLD_MOVE_KEYS.map((d) => neighborCoord(0, 0, d));
      const distinct = new Set(coords.map((c) => worldCoordKey(c.x, c.y))).size;
      const w = createWorld();
      expandToCorner(w, "top"); // vertex neighbour: up-and-in-world (1,1)
      return {
        count: WORLD_MOVE_KEYS.length,
        distinct,
        topX: w.x,
        topY: w.y,
        topFacing: w.facing,
      };
    },
    expect: (state) => (
      state.count === 8 &&
      state.distinct === 8 &&
      state.topX === 1 && state.topY === 1 &&
      state.topFacing === "topRight"
    ),
  },
  {
    id: "obstacles-block-movement",
    label: "Obstacles: water and hill are both impassable",
    run: async () => {
      const savedPond = pondTileKeys;
      const savedHill = hillTileKeys;
      pondTileKeys = new Set([getGridPositionKey(4, 4)]);
      hillTileKeys = new Set([getGridPositionKey(4, 5)]);
      const state = {
        water: isBlockedTile(4, 4),
        hill: isBlockedTile(4, 5),
        open: isBlockedTile(4, 6),
      };
      pondTileKeys = savedPond;
      hillTileKeys = savedHill;
      return state;
    },
    expect: (state) => state.water === true && state.hill === true && state.open === false,
  },
  {
    id: "hill-blocks-line-of-sight",
    label: "Hill: blocks line of sight, clear elsewhere, symmetric",
    run: async () => {
      const savedHill = hillTileKeys;
      hillTileKeys = new Set([
        getGridPositionKey(5, 5),
        getGridPositionKey(5, 6),
        getGridPositionKey(6, 5),
      ]);
      const state = {
        blocked: hasLineOfSight(3, 5, 8, 5), // line crosses the hill
        clear: hasLineOfSight(7, 7, 7, 3), // open row, no hill
        symmetric: hasLineOfSight(3, 5, 8, 5) === hasLineOfSight(8, 5, 3, 5),
      };
      hillTileKeys = savedHill;
      return state;
    },
    expect: (state) => state.blocked === false && state.clear === true && state.symmetric === true,
  },
  {
    id: "hidden-player-remains-pack-focus",
    label: "Stealth: pack pursues a player hidden behind a hill",
    run: async () => {
      // One enemy at top-centre; two players below. A hill sits between the enemy
      // and the near player only. The concealed player remains the best target.
      setEnemyMode("wolves"); // a prior scenario may have left stag mode active
      resetDevTest(
        { row: 6, col: 5, direction: "topRight" },
        { row: 0, col: 5, direction: "bottomLeft" },
        { row: 9, col: 9, direction: "topRight" },
        { isActive: false },
        { isActive: false },
        { isActive: false },
      );
      const savedHill = hillTileKeys;
      hillTileKeys = new Set([getGridPositionKey(3, 5)]); // between enemy(6,5) and player(0,5)
      refreshHiddenStates();
      const nearHidden = isUnitHidden(player);
      const farVisible = !isUnitHidden(playerSupport);
      // Concealment must not remove the nearer player from target selection.
      planEnemyPackTurn(
        units.filter((unit) => unit.team === "enemy"),
        units.filter((unit) => unit.team === "player"),
      );
      const focusIsNear = enemyPackFocusTarget === player;
      hillTileKeys = savedHill;
      return { nearHidden, farVisible, focusIsNear };
    },
    expect: (state) => state.nearHidden === true && state.farVisible === true && state.focusIsNear === true,
  },
  {
    id: "water-field-tiles-seamlessly",
    label: "Water: global field tiles arenas with no overlap",
    run: async () => {
      const seen = new Set();
      let overlap = 0;
      for (const [nx, ny] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
        for (let r = 0; r < GRID_SIZE; r += 1) {
          for (let c = 0; c < GRID_SIZE; c += 1) {
            const { gx, gy } = worldTileToGlobal(nx, ny, r, c);
            const key = `${gx},${gy}`;
            if (seen.has(key)) {
              overlap += 1;
            } else {
              seen.add(key);
            }
          }
        }
      }
      return { overlap, deterministic: isWorldWater(3, 7) === isWorldWater(3, 7) };
    },
    expect: (state) => state.overlap === 0 && state.deterministic === true,
  },
];

const INTERACTION_DEV_TEST_SCENARIO_IDS = [
  "friendly-follow-vacated",
  "friendly-stationary-blocker",
  "same-tile-contest-partial",
  "approach-contest-player-wins",
  "approach-contest-attack",
  "hunt-flanks-friendly-blocker",
  "crossing-paths",
  "adjacent-swap",
  "corpse-layer",
  "post-move-contact",
  "intent-target-fallback",
];

async function runDevTestScenario(scenarioId) {
  const scenario = DEV_TEST_SCENARIOS.find((item) => item.id === scenarioId);

  if (!scenario) {
    throw new Error(`Unknown dev test scenario: ${scenarioId}`);
  }

  // Mechanics scenarios assume a clear board; suppress the seeded hill/water for
  // the whole scenario (including any arena resize that re-stamps terrain) so a
  // stray obstacle can't derail a movement/pack test.
  devTestObstaclesDisabled = true;
  clearArenaObstacles();

  try {
    const state = await scenario.run();
    const passed = scenario.expect(state);

    return {
      id: scenario.id,
      label: scenario.label,
      passed,
      state,
    };
  } finally {
    devTestObstaclesDisabled = false;
  }
}

function setDevTestStatus(message, statusClass = "") {
  if (!devTestStatus) {
    return;
  }

  devTestStatus.classList.remove("is-pass", "is-fail");

  if (statusClass) {
    devTestStatus.classList.add(statusClass);
  }

  devTestStatus.textContent = message;
}

function setupDevTestControls() {
  if (!devTestScenariosList) {
    return;
  }

  const scenarios = getInteractionDevTestScenarios();
  const buttons = scenarios.map((scenario) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ui-button dev-test-button";
    button.dataset.devTestScenario = scenario.id;

    const labelSpan = document.createElement("span");
    labelSpan.textContent = scenario.label;

    const indicatorSpan = document.createElement("span");
    indicatorSpan.className = "dev-test-indicator";

    button.append(labelSpan, indicatorSpan);

    button.addEventListener("click", async () => {
      if (isExecutingActionQueue) {
        return;
      }

      setDevTestStatus(`Running ${scenario.label}...`);
      setDevTestButtonsDisabled(true);

      try {
        const result = await runDevTestScenario(scenario.id);
        setDevTestButtonResult(button, indicatorSpan, result.passed);
        setDevTestStatus(
          `${result.passed ? "PASS" : "FAIL"}: ${scenario.label}`,
          result.passed ? "is-pass" : "is-fail",
        );
      } catch (error) {
        setDevTestButtonResult(button, indicatorSpan, false);
        setDevTestStatus(`ERROR: ${error.message}`, "is-fail");
      } finally {
        setDevTestButtonsDisabled(false);
      }
    });

    return button;
  });

  const runAllButton = createRunAllInteractionChecksButton(buttons, scenarios);
  const toolbar = document.createElement("div");

  toolbar.className = "dev-test-toolbar";
  toolbar.append(runAllButton);
  devTestScenariosList.replaceChildren(toolbar, ...buttons);
}

function getInteractionDevTestScenarios() {
  return INTERACTION_DEV_TEST_SCENARIO_IDS
    .map((scenarioId) => DEV_TEST_SCENARIOS.find((scenario) => scenario.id === scenarioId))
    .filter(Boolean);
}

function createRunAllInteractionChecksButton(buttons, scenarios) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "ui-button dev-test-run-all";
  button.textContent = "Run all";

  button.addEventListener("click", async () => {
    if (isExecutingActionQueue) {
      return;
    }

    setDevTestStatus("Running interaction checks...");
    setDevTestButtonsDisabled(true);
    clearDevTestButtonResults(buttons);

    let failedResult = null;

    try {
      for (let index = 0; index < scenarios.length; index += 1) {
        const scenario = scenarios[index];
        const scenarioButton = buttons[index];
        const indicator = scenarioButton.querySelector(".dev-test-indicator");

        setDevTestStatus(`Running ${scenario.label}...`);

        try {
          const result = await runDevTestScenario(scenario.id);

          setDevTestButtonResult(scenarioButton, indicator, result.passed);

          if (!result.passed && !failedResult) {
            failedResult = result;
          }
        } catch (error) {
          setDevTestButtonResult(scenarioButton, indicator, false);
          failedResult = {
            label: scenario.label,
            passed: false,
            error,
          };
          break;
        }
      }

      if (failedResult) {
        const errorSuffix = failedResult.error ? `: ${failedResult.error.message}` : "";

        setDevTestStatus(`FAIL: ${failedResult.label}${errorSuffix}`, "is-fail");
        return;
      }

      setDevTestStatus(`PASS: ${scenarios.length} interaction checks`, "is-pass");
    } finally {
      setDevTestButtonsDisabled(false);
    }
  });

  return button;
}

function clearDevTestButtonResults(buttons) {
  buttons.forEach((button) => {
    const indicator = button.querySelector(".dev-test-indicator");

    button.classList.remove("is-pass", "is-fail");

    if (indicator) {
      indicator.textContent = "";
    }
  });
}

function setDevTestButtonResult(button, indicator, passed) {
  button.classList.remove("is-pass", "is-fail");
  button.classList.add(passed ? "is-pass" : "is-fail");

  if (indicator) {
    indicator.textContent = passed ? "✓" : "✗";
  }
}

function setDevTestButtonsDisabled(disabled) {
  devTestScenariosList.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
}

function syncArenaSizeControl(message = "") {
  if (arenaSizeInput) {
    arenaSizeInput.min = String(MIN_GRID_SIZE);
    arenaSizeInput.max = String(MAX_GRID_SIZE);
    arenaSizeInput.value = String(GRID_SIZE);
  }

  if (arenaSizeStatus) {
    arenaSizeStatus.textContent = message || `${GRID_SIZE} x ${GRID_SIZE} tiles`;
  }
}

function setArenaTileCount(tileCount) {
  if (isExecutingActionQueue || hasMovingPlayerUnits()) {
    syncArenaSizeControl("Wait for movement to finish");
    return false;
  }

  const nextGridSize = clampArenaSize(tileCount);

  if (nextGridSize === GRID_SIZE) {
    syncArenaSizeControl(`${GRID_SIZE} x ${GRID_SIZE} tiles`);
    return true;
  }

  GRID_SIZE = nextGridSize;
  updateArenaMetrics();
  setHoveredTile(null);
  setPlayerSelected(null);
  buildArena();
  resetDevTest();
  refillAvailableActions();
  updateEnemyIntentPreview();
  resizeArena();
  syncArenaSizeControl(`${GRID_SIZE} x ${GRID_SIZE} tiles`);
  return true;
}

function setupArenaSizeControls() {
  syncArenaSizeControl();

  if (!arenaSizeInput || !applyArenaSizeButton) {
    return;
  }

  applyArenaSizeButton.addEventListener("click", () => {
    setArenaTileCount(arenaSizeInput.value);
  });

  arenaSizeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    setArenaTileCount(arenaSizeInput.value);
  });
}

function syncEnemyModeControls() {
  enemyModeButtons.forEach((button) => {
    const isActive = button.dataset.enemyMode === enemyMode;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = isExecutingActionQueue;
  });
}

function setEnemyMode(nextMode) {
  if (isExecutingActionQueue || !ENEMY_MODES.includes(nextMode)) {
    syncEnemyModeControls();
    return false;
  }

  enemyMode = nextMode;
  setPlayerSelected(null);
  resetDevTest();
  buildArena();
  updateEnemyIntentPreview();
  updatePlayerActionControls();
  updateActiveDirection(getDevPreviewUnit().direction);
  updateAnimationControls();
  syncEnemyModeControls();
  return true;
}

function setupEnemyModeControls() {
  syncEnemyModeControls();

  enemyModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setEnemyMode(button.dataset.enemyMode);
    });
  });
}

window.devTest = {
  reset: resetDevTest,
  queue: queueDevTestActions,
  queuePack: queueDevTestPackActions,
  runTick: runDevTestTick,
  runTurn: runDevTestTurn,
  runScenario: runDevTestScenario,
  scenarios: DEV_TEST_SCENARIOS.map(({ id, label }) => ({ id, label })),
  setEnemyMode,
  setArenaSize: setArenaTileCount,
  state: getDevTestState,
  world: () => worldState,
  openWorldMap,
  chooseCorner,
  exportHillLayout: buildHillLayoutExport,
  loadHillLayout,
};

function getTileFromEvent(event) {
  return event.target.closest(".tile");
}

function movePlayerFromTileElement(tile) {
  if (!tile) {
    return;
  }

  movePlayerToTile(Number(tile.dataset.row), Number(tile.dataset.col), {
    unit: getSelectedPlayerUnit() ?? player,
  });
}

function isPlayerTile(tile) {
  return Boolean(getFriendlyUnitAtTile(tile));
}

function getFriendlyUnitAtTile(tile) {
  if (!tile) {
    return null;
  }

  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);

  return getAliveUnitsByTeam("player").find((unit) => unit.row === row && unit.col === col) ?? null;
}

function isFriendlyTile(tile) {
  if (!tile) {
    return false;
  }

  return isFriendlyPosition(Number(tile.dataset.row), Number(tile.dataset.col));
}

function isEnemyTile(tile) {
  if (!tile) {
    return false;
  }

  return isEnemyPosition(Number(tile.dataset.row), Number(tile.dataset.col));
}

function isEnemyPosition(row, col) {
  return units.some((unit) => isUnitAlive(unit) && unit.team === "enemy" && unit.row === row && unit.col === col);
}

function isFriendlyPosition(row, col) {
  return units.some((unit) => isUnitAlive(unit) && unit.team === "player" && unit.row === row && unit.col === col);
}

function setDevToolsEnabled(enabled) {
  isDevToolsEnabled = enabled;
  devToolsToggle?.classList.toggle("is-active", enabled);
  devToolsToggle?.setAttribute("aria-pressed", String(enabled));

  if (debugControls) {
    debugControls.hidden = !enabled;
  }

  if (!enabled) {
    setHoveredTile(null);
    arena.classList.add("tile-numbers-hidden");
    toggleTileNumbers?.classList.remove("is-active");
    toggleTileNumbers?.setAttribute("aria-pressed", "false");
  }
}

function handleTileIntent(tile) {
  if (isExecutingActionQueue) {
    return;
  }

  if (!tile) {
    return;
  }

  const friendlyUnit = getFriendlyUnitAtTile(tile);

  if (friendlyUnit) {
    setPlayerSelected(friendlyUnit === getSelectedPlayerUnit() ? null : friendlyUnit);
    return;
  }

  if (isFriendlyTile(tile)) {
    return;
  }

  if (isEnemyTile(tile)) {
    return;
  }

  if (!isDevToolsEnabled) {
    if (getSelectedPlayerUnit()) {
      setPlayerSelected(null);
    }

    return;
  }

  if (getSelectedPlayerUnit()) {
    setPlayerSelected(null);
  }

  movePlayerFromTileElement(tile);
}

animationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const unit = getDevPreviewUnit();
    playUnitAnimation(unit, button.dataset.animation, true);
  });
});

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const unit = getDevPreviewUnit();
    unit.direction = button.dataset.direction;
    updateActiveDirection(unit.direction);
    playUnitAnimation(unit, unit.animationName, true);
    if (unit.team === "player") {
      updatePlayerMovePreview();
    }
  });
});

const devRotateButton = document.getElementById("dev-rotate");
if (devRotateButton) {
  devRotateButton.addEventListener("click", () => rotateDevPreviewUnitClockwise());
}

buildArena();
resetDevTest(); // place units at their spawns and clear obstacle/boxed-in cells (as startArena does)
refillAvailableActions();
updateReshuffleControl();
renderActionQueue(getSelectedPlayerUnit());
resizeArena();
updatePlayerTileLabels();
updateActiveDirection(player.direction);
setupDevTestControls();
setupArenaSizeControls();
setupEnemyModeControls();
updateEnemyIntentPreview();
updateAnimationControls();
units.forEach((unit) => {
  if (isUnitActive(unit)) {
    playUnitAnimation(unit, "idle", unit === getDevPreviewUnit());
  }
});

if (executeQueueButton) {
  executeQueueButton.addEventListener("click", executePlayerActionQueue);
}

if (reshuffleButton) {
  reshuffleButton.addEventListener("click", reshuffleActions);
}

if (restartButton) {
  restartButton.addEventListener("click", resetGame);
}

if (tutorialToggle && tutorialOverlay) {
  // Step 1 is the intro popup (#tutorial-overlay). "Got it" launches the guided
  // coachmark tour below, each step spotlighting one live UI element.
  const GUIDED_STEPS = [
    {
      label: "Next",
      body: "These are your wolves — click one to give it orders.",
      getTarget: () => getAliveUnitsByTeam("player")[0]?.element ?? null,
      onEnter: () => {
        const unit = getAliveUnitsByTeam("player")[0];
        if (unit) setPlayerSelected(unit);
      },
    },
    {
      label: "Next",
      body: "Give this wolf an order: <strong>Move</strong>, <strong>Attack</strong>, or <strong>Defend</strong> — up to 5 per wolf.",
      getTarget: () => document.querySelector(".player-action-menu"),
      onEnter: ensureFirstWolfSelected,
    },
    {
      label: "Rrrrr",
      body: "Each Move has a style: <strong>Hunt</strong> (toward the enemy), <strong>Flank</strong> (to their side), or <strong>Dodge</strong> (away).",
      getTarget: () => document.querySelector(".movement-mode-selector"),
      onEnter: ensureFirstWolfSelected,
    },
    {
      label: "Woof",
      body: "Those orders come from your <strong>Actions Inventory</strong> — a limited, shared hand dealt fresh actions each round, so plan around what you've got.",
      getTarget: () => document.querySelector("#actions-list"),
      onEnter: () => setPlayerSelected(null),
    },
    {
      label: "Sniff sniff",
      body: "Not the hand you wanted? Spend a <strong>Reshuffle</strong> to redraw.",
      getTarget: () => document.querySelector("#reshuffle-actions"),
      onEnter: () => setPlayerSelected(null),
    },
    {
      label: "Hooooow",
      body: "Above each enemy wolf you can see the actions they've planned for the turn. Read them and set up your counter.",
      getTarget: () => {
        const enemies = getAliveUnitsByTeam("enemy");
        // Prefer an enemy whose plan includes a Move so the highlighted intent is illustrative.
        const enemy = enemies.find((unit) => getEnemyPackActionsForUnit(unit).includes("Move")) ?? enemies[0];
        if (!enemy) return null;
        return enemy.intentTags && !enemy.intentTags.hidden ? enemy.intentTags : enemy.element;
      },
      onEnter: () => {
        setPlayerSelected(null);
        updateEnemyIntentPreview();
      },
    },
    {
      label: "Let's go",
      body: "Plan all your wolves, then hit <strong>Play</strong> — the whole turn resolves at once.",
      getTarget: () => document.querySelector("#execute-queue"),
      onEnter: () => setPlayerSelected(null),
    },
  ];

  let guidedStepIndex = -1;

  function ensureFirstWolfSelected() {
    if (getSelectedPlayerUnit()) return;
    const unit = getAliveUnitsByTeam("player")[0];
    if (unit) setPlayerSelected(unit);
  }

  function setIntroOpen(isOpen) {
    tutorialOverlay.hidden = !isOpen;
  }

  function isGuidedActive() {
    return guidedStepIndex >= 0;
  }

  function positionSpotlight(target) {
    if (!tutorialSpotlight) return;

    if (!target) {
      tutorialSpotlight.hidden = true;
      return;
    }

    const pad = 8;
    const rect = target.getBoundingClientRect();
    tutorialSpotlight.hidden = false;
    tutorialSpotlight.style.left = `${rect.left - pad}px`;
    tutorialSpotlight.style.top = `${rect.top - pad}px`;
    tutorialSpotlight.style.width = `${rect.width + pad * 2}px`;
    tutorialSpotlight.style.height = `${rect.height + pad * 2}px`;
  }

  function positionCoachCard(target) {
    if (!tutorialCoachCard) return;

    const margin = 16;
    const gap = 18;
    const card = tutorialCoachCard.getBoundingClientRect();
    const cw = card.width;
    const ch = card.height;
    let left;
    let top;

    if (!target) {
      left = (window.innerWidth - cw) / 2;
      top = (window.innerHeight - ch) / 2;
    } else {
      const rect = target.getBoundingClientRect();

      if (rect.right + gap + cw + margin <= window.innerWidth) {
        left = rect.right + gap;
        top = rect.top + rect.height / 2 - ch / 2;
      } else if (rect.left - gap - cw - margin >= 0) {
        left = rect.left - gap - cw;
        top = rect.top + rect.height / 2 - ch / 2;
      } else if (rect.bottom + gap + ch + margin <= window.innerHeight) {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - cw / 2;
      } else {
        top = rect.top - gap - ch;
        left = rect.left + rect.width / 2 - cw / 2;
      }
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - cw - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - ch - margin));
    tutorialCoachCard.style.left = `${left}px`;
    tutorialCoachCard.style.top = `${top}px`;
  }

  function layoutCurrentStep() {
    if (!isGuidedActive()) return;
    const step = GUIDED_STEPS[guidedStepIndex];
    const target = step.getTarget?.() ?? null;
    if (target) target.scrollIntoView({ block: "center", inline: "center" });
    positionSpotlight(target);
    positionCoachCard(target);
  }

  function renderGuidedStep() {
    const step = GUIDED_STEPS[guidedStepIndex];
    if (tutorialCoachBody) tutorialCoachBody.innerHTML = step.body;
    if (tutorialNextButton) tutorialNextButton.textContent = step.label;
    if (tutorialCoachProgress) {
      tutorialCoachProgress.textContent = `${guidedStepIndex + 1} / ${GUIDED_STEPS.length}`;
    }
    step.onEnter?.();
    // Reveal layers, then position after layout settles (onEnter may open the menu).
    if (tutorialCoachCatcher) tutorialCoachCatcher.hidden = false;
    if (tutorialCoachCard) tutorialCoachCard.hidden = false;
    requestAnimationFrame(layoutCurrentStep);
  }

  function startGuidedTutorial() {
    setIntroOpen(false);
    isGuidedTutorialActive = true;
    guidedStepIndex = 0;
    seedTutorialActionHand();
    window.addEventListener("resize", layoutCurrentStep);
    renderGuidedStep();
  }

  function advanceGuidedTutorial() {
    if (guidedStepIndex + 1 >= GUIDED_STEPS.length) {
      endGuidedTutorial();
      return;
    }
    guidedStepIndex += 1;
    renderGuidedStep();
  }

  function endGuidedTutorial() {
    isGuidedTutorialActive = false;
    guidedStepIndex = -1;
    window.removeEventListener("resize", layoutCurrentStep);
    if (tutorialSpotlight) tutorialSpotlight.hidden = true;
    if (tutorialCoachCard) tutorialCoachCard.hidden = true;
    if (tutorialCoachCatcher) tutorialCoachCatcher.hidden = true;
    setPlayerSelected(null);
  }

  tutorialToggle.addEventListener("click", () => setIntroOpen(true));

  if (tutorialCloseButton) {
    tutorialCloseButton.addEventListener("click", startGuidedTutorial);
  }

  if (tutorialNextButton) {
    tutorialNextButton.addEventListener("click", advanceGuidedTutorial);
  }

  if (tutorialSkipButton) {
    tutorialSkipButton.addEventListener("click", endGuidedTutorial);
  }

  // The intro overlay can be dismissed by backdrop click (does not start the tour).
  tutorialOverlay.addEventListener("click", (event) => {
    if (event.target === tutorialOverlay) setIntroOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (isGuidedActive()) {
      endGuidedTutorial();
    } else if (!tutorialOverlay.hidden) {
      setIntroOpen(false);
    }
  });
}

if (copyBattleDebugButton) {
  copyBattleDebugButton.addEventListener("click", copyLastBattleDebugReport);
  updateBattleDebugControls();
}

actionQueueList.addEventListener("click", (event) => {
  event.stopPropagation();

  const unitButton = event.target.closest("[data-player-timeline-unit]");
  const removeButton = event.target.closest("[data-action-index]");

  if (unitButton) {
    const unit = getPlayerUnitById(unitButton.dataset.playerTimelineUnit);

    if (unit) {
      setPlayerSelected(unit === getSelectedPlayerUnit() ? null : unit);
    }

    return;
  }

  if (!removeButton) {
    return;
  }

  const unit = getPlayerUnitById(removeButton.dataset.unitId);

  if (unit) {
    removeUnitActionAt(unit, Number(removeButton.dataset.actionIndex));
  }
});

arena.addEventListener("click", (event) => {
  if (event.target.closest(".player-action-menu")) {
    return;
  }

  // Hill-editor mode intercepts every tile click for drawing (ignores units).
  if (isHillEditMode) {
    const editTile = getTileFromPointerEvent(event);
    if (editTile) {
      cycleHillTileAt(Number(editTile.dataset.row), Number(editTile.dataset.col));
      event.stopPropagation();
    }
    return;
  }

  const tile = getTileFromPointerEvent(event);
  const clickedFriendlyUnit = getFriendlyUnitAtTile(tile) ?? getFriendlyUnitFromPointerEvent(event);

  if (clickedFriendlyUnit) {
    setPlayerSelected(clickedFriendlyUnit === getSelectedPlayerUnit() ? null : clickedFriendlyUnit);
    event.stopPropagation();
    return;
  }

  const selectedUnit = getSelectedPlayerUnit();

  if (selectedUnit && isPointerInsideUnit(selectedUnit, event)) {
    setPlayerSelected(null);
    event.stopPropagation();
    return;
  }

  handleTileIntent(tile);

  if (isPlayerTile(tile)) {
    event.stopPropagation();
  }
});

document.addEventListener("click", (event) => {
  // The guided tutorial drives selection itself; don't let stray clicks deselect.
  if (isGuidedTutorialActive) {
    return;
  }

  if (event.target.closest(".player-action-menu, .action-queue-panel")) {
    return;
  }

  if (getSelectedPlayerUnit()) {
    setPlayerSelected(null);
  }
});

arena.addEventListener("mousemove", (event) => {
  setHoveredTile(getTileFromPointerEvent(event));
});

arena.addEventListener("mouseleave", () => {
  setHoveredTile(null);
});

arena.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const tile = getTileFromEvent(event);

  if (!tile) {
    return;
  }

  event.preventDefault();
  handleTileIntent(tile);
});

const toggleTileNumbers = document.getElementById("toggle-tile-numbers");
if (toggleTileNumbers) {
  toggleTileNumbers.addEventListener("click", () => {
    const hidden = document.getElementById("arena").classList.toggle("tile-numbers-hidden");
    toggleTileNumbers.classList.toggle("is-active", !hidden);
    toggleTileNumbers.setAttribute("aria-pressed", String(!hidden));
  });
}

const hillEditorToggle = document.getElementById("hill-editor-toggle");
const hillEditorStatus = document.getElementById("hill-editor-status");
if (hillEditorToggle) {
  hillEditorToggle.addEventListener("click", () => {
    const on = !isHillEditMode;
    setHillEditMode(on);
    hillEditorToggle.classList.toggle("is-active", on);
    hillEditorToggle.setAttribute("aria-pressed", String(on));
    if (hillEditorStatus) {
      hillEditorStatus.textContent = on
        ? "On — click a tile: none → 1 → 2 → none."
        : "Off. Click a tile to cycle none → 1 → 2 → none.";
    }
  });
}

const copyHillsButton = document.getElementById("copy-hills");
if (copyHillsButton) {
  copyHillsButton.addEventListener("click", async () => {
    const layout = buildHillLayoutExport();
    const text = JSON.stringify(layout, null, 2);
    const setStatus = (message) => {
      if (hillEditorStatus) {
        hillEditorStatus.textContent = message;
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!copyTextWithSelectionFallback(text)) {
        throw new Error("Clipboard copy failed");
      }
      setStatus(`Copied ${layout.hills.length} hill(s).`);
    } catch (error) {
      if (copyTextWithSelectionFallback(text)) {
        setStatus(`Copied ${layout.hills.length} hill(s).`);
      } else {
        window.lastHillLayout = layout;
        setStatus("Copy failed — layout is at window.lastHillLayout.");
      }
    }
  });
}

const fillMoveActionsButton = document.getElementById("fill-move-actions");
if (fillMoveActionsButton) {
  fillMoveActionsButton.addEventListener("click", () => {
    if (isExecutingActionQueue) {
      return;
    }

    fillAvailableActions("Move");
  });
}

if (devToolsToggle) {
  devToolsToggle.addEventListener("click", () => {
    setDevToolsEnabled(!isDevToolsEnabled);
  });
}

// Resolution demos: set up a clean 1v1 and play one tick so you can watch how
// move-before-attack resolves and whether a "Miss" popup appears over the attacker.
const resolutionDemoStatus = document.getElementById("resolution-demo-status");

function setResolutionDemoStatus(message) {
  if (resolutionDemoStatus) {
    resolutionDemoStatus.textContent = message;
  }
}

async function runResolutionDemo({ player: playerSetup, enemy: enemySetup, playerActions = [], enemyActions = [], status }) {
  if (isExecutingActionQueue) {
    return;
  }

  // Guarantee an enemy wolf to attack, and isolate to a single 1v1 pair.
  if (enemyMode !== "wolves") {
    setEnemyMode("wolves");
  }

  const inactive = { isActive: false };

  resetDevTest(playerSetup, enemySetup, inactive, inactive, inactive, inactive);
  queueDevTestActions(playerActions, enemyActions);
  setResolutionDemoStatus(`${status} — watch…`);
  await runDevTestTick();
  setResolutionDemoStatus(status);
}

const winFightButton = document.getElementById("dev-win-fight");
if (winFightButton) {
  winFightButton.addEventListener("click", () => devEndFight(true));
}

const loseFightButton = document.getElementById("dev-lose-fight");
if (loseFightButton) {
  loseFightButton.addEventListener("click", () => devEndFight(false));
}

const dodgeMissButton = document.getElementById("demo-dodge-miss");
if (dodgeMissButton) {
  dodgeMissButton.addEventListener("click", () => runResolutionDemo({
    // Player is adjacent, flees (Dodge mode); the enemy's queued attack whiffs.
    player: { row: 5, col: 4, direction: "bottomLeft", movementMode: "Dodge" },
    enemy: { row: 4, col: 4, direction: "bottomLeft" },
    playerActions: ["Move"],
    enemyActions: ["Attack"],
    status: 'Dodge → enemy "Miss"',
  }));
}

const swingMissButton = document.getElementById("demo-swing-miss");
if (swingMissButton) {
  swingMissButton.addEventListener("click", () => runResolutionDemo({
    // Player swings with no enemy in range → "Miss" over the player.
    player: { row: 8, col: 4, direction: "topRight" },
    enemy: { row: 0, col: 4, direction: "bottomLeft" },
    playerActions: ["Attack"],
    enemyActions: [],
    status: 'Swing at air → player "Miss"',
  }));
}

const stepHitButton = document.getElementById("demo-step-hit");
if (stepHitButton) {
  stepHitButton.addEventListener("click", () => runResolutionDemo({
    // Player steps into adjacency this tick; the enemy's queued attack connects.
    player: { row: 8, col: 4, direction: "topRight" },
    enemy: { row: 4, col: 4, direction: "bottomLeft" },
    playerActions: ["Move"],
    enemyActions: ["Attack"],
    status: "Step in → enemy hits (-3)",
  }));
}

const pathfindingDemoStatus = document.getElementById("pathfinding-demo-status");

function setPathfindingDemoStatus(message) {
  if (pathfindingDemoStatus) {
    pathfindingDemoStatus.textContent = message;
  }
}

// Pathfinding demo: drops a mover and its idle target on OPPOSITE sides of the
// static pond (rows 4-7 / cols 8-11) with the target dead ahead, then runs a
// full turn so the shared move scorer has to route the mover AROUND the water.
// Pre-fix the mover froze in front of the pond; post-fix it rounds it.
const PATHFINDING_DEMO_GRID_SIZE = 18;
async function runPathfindingDemo({ mover, status }) {
  if (isExecutingActionQueue) {
    return;
  }

  // Force an 18x18 board: at 18 the pond is a free-standing obstacle with open
  // ground on BOTH sides, so rounding it is a genuine choice (at 12 the pond
  // hugs the right edge, forcing a one-sided detour). Also keeps the hard-coded
  // positions on-grid and the pond present.
  if (GRID_SIZE !== PATHFINDING_DEMO_GRID_SIZE) {
    setArenaTileCount(PATHFINDING_DEMO_GRID_SIZE);
  }

  // A single 1v1 pair keeps the routing unit unambiguous (no pack swarm).
  if (enemyMode !== "wolves") {
    setEnemyMode("wolves");
  }

  const inactive = { isActive: false };
  const below = { row: 8, col: 9, direction: "topRight" }; // south of the pond
  const above = { row: 3, col: 9, direction: "bottomLeft" }; // north of the pond
  const queuedMoves = ["Move", "Move", "Move", "Move", "Move"]; // 5 ticks ≈ 15 tiles, ample for the detour

  if (mover === "enemy") {
    // Enemy wolf (north) hunts the idle player (south) around the pond.
    resetDevTest(below, above, inactive, inactive, inactive, inactive);
    queueDevTestActions([], queuedMoves);
  } else {
    // Player in Hunt mode (south) chases the idle enemy (north) around the pond.
    resetDevTest({ ...below, movementMode: "Hunt" }, above, inactive, inactive, inactive, inactive);
    queueDevTestActions(queuedMoves, []);
  }

  setPathfindingDemoStatus(`${status} — watch it round the pond…`);
  await runDevTestTurn();
  setPathfindingDemoStatus(status);
}

const pathfindingPlayerButton = document.getElementById("demo-pathfinding-player");
if (pathfindingPlayerButton) {
  pathfindingPlayerButton.addEventListener("click", () => runPathfindingDemo({
    mover: "player",
    status: "Player Hunt rounds the pond",
  }));
}

const pathfindingEnemyButton = document.getElementById("demo-pathfinding-enemy");
if (pathfindingEnemyButton) {
  pathfindingEnemyButton.addEventListener("click", () => runPathfindingDemo({
    mover: "enemy",
    status: "Enemy AI rounds the pond",
  }));
}

window.addEventListener("resize", resizeArena);
window.addEventListener("resize", positionPlayerActionMenu);
window.addEventListener("resize", () => {
  if (worldStage?.classList.contains("is-zoomed-out")) {
    renderWorldMap();
  }
});
