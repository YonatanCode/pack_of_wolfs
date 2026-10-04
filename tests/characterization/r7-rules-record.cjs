"use strict";
// REQUIREMENT — P1c acceptance (hard assertions; evidence in the golden)
// R7a: every RULES value (and every kept alias) equals the constants pinned from HEAD e4c1627.
// R7b: getRulesRecord() = { version "0.1.0-current", hash, values }; hash identical across fresh contexts.
// R7c: hash changes when ANY single leaf changes; unchanged by key-insertion order; array order matters.
// R7d: per-battle semantics: activeRules is a frozen snapshot re-taken from RULES at load/restart;
//      point-of-use reads proven by swapping the context binding (no override API exists).
// R7e: draw weights exist (all 1) and are hashed. P2a DECLARED CHANGE: they are now CONSULTED by the draw (weighted
// drawing is the approved P2a change); the P1c assertion that they were NOT consulted no longer holds. Identity under
// EQUAL weights is proven by r20; here we only assert that a skewed weight changes the hands.
// R7f: moved literals are no longer stand-alone definitions in script.js.
const fs = require("node:fs");
const path = require("node:path");
const { check, same, bootScenario, hand, counts, evJson, loadGame, units } = require("./_scn.cjs");
const { freshClearBoard, packQueue } = require("./_lib.cjs");

const ID = "r7-rules-record";
const PIN = JSON.parse(fs.readFileSync(path.join(__dirname, "pins", "rules-pinned-constants.json"), "utf8")).constants;

// pinned name -> path inside RULES (UNIT_DEFENDED_DAMAGE is derived: ceil(attack / divisor))
const MAP = {
  DEFAULT_GRID_SIZE: "buildDefaults.grid.defaultSize", MIN_GRID_SIZE: "buildDefaults.grid.minSize", MAX_GRID_SIZE: "buildDefaults.grid.maxSize",
  PLAYER_MOVE_SPEED: "buildDefaults.movement.playerMoveSpeed", PLAYER_MOVE_ANIMATION_STOP_EARLY_FRAMES: "buildDefaults.movement.animationStopEarlyFrames",
  PLAYER_MOVE_ANIMATION_MIN_VISIBLE_FRAMES: "buildDefaults.movement.animationMinVisibleFrames", MOVE_ACTION_TILE_COUNT: "buildDefaults.movement.moveActionTileCount",
  UNIT_MAX_HEALTH: "buildDefaults.combat.maxHealth", UNIT_ATTACK_DAMAGE: "buildDefaults.combat.attackDamage", UNIT_HIT_REACTION_MS: "buildDefaults.combat.hitReactionMs",
  UNIT_RECOVERY_SAFE_TURNS: "buildDefaults.recovery.safeTurns", UNIT_RECOVERY_HEAL_AMOUNT: "buildDefaults.recovery.healAmount",
  ACTIONS: "buildDefaults.actions.list",
  ENEMY_LOW_HEALTH_RATIO: "buildDefaults.enemy.lowHealthRatio", ENEMY_FLEE_TRIGGER_RANGE: "buildDefaults.enemy.fleeTriggerRange", ENEMY_FLEE_SAFE_RANGE: "buildDefaults.enemy.fleeSafeRange",
  ACTION_SLOT_COUNT: "perBattle.handSize", ACTION_QUEUE_SLOT_COUNT: "perBattle.playerActionBudget", RESHUFFLE_CHARGES_PER_BATTLE: "perBattle.reshuffleCharges",
  MAX_SAME_ACTION: "perBattle.maxSameAction", ENEMY_PLAN_ACTION_COUNT: "perBattle.enemyActionBudget", ENEMY_AGGRESSIVE_DOCTRINE: "perBattle.enemyActionPool",
};

const record = (g) => evJson(g, "window.devTest.getRulesRecord()");
const leafPaths = (v, p = []) => (v && typeof v === "object"
  ? Object.keys(v).flatMap((k) => leafPaths(v[k], [...p, Array.isArray(v) ? Number(k) : k])) : [p]);
const getAt = (o, p) => p.reduce((x, k) => x[k], o);
const reverseKeys = (v) => (Array.isArray(v) ? v.map(reverseKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reverseKeys(v[k])])) : v);
const hashIn = (g, obj) => g.ev(`computeRulesHash(${JSON.stringify(obj)})`);
/** Install a frozen, modified activeRules in the context (what a P2 override would do), run fn, restore. */
function withActive(g, patch, fn) {
  g.ev(`window.__saved = activeRules; activeRules = deepFreeze({ ...activeRules, ...${JSON.stringify(patch)} });`);
  try { return fn(); } finally { g.ev("activeRules = window.__saved; delete window.__saved;"); }
}

async function run() {
  const g = bootScenario(1);

  // ---- R7a
  const names = Object.keys(PIN);
  check(names.every((n) => n === "UNIT_DEFENDED_DAMAGE" || MAP[n]), "every pinned name is mapped");
  const aliasChecked = [];
  names.forEach((n) => {
    same(evJson(g, n), PIN[n], `alias ${n} equals pinned value`);
    if (n !== "UNIT_DEFENDED_DAMAGE") same(evJson(g, `RULES.${MAP[n]}`), PIN[n], `RULES.${MAP[n]} equals pinned ${n}`);
    aliasChecked.push(n);
  });
  check(g.ev("RULES.buildDefaults.combat.attackDamage") === 3 && PIN.UNIT_DEFENDED_DAMAGE === 1 && g.ev("UNIT_DEFENDED_DAMAGE") === 1, "derived defended damage 1");
  same(evJson(g, "RULES.perBattle.drawWeights"), { Move: 1, Attack: 1, Defend: 1 }, "draw weights");
  same(Object.keys(PIN).length, 23, "pin table size");

  // ---- R7b
  const rec = record(g);
  check(rec.version === "0.1.0-current" && g.ev("RULES_VERSION") === "0.1.0-current", "version");
  check(typeof rec.hash === "string" && /^[0-9a-f]{14}$/.test(rec.hash), "hash is a 14-hex string");
  check(hashIn(g, rec.values) === rec.hash, "hash == computeRulesHash(values)");
  same(rec.values, evJson(g, "RULES"), "record values are the full RULES");
  const rec2 = record(loadGame({ query: "?mode=world", scenarios: true }));
  check(rec2.hash === rec.hash, "hash identical across fresh contexts (and boot modes)");
  check(rec.values !== undefined && g.ev("Object.isFrozen(devTest.getRulesRecord().values)") === false, "record values are a plain clone (not the frozen RULES)");
  const rb = loadGame({ query: "?scenario=intro&seed=9", scenarios: true });
  check(record(rb).hash === rec.hash, "hash independent of seed");

  // ---- R7c
  const leaves = leafPaths(rec.values);
  let changed = 0;
  leaves.forEach((p) => {
    const c = JSON.parse(JSON.stringify(rec.values));
    const parent = getAt(c, p.slice(0, -1)); const k = p[p.length - 1];
    parent[k] = typeof parent[k] === "number" ? parent[k] + 1 : parent[k] + "x";
    check(hashIn(g, c) !== rec.hash, `hash changes when ${p.join(".")} changes`);
    changed += 1;
  });
  check(changed === leaves.length && leaves.length >= 30, "all leaves exercised");
  check(hashIn(g, reverseKeys(rec.values)) === rec.hash, "key insertion order does not change the hash");
  const swapped = JSON.parse(JSON.stringify(rec.values)); swapped.perBattle.enemyActionPool.reverse();
  check(hashIn(g, swapped) !== rec.hash, "array order is significant");
  const grown = JSON.parse(JSON.stringify(rec.values)); grown.perBattle.extra = 1;
  check(hashIn(g, grown) !== rec.hash, "adding a key changes the hash");

  // ---- R7d
  const subset = (rules) => { const { version, hash, ...rest } = rules; return rest; };
  const ar = () => evJson(g, "window.devTest.getActiveRules()");
  same(subset(ar()), rec.values.perBattle, "boot: activeRules == RULES.perBattle");
  check(ar().version === rec.version && ar().hash === rec.hash, "activeRules carries version/hash");
  check(g.ev("Object.isFrozen(activeRules) && Object.isFrozen(activeRules.drawWeights) && Object.isFrozen(activeRules.enemyActionPool)"), "activeRules is deep-frozen");
  check(g.ev("Object.isFrozen(RULES) && Object.isFrozen(RULES.perBattle.drawWeights) && Object.isFrozen(RULES.buildDefaults.combat) && Object.isFrozen(RULES.perBattle.enemyActionPool)"), "RULES is deep-frozen");
  const tamper = (expr) => g.ev(`(function(){ "use strict"; try { ${expr}; return "no-throw"; } catch (e) { return e.constructor.name; } })()`);
  const tampered = {
    strict: ["activeRules.handSize = 9", "activeRules.drawWeights.Move = 9", "activeRules.enemyActionPool.push('Move')", "RULES.perBattle.handSize = 9",
      "RULES.buildDefaults.combat.attackDamage = 99", "delete RULES.perBattle.maxSameAction"].map((e) => [e, tamper(e)]),
  };
  tampered.strict.forEach(([e, r]) => check(r === "TypeError", `strict tamper throws TypeError: ${e}`));
  g.ev("activeRules.handSize = 9; RULES.perBattle.handSize = 9;"); // sloppy mode: silently ignored
  check(g.ev("activeRules.handSize") === 5 && g.ev("RULES.perBattle.handSize") === 5, "sloppy tamper ignored");
  check(g.ev("ACTION_SLOT_COUNT") === 5, "alias unaffected");
  check(rec.hash === record(g).hash, "hash unchanged after tamper attempts");

  // re-take at every battle load/restart path
  const retake = {};
  const stale = "activeRules = deepFreeze({ ...activeRules, handSize: 2, reshuffleCharges: 7 })";
  g.ev(stale); g.ev("window.devTest.loadScenario('intro', 3)");
  same(subset(ar()), rec.values.perBattle, "loadScenario re-takes activeRules"); retake.loadScenario = true;
  check(g.ev("reshuffleChargesRemaining") === 2, "loadScenario charges come from the re-taken snapshot");
  g.ev(stale); check(g.ev("window.devTest.restartBattle()") === true, "restart ok");
  same(subset(ar()), rec.values.perBattle, "restartBattle re-takes activeRules"); retake.restartBattle = true;
  const w = loadGame({ query: "?mode=world", scenarios: true });
  w.ev(stale); w.ev("resetGame()");
  same(subset(evJson(w, "window.devTest.getActiveRules()")), rec.values.perBattle, "resetGame (legacy path) re-takes activeRules"); retake.resetGame = true;
  check(w.ev("reshuffleChargesRemaining") === 2 && w.ev("actionsList.children.length") === 5, "resetGame draws a full default hand");
  w.ev(stale); w.ev("startArena({ enemyMode: 'wolves' }, 'bottom')");
  same(subset(evJson(w, "window.devTest.getActiveRules()")), rec.values.perBattle, "startArena re-takes activeRules"); retake.startArena = true;
  check(w.ev("reshuffleChargesRemaining") === 2, "startArena charges from snapshot");
  check(evJson(g, "window.devTest.getBattleRecord()").rules.hash === rec.hash, "getBattleRecord carries rules identity");
  same(evJson(g, "getBattleSeeds()"), { scenarioId: "intro", scenarioVersion: evJson(g, "getBattleSeeds()").scenarioVersion, seed: 3, handSeed: 3 }, "getBattleSeeds unchanged (no rules field)");

  // point-of-use: swapping the binding changes behaviour
  const evidence = {};
  const h3 = bootScenario(4);
  evidence.handSize3 = withActive(h3, { handSize: 3 }, () => { h3.ev("actionsList.replaceChildren(); refillAvailableActions()"); return hand(h3).length; });
  check(evidence.handSize3 === 3, "refillAvailableActions draws activeRules.handSize cards");
  const h7 = bootScenario(4);
  evidence.handSize7 = withActive(h7, { handSize: 7, maxSameAction: 7 }, () => { h7.ev("actionsList.replaceChildren(); refillAvailableActions()"); return hand(h7).length; });
  check(evidence.handSize7 === 7, "hand size 7 with matching cap");
  const hc = bootScenario(4);
  evidence.capOneMaxCount = withActive(hc, { handSize: 3, maxSameAction: 1 }, () => { hc.ev("actionsList.replaceChildren(); refillAvailableActions()"); return Math.max(...Object.values(counts(hand(hc)))); });
  check(evidence.capOneMaxCount === 1, "maxSameAction=1 yields 3 distinct cards");
  const hb = bootScenario(4);
  evidence.queueFull = withActive(hb, { playerActionBudget: 2 }, () => {
    hb.ev("setPlayerSelected(player)");
    const act = hand(hb);
    hb.ev(`applyPlayerAction(${JSON.stringify(act[0])}); applyPlayerAction(${JSON.stringify(act[1])}); applyPlayerAction(${JSON.stringify(act[2])})`);
    return { queued: hb.ev("getQueuedPlayerActionTotal()"), full: hb.ev("isUnitActionQueueFull(player)") };
  });
  same(evidence.queueFull, { queued: 2, full: true }, "player action budget 2 caps queueing and isUnitActionQueueFull");
  const hb2 = bootScenario(4);
  hb2.ev("setPlayerSelected(player)");
  const act2 = hand(hb2);
  hb2.ev(`applyPlayerAction(${JSON.stringify(act2[0])}); applyPlayerAction(${JSON.stringify(act2[1])}); applyPlayerAction(${JSON.stringify(act2[2])})`);
  const tagCount2 = (x) => { x.ev("renderUnitIntentTags(player)"); return x.ev("Array.from(player.intentTags.querySelectorAll('.unit-intent-label')).length"); };
  evidence.tagSlice = { queued: hb2.ev("getUnitActionQueue(player).length"), defaultBudget: tagCount2(hb2),
    budget1: withActive(hb2, { playerActionBudget: 1 }, () => tagCount2(hb2)), budget2: withActive(hb2, { playerActionBudget: 2 }, () => tagCount2(hb2)) };
  same(evidence.tagSlice, { queued: 3, defaultBudget: 3, budget1: 1, budget2: 2 }, "intent tags rendered and sliced exactly by playerActionBudget");

  const SETUP_A = [
    { row: 12, col: 6, direction: "topRight" }, { row: 12, col: 8, direction: "topRight" }, { row: 13, col: 7, direction: "topRight" },
    { row: 3, col: 6, direction: "bottomLeft" }, { row: 3, col: 8, direction: "bottomLeft" }, { row: 2, col: 10, direction: "bottomLeft" }];
  const pa = freshClearBoard(SETUP_A);
  const planPack = (x) => { x.ev(`planEnemyPackTurn(units.filter((u) => u.team === "enemy" && u.type === "wolf"), units.filter((u) => u.team === "player"))`); return packQueue(x).length; };
  const base = planPack(pa);
  const pb = freshClearBoard(SETUP_A);
  evidence.packPlan = { defaultBudget: base, budget1: withActive(pb, { enemyActionBudget: 1 }, () => planPack(pb)) };
  check(base === 3 && evidence.packPlan.budget1 === 1, "planEnemyPackTurn stops at enemyActionBudget (default queue 3, budget 1 gives 1)");
  const pc = freshClearBoard(SETUP_A);
  evidence.planEnemyTurn = { defaultBudget: pc.ev("planEnemyTurn(enemy, player).length"), budget2: withActive(pc, { enemyActionBudget: 2 }, () => pc.ev("planEnemyTurn(enemy, player).length")) };
  check(evidence.planEnemyTurn.defaultBudget === 3 && evidence.planEnemyTurn.budget2 === 2, "planEnemyTurn fills to enemyActionBudget");
  const SETUP_B = [
    { row: 6, col: 6, direction: "topRight" }, { row: 6, col: 9, direction: "topRight" }, { row: 8, col: 6, direction: "topRight" },
    { row: 5, col: 6, direction: "bottomLeft" }, { row: 6, col: 10, direction: "topLeft" }, { row: 4, col: 8, direction: "bottomLeft" }];
  const POOLS = { allDefend: ["Defend", "Defend", "Defend", "Defend", "Defend"], attackAttack: ["Attack", "Attack"] };
  const plans = (setup, patch) => {
    const x = freshClearBoard(setup); const y = freshClearBoard(setup);
    const run2 = () => ({ single: evJson(x, "planEnemyTurn(enemy, player)"),
      pack: (y.ev(`planEnemyPackTurn(units.filter((u) => u.team === "enemy" && u.type === "wolf"), units.filter((u) => u.team === "player"))`), packQueue(y).map((e) => e.action)) });
    if (!patch) return run2();
    x.ev(`activeRules = deepFreeze({ ...activeRules, enemyActionPool: ${JSON.stringify(patch)} })`);
    y.ev(`activeRules = deepFreeze({ ...activeRules, enemyActionPool: ${JSON.stringify(patch)} })`);
    return run2();
  };
  const hasMA = (l) => l.some((a) => a === "Move" || a === "Attack");
  const def = plans(SETUP_B);
  check(hasMA(def.single) && hasMA(def.pack), "default pool: plans contain Move/Attack");
  const allDef = plans(SETUP_B, POOLS.allDefend);
  check(!hasMA(allDef.single) && !hasMA(allDef.pack) && allDef.single.length > 0 && allDef.pack.length > 0, "all-Defend pool: plans contain only Defend");
  check(JSON.stringify(allDef.single) !== JSON.stringify(def.single) && JSON.stringify(allDef.pack) !== JSON.stringify(def.pack), "all-Defend plans differ from default");
  const atk = plans(SETUP_B, POOLS.attackAttack);
  same(atk.single, ["Attack", "Attack"], "[Attack,Attack] pool: single plan is exactly two Attacks");
  check(atk.pack.length === 2 && atk.pack.every((a) => a === "Attack"), "[Attack,Attack] pool: pack plan is exactly two Attacks");
  const mv = plans(SETUP_A, ["Move", "Move", "Move", "Move", "Move"]);
  check(mv.single.length === 3 && mv.pack.length === 5 && mv.single.concat(mv.pack).every((a) => a === "Move"), "all-Move pool (far setup): Moves only");
  evidence.doctrinePool = { default: def, allDefend: allDef, attackAttack: atk, allMoveFar: mv };
  const rc = bootScenario(4);
  evidence.reshuffleCharges = withActive(rc, { reshuffleCharges: 1 }, () => { rc.ev("window.devTest.restartBattle()"); return rc.ev("reshuffleChargesRemaining"); });
  check(evidence.reshuffleCharges === 2, "restart re-takes the snapshot from RULES (swapped binding is replaced)");
  // charges at load come from the snapshot taken at that load (RULES), not a stale binding
  same(rc.ev("activeRules.reshuffleCharges"), 2, "snapshot back to RULES after restart");

  // ---- R7e
  check(Object.values(rec.values.perBattle.drawWeights).every((x) => x === 1), "draw weights are all 1");
  const w2 = JSON.parse(JSON.stringify(rec.values)); w2.perBattle.drawWeights.Move = 5;
  check(hashIn(g, w2) !== rec.hash, "draw weights are part of the hash");
  // loadScenario re-takes activeRules from RULES, so patch AFTER load per seed instead:
  const handsPatched = (patch) => {
    const x = bootScenario(1); const out = [];
    for (let s = 0; s < 500; s += 1) {
      x.ev(`window.devTest.loadScenario("intro", ${s})`);
      out.push(withActive(x, patch, () => { x.ev("actionsList.replaceChildren(); seedHandRandom(" + s + "); refillAvailableActions()"); return hand(x); }));
    }
    return out;
  };
  const eq = handsPatched({ drawWeights: Object.freeze({ Move: 1, Attack: 1, Defend: 1 }) });
  const skew = handsPatched({ drawWeights: Object.freeze({ Move: 5, Attack: 1, Defend: 1 }) });
  const differing = skew.filter((h, i) => h.join(",") !== eq[i].join(",")).length;
  check(differing > 0, "P2a: draw weights are consulted: {5,1,1} changes hands relative to {1,1,1}");
  check(eq.length === 500 && eq.every((h) => h.length === 5), "500 hands of 5");
  check(new Set(eq.map((h) => h.join(","))).size > 20, "hands vary across seeds");

  // ---- R7f
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "script.js"), "utf8");
  const banned = [/const ACTION_SLOT_COUNT = 5/, /const ACTION_QUEUE_SLOT_COUNT = 5/, /const RESHUFFLE_CHARGES_PER_BATTLE = 2/, /const MAX_SAME_ACTION = 3/,
    /const ENEMY_PLAN_ACTION_COUNT = 5/, /const ENEMY_AGGRESSIVE_DOCTRINE = \[/, /const UNIT_ATTACK_DAMAGE = 3/, /const UNIT_MAX_HEALTH = 10/,
    /const ACTIONS = \[/, /const ENEMY_FLEE_SAFE_RANGE = 7/];
  banned.forEach((re) => check(!re.test(src), `script.js has no stand-alone ${re}`));
  const useSites = ["ACTION_SLOT_COUNT", "ACTION_QUEUE_SLOT_COUNT", "RESHUFFLE_CHARGES_PER_BATTLE", "MAX_SAME_ACTION", "ENEMY_PLAN_ACTION_COUNT", "ENEMY_AGGRESSIVE_DOCTRINE"];
  const lines = src.split("\n");
  // Line-number independent: per alias, record each reference's context (its own definition, or the
  // nearest preceding dev-scenario `id: "..."`), never an absolute line number.
  const contextOf = (n, i) => {
    if (new RegExp(`^const ${n} = RULES\\.`).test(lines[i])) return "alias-definition";
    for (let j = i; j >= 0; j -= 1) { const m = /^\s*id: "([^"]+)"/.exec(lines[j]); if (m) return `dev-scenario:${m[1]}`; }
    return "UNKNOWN";
  };
  const leftover = {};
  useSites.forEach((n) => {
    const re = new RegExp(`\\b${n}\\b`);
    leftover[n] = lines.map((l, i) => [l, i]).filter(([l]) => re.test(l) && !/^\s*\/\//.test(l)).map(([, i]) => contextOf(n, i));
  });
  Object.entries(leftover).forEach(([n, ctx]) => {
    check(ctx.filter((c) => c === "alias-definition").length === 1, `${n}: exactly one alias definition`);
    const others = ctx.filter((c) => c !== "alias-definition");
    if (n === "ACTION_QUEUE_SLOT_COUNT") check(others.length === 3 && others.every((c) => c === "dev-scenario:player-shared-action-cap"), `${n}: only the player-shared-action-cap dev-scenario expect (got ${others})`);
    else check(others.length === 0, `${n} only referenced by its alias definition (got ${others})`);
  });

  return {
    header: "REQUIREMENT — P1c acceptance",
    version: rec.version, hash: rec.hash,
    pinnedChecked: aliasChecked,
    leavesHashed: leaves.length, orderIndependent: true, arrayOrderSignificant: true,
    tamper: tampered.strict.map(([e, r]) => `${e} -> ${r}`), sloppyTamperIgnored: true,
    retakeOn: Object.keys(retake),
    pointOfUseEvidence: evidence,
    drawWeightsConsulted: { seeds: 500, handsDifferingUnderSkew: differing, sampleHands: eq.slice(0, 3) },
    aliasReferenceContexts: leftover,
  };
}
module.exports = { id: ID, run };
