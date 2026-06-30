const DEFAULT_GRID_SIZE = 12;
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

// Pond: a static, impassable water feature. The shape is hand-placed (not
// random) to keep the board deterministic, tucked against the quiet right-mid
// edge — clear of the spawn rows (0 and 11) and the central travel lane — so
// wolves rarely need to route through it. (Movement path-builders stop at
// water, but the AI scores goals by straight-line distance and would otherwise
// stall walking into the shoreline.)
const POND_LAYOUT = [
  [4, 9], [4, 10],
  [5, 8], [5, 9], [5, 10], [5, 11],
  [6, 8], [6, 9], [6, 10], [6, 11],
  [7, 9], [7, 10], [7, 11],
];

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

function isPondTile(row, col) {
  return pondTileKeys.has(getGridPositionKey(row, col));
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

function pickTerrainTile(type) {
  if (type === TERRAIN_DIRT) {
    return DIRT_BASE_TILES[Math.floor(Math.random() * DIRT_BASE_TILES.length)];
  }

  if (Math.random() < GRASS_DECOR_CHANCE) {
    return GRASS_DECOR_TILES[Math.floor(Math.random() * GRASS_DECOR_TILES.length)];
  }

  return GRASS_BASE_TILES[Math.floor(Math.random() * GRASS_BASE_TILES.length)];
}

function oppositeTerrain(type) {
  return type === TERRAIN_GRASS ? TERRAIN_DIRT : TERRAIN_GRASS;
}

// Build a coarse lattice of random values, then sample it with smooth
// (bilinear + smoothstep) interpolation so the field varies gradually. Returns
// a grid of terrain TYPES (grass/dirt), not yet resolved to tile sprites.
function generateTerrainTypes(size) {
  const latticeSize = Math.ceil(size / TERRAIN_NOISE_SCALE) + 2;
  const lattice = [];

  for (let y = 0; y <= latticeSize; y += 1) {
    const rowValues = [];
    for (let x = 0; x <= latticeSize; x += 1) {
      rowValues.push(Math.random());
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

function generateTerrain(size) {
  const types = generateTerrainTypes(size);
  smoothLoneTiles(types, size);

  terrainTiles = types.map((typeRow, row) =>
    typeRow.map((type, col) => {
      // Grass cells touching dirt get the blended edge tile; everything else
      // picks a normal tile from its terrain pool.
      if (type === TERRAIN_GRASS && hasNeighbourOfType(types, size, row, col, TERRAIN_DIRT)) {
        return GRASS_EDGE_TILES[Math.floor(Math.random() * GRASS_EDGE_TILES.length)];
      }

      return pickTerrainTile(type);
    }),
  );

  stampPond(size);

  return terrainTiles;
}

// Paint the static pond onto the freshly-generated terrain: rebuild the
// impassable-tile set, autotile each pond cell's water sprite from its land
// edges, then force every non-pond neighbour (8-way) to grass so the pond sits
// in a green frame instead of butting against random dirt patches. Pond cells
// outside the current grid (e.g. a smaller dev arena) are simply skipped.
function stampPond(size) {
  pondTileKeys = new Set();

  POND_LAYOUT.forEach(([row, col]) => {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      pondTileKeys.add(getGridPositionKey(row, col));
    }
  });

  pondTileKeys.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    terrainTiles[row][col] = getPondTileForCell(row, col, size);
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

// Choose a single pond cell's water sprite by which of its four isometric edges
// border land (an on-board, non-pond neighbour). Off-board neighbours count as
// open water, so the pond ends cleanly at the board edge with no phantom shore.
function getPondTileForCell(row, col, size) {
  const groundEdges = POND_EDGE_DIRECTIONS.filter((direction) => {
    const delta = DIRECTION_TILE_DELTAS[direction];
    const r = row + delta.row;
    const c = col + delta.col;

    return r >= 0 && r < size && c >= 0 && c < size && !isPondTile(r, c);
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
    packObjective: null,
    isDefeated: false,
    hasPlayedDeathAnimation: false,
    deathAnimationPromise: null,
    animationFrameRequest: null,
    movementFrameRequest: null,
    animationComplete: null,
    animationStartedAt: 0,
    animationName: "idle",
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

function randomAction() {
  return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
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

  const newItems = Array.from({ length: emptySlotCount }, (_, index) => {
    const item = createAvailableActionItem(randomAction());
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
  const hand = [...ACTIONS, ...Array.from({ length: fillerCount }, randomAction)];

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

const WORLD_CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const WORLD_CORNER_DELTAS = {
  topRight: { x: 1, y: 0 },
  bottomLeft: { x: -1, y: 0 },
  topLeft: { x: 0, y: 1 },
  bottomRight: { x: 0, y: -1 },
};

function worldCoordKey(x, y) {
  return `${x},${y}`;
}

// Manhattan distance from home (0, 0) — the tunable basis for difficulty.
function worldNodeDistance(x, y) {
  return Math.abs(x) + Math.abs(y);
}

// Deterministic per-cell encounter so a node looks the same every time you
// revisit it. Tunable; v1 sprinkles stag duels through a mostly-wolf world.
function pickEnemyModeForNode(x, y) {
  const hash = Math.abs((x * 73856093) ^ (y * 19349663));
  return hash % 3 === 0 ? "stag" : "wolves";
}

function createWorldNode(x, y, overrides = {}) {
  return {
    x,
    y,
    cleared: false,
    enemyMode: pickEnemyModeForNode(x, y),
    difficulty: worldNodeDistance(x, y),
    ...overrides,
  };
}

// Fresh run: the home cell (0, 0) is the first fight, using the default enemy
// so it matches the arena the game boots into. Winning it opens the map.
function createWorld() {
  const world = { x: 0, y: 0, nodes: {} };
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

function neighborCoord(x, y, corner) {
  const delta = WORLD_CORNER_DELTAS[corner];

  if (!delta) {
    throw new Error(`Unknown corner: ${corner}`);
  }

  return { x: x + delta.x, y: y + delta.y };
}

// Move the pack into the neighbouring cell for the chosen corner, creating that
// node the first time it's reached. Returns the node and whether entering it
// starts a battle (uncleared) or is safe passage (already cleared).
function expandToCorner(world, corner) {
  const { x, y } = neighborCoord(world.x, world.y, corner);
  const key = worldCoordKey(x, y);

  if (!world.nodes[key]) {
    world.nodes[key] = createWorldNode(x, y);
  }

  world.x = x;
  world.y = y;

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

const worldMapOverlay = document.querySelector("#world-map-overlay");
const worldMapGrid = document.querySelector("#world-map-grid");
const CORNER_ARROWS = {
  topLeft: "↖",
  topRight: "↗",
  bottomRight: "↘",
  bottomLeft: "↙",
};

// Tear down the current arena and build the one described by a world node:
// fresh terrain, the node's enemy type, and a full-health pack (arenas are
// self-contained — no carry-over damage).
function startArena(node) {
  hideWorldMap();

  if (gameResultOverlay) {
    gameResultOverlay.hidden = true;
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
  if (worldMapOverlay) {
    worldMapOverlay.hidden = true;
  }
}

function openWorldMap() {
  if (gameResultOverlay) {
    gameResultOverlay.hidden = true;
  }

  renderWorldMap();

  if (worldMapOverlay) {
    worldMapOverlay.hidden = false;
  }
}

// Player picked a corner on the map: walk there. A fresh cell starts a battle;
// a previously-cleared cell is safe passage, so we just stay on the map.
function chooseCorner(corner) {
  const { node, isBattle } = expandToCorner(worldState, corner);

  if (isBattle) {
    startArena(node);
  } else {
    renderWorldMap();
  }
}

// Render the known lattice plus the four corner choices around the current
// cell. The grid is rotated 45° (see CSS) so the four world neighbours read as
// the four screen corners; cell contents are counter-rotated to stay upright.
function renderWorldMap() {
  if (!worldMapGrid) {
    return;
  }

  worldMapGrid.replaceChildren();

  // Every cell to show: known nodes + the four neighbours of the current cell.
  const cells = new Map();
  const addCell = (x, y, extra) => {
    const key = worldCoordKey(x, y);
    cells.set(key, { x, y, ...cells.get(key), ...extra });
  };

  Object.values(worldState.nodes).forEach((node) => addCell(node.x, node.y, { node }));

  WORLD_CORNERS.forEach((corner) => {
    const { x, y } = neighborCoord(worldState.x, worldState.y, corner);
    addCell(x, y, { corner, node: getWorldNode(worldState, x, y) });
  });

  const list = [...cells.values()];
  const xs = list.map((c) => c.x);
  const ys = list.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  worldMapGrid.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, var(--world-cell-size, 56px))`;
  worldMapGrid.style.gridTemplateRows = `repeat(${maxY - minY + 1}, var(--world-cell-size, 56px))`;

  list.forEach(({ x, y, node, corner }) => {
    const isCurrent = x === worldState.x && y === worldState.y;
    const isCleared = Boolean(node && node.cleared);
    const isChoice = Boolean(corner) && !isCurrent;

    const cell = document.createElement(isChoice ? "button" : "div");
    cell.className = "world-cell";
    cell.style.gridColumn = String(x - minX + 1);
    cell.style.gridRow = String(maxY - y + 1);
    cell.classList.toggle("is-current", isCurrent);
    cell.classList.toggle("is-cleared", isCleared);
    cell.classList.toggle("is-choice", isChoice);
    cell.classList.toggle("is-battle", isChoice && !isCleared);

    const content = document.createElement("span");
    content.className = "world-cell-content";

    if (isCurrent) {
      content.textContent = "You";
    } else if (isChoice) {
      const arrow = CORNER_ARROWS[corner] ?? "";
      content.textContent = isCleared ? `${arrow} Safe` : `${arrow} Fight`;
      cell.type = "button";
      cell.addEventListener("click", () => chooseCorner(corner));
    } else if (isCleared) {
      content.textContent = "✓";
    }

    cell.append(content);
    worldMapGrid.append(cell);
  });
}

function buildArena() {
  const tileLayer = document.createElement("div");
  const unitLayer = document.createElement("div");

  tileElements.length = 0;
  playerMovePreviewTile = null;
  playerActionMenu?.remove();
  tileLayer.className = "tile-layer";
  unitLayer.className = "unit-layer";

  generateTerrain(GRID_SIZE);

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
  setUnitPosition(unit, anchorX, anchorY);
  updateUnitDepth(unit);
  unitLayer.append(unit.element, unit.healthBar, unit.intentTags);
  updateUnitHealthBar(unit);
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

  const visibleActions = actions.slice(0, ACTION_QUEUE_SLOT_COUNT);
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

  if (unit === getSelectedPlayerUnit()) {
    positionPlayerActionMenu();
  }
}

function updateUnitDepth(unit) {
  const liveUnitDepth = GRID_SIZE * 2 + unit.row + unit.col + 20;

  unit.element.style.zIndex = unit.isDefeated ? liveUnitDepth - 2 : liveUnitDepth;
  updateUnitHealthBarDepth(unit);
  updateUnitIntentTagsDepth(unit);

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
      isPondTile(nextRow, nextCol) ||
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
      isPondTile(nextRow, nextCol) ||
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
    isPondTile(targetRow, targetCol)
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
          isPondTile(nextRow, nextCol) ||
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

  enemyPackFocusTarget = getBestPackFocusTarget(aliveEnemies, alivePlayers);

  const plannedStates = new Map(aliveEnemies.map((unit) => [
    unit,
    { row: unit.row, col: unit.col, direction: unit.direction },
  ]));

  assignEnemyPackObjectives(aliveEnemies, enemyPackFocusTarget, alivePlayers, plannedStates);

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
      alivePlayers,
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
      !isPondTile(row, col) &&
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

  return isGridPosition(row, col) && !isPondTile(row, col)
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

    if (!isGridPosition(nextRow, nextCol) || isPondTile(nextRow, nextCol) || blockingUnit) {
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
  setUnitAnimationSprite(unit, animationName);
  setUnitFrame(unit, 0);

  if (shouldUpdateButtons) {
    updateAnimationControls(unit);
  }

  const animate = (timestamp) => {
    const elapsed = timestamp - unit.animationStartedAt;
    const absoluteFrame = Math.floor(elapsed / animation.frameMs);
    const sequenceIndex = absoluteFrame % getUnitAnimationFrameCount(animation);
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
  const movementMode = snapshot.movementMode ? ` mode ${snapshot.movementMode}` : "";
  const queue = includeQueue ? ` queue: ${snapshot.queue.length ? snapshot.queue.join(", ") : "-"}` : "";

  return `${snapshot.id} ${snapshot.label} hp ${snapshot.health}/${snapshot.maxHealth}${defeated} at ${formatBattleDebugPosition(snapshot)} facing ${snapshot.direction}${movementMode}${queue}`;
}

function beginBattleDebugLog() {
  activeBattleDebugLog = {
    enemyMode,
    gridSize: GRID_SIZE,
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
      return `${getBattleDebugUnitName(unit)} Move ${movement}`;
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

function getFriendlyFocusTarget(friendlyUnit = player) {
  return getAliveUnitsByTeam("enemy")
    .sort((unit, otherUnit) => {
      return (
        getGridDistance(friendlyUnit.row, friendlyUnit.col, unit.row, unit.col) -
        getGridDistance(friendlyUnit.row, friendlyUnit.col, otherUnit.row, otherUnit.col)
      );
    })[0] ?? enemy;
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
    !isPondTile(position.row, position.col) &&
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

  if (!objective) {
    return getHuntMovePlanFromSnapshot(movingUnit, focusTarget, startStates, { ignoredBlockingUnits });
  }

  if (objective.mode === "flee") {
    const nearestPlayer = getNearestUnitByDistance(
      movingUnit,
      getAliveUnitsByTeam("player"),
      startStates,
    );

    if (!nearestPlayer) {
      return getHuntMovePlanFromSnapshot(movingUnit, focusTarget, startStates, { ignoredBlockingUnits });
    }

    return getMovementModeMovePlanFromSnapshot(movingUnit, nearestPlayer, startStates, "Dodge", {
      ignoredBlockingUnits,
    });
  }

  const goal = getEnemyPackGoalPosition(movingUnit, focusTarget);

  if (!goal) {
    return getHuntMovePlanFromSnapshot(movingUnit, focusTarget, startStates, { ignoredBlockingUnits });
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
  const isSlotGoal = goal.row !== focusTarget.row || goal.col !== focusTarget.col;

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
    return fallbackPlan;
  }

  return getModeMovePlanFromTargetState(movingUnit, targetStartState, startStates, movementMode, {
    actionQueue,
    ignoredBlockingUnits,
  });
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

  return candidate
    ? {
      unit: movingUnit,
      path: candidate.path,
      target: { ...candidate.target, direction: candidate.direction },
    }
    : fallbackPlan;
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
      isPondTile(nextRow, nextCol) ||
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

function getDefaultDevUnitSetup(team, role = "primary") {
  const centerCol = clampGridCoordinate(Math.floor((GRID_SIZE - 1) / 2));
  const roleOffsets = {
    primary: 0,
    support: team === "player" ? -2 : 2,
    flank: team === "player" ? 3 : -3,
  };
  const col = clampGridCoordinate(centerCol + (roleOffsets[role] ?? 0));

  return {
    row: team === "player" ? GRID_SIZE - 1 : 0,
    col,
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
  updatePlayerTileLabels();
  updateActiveDirection(getDevPreviewUnit().direction);
  renderActionQueue(getSelectedPlayerUnit());
  renderUnitIntentTags(enemy);
  renderUnitIntentTags(enemySupport);
  renderUnitIntentTags(enemyFlank);
  updatePlayerActionControls();
  updateAnimationControls();

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
      chooseCorner("bottomLeft"); // safe passage back to cleared (0,0)
      const result = { x: worldState.x, y: worldState.y };
      worldState = createWorld(); // restore a fresh run
      return result;
    },
    expect: (state) => state.x === 0 && state.y === 0,
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

  const state = await scenario.run();
  const passed = scenario.expect(state);

  return {
    id: scenario.id,
    label: scenario.label,
    passed,
    state,
  };
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
