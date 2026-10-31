"use strict";
// REQUIREMENT — wilds scenario (hard assertions; evidence in the golden; ENGINE-NOTES section 15)
// R55a DEFINITION: window.BATTLE_SCENARIOS.wilds is registered and frozen: id wilds, version 1, gridSize 16, hand seed 1,
//      terrain { generated: { seed: 33 } }; its six spawns are exactly the cells the generator keeps clear on a 16 board
//      (getEntryCornerSetup with no entry corner, i.e. the original arena's spawns).
// R55b DEFAULT BOOT: a link without parameters ("") boots wilds, 16x16, under the unchanged default battle setup
//      (commanderdraw, hash 0e098f37a86413) and, since ENGINE-NOTES 16.1, a FRESH battle seed (seed = hand seed). The
//      former seed-1 default battle is pinned through its explicit equivalent "?scenario=wilds&seed=1" (same setup, no
//      game loop): pinned label and Copy link; "?seed=1" boots wilds. ?scenario=intro still boots the
//      authored 12x12 intro; an unknown scenario id falls back to wilds (the warning is captured, not printed).
// R55c TERRAIN: generated from the fixed terrain seed only: identical over the default boot, an explicit wilds boot, a
//      wilds load from an intro battle under another battle seed, and a load with a non-default entry corner and the
//      dev-test obstacle switch set (both restored afterwards); pinned fingerprint of tiles + pond / hill / level / tree /
//      flower keys; ZERO Math.random draws during loadScenario("wilds"); terrainRandom is Math.random again afterwards;
//      water, rocks (incl. a level-2 crest), trees and flowers present.
// R55d SPAWNS: every unit stands on its scenario spawn, on an unblocked cell, inside the main walkable region, and every
//      walkable cell is in that region (one connected battlefield).
// R55e RESTART: Restart, Play Again and devTest.restartBattle keep wilds, seed 1, the terrain, spawns, boot hand and setup.
// R55f TUTORIAL: from the default boot the tutorial forces current + plain defaults and restarts on wilds (same terrain,
//      units at spawns); after it ends, the next Restart returns to the default setup.
// R55g OBSERVATION / STATE: observeBattle and snapshotBattleState carry the wilds terrain (pond / hill / tree / hillLevels)
//      and gridSize 16; loadBattleState of a wilds snapshot into a second wilds battle whose obstacles were cleared
//      reproduces the terrain and the whole snapshot.
// R55h HEADLESS DOOR: one Move order is queued through applyPlayerOrders, a second Move is refused (card-not-in-hand), and
//      ONE headless turn (runHeadlessTurn) runs on wilds; its observation, outcome and event hash are recorded. The
//      post-turn state is then round-tripped as in R55g.
// No battle is simulated beyond that single scripted turn. Own hand ledger (limit 20).
const crypto = require("node:crypto");
const S = require("./_settings.cjs");
const { check, same, J } = S;

const ID = "r55-wilds-scenario";
const HAND_LIMIT = 20;
const TERRAIN_SEED = 33;
const DEFAULT_SETUP_HASH = "0e098f37a86413";
const DRAW_VERSION = "0.1.0-commanderdraw-enemy-random-draw";
const PINNED_TERRAIN_FINGERPRINT = "929db99e2d13f070"; // sha256 (first 16 hex) of the terrain JSON below
const SPAWNS = {
  P1: { row: 15, col: 7, direction: "topRight" }, P2: { row: 15, col: 5, direction: "topRight" }, P3: { row: 15, col: 9, direction: "topRight" },
  E1: { row: 0, col: 7, direction: "bottomLeft" }, E2: { row: 0, col: 5, direction: "bottomLeft" }, E3: { row: 0, col: 9, direction: "bottomLeft" },
};
const VARS = { P1: "player", P2: "playerSupport", P3: "playerFlank", E1: "enemy", E2: "enemySupport", E3: "enemyFlank" };
const DIRT = [0, 1, 2, 3, 4, 6, 8, 18]; // DIRT_BASE_TILES, for the map legend only

/** RAW boot (the query exactly as given) with the r54 hand counter. */
function rawBoot(query) {
  const g = S.loadGame({ query, scenarios: true });
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  return g;
}

const TERRAIN_EXPR = `({ tiles: terrainTiles, pond: [...pondTileKeys].sort(), hill: [...hillTileKeys].sort(),
  hillLevels: [...hillTileLevels.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)), tree: [...treeTileKeys].sort(), flower: [...flowerTileKeys].sort() })`;
const terrainOf = (g) => J(g, TERRAIN_EXPR);
const fingerprint = (t) => crypto.createHash("sha256").update(JSON.stringify(t)).digest("hex").slice(0, 16);
const positions = (g) => J(g, `({ ${Object.entries(VARS).map(([id, v]) => `${id}: { row: ${v}.row, col: ${v}.col, direction: ${v}.direction }`).join(", ")} })`);
const seeds = (g) => J(g, "window.devTest.getBattleSeeds()");
const hand = (g) => J(g, "playerHand");
const setupOf = (g) => ({ preset: g.ev("getActivePreset()"), version: g.ev("activeRules.version"), hash: g.ev("activeRules.hash") });
const click = (g, variable) => g.ev(`${variable}.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`);
const sortedTerrain = (t) => ({ pond: [...t.pond].sort(), hill: [...t.hill].sort(), tree: [...t.tree].sort(),
  hillLevels: [...t.hillLevels].sort((a, b) => (a[0] < b[0] ? -1 : 1)) });

/** ASCII evidence: ~ water, ^ rock (level 1), A rock (level 2), T tree, * flowers, : dirt, . grass. */
function asciiMap(t) {
  return t.tiles.map((row, r) => row.map((tile, c) => {
    const k = `${r},${c}`;
    if (t.pond.includes(k)) return "~";
    if (t.hill.includes(k)) return t.hillLevels.find(([key]) => key === k)?.[1] === 2 ? "A" : "^";
    if (t.tree.includes(k)) return "T";
    if (t.flower.includes(k)) return "*";
    return DIRT.includes(tile) ? ":" : ".";
  }).join(" "));
}

/** Call fn's expression with console.warn captured inside the context (so an expected warning is evidence, not output). */
function withCapturedWarn(g, expr) {
  return J(g, `(function () { const orig = console.warn; const warnings = []; console.warn = (...a) => warnings.push(a.join(" "));
    try { const value = ${expr}; return { value, warnings }; } finally { console.warn = orig; } })()`);
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  // ---- R55a ---------------------------------------------------------------------------------------------------------
  // 16.1: the plain boot ("") draws a fresh seed, so the seed-1 pins below use the explicit equivalent of the old plain boot.
  const g = track(rawBoot("?scenario=wilds&seed=1"));
  const t = track(rawBoot("")); // the plain boot (also R55f's tutorial context)
  const def = J(g, "window.BATTLE_SCENARIOS.wilds");
  check(g.ev("Object.isFrozen(window.BATTLE_SCENARIOS.wilds) && Object.isFrozen(window.BATTLE_SCENARIOS.wilds.terrain.generated)"), "R55a: wilds is deep-frozen");
  same([def.id, def.scenarioVersion, def.gridSize, def.seed, def.terrain], ["wilds", 1, 16, 1, { generated: { seed: TERRAIN_SEED } }], "R55a: wilds definition");
  same(def.spawns, { player: { primary: SPAWNS.P1, support: SPAWNS.P2, flank: SPAWNS.P3 }, enemy: { primary: SPAWNS.E1, support: SPAWNS.E2, flank: SPAWNS.E3 } },
    "R55a: wilds spawn definition");
  same(J(g, `["player", "enemy"].flatMap((team) => ["primary", "support", "flank"].map((role) => getEntryCornerSetup(team, role, null, 16)))`),
    Object.values(SPAWNS), "R55a: the spawns are the cells the generator keeps clear (no entry corner, 16 board)");
  check(g.ev("window.DEFAULT_SCENARIO_ID") === "wilds", "R55a: the default scenario id is wilds");

  // ---- R55b ---------------------------------------------------------------------------------------------------------
  const plainSeeds = seeds(t);
  check(plainSeeds.scenarioId === "wilds" && Number.isInteger(plainSeeds.seed) && plainSeeds.handSeed === plainSeeds.seed, "R55b: no parameters -> wilds under a fresh seed");
  same(setupOf(t), { preset: "commanderdraw", version: DRAW_VERSION, hash: DEFAULT_SETUP_HASH }, "R55b: no parameters -> the default battle setup");
  same(fingerprint(terrainOf(t)), PINNED_TERRAIN_FINGERPRINT, "R55b: no parameters -> the fixed wilds terrain");
  same(seeds(g), { scenarioId: "wilds", scenarioVersion: 1, seed: 1, handSeed: 1 }, "R55b: ?scenario=wilds&seed=1 -> wilds, seed 1");
  check(g.ev("GRID_SIZE") === 16 && g.ev("enemyMode") === "wolves", "R55b: 16x16, wolves");
  same(setupOf(g), { preset: "commanderdraw", version: DRAW_VERSION, hash: DEFAULT_SETUP_HASH }, "R55b: the default battle setup is unchanged");
  check(g.ev("isDefaultBattleSetupActive()") === true, "R55b: isDefaultBattleSetupActive");
  same(J(g, "getRulesLinkStatus()"), { status: "none", message: "" }, "R55b: no link status");
  out.label = g.ev("getScenarioLabelText()");
  same(out.label, "wilds · seed 1 · custom rules 0e098f · commander draw (experimental)", "R55b: label");
  const copy = await g.runLimited(() => g.ev("copyRulesLink()"));
  same(copy, { copied: true, link: "?scenario=wilds&seed=1&preset=commanderdraw&rules=wa:2,dwa:2" }, "R55b: Copy link names wilds and the setup");
  const viaLink = track(rawBoot(copy.link));
  same([seeds(viaLink), setupOf(viaLink)], [seeds(g), setupOf(g)], "R55b: the copied link boots the same battle");
  const seedOnly = track(rawBoot("?seed=1"));
  same(seeds(seedOnly).scenarioId, "wilds", "R55b: ?seed=1 boots wilds");
  const intro = track(rawBoot("?scenario=intro&seed=1"));
  same(seeds(intro), { scenarioId: "intro", scenarioVersion: 1, seed: 1, handSeed: 1 }, "R55b: ?scenario=intro still boots intro");
  same(setupOf(intro), setupOf(g), "R55b: intro under the same default setup");
  const introTerrain = terrainOf(intro);
  check(intro.ev("GRID_SIZE") === 12 && introTerrain.tiles.every((row) => row.every((t) => t === 22)), "R55b: intro is the authored 12x12 flat board");
  same([introTerrain.hill, introTerrain.pond, introTerrain.tree, introTerrain.flower, introTerrain.hillLevels],
    [["5,0", "5,11", "6,0", "6,11"], [], [], [], []], "R55b: intro keeps exactly its 4 rocks");
  const fallback = withCapturedWarn(intro, `resolveScenario("nowhere").id`);
  same(fallback, { value: "wilds", warnings: ['[scenario] unknown scenario "nowhere", falling back to "wilds"'] }, "R55b: unknown id falls back to wilds");
  const fallbackLoad = withCapturedWarn(intro, `[loadScenario("nowhere", 1), activeScenario.id, GRID_SIZE]`);
  same(fallbackLoad.value, [true, "wilds", 16], "R55b: loading an unknown id loads wilds");
  out.fallback = { resolve: fallback, load: fallbackLoad };

  // ---- R55c ---------------------------------------------------------------------------------------------------------
  const terrain = terrainOf(g);
  const fp = fingerprint(terrain);
  check(terrain.tiles.length === 16 && terrain.tiles.every((row) => row.length === 16), "R55c: 16x16 tile matrix");
  same(fp, PINNED_TERRAIN_FINGERPRINT, "R55c: pinned terrain fingerprint");
  const explicit = track(rawBoot("?scenario=wilds&seed=1&preset=current"));
  same(fingerprint(terrainOf(explicit)), fp, "R55c: explicit wilds boot (other preset): same terrain");
  same(fingerprint(terrainOf(viaLink)), fp, "R55c: copied-link boot: same terrain");
  const draws = J(intro, `(function () { const orig = Math.random; let n = 0; Math.random = function () { n += 1; return orig(); };
    try { loadScenario("wilds", 7); } finally { Math.random = orig; } return n; })()`);
  same(draws, 0, "R55c: loadScenario('wilds') draws nothing from Math.random");
  same(fingerprint(terrainOf(intro)), fp, "R55c: wilds loaded from an intro battle under battle seed 7: same terrain");
  same(seeds(intro), { scenarioId: "wilds", scenarioVersion: 1, seed: 7, handSeed: 7 }, "R55c: battle seed 7 is used for the hand only");
  check(intro.ev(`loadScenario("wilds", 1) && terrainRandom === Math.random`), "R55c: terrainRandom is Math.random again after a load");
  const pinned = J(intro, `(function () { currentEntryCorner = "topLeft"; devTestObstaclesDisabled = true;
    try { loadScenario("wilds", 1); return [currentEntryCorner, devTestObstaclesDisabled]; } finally { currentEntryCorner = null; devTestObstaclesDisabled = false; } })()`);
  same(pinned, ["topLeft", true], "R55c: entry corner and obstacle switch are restored after the load");
  same(fingerprint(terrainOf(intro)), fp, "R55c: a non-default entry corner / obstacle switch does not change the map");
  check(terrain.pond.length > 0 && terrain.hill.length > 0 && terrain.tree.length > 0 && terrain.flower.length > 0, "R55c: water, rocks, trees and flowers");
  check(terrain.hillLevels.some(([, level]) => level === 2), "R55c: a level-2 rock crest");
  check(terrain.tiles.flat().some((t) => DIRT.includes(t)) && terrain.tiles.flat().some((t) => !DIRT.includes(t)), "R55c: grass and dirt");
  out.terrain = { seed: TERRAIN_SEED, fingerprint: fp, counts: { pond: terrain.pond.length, hill: terrain.hill.length, tree: terrain.tree.length, flower: terrain.flower.length },
    hillLevel2: terrain.hillLevels.filter(([, l]) => l === 2).map(([k]) => k), tree: terrain.tree, map: asciiMap(terrain), mathRandomDrawsDuringLoad: draws };

  // ---- R55d ---------------------------------------------------------------------------------------------------------
  same(positions(g), SPAWNS, "R55d: every unit on its scenario spawn");
  const reach = J(g, `(function () { const region = getLargestWalkableRegion(); let walkable = 0;
    for (let r = 0; r < GRID_SIZE; r += 1) for (let c = 0; c < GRID_SIZE; c += 1) if (!isBlockedTile(r, c)) walkable += 1;
    return { region: region.size, walkable, spawns: units.filter(isUnitActive).map((u) => ({ blocked: isBlockedTile(u.row, u.col), inRegion: region.has(getGridPositionKey(u.row, u.col)) })) }; })()`);
  check(reach.spawns.length === 6 && reach.spawns.every((s) => !s.blocked && s.inRegion), "R55d: six spawns, all unblocked and in the main region");
  same(reach.region, reach.walkable, "R55d: one connected battlefield (every walkable cell reachable)");
  out.reach = { region: reach.region, walkable: reach.walkable };

  // ---- R55e ---------------------------------------------------------------------------------------------------------
  const bootHand = hand(g);
  const restartState = () => [seeds(g), setupOf(g), fingerprint(terrainOf(g)), positions(g), hand(g)];
  const expected = [seeds(g), setupOf(g), fp, SPAWNS, bootHand];
  click(g, "restartBattleButton");
  same(restartState(), expected, "R55e: Restart keeps wilds, seed, setup, terrain, spawns and hand");
  click(g, "restartButton");
  same(restartState(), expected, "R55e: Play Again keeps them");
  check(g.ev("window.devTest.restartBattle()") === true, "R55e: devTest.restartBattle restarts");
  same(restartState(), expected, "R55e: restartBattle keeps them");
  out.bootHand = bootHand;

  // ---- R55f ---------------------------------------------------------------------------------------------------------
  t.ev("startGuidedTutorial()");
  check(t.ev("isGuidedTutorialActive") === true, "R55f: tutorial active");
  same(setupOf(t), { preset: "current", version: "0.1.0-current", hash: "0d3ce2ec6fa6de" }, "R55f: the tutorial forces current + plain defaults");
  same([seeds(t).scenarioId, fingerprint(terrainOf(t)), positions(t)], ["wilds", fp, SPAWNS], "R55f: the tutorial battle is wilds, same terrain, units at spawns");
  t.ev("endGuidedTutorial()");
  click(t, "restartBattleButton");
  same(setupOf(t), { preset: "commanderdraw", version: DRAW_VERSION, hash: DEFAULT_SETUP_HASH }, "R55f: the next Restart returns to the default setup");
  same([seeds(t).scenarioId, fingerprint(terrainOf(t))], ["wilds", fp], "R55f: still wilds");

  // ---- R55g ---------------------------------------------------------------------------------------------------------
  const obs = J(g, "observeBattle()");
  const snap0 = J(g, "snapshotBattleState()");
  same(obs.config, { gridSize: 16, enemyMode: "wolves" }, "R55g: observation config");
  same(snap0.config, { gridSize: 16, enemyMode: "wolves" }, "R55g: snapshot config");
  const live = { pond: terrain.pond, hill: terrain.hill, tree: terrain.tree, hillLevels: terrain.hillLevels };
  same(sortedTerrain(obs.terrain), live, "R55g: the observation carries the wilds terrain");
  same(sortedTerrain(snap0.terrain), live, "R55g: the snapshot carries the wilds terrain");
  out.bootObservation = { units: obs.units.map((u) => `${u.id} ${u.row},${u.col} ${u.direction} hp ${u.health}${u.concealed ? " concealed" : ""}`), hand: obs.hand };

  const roundTrip = (state, label) => {
    const r = track(rawBoot("?scenario=wilds&seed=1")); // 16.1: the seed-1 battle's explicit link (the plain boot draws a fresh seed)
    r.ev("clearArenaObstacles()");
    check(r.ev("pondTileKeys.size + hillTileKeys.size + treeTileKeys.size + hillTileLevels.size") === 0, `${label}: target obstacles cleared first`);
    r.ev(`loadBattleState(${JSON.stringify(state)})`);
    same(J(r, "snapshotBattleState()"), state, `${label}: loadBattleState reproduces the whole snapshot`);
    same(sortedTerrain(J(r, "observeBattle()").terrain), live, `${label}: and the terrain in the observation`);
  };
  roundTrip(snap0, "R55g boot state");

  // ---- R55h ---------------------------------------------------------------------------------------------------------
  same(bootHand.filter((a) => a === "Move").length, 1, "R55h: the seed-1 boot hand holds one Move");
  same(J(g, `applyPlayerOrders([{ unit: "P1", action: "Move" }])`), { ok: true, queuedTotal: 1 }, "R55h: P1 Move queued through the headless door");
  const refused = J(g, `applyPlayerOrders([{ unit: "P2", action: "Move" }])`);
  same([refused.ok, refused.reason, refused.index], [false, "card-not-in-hand", 0], "R55h: a second Move is refused (no Move card left)");
  same(J(g, "observeBattle().units.find((u) => u.id === 'P1').queue"), ["Move"], "R55h: the queue is observed");
  const turn = J(g, `(function () { const r = runHeadlessTurn([], { includeEvents: true }); return { ok: r.ok, outcome: r.outcome, eventHash: hashTurnEvents(r.events),
    events: r.events.length, observation: r.observation }; })()`);
  check(turn.ok === true, "R55h: one headless turn ran");
  same(turn.observation, J(g, "observeBattle()"), "R55h: the returned observation equals a fresh one");
  same(sortedTerrain(turn.observation.terrain), live, "R55h: terrain unchanged by the turn");
  out.headlessTurn = { outcome: turn.outcome, eventHash: turn.eventHash, events: turn.events,
    units: turn.observation.units.map((u) => `${u.id} ${u.row},${u.col} ${u.direction} hp ${u.health}${u.concealed ? " concealed" : ""}`), hand: turn.observation.hand };
  roundTrip(J(g, "snapshotBattleState()"), "R55h post-turn state");

  const hands = ctxs.reduce((n, c) => n + S.handsOf(c), 0);
  check(hands <= HAND_LIMIT, `R55 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return { header: "REQUIREMENT — wilds scenario", handsGenerated: hands, result: out };
}
module.exports = { id: ID, run };
