"use strict";
// REQUIREMENT — game loop (hard assertions; evidence in the golden; ENGINE-NOTES section 16)
// R56a ROUTE: a PLAIN boot ("") routes to wilds with bootRoute.gameLoop = true under the default battle setup; explicit
//      links (?scenario=wilds, ?scenario=intro, ?seed=1, ?preset=commanderdraw, ?mode=world) never carry gameLoop.
// R56b PLAIN WIN: devEndFight(true) (the dev End-fight seam; also through the dev "win" button listener) on the plain
//      boot opens the world map instead of the You Win overlay: the scenario is left, worldState is a fresh run at the
//      home cell (0, 0), which is cleared and carries the wilds terrain seed 33; the live arena on the map is the wilds
//      terrain just won (pinned r55 fingerprint).
// R56c EXPLICIT WIN: ?scenario=wilds and ?scenario=intro show the You Win overlay, do NOT open the map or touch
//      worldState, and Play Again restarts the same scenario + seed (unchanged scenario end behaviour).
// R56d LOSS: plain and explicit boots show the You Lose overlay (no map); Play Again re-fights the same map: in the plain
//      boot's game-loop battle under a NEW fresh seed (ENGINE-NOTES 16.1), in an explicit-link battle under the same seed;
//      the plain boot's game loop survives that retry (a following win opens the map).
// R56e WORLD WOLF FIGHT: devTest.chooseCorner from the map starts the next node's fight (no turn played): default battle
//      setup (commanderdraw, hash 0e098f37a86413), 2 reshuffle charges, a 5-card hand; the hand stream AND the enemy draw
//      stream are seeded from the same fresh seed (enemy stream position = one list drawn from deriveEnemyDrawSeed(handSeed),
//      replicated with the pure draw functions) and both are in the BattleState; a loss shows the overlay and Play Again
//      keeps the default setup; a win clears the new cell on the map.
// R56f STAG NODE: startArena with a forced stag node keeps current + plain defaults (hash 0d3ce2ec6fa6de), also after
//      Play Again, as world mode always did.
// R56g TUTORIAL: the tutorial still forces current + plain defaults on the plain boot and inside a world wolf fight.
// R56h FRESH SEED (16.1): two plain boots under different harness Math.random states get different battle seeds, hand
//      streams (and here different hands) and enemy draw streams (each = one list drawn from deriveEnemyDrawSeed(seed),
//      replicated with the pure draw functions); the terrain stays the fixed wilds map; the label and Copy link name the
//      seed and the copied link reproduces the battle (explicit, no game loop); Restart keeps the seed and the hand.
//      Only relations are recorded (the seed values depend on the harness's Math.random).
// No battle is simulated (no turn is played). Own hand ledger (limit 25; 20 before 16.1).
const crypto = require("node:crypto");
const S = require("./_settings.cjs");
const { check, same, J } = S;

const ID = "r56-game-loop";
const HAND_LIMIT = 25;
const DEFAULT_SETUP_HASH = "0e098f37a86413";
const CURRENT_HASH = "0d3ce2ec6fa6de";
const WILDS_TERRAIN_SEED = 33;
const WILDS_FINGERPRINT = "929db99e2d13f070"; // r55's pinned terrain fingerprint

/** RAW boot (the query exactly as given) with the r54 / r55 hand counter, and showGameResult's argument recorded (the stub
 * DOM's querySelector returns a detached element, so the overlay text itself is not observable; r6). */
function rawBoot(query, harnessSeed) {
  const g = S.loadGame({ query, scenarios: true, ...(harnessSeed === undefined ? {} : { seed: harnessSeed }) });
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  g.ev(`window.__result = null; (function () { const orig = showGameResult;
    showGameResult = function (didWin) { window.__result = didWin ? "You Win!" : "You Lose"; return orig.apply(this, arguments); }; })()`);
  return g;
}

const TERRAIN_EXPR = `({ tiles: terrainTiles, pond: [...pondTileKeys].sort(), hill: [...hillTileKeys].sort(),
  hillLevels: [...hillTileLevels.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)), tree: [...treeTileKeys].sort(), flower: [...flowerTileKeys].sort() })`;
const fingerprint = (g) => crypto.createHash("sha256").update(JSON.stringify(J(g, TERRAIN_EXPR))).digest("hex").slice(0, 16);
const setupOf = (g) => ({ preset: g.ev("getActivePreset()"), hash: g.ev("activeRules.hash") });
const seeds = (g) => J(g, "window.devTest.getBattleSeeds()");
/** What the player sees after a battle ends. */
const endView = (g) => J(g, `({ overlay: !gameResultOverlay.hidden, message: gameResultOverlay.hidden ? "" : window.__result,
  map: worldStage.classList.contains("is-zoomed-out"), scenario: activeScenario ? activeScenario.id : null,
  world: { x: worldState.x, y: worldState.y, cleared: Object.keys(worldState.nodes).filter((k) => worldState.nodes[k].cleared).sort() } })`);
const playAgain = (g) => g.ev(`restartButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`);

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};
  let tutorialHands = 0; // seedTutorialActionHand deals outside drawPlayerHandToSize: counted here

  // ---- R56a ---------------------------------------------------------------------------------------------------------
  const g = track(rawBoot(""));
  same(J(g, "bootRoute"), { scenario: "wilds", gameLoop: true }, "R56a: the plain boot route carries gameLoop");
  same(setupOf(g), { preset: "commanderdraw", hash: DEFAULT_SETUP_HASH }, "R56a: the plain boot plays the default battle setup");
  check(g.ev("isGameLoopScenarioBattle()") === true, "R56a: the plain boot battle is the game loop's battle");
  out.routes = {};
  ["?scenario=wilds", "?scenario=intro", "?seed=1", "?preset=commanderdraw", "?mode=world"].forEach((query) => {
    const route = J(track(rawBoot(query)), "bootRoute");
    check(!("gameLoop" in route), `R56a: ${query} has no gameLoop`);
    out.routes[query] = route;
  });

  // ---- R56h ---------------------------------------------------------------------------------------------------------
  const streamOf = (c) => J(c, `({ seeds: getBattleSeeds(), hand: playerHand, handState: getHandRandomState(), enemy: getEnemyDrawState(),
    expectedEnemy: (function () { const s = createSeededRandom(deriveEnemyDrawSeed(activeScenarioSeed));
      const pool = toCanonicalEnemyPool(drawEnemyActionList(s, activeRules.enemyActionBudget, getEnemyDrawWeightsState().active));
      return { state: s.getState(), pool }; })() })`);
  const g2 = track(rawBoot("", 2));
  const s1 = streamOf(g);
  const s2 = streamOf(g2);
  [s1, s2].forEach((x, i) => {
    check(x.seeds.scenarioId === "wilds" && Number.isInteger(x.seeds.seed) && x.seeds.handSeed === x.seeds.seed, `R56h: plain boot ${i + 1}: wilds, seed = hand seed`);
    same(x.enemy, x.expectedEnemy, `R56h: plain boot ${i + 1}: the enemy stream is seeded from the battle seed (one list drawn)`);
  });
  same(fingerprint(g2), WILDS_FINGERPRINT, "R56h: the second plain boot has the same fixed terrain");
  const differ = { seed: s1.seeds.seed !== s2.seeds.seed, handState: s1.handState !== s2.handState, hand: s1.hand.join() !== s2.hand.join(),
    enemyState: s1.enemy.state !== s2.enemy.state };
  same(differ, { seed: true, handState: true, hand: true, enemyState: true }, "R56h: different Math.random states -> different seeds, hand and enemy streams");
  same(g.ev("getScenarioLabelText()"), `wilds · seed ${s1.seeds.seed} · custom rules 0e098f · commander draw (experimental)`, "R56h: the label names the fresh seed");
  const copy = await g.runLimited(() => g.ev("copyRulesLink()"));
  same(copy, { copied: true, link: `?scenario=wilds&seed=${s1.seeds.seed}&preset=commanderdraw&rules=wa:2,dwa:2` }, "R56h: Copy link names the fresh seed");
  const rep = track(rawBoot(copy.link));
  const sr = streamOf(rep);
  same([sr.seeds, sr.hand, sr.handState, sr.enemy, setupOf(rep), J(rep, "bootRoute.gameLoop === undefined")], [s1.seeds, s1.hand, s1.handState, s1.enemy, setupOf(g), true],
    "R56h: the copied link reproduces the battle (explicit: no game loop)");
  g.ev(`restartBattleButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`);
  const sRestart = streamOf(g);
  same([sRestart.seeds, sRestart.hand, sRestart.handState, sRestart.enemy], [s1.seeds, s1.hand, s1.handState, s1.enemy], "R56h: Restart keeps the seed, hand and streams");
  out.freshSeed = { differ, reproducibleViaCopyLink: true, restartKeepsSeed: true };

  // ---- R56b ---------------------------------------------------------------------------------------------------------
  const before = fingerprint(g);
  same(before, WILDS_FINGERPRINT, "R56b: the plain boot arena is the wilds terrain");
  g.ev("devEndFight(true)");
  const won = endView(g);
  same(won, { overlay: false, message: "", map: true, scenario: null, world: { x: 0, y: 0, cleared: ["0,0"] } }, "R56b: a plain-boot win opens the world map with the home cell cleared");
  same(J(g, "getCurrentWorldNode(worldState)"), { x: 0, y: 0, cleared: true, enemyMode: "wolves", difficulty: 0, seed: WILDS_TERRAIN_SEED }, "R56b: the home cell carries the wilds terrain seed");
  same(fingerprint(g), WILDS_FINGERPRINT, "R56b: the map's live (home) arena is the wilds terrain just won");
  check(g.ev("restartBattleButton.hidden") === true && g.ev("getRulesLockReason()") === "no-scenario-battle", "R56b: world map: no scenario Restart, rules panel locked");
  const viaButton = track(rawBoot(""));
  viaButton.ev(`winFightButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`);
  same(endView(viaButton), won, "R56b: the dev win button takes the same path");
  out.plainWin = won;

  // ---- R56c ---------------------------------------------------------------------------------------------------------
  out.explicitWin = {};
  for (const [query, id] of [["?scenario=wilds", "wilds"], ["?scenario=intro", "intro"]]) {
    const e = track(rawBoot(query));
    const seedsBefore = seeds(e);
    e.ev("devEndFight(true)");
    const view = endView(e);
    same(view, { overlay: true, message: "You Win!", map: false, scenario: id, world: { x: 0, y: 0, cleared: [] } }, `R56c: ${query} win shows You Win, no map`);
    playAgain(e);
    same([e.ev("gameResultOverlay.hidden"), seeds(e)], [true, seedsBefore], `R56c: ${query} Play Again restarts the same scenario + seed`);
    out.explicitWin[query] = view;
  }

  // ---- R56d ---------------------------------------------------------------------------------------------------------
  const l = track(rawBoot(""));
  l.ev("devEndFight(false)");
  const lostPlain = endView(l);
  same(lostPlain, { overlay: true, message: "You Lose", map: false, scenario: "wilds", world: { x: 0, y: 0, cleared: [] } }, "R56d: a plain-boot loss shows You Lose, no map");
  const lSeeds = seeds(l);
  playAgain(l);
  const lAfter = seeds(l);
  same([l.ev("gameResultOverlay.hidden"), lAfter.scenarioId, setupOf(l), fingerprint(l)], [true, "wilds", { preset: "commanderdraw", hash: DEFAULT_SETUP_HASH }, WILDS_FINGERPRINT],
    "R56d: Play Again re-fights the wilds map under the default setup");
  check(Number.isInteger(lAfter.seed) && lAfter.seed !== lSeeds.seed && lAfter.handSeed === lAfter.seed, "R56d: game-loop Play Again deals a NEW fresh seed");
  const sl = streamOf(l);
  same(sl.enemy, sl.expectedEnemy, "R56d: the enemy stream is reseeded from the new seed (one list drawn)");
  const le = track(rawBoot("?scenario=wilds"));
  le.ev("devEndFight(false)");
  const lostExplicit = endView(le);
  same(lostExplicit, { overlay: true, message: "You Lose", map: false, scenario: "wilds", world: { x: 0, y: 0, cleared: [] } }, "R56d: an explicit-link loss shows You Lose, no map");
  const leSeeds = seeds(le);
  playAgain(le);
  same([le.ev("gameResultOverlay.hidden"), seeds(le)], [true, leSeeds], "R56d: explicit-link Play Again after a loss keeps the seed");
  out.loss = { plain: lostPlain, explicit: lostExplicit };

  // ---- R56g (plain boot) ----------------------------------------------------------------------------------------------
  l.ev("startGuidedTutorial()");
  tutorialHands += 1;
  same(setupOf(l), { preset: "current", hash: CURRENT_HASH }, "R56g: the tutorial forces current + plain defaults on the plain boot");
  l.ev("endGuidedTutorial()");
  l.ev("devEndFight(true)");
  same(endView(l).map, true, "R56d: after a retry (and the tutorial) a plain-boot win still opens the map");

  // ---- R56e ---------------------------------------------------------------------------------------------------------
  await g.runLimited(() => g.ev("window.devTest.chooseCorner('topRight')"));
  const fight = J(g, `({ map: worldStage.classList.contains("is-zoomed-out"), scenario: activeScenario, at: [worldState.x, worldState.y],
    node: getCurrentWorldNode(worldState), enemyMode, charges: reshuffleChargesRemaining, hand: playerHand.length, version: activeRules.version })`);
  same([fight.map, fight.scenario, fight.at, fight.node.cleared, fight.node.enemyMode, fight.enemyMode, fight.charges, fight.hand],
    [false, null, [1, 0], false, "wolves", "wolves", 2, 5], "R56e: chooseCorner starts the wolf fight at (1, 0)");
  same(setupOf(g), { preset: "commanderdraw", hash: DEFAULT_SETUP_HASH }, "R56e: the world wolf fight plays the default battle setup");
  const stream = J(g, `(function () {
    const s = createSeededRandom(deriveEnemyDrawSeed(handSeed));
    const pool = toCanonicalEnemyPool(drawEnemyActionList(s, activeRules.enemyActionBudget, getEnemyDrawWeightsState().active));
    const snap = snapshotBattleState();
    return { expected: { state: s.getState(), pool }, live: { state: getEnemyDrawState().state, pool: getEnemyDrawState().pool },
      rng: snap.rng, drawnPool: snap.enemyPack.drawnPool, handSeed, battleSeed: getBattleSeeds().seed };
  })()`);
  same(stream.live, stream.expected, "R56e: the enemy stream was seeded from the fresh hand seed and drew exactly one list");
  same([stream.rng.handSeed, stream.rng.enemyDrawState, stream.drawnPool], [stream.handSeed, stream.live.state, stream.live.pool], "R56e: both streams are in the BattleState");
  check(stream.handSeed !== 1 && stream.battleSeed === null, "R56e: a fresh (non-scenario) seed");
  // (the drawn list itself depends on the harness's Math.random position at the fresh seed, so only its size is recorded)
  out.worldFight = { at: fight.at, version: fight.version, drawnPoolSize: stream.live.pool.length };
  g.ev("devEndFight(false)");
  same(endView(g), { overlay: true, message: "You Lose", map: false, scenario: null, world: { x: 1, y: 0, cleared: ["0,0"] } }, "R56e: a world-fight loss shows You Lose");
  playAgain(g);
  same([g.ev("gameResultOverlay.hidden"), setupOf(g), J(g, "[worldState.x, worldState.y]")], [true, { preset: "commanderdraw", hash: DEFAULT_SETUP_HASH }, [1, 0]],
    "R56e: Play Again re-fights the node under the default setup");
  g.ev("devEndFight(true)");
  same(endView(g), { overlay: false, message: "", map: true, scenario: null, world: { x: 1, y: 0, cleared: ["0,0", "1,0"] } }, "R56e: a world-fight win clears the cell on the map");

  // ---- R56g (world fight) ---------------------------------------------------------------------------------------------
  await g.runLimited(() => g.ev("window.devTest.chooseCorner('topRight')"));
  same([J(g, "[worldState.x, worldState.y]"), setupOf(g)], [[2, 0], { preset: "commanderdraw", hash: DEFAULT_SETUP_HASH }], "R56g: the next wolf fight at (2, 0)");
  g.ev("startGuidedTutorial()");
  tutorialHands += 1;
  same(setupOf(g), { preset: "current", hash: CURRENT_HASH }, "R56g: the tutorial forces current + plain defaults inside a world fight");
  g.ev("endGuidedTutorial()");

  // ---- R56f ---------------------------------------------------------------------------------------------------------
  g.ev("startArena(createWorldNode(2, 1, { enemyMode: 'stag' }), 'topLeft')");
  same([g.ev("enemyMode"), setupOf(g), g.ev("reshuffleChargesRemaining")], ["stag", { preset: "current", hash: CURRENT_HASH }, 2], "R56f: a stag node keeps current + plain defaults");
  g.ev("devEndFight(false)");
  playAgain(g);
  same([g.ev("enemyMode"), setupOf(g)], ["stag", { preset: "current", hash: CURRENT_HASH }], "R56f: Play Again of a stag fight keeps current");

  const hands = ctxs.reduce((n, c) => n + S.handsOf(c), 0) + tutorialHands;
  check(hands <= HAND_LIMIT, `R56 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return { header: "REQUIREMENT — game loop", handsGenerated: hands, result: out };
}
module.exports = { id: ID, run };
