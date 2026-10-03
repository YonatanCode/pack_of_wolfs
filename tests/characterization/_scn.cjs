"use strict";
// Shared helpers for the P1b scenario fixtures (r1..r5, c8). Not a fixture itself.
const { loadGame } = require("../harness/load-game.cjs");
const { evJson, units, packQueue, focus, runTurn } = require("./_lib.cjs");

const REQ_HEADER = "REQUIREMENT — P1b acceptance";
const SPAWNS = {
  P1: { row: 11, col: 5, direction: "topRight" }, P2: { row: 11, col: 3, direction: "topRight" }, P3: { row: 11, col: 8, direction: "topRight" },
  E1: { row: 0, col: 5, direction: "bottomLeft" }, E2: { row: 0, col: 7, direction: "bottomLeft" }, E3: { row: 0, col: 2, direction: "bottomLeft" },
};

/** Hard assertion: throws (run-all reports the fixture as failed with this message). */
function check(cond, msg) { if (!cond) throw new Error("ASSERT FAILED: " + msg); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}\n        a=${JSON.stringify(a).slice(0, 300)}\n        b=${JSON.stringify(b).slice(0, 300)}`); }

/** Real boot route: window.location.search + scenarios/*.js loaded before script.js. */
function bootScenario(seed = 1, extra = {}) {
  return loadGame({ query: `?scenario=intro&seed=${seed}`, scenarios: true, ...extra });
}

const hand = (g) => evJson(g, "Array.from(actionsList.children).map((i) => i.dataset.action)");
const seeds = (g) => evJson(g, "window.devTest.getBattleSeeds()");
const counts = (h) => h.reduce((m, a) => ({ ...m, [a]: (m[a] ?? 0) + 1 }), {});

/** Full observable battle state (everything restartBattle must reproduce). */
function snapshot(g) {
  return {
    seeds: seeds(g),
    gridSize: g.ev("GRID_SIZE"),
    enemyMode: g.ev("enemyMode"),
    terrain: evJson(g, "terrainTiles"),
    hills: evJson(g, "[...hillTileKeys].sort()"),
    ponds: evJson(g, "[...pondTileKeys].sort()"),
    flowers: evJson(g, "[...flowerTileKeys].sort()"),
    trees: evJson(g, "[...treeTileKeys].sort()"),
    units: evJson(g, `(function(){
      const all = [["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]];
      const o = {}; all.forEach(([id,u]) => { o[id] = { row:u.row, col:u.col, direction:u.direction, health:u.health,
        maxHealth:u.maxHealth, movementMode:u.movementMode ?? null, turnsSinceHit:u.turnsSinceHit,
        tookDamageThisTurn:u.tookDamageThisTurn, isFleeing:!!u.isFleeing, packObjective:u.packObjective ?? null,
        isDefeated:!!u.isDefeated, isActive:isUnitActive(u), type:u.type, queue:[...getUnitActionQueue(u)],
        isHidden:!!u.isHidden, elementHidden:!!u.element.hidden, isHit:u.element.classList.contains("is-hit"),
        animationName:u.animationName, hasPlayedDeathAnimation:!!u.hasPlayedDeathAnimation,
        hasDeathPromise:u.deathAnimationPromise !== null && u.deathAnimationPromise !== undefined,
        intentText: u.intentTags ? Array.from(u.intentTags.querySelectorAll(".unit-intent-label")).map((t) => t.textContent) : [] }; });
      return o; })()`),
    packQueue: packQueue(g),
    packFocus: focus(g),
    hand: hand(g),
    reshuffleCharges: g.ev("reshuffleChargesRemaining"),
    overlayHidden: g.ev("gameResultOverlay.hidden"),
    debugReport: { lexical: g.ev("lastBattleDebugReport"), window: g.ev("window.lastBattleDebugReport ?? null"), activeLogIsNull: g.ev("activeBattleDebugLog === null") },
    restartButtonHidden: g.ev("document.getElementById('restart-battle').hidden"),
    selected: evJson(g, "getSelectedPlayerUnit() ? getBattleDebugUnitId(getSelectedPlayerUnit()) : null"),
  };
}

/** Next n values of the hand stream (CONSUMES them: call last). */
const streamTail = (g, n = 8) => evJson(g, `Array.from({ length: ${n} }, () => handRandom())`);

/** Place P1 next to E1 (rest at the authored spawns) so a hand-authored turn can do damage. */
function placeFight(g) {
  const s = (k, o = {}) => ({ ...SPAWNS[k], ...o });
  g.ev(`resetDevTest(${[s("P1", { row: 5, col: 5, direction: "bottomRight" }), s("E1", { row: 5, col: 6, direction: "topLeft" }),
    s("P2"), s("E2"), s("P3"), s("E3")].map((x) => JSON.stringify(x)).join(",")})`);
}
/** Queue hand cards (by hand INDEX) for a player unit through the real UI path (select + applyPlayerAction). */
function queueByIndex(g, unitVar, indices) {
  const h = hand(g);
  g.ev(`setPlayerSelected(${unitVar})`);
  indices.forEach((i) => g.ev(`applyPlayerAction(${JSON.stringify(h[i])})`));
  return indices.map((i) => h[i]);
}
const setEnemyOrders = (g, list) => g.ev(`queueDevTestPackActions(${JSON.stringify(list)})`);
const turnEnd = (g) => g.ev("refillAvailableActions(); applyTurnEndRecovery();");

module.exports = { REQ_HEADER, SPAWNS, check, same, bootScenario, hand, seeds, counts, snapshot, streamTail, placeFight, queueByIndex, setEnemyOrders, turnEnd, loadGame, evJson, units, runTurn };
