"use strict";
// Generator for goldens/rules-pinned-constants.json. Run ONCE against the UNMODIFIED (pre-P1c) script.js:
//   (pin already recorded; to regenerate, check out HEAD e4c1627 script.js first, then:)
//   node tests/characterization/_pin-rules-constants.cjs
// Output: pins/rules-pinned-constants.json (outside goldens/ because run-all flags non-fixture goldens as orphans)
// The pin must come from HEAD (e4c1627), not from the edited file. Not a fixture (leading underscore).
const fs = require("node:fs");
const path = require("node:path");
const { loadGame } = require("../harness/load-game.cjs");
const NAMES = ["DEFAULT_GRID_SIZE", "MIN_GRID_SIZE", "MAX_GRID_SIZE", "PLAYER_MOVE_SPEED", "PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES",
  "PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES", "UNIT_MAX_HEALTH", "UNIT_RECOVERY_SAFE_TURNS", "UNIT_RECOVERY_HEAL_AMOUNT",
  "UNIT_ATTACK_DAMAGE", "UNIT_DEFENDED_DAMAGE", "UNIT_HIT_REACTION_MS", "ACTIONS", "ACTION_SLOT_COUNT", "ACTION_QUEUE_SLOT_COUNT",
  "RESHUFFLE_CHARGES_PER_BATTLE", "MOVE_ACTION_TILE_COUNT", "MAX_SAME_ACTION", "ENEMY_PLAN_ACTION_COUNT", "ENEMY_AGGRESSIVE_DOCTRINE",
  "ENEMY_LOW_HEALTH_RATIO", "ENEMY_FLEE_TRIGGER_RANGE", "ENEMY_FLEE_SAFE_RANGE"];
const g = loadGame({});
const table = {};
NAMES.forEach((n) => { table[n] = JSON.parse(g.ev(`JSON.stringify(${n})`)); });
const out = { header: "REQUIREMENT — constants pinned from HEAD e4c1627 before P1c; RULES must reproduce them exactly", constants: table };
fs.writeFileSync(path.join(__dirname, "pins", "rules-pinned-constants.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(table));
