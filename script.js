const GRID_SIZE = 10;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;
const WOLF_FRAME_SIZE = 64;
const ISO_X_STEP = TILE_WIDTH / 2;
const ISO_Y_STEP = TILE_HEIGHT / 4;
const TILE_MAX_INDEX = 40;
const TILE_OPAQUE_TOP = 8;
const TILE_OPAQUE_FULL_TOP = 16;
const TILE_OPAQUE_FULL_BOTTOM = 24;
const PLAYER_MOVE_SPEED = 60;
const PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES = 5;
const PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES = 2;
const UNIT_MAX_HEALTH = 10;
const UNIT_ATTACK_DAMAGE = 3;
const UNIT_DEFENDED_DAMAGE = Math.ceil(UNIT_ATTACK_DAMAGE / 3);
const UNIT_HIT_REACTION_MS = 220;
const TILE_PATH = "isometric tileset/separated images";
const WOLF_PATH = "wolf/no effects";
const WOLF_DIRECTIONS = {
  bottomLeft: 0,
  bottomRight: 1,
  topLeft: 2,
  topRight: 3,
};
const ACTIONS = ["Move", "Attack", "Defend"];
const ACTION_SLOT_COUNT = 5;
const ACTION_QUEUE_SLOT_COUNT = 5;
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
const CLOSE_ICON = "assets/icons/close.svg";
const ROTATE_ICON = "assets/icons/rotate.svg";
const CLOCKWISE_DIRECTIONS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const PLAYER_MOVEMENT_MODES = ["Sneak", "Dodge", "Flank", "Hunt"];
const DEFAULT_PLAYER_MOVEMENT_MODE = "Hunt";

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
const actionsList = document.querySelector("#actions-list");
const actionQueueList = document.querySelector("#action-queue-list");
const executeQueueButton = document.querySelector("#execute-queue");
const devToolsToggle = document.querySelector("#toggle-dev-tools");
const debugControls = document.querySelector(".debug-controls");
const devTestScenariosList = document.querySelector("#dev-test-scenarios");
const devTestStatus = document.querySelector("#dev-test-status");
const gameResultOverlay = document.querySelector("#game-result-overlay");
const restartButton = document.querySelector("#restart-button");
const tileElements = [];
const unitActionQueues = new WeakMap();
let hoveredTile = null;
let selectedPlayerUnit = null;
let isDevToolsEnabled = false;
let playerActionMenu = null;
let playerMovePreview = null;
let playerMovePreviewTile = null;
let isExecutingActionQueue = false;

const boardWidth = (GRID_SIZE + GRID_SIZE) * ISO_X_STEP;
const boardHeight = (GRID_SIZE + GRID_SIZE - 2) * ISO_Y_STEP + TILE_HEIGHT;
const xOffset = boardWidth / 2;
const player = createWolf({ row: 9, col: 4, direction: "topRight", team: "player" });
const playerSupport = createWolf({ row: 9, col: 2, direction: "topRight", team: "player" });
const enemy = createWolf({ row: 0, col: 4, direction: "bottomLeft", team: "enemy" });
const enemySupport = createWolf({ row: 0, col: 6, direction: "bottomLeft", team: "enemy" });
const units = [player, playerSupport, enemy, enemySupport];
const enemyPackActionQueue = [];
let enemyPackFocusTarget = null;

const wolfAnimations = {
  idle: { file: "wolf-idle.png", frames: 4, frameMs: 180 },
  run: { file: "wolf-run.png", frames: 8, frameMs: 95 },
  bite: { file: "wolf-bite.png", frames: 15, frameMs: 70 },
  howl: { file: "wolf-howl.png", frames: 9, frameMs: 115 },
  death: { file: "wolf-death.png", frames: 12, frameMs: 105 },
};
const wolfAnimationPreloads = new Map(
  Object.keys(wolfAnimations).map((animationName) => [
    animationName,
    preloadWolfAnimation(animationName),
  ]),
);

document.documentElement.style.setProperty("--arena-width", `${boardWidth}px`);
document.documentElement.style.setProperty("--arena-height", `${boardHeight}px`);

function hasQueuedPlayerActions() {
  return getQueuedPlayerActionTotal() > 0;
}

function hasMovingPlayerUnits() {
  return getAliveUnitsByTeam("player").some((unit) => unit.movementFrameRequest !== null);
}

function getPlayerTimelineUnits() {
  return [player, playerSupport];
}

function getQueuedPlayerActionTotal() {
  return getPlayerTimelineUnits().reduce((total, unit) => total + getUnitActionQueue(unit).length, 0);
}

function randomTileSrc() {
  const index = Math.floor(Math.random() * (TILE_MAX_INDEX + 1));
  return `${TILE_PATH}/tile_${String(index).padStart(3, "0")}.png`;
}

function projectTile(row, col) {
  return {
    x: (col - row) * ISO_X_STEP + xOffset,
    y: (col + row) * ISO_Y_STEP,
  };
}

function createWolf({ row, col, direction, team, movementMode = DEFAULT_PLAYER_MOVEMENT_MODE }) {
  return {
    element: document.createElement("div"),
    healthBar: null,
    intentTags: null,
    row,
    col,
    direction,
    movementMode,
    team,
    health: UNIT_MAX_HEALTH,
    maxHealth: UNIT_MAX_HEALTH,
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

function fillAvailableActions(action) {
  const items = Array.from({ length: ACTION_SLOT_COUNT }, () => createAvailableActionItem(action));

  actionsList.replaceChildren(...items);
  updatePlayerActionControls();
}

function addAvailableAction(action) {
  actionsList.prepend(createAvailableActionItem(action));
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
  return "";
}

function getPlayerUnitById(unitId) {
  if (unitId === "player") return player;
  if (unitId === "playerSupport") return playerSupport;
  return null;
}

function getPlayerUnitLabel(unit) {
  return unit === playerSupport ? "support wolf" : "lead wolf";
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
    chip.textContent = unit === playerSupport ? "P2" : "P1";

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
  const rotateButton = createPlayerRotateButton();

  menu.className = "player-action-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Player wolf actions");
  menu.append(movementModeSelector, rotateButton);

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

function createPlayerRotateButton() {
  const button = document.createElement("button");
  const label = document.createElement("span");

  button.type = "button";
  button.className = "ui-button action-button player-rotate-button";
  button.dataset.playerRotate = "clockwise";
  button.setAttribute("aria-label", "Rotate player wolf clockwise");
  label.className = "action-label";
  label.textContent = "Rotate";
  button.append(createIcon(ROTATE_ICON, "action-icon"), label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    rotatePlayerClockwise();
  });

  return button;
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
            item.style.animation = "";
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

  playerActionMenu.querySelectorAll("[data-player-rotate]").forEach((button) => {
    button.disabled = isExecutingActionQueue || !selectedUnit || selectedUnit.movementFrameRequest !== null;
  });

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
  updateActiveDirection((selectedPlayerUnit ?? player).direction);
  updatePlayerActionControls();
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
  playWolfAnimation(selectedUnit, selectedUnit.animationName, true);
  updatePlayerMovePreview();
  updateEnemyIntentPreview();
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
      label = `Enemy wolf occupies tile ${tileNumber}`;
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

function buildArena() {
  const tileLayer = document.createElement("div");
  const unitLayer = document.createElement("div");

  tileElements.length = 0;
  tileLayer.className = "tile-layer";
  unitLayer.className = "unit-layer";

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

      img.src = randomTileSrc();
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

  units.forEach((unit) => {
    placeWolf(unitLayer, unit);
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

function placeWolf(unitLayer, wolf) {
  const tilePosition = projectTile(wolf.row, wolf.col);
  const anchorX = tilePosition.x;
  const anchorY = tilePosition.y + TILE_HEIGHT / 2;

  wolf.element.className = "unit wolf";
  wolf.healthBar = createUnitHealthBar();
  wolf.intentTags = createUnitIntentTags();
  setWolfPosition(wolf, anchorX, anchorY);
  updateWolfDepth(wolf);
  unitLayer.append(wolf.element, wolf.healthBar, wolf.intentTags);
  updateUnitHealthBar(wolf);
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

function getTileAnchor(row, col) {
  const tilePosition = projectTile(row, col);

  return {
    x: tilePosition.x,
    y: tilePosition.y + TILE_HEIGHT / 2,
  };
}

function setWolfPosition(wolf, x, y) {
  wolf.x = x;
  wolf.y = y;
  wolf.element.style.left = `${x}px`;
  wolf.element.style.top = `${y}px`;
  positionUnitHealthBar(wolf);
  positionUnitIntentTags(wolf);

  if (wolf === getSelectedPlayerUnit()) {
    positionPlayerActionMenu();
  }
}

function updateWolfDepth(wolf) {
  wolf.element.style.zIndex = GRID_SIZE * 2 + wolf.row + wolf.col + 20;
  updateUnitHealthBarDepth(wolf);
  updateUnitIntentTagsDepth(wolf);

  if (wolf === getSelectedPlayerUnit()) {
    positionPlayerActionMenu();
  }
}

function createPlayerMovePreview() {
  const preview = document.createElement("div");

  preview.className = "unit wolf move-preview";
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

  playerMovePreview.style.backgroundImage = `url("${getWolfAnimationSrc("idle")}")`;
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

function setWolfFrame(wolf, frameIndex, directionRow) {
  const x = frameIndex * WOLF_FRAME_SIZE;
  const y = directionRow * WOLF_FRAME_SIZE;

  wolf.element.style.backgroundPosition = `-${x}px -${y}px`;
}

function updateActiveButton(animationName) {
  animationButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.animation === animationName);
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

function isPointerInsideWolf(wolf, event) {
  const rect = wolf.element.getBoundingClientRect();

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
    .filter((unit) => isPointerInsideWolf(unit, event))
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

function isUnitAlive(unit) {
  return !unit.isDefeated && unit.health > 0;
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
    return unit.row === row && unit.col === col && (includeDefeated || isUnitAlive(unit));
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

    if (!isGridPosition(nextRow, nextCol) || getBlockingUnitAtPosition(nextRow, nextCol)) {
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

function renderEnemyPackIntentTags(enemyUnits = units.filter((unit) => unit.team === "enemy")) {
  enemyUnits.forEach((unit) => {
    renderUnitIntentTags(unit, getEnemyPackActionsForUnit(unit));
  });
}

function planEnemyPackTurn(enemyUnits, playerUnits) {
  const aliveEnemies = enemyUnits.filter(isUnitAlive);
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

function getBestEnemyPackAction(
  enemyUnits,
  focusTarget,
  plannedStates,
  reservedMoveTargets,
  plannedActions,
  doctrinePool,
) {
  const attackAssignments = doctrinePool.includes("Attack")
    ? enemyUnits
      .map((unit) => {
        const plannedState = plannedStates.get(unit);

        if (!plannedState || !isAdjacentTile(plannedState.row, plannedState.col, focusTarget.row, focusTarget.col)) {
          return null;
        }

        return {
          action: "Attack",
          score: getGridDistance(unit.row, unit.col, focusTarget.row, focusTarget.col) +
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

function getEnemyPackMoveAssignment(unit, focusTarget, plannedStates, reservedMoveTargets, plannedActions) {
  const plannedState = plannedStates.get(unit);

  if (!plannedState) {
    return null;
  }

  const currentDistance = getGridDistance(plannedState.row, plannedState.col, focusTarget.row, focusTarget.col);
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

    const distance = getGridDistance(target.row, target.col, focusTarget.row, focusTarget.col);
    const improvement = currentDistance - distance;

    if (improvement <= 0) {
      return;
    }

    const assignment = {
      action: "Move",
      direction,
      facingDirection: getFacingDirectionForMove(
        plannedState.row,
        plannedState.col,
        target.row,
        target.col,
        plannedState.direction,
      ),
      score: improvement * 10 -
        distance -
        getDirectionTurnCost(plannedState.direction, getFacingDirectionForMove(
          plannedState.row,
          plannedState.col,
          target.row,
          target.col,
          plannedState.direction,
        )) -
        getPlannedActionCountForUnit(unit, plannedActions) * 5,
      target,
      unit,
    };

    if (!bestAssignment || assignment.score > bestAssignment.score) {
      bestAssignment = assignment;
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

    if (!isGridPosition(nextRow, nextCol) || blockingUnit) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
  }

  return { row: targetRow, col: targetCol };
}

function getPackPlanBlockingUnitAtPosition(row, col, planningUnit, plannedStates) {
  return units.find((unit) => {
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
      playWolfAnimation(enemyUnit, enemyUnit.animationName);
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

function getWolfAnimationSrc(animationName) {
  return `${WOLF_PATH}/${wolfAnimations[animationName].file}`;
}

function preloadWolfAnimation(animationName) {
  const image = new Image();
  const loaded = new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });

  image.src = getWolfAnimationSrc(animationName);

  return {
    image,
    ready: image.decode ? image.decode().catch(() => loaded).then(() => undefined) : loaded,
  };
}

function setWolfAnimationSprite(wolf, animationName) {
  const preload = wolfAnimationPreloads.get(animationName);
  const src = preload?.image.currentSrc || preload?.image.src || getWolfAnimationSrc(animationName);

  wolf.element.style.backgroundImage = `url("${src}")`;
}

function waitForWolfAnimation(animationName) {
  return wolfAnimationPreloads.get(animationName)?.ready ?? Promise.resolve();
}

function stopWolfAnimation(wolf) {
  if (wolf.animationFrameRequest !== null) {
    cancelAnimationFrame(wolf.animationFrameRequest);
    wolf.animationFrameRequest = null;
  }

  if (wolf.animationComplete) {
    wolf.animationComplete();
    wolf.animationComplete = null;
  }
}

function playWolfAnimation(wolf, animationName, shouldUpdateButtons = false) {
  const animation = wolfAnimations[animationName];

  if (!animation) {
    return;
  }

  if (wolf.isDefeated && animationName !== "death") {
    return;
  }

  stopWolfAnimation(wolf);

  wolf.animationName = animationName;
  wolf.animationStartedAt = performance.now();
  setWolfAnimationSprite(wolf, animationName);
  setWolfFrame(wolf, 0, WOLF_DIRECTIONS[wolf.direction]);

  if (shouldUpdateButtons) {
    updateActiveButton(animationName);
  }

  const animate = (timestamp) => {
    const elapsed = timestamp - wolf.animationStartedAt;
    const absoluteFrame = Math.floor(elapsed / animation.frameMs);
    const frameIndex = absoluteFrame % animation.frames;
    const directionRow = WOLF_DIRECTIONS[wolf.direction];

    setWolfFrame(wolf, frameIndex, directionRow);
    wolf.animationFrameRequest = requestAnimationFrame(animate);
  };

  wolf.animationFrameRequest = requestAnimationFrame(animate);
}

async function playWolfAnimationCycles(
  wolf,
  animationName,
  cycleCount = 1,
  { shouldUpdateButtons = false, direction = wolf.direction } = {},
) {
  const animation = wolfAnimations[animationName];

  if (!animation) {
    return Promise.resolve();
  }

  stopWolfAnimation(wolf);
  await waitForWolfAnimation(animationName);

  const directionRow = WOLF_DIRECTIONS[direction] ?? WOLF_DIRECTIONS[wolf.direction];
  const totalFrames = animation.frames * cycleCount;

  wolf.animationName = animationName;
  wolf.animationStartedAt = performance.now();
  setWolfAnimationSprite(wolf, animationName);
  setWolfFrame(wolf, 0, directionRow);

  if (shouldUpdateButtons) {
    updateActiveButton(animationName);
  }

  return new Promise((resolve) => {
    const finish = () => {
      wolf.animationComplete = null;
      wolf.animationFrameRequest = null;
      resolve();
    };

    wolf.animationComplete = finish;

    const animate = (timestamp) => {
      const elapsed = timestamp - wolf.animationStartedAt;
      const absoluteFrame = Math.floor(elapsed / animation.frameMs);

      if (absoluteFrame >= totalFrames) {
        finish();
        return;
      }

      const frameIndex = absoluteFrame % animation.frames;

      setWolfFrame(wolf, frameIndex, directionRow);
      wolf.animationFrameRequest = requestAnimationFrame(animate);
    };

    wolf.animationFrameRequest = requestAnimationFrame(animate);
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

    await playWolfAnimationCycles(unit, "death", 1, {
      direction: unit.direction,
    });

    setWolfAnimationSprite(unit, "death");
    setWolfFrame(unit, wolfAnimations.death.frames - 1, WOLF_DIRECTIONS[unit.direction]);
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

function resetGame() {
  if (gameResultOverlay) gameResultOverlay.hidden = true;
  resetDevTest();
  refillAvailableActions();
  updateEnemyIntentPreview();
}

async function executePlayerActionQueue() {
  if (isExecutingActionQueue || !hasQueuedPlayerActions() || hasMovingPlayerUnits()) {
    updateActionQueueControls();
    return;
  }

  planEnemyPackTurn(
    units.filter((unit) => unit.team === "enemy"),
    units.filter((unit) => unit.team === "player"),
  );
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
    refillAvailableActions();
    renderActionQueue(getSelectedPlayerUnit());
    updateEnemyIntentPreview();
    updatePlayerActionControls();
    getAliveUnitsByTeam("player").forEach((unit) => {
      playWolfAnimation(unit, "idle", unit === player);
    });
    getAliveUnitsByTeam("enemy").forEach((unit) => {
      playWolfAnimation(unit, "idle");
    });

    if (!hasAliveUnitsByTeam("player")) {
      showGameResult(false);
    } else if (!hasAliveUnitsByTeam("enemy")) {
      showGameResult(true);
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

    await playWolfAnimationCycles(unit, actionAnimation.animationName, actionAnimation.cycles, {
      shouldUpdateButtons,
      direction: actionDirection,
    });

    if (action === "Attack") {
      playWolfAnimation(unit, "idle", shouldUpdateButtons);
      const liveTarget = getLiveAttackTarget(unit, attackTarget, startStates);
      const targetIsDefending = tickActions.some((t) => t.unit === liveTarget && t.action === "Defend");
      damageIntents.push({
        attacker: unit,
        target: liveTarget,
        damage: targetIsDefending ? UNIT_DEFENDED_DAMAGE : UNIT_ATTACK_DAMAGE,
      });
    }
  }));

  await resolveTickDamage(damageIntents);

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
        plan = getPlayerMovePlanFromSnapshot(unit, getFriendlyFocusTarget(unit), startStates);
      } else if (unit.team === "enemy") {
        plan = getHuntMovePlanFromSnapshot(unit, getEnemyPackFocusTarget(), startStates);
      } else {
        const path = getMovePathFromSnapshot(
          startState.row,
          startState.col,
          startState.direction,
          MOVE_ACTION_TILE_COUNT,
          unit,
          startStates,
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
  stopMovePlansBeforePathCollisions(movePlans, startStates);

  const targetCounts = new Map();

  movePlans.forEach(({ target }) => {
    const key = getGridPositionKey(target.row, target.col);
    targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
  });

  return new Map(movePlans.map(({ unit, target }) => {
    const targetKey = getGridPositionKey(target.row, target.col);

    if (
      targetCounts.get(targetKey) > 1 &&
      !isAttackIntentEngagementTarget(unit, target, movePlans)
    ) {
      const startState = startStates.get(unit);
      return [unit, { row: startState.row, col: startState.col }];
    }

    return [unit, target];
  }));
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

      const endpoints = getBestAttackIntentEngagementEndpoints(plan, otherPlan, startStates);

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

function getBestAttackIntentEngagementEndpoints(plan, otherPlan, startStates) {
  let bestEndpoints = null;
  let bestScore = -1;

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

      const score = step + otherStep;

      if (score > bestScore) {
        bestScore = score;
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
  { actionQueue = getUnitActionQueue(playerUnit) } = {},
) {
  return getMovementModeMovePlanFromSnapshot(
    playerUnit,
    targetUnit,
    startStates,
    playerUnit.movementMode,
    { actionQueue },
  );
}

function getHuntMovePlanFromSnapshot(movingUnit, targetUnit, startStates) {
  return getMovementModeMovePlanFromSnapshot(movingUnit, targetUnit, startStates, "Hunt");
}

function getMovementModeMovePlanFromSnapshot(
  movingUnit,
  targetUnit,
  startStates,
  movementMode,
  { actionQueue = getUnitActionQueue(movingUnit) } = {},
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

  const context = getUnitMoveContext(movingUnit, targetUnit, startStates, actionQueue);
  const candidate = getMoveCandidateForMode(movementMode, context);

  return candidate
    ? {
      unit: movingUnit,
      path: candidate.path,
      target: { ...candidate.target, direction: candidate.direction },
    }
    : fallbackPlan;
}

function getUnitMoveContext(movingUnit, targetUnit, startStates, actionQueue) {
  const startState = startStates.get(movingUnit);
  const targetStartState = startStates.get(targetUnit);
  const currentDistance = getGridDistance(
    startState.row,
    startState.col,
    targetStartState.row,
    targetStartState.col,
  );
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
  );
  const candidates = getUnitMoveCandidatesFromSnapshot(movingUnit, targetStartState, startStates);

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

function getUnitMoveCandidatesFromSnapshot(movingUnit, targetStartState, startStates) {
  const startState = startStates.get(movingUnit);
  const candidates = [];

  MOVEMENT_DIRECTIONS.forEach((direction) => {
    const path = getMovePathFromSnapshot(
      startState.row,
      startState.col,
      direction,
      MOVE_ACTION_TILE_COUNT,
      movingUnit,
      startStates,
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
      const distance = getGridDistance(
        target.row,
        target.col,
        targetStartState.row,
        targetStartState.col,
      );

      candidates.push({
        direction: facingDirection,
        distance,
        escapeRoutes: getEscapeRouteCountFromSnapshot(
          target.row,
          target.col,
          movingUnit,
          startStates,
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
    case "Hunt":
    default:
      return getHuntMoveCandidate(context);
  }
}

function getHuntMoveCandidate({ candidates, currentDistance }) {
  return candidates
    .filter((candidate) => candidate.distance < currentDistance)
    .sort(compareHuntMoveCandidates)[0] ?? null;
}

function compareHuntMoveCandidates(candidate, otherCandidate) {
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

function getEscapeRouteCountFromSnapshot(row, col, movingUnit, startStates) {
  return Object.values(MOVEMENT_TILE_DELTAS).filter((delta) => {
    const nextRow = row + delta.row;
    const nextCol = col + delta.col;
    const blockingUnit = getBlockingUnitAtSnapshotPosition(nextRow, nextCol, startStates);

    return (
      isGridPosition(nextRow, nextCol) &&
      (!blockingUnit || blockingUnit === movingUnit)
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

function getMovePathFromSnapshot(row, col, direction, tileCount, movingUnit, startStates) {
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
      (blockingUnit && blockingUnit !== movingUnit)
    ) {
      break;
    }

    targetRow = nextRow;
    targetCol = nextCol;
    path.push({ row: targetRow, col: targetCol });
  }

  return path;
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
  const damageByTarget = new Map();

  validIntents.forEach(({ target, damage }) => {
    damageByTarget.set(target, (damageByTarget.get(target) ?? 0) + damage);
  });

  const damageResults = Array.from(damageByTarget.entries()).map(([target, damage]) => {
    return {
      target,
      ...damageUnit(target, damage),
    };
  });

  damageResults.forEach(({ target, damageTaken }) => {
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

function moveUnitToTile(unit, row, col, { direction = null, shouldUpdateButtons = false } = {}) {
  const blockingUnit = getBlockingUnitAtPosition(row, col);

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
  const minRunAnimationDuration =
    wolfAnimations.run.frameMs * PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES;
  const runAnimationStopAt = Math.max(
    minRunAnimationDuration,
    duration - wolfAnimations.run.frameMs * PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES,
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
  updateWolfDepth(unit);

  if (unit === getSelectedPlayerUnit()) {
    updatePlayerMovePreview();
    updateActiveDirection(unit.direction);
  }

  playWolfAnimation(unit, "run", shouldUpdateButtons);

  return new Promise((resolve) => {
    const move = (timestamp) => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = EASING.cubicEaseOut(progress);
      const x = start.x + deltaX * easedProgress;
      const y = start.y + deltaY * easedProgress;

      setWolfPosition(unit, x, y);

      if (!hasStoppedRunAnimation && elapsed >= runAnimationStopAt) {
        hasStoppedRunAnimation = true;
        playWolfAnimation(unit, "idle", shouldUpdateButtons);
      }

      if (progress < 1) {
        unit.movementFrameRequest = requestAnimationFrame(move);
        return;
      }

      unit.movementFrameRequest = null;
      setWolfPosition(unit, target.x, target.y);
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

function resetUnitForDev(unit, setup = {}) {
  const row = setup.row ?? unit.row;
  const col = setup.col ?? unit.col;
  const direction = setup.direction ?? unit.direction;
  const movementMode = setup.movementMode ?? unit.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE;
  const health = setup.health ?? UNIT_MAX_HEALTH;
  const anchor = getTileAnchor(row, col);

  if (unit.movementFrameRequest !== null) {
    cancelAnimationFrame(unit.movementFrameRequest);
    unit.movementFrameRequest = null;
  }

  stopWolfAnimation(unit);
  unit.element.classList.remove("is-hit");
  unit.row = row;
  unit.col = col;
  unit.direction = direction;
  unit.movementMode = movementMode;
  unit.health = Math.max(0, Math.min(unit.maxHealth, health));
  unit.isDefeated = unit.health === 0;
  unit.hasPlayedDeathAnimation = false;
  unit.deathAnimationPromise = null;
  clearUnitActionQueue(unit);
  setWolfPosition(unit, anchor.x, anchor.y);
  updateWolfDepth(unit);
  updateUnitHealthBar(unit);

  if (unit.isDefeated) {
    setWolfAnimationSprite(unit, "death");
    setWolfFrame(unit, wolfAnimations.death.frames - 1, WOLF_DIRECTIONS[unit.direction]);
    unit.animationName = "death";
    unit.hasPlayedDeathAnimation = true;
  } else {
    playWolfAnimation(unit, "idle", unit === player);
  }

  if (unit === getSelectedPlayerUnit()) {
    renderPlayerMovementModeSelector();
  }
}

function resetDevTest(playerSetup = {}, enemySetup = {}, playerSupportSetup = null, enemySupportSetup = null) {
  isExecutingActionQueue = false;
  clearEnemyPackActionQueue();
  setPlayerSelected(null);
  resetUnitForDev(player, {
    row: 9,
    col: 4,
    direction: "topRight",
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
    health: UNIT_MAX_HEALTH,
    ...playerSetup,
  });
  resetUnitForDev(playerSupport, {
    row: 9,
    col: 2,
    direction: "topRight",
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
    health: UNIT_MAX_HEALTH,
    ...(playerSupportSetup ?? {}),
  });
  resetUnitForDev(enemy, {
    row: 0,
    col: 4,
    direction: "bottomLeft",
    health: UNIT_MAX_HEALTH,
    ...enemySetup,
  });
  resetUnitForDev(enemySupport, {
    row: 0,
    col: 6,
    direction: "bottomLeft",
    health: UNIT_MAX_HEALTH,
    ...(enemySupportSetup ?? {}),
  });
  updatePlayerTileLabels();
  updateActiveDirection(player.direction);
  renderActionQueue(getSelectedPlayerUnit());
  renderUnitIntentTags(enemy);
  renderUnitIntentTags(enemySupport);
  updatePlayerActionControls();

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
  const unitMap = { player, playerSupport, enemy, enemySupport };

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

    if (!hasAliveUnitsByTeam("player")) {
      showGameResult(false);
    } else if (!hasAliveUnitsByTeam("enemy")) {
      showGameResult(true);
    }
  }

  return getDevTestState();
}

function getDevTestUnitState(unit) {
  return {
    row: unit.row,
    col: unit.col,
    direction: unit.direction,
    health: unit.health,
    isDefeated: unit.isDefeated,
    animationName: unit.animationName,
    actionQueue: [...getUnitActionQueue(unit)],
  };
}

function getDevTestState() {
  return {
    player: getDevTestUnitState(player),
    playerSupport: getDevTestUnitState(playerSupport),
    enemy: getDevTestUnitState(enemy),
    enemySupport: getDevTestUnitState(enemySupport),
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
    id: "move-away-miss",
    label: "Move-away miss",
    run: async () => {
      resetDevTest(
        { row: 5, col: 4, direction: "bottomLeft" },
        { row: 4, col: 4, direction: "bottomLeft" },
      );
      queueDevTestActions(["Move"], ["Attack"]);
      return runDevTestTick();
    },
    expect: (state) => (
      state.player.row === 8 &&
      state.player.col === 4 &&
      state.player.health === 10 &&
      state.enemy.health === 10
    ),
  },
  {
    id: "move-into-range-miss",
    label: "Move-in miss",
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
      state.player.health === 10
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
      state.player.row === 5 &&
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

  const buttons = DEV_TEST_SCENARIOS.map((scenario) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ui-button dev-test-button";
    button.textContent = scenario.label;
    button.dataset.devTestScenario = scenario.id;
    button.addEventListener("click", async () => {
      if (isExecutingActionQueue) {
        return;
      }

      setDevTestStatus(`Running ${scenario.label}...`);
      devTestScenariosList.querySelectorAll("button").forEach((item) => {
        item.disabled = true;
      });

      try {
        const result = await runDevTestScenario(scenario.id);
        setDevTestStatus(
          `${result.passed ? "PASS" : "FAIL"}: ${scenario.label}`,
          result.passed ? "is-pass" : "is-fail",
        );
      } catch (error) {
        setDevTestStatus(`ERROR: ${error.message}`, "is-fail");
      } finally {
        devTestScenariosList.querySelectorAll("button").forEach((item) => {
          item.disabled = false;
        });
      }
    });

    return button;
  });

  devTestScenariosList.replaceChildren(...buttons);
}

window.devTest = {
  reset: resetDevTest,
  queue: queueDevTestActions,
  queuePack: queueDevTestPackActions,
  runTick: runDevTestTick,
  runTurn: runDevTestTurn,
  runScenario: runDevTestScenario,
  scenarios: DEV_TEST_SCENARIOS.map(({ id, label }) => ({ id, label })),
  state: getDevTestState,
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
  return units.some((unit) => unit.team === "enemy" && unit.row === row && unit.col === col);
}

function isFriendlyPosition(row, col) {
  return units.some((unit) => unit.team === "player" && unit.row === row && unit.col === col);
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
    const unit = getSelectedPlayerUnit() ?? player;
    playWolfAnimation(unit, button.dataset.animation, unit === player);
  });
});

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const unit = getSelectedPlayerUnit() ?? player;
    unit.direction = button.dataset.direction;
    updateActiveDirection(unit.direction);
    playWolfAnimation(unit, unit.animationName, unit === player);
    updatePlayerMovePreview();
  });
});

buildArena();
refillAvailableActions();
renderActionQueue(getSelectedPlayerUnit());
resizeArena();
updatePlayerTileLabels();
updateActiveDirection(player.direction);
setupDevTestControls();
updateEnemyIntentPreview();
units.forEach((unit) => {
  playWolfAnimation(unit, "idle", unit === player);
});

if (executeQueueButton) {
  executeQueueButton.addEventListener("click", executePlayerActionQueue);
}

if (restartButton) {
  restartButton.addEventListener("click", resetGame);
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

  if (selectedUnit && isPointerInsideWolf(selectedUnit, event)) {
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

window.addEventListener("resize", resizeArena);
window.addEventListener("resize", positionPlayerActionMenu);
