"use strict";
// REQUIREMENT — P1e acceptance
// R17: a BattleState copy shares nothing mutable with the live battle, is plain JSON data, and restores the
// battle (incl. the hand-stream POSITION) in a fresh context. Board: seed-1 intro after one real played turn
// (so positions, hand, RNG position and the battle note differ from boot), with new cards queued.
//   1. Shares nothing: no object/array inside the snapshot is identical to any object reachable from the live
//      battle state (units, unit queues, pack queue + entries, packObjective objects, hand, terrain sets / map,
//      activeRules and its nested values); snapshot.rules is not the live frozen activeRules and is not frozen.
//   2. Snapshot -> live: EVERY leaf of the snapshot is mutated (numbers, strings, booleans, nulls), every
//      array is pushed to and every object gets a new key (rules values, RNG state, queue entries included):
//      the live fingerprint (_preview.liveFingerprint) and a fresh snapshot are unchanged.
//   3. Live -> snapshot: the live battle is mutated (unit fields, queues, pack queue and entries, focus,
//      packObjective, hand, reshuffle charges, terrain sets, hill levels, two hand-stream draws, activeRules
//      rebound): a previously taken snapshot's JSON is unchanged.
//   4. JSON round trip: JSON.parse(JSON.stringify(s)) deep-equals s (strict structural walk: only plain
//      objects/arrays/strings/finite numbers/booleans/null, same keys in the same order).
//   5. Fresh context: loadBattleState(snapshot from A) into a freshly booted B gives an identical snapshot,
//      identical next 3 hand-stream draws, and an identical dry run (same event hash). loadBattleState with a
//      different grid size is refused (BattleStateError) without changing anything.
const P = require("./_preview.cjs");

const ID = "r17-copy-independence";

// Every live object the rules state lives in (walks plain objects/arrays/Sets/Maps; skips DOM and functions).
const LIVE_OBJECTS = `(function () {
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v) || v.nodeType !== undefined) return;
    seen.add(v);
    if (v instanceof Set || v instanceof Map) { v.forEach((x, k) => { walk(x); walk(k); }); return; }
    Object.keys(v).forEach((k) => { if (k !== "element" && k !== "healthBar" && k !== "intentTags" && k !== "hiddenTag") walk(v[k]); });
  };
  [units, enemyPackActionQueue, enemyPackFocusTarget, playerHand, pondTileKeys, hillTileKeys, treeTileKeys, hillTileLevels,
    activeRules, RULES].forEach(walk);
  units.forEach((u) => walk(unitActionQueues.get(u)));
  return seen;
})()`;

const SHARED_WITH_LIVE = `(function (s) {
  const live = ${LIVE_OBJECTS};
  const shared = [];
  const walk = (v, path) => {
    if (!v || typeof v !== "object") return;
    if (live.has(v)) shared.push(path);
    Object.keys(v).forEach((k) => walk(v[k], path + "." + k));
  };
  walk(s, "$");
  return shared;
})`;

const MUTATE_EVERYTHING = `(function (s) {
  let count = 0;
  const walk = (v) => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => { if (x && typeof x === "object") walk(x); else { v[i] = bump(x); count += 1; } });
      v.push("mutated"); count += 1;
      return;
    }
    Object.keys(v).forEach((k) => { if (v[k] && typeof v[k] === "object") walk(v[k]); else { v[k] = bump(v[k]); count += 1; } });
    v.__mutated = true; count += 1;
  };
  const bump = (x) => typeof x === "number" ? x + 1000 : typeof x === "string" ? x + "~" : typeof x === "boolean" ? !x : "was-null";
  walk(s);
  return count;
})`;

const MUTATE_LIVE = `(function () {
  units.forEach((u) => { u.row += 1; u.col += 1; u.health -= 1; u.direction = "topLeft"; u.isHidden = !u.isHidden; u.turnsSinceHit += 5; });
  getUnitActionQueue(player).push("Defend"); getUnitActionQueue(playerSupport).length = 0;
  if (enemyPackActionQueue.length) { enemyPackActionQueue[0].action = "Mutated"; enemyPackActionQueue[0].unit = player; }
  enemyPackActionQueue.push({ unit: enemy, action: "Attack" });
  enemyPackFocusTarget = playerFlank;
  if (enemy.packObjective) { enemy.packObjective.mode = "mutated"; if (enemy.packObjective.slotDelta) enemy.packObjective.slotDelta.row = 99; }
  playerHand.push("Attack"); playerHand.reverse(); reshuffleChargesRemaining -= 1;
  pondTileKeys.add("0,0"); hillTileKeys.add("1,1"); treeTileKeys.add("2,2"); hillTileLevels.set("1,1", 7);
  handRandom(); handRandom();
  activeRules = deepFreeze({ ...activeRules, handSize: 9 });
})()`;

// Strict structural equality after a JSON round trip (plain data only, same key order).
const ROUND_TRIP_PROBLEMS = `(function (s) {
  const problems = [];
  const plainProto = (v) => Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === Array.prototype;
  const eq = (a, b, path) => {
    if (a === null || typeof a !== "object") {
      if (typeof a === "number" && !Number.isFinite(a)) problems.push(path + " non-finite");
      if (!["string", "number", "boolean"].includes(typeof a) && a !== null) problems.push(path + " " + typeof a);
      if (a !== b) problems.push(path + " differs");
      return;
    }
    if (!plainProto(a)) problems.push(path + " not a plain object/array");
    if (Array.isArray(a) !== Array.isArray(b)) { problems.push(path + " array/object"); return; }
    const ka = Object.keys(a); const kb = Object.keys(b ?? {});
    if (ka.join() !== kb.join()) problems.push(path + " keys");
    ka.forEach((k) => eq(a[k], b[k], path + "." + k));
  };
  eq(s, JSON.parse(JSON.stringify(s)), "$");
  return problems;
})`;

async function prepareA() {
  const a = P.boot();
  P.BOARDS.plain.setup(a);
  await P.L.playTurn(a);
  const orders = [...P.L.queueByIndex(a, "player", [0]), ...P.L.queueByIndex(a, "playerFlank", [1])];
  return { a, orders };
}

async function run() {
  const out = { header: P.REQ_HEADER };
  const { a, orders } = await prepareA();
  out.board = { description: "seed-1 intro, one real turn played (first card to P1/P2/P3), then cards 0 -> P1 and 1 -> P3 queued", ordersQueued: orders };

  // 1. shares nothing
  a.ev("globalThis.__s1 = snapshotBattleState();");
  const shared = JSON.parse(a.ev(`JSON.stringify(${SHARED_WITH_LIVE}(__s1))`));
  P.L.same(shared, [], "snapshot shares no object with the live battle");
  P.L.check(a.ev("__s1.rules !== activeRules && __s1.rules.values !== activeRules && !Object.isFrozen(__s1.rules.values) && !Object.isFrozen(__s1.rules.values.enemyActionPool)"), "snapshot rules are a plain, unfrozen copy");
  out.sharesNothing = { sharedPaths: shared, rulesIsLiveFrozenObject: false };

  // 2. snapshot mutation does not reach the live battle
  const before = P.liveFingerprint(a);
  const mutatedLeaves = a.ev(`${MUTATE_EVERYTHING}(__s1)`);
  P.L.check(mutatedLeaves > 100, `mutated every leaf/array/object of the snapshot (${mutatedLeaves})`);
  P.L.same(P.liveFingerprint(a), before, "mutating the snapshot leaves the live battle unchanged");
  out.snapshotMutation = { mutationsApplied: "> 100 (every leaf, array and object)", liveUnchanged: true };

  // 3. live mutation does not reach an earlier snapshot
  a.ev("globalThis.__s2 = snapshotBattleState(); globalThis.__s2text = JSON.stringify(__s2);");
  a.ev(MUTATE_LIVE);
  P.L.check(a.ev("JSON.stringify(snapshotBattleState()) !== __s2text"), "the live mutation is visible in a NEW snapshot");
  P.L.check(a.ev("JSON.stringify(__s2) === __s2text"), "an earlier snapshot is unchanged by live mutation");
  out.liveMutation = { newSnapshotDiffers: true, earlierSnapshotUnchanged: true };

  // 4. JSON round trip
  const { a: a2 } = await prepareA();
  const rt = JSON.parse(a2.ev(`JSON.stringify(${ROUND_TRIP_PROBLEMS}(snapshotBattleState()))`));
  P.L.same(rt, [], "snapshot is JSON-roundtrip stable");
  out.jsonRoundTrip = { problems: rt };

  // 5. load into a fresh context
  const state = P.snapshot(a2);
  const b = P.boot();
  P.L.check(JSON.stringify(P.snapshot(b)) !== JSON.stringify(state), "fresh context starts from a different state");
  b.ev(`loadBattleState(${JSON.stringify(state)})`);
  P.L.same(P.snapshot(b), state, "snapshot after loadBattleState equals the loaded state");
  const dryA = P.dryRun(a2); const dryB = P.dryRun(b);
  P.L.check(dryA.ok && dryB.ok && dryA.result.eventHash === dryB.result.eventHash, "dry run of the loaded copy equals the original's");
  P.L.same(dryB.result.finalState, dryA.result.finalState, "dry-run final states equal");
  const drawsA = P.evJ(a2, "[handRandom(), handRandom(), handRandom()]");
  const drawsB = P.evJ(b, "[handRandom(), handRandom(), handRandom()]");
  P.L.same(drawsB, drawsA, "next 3 hand-stream draws equal (RNG position restored)");
  const c = P.boot();
  const cBefore = P.liveFingerprint(c);
  const bad = c.ev(`(function () { try { loadBattleState(${JSON.stringify({ ...state, config: { ...state.config, gridSize: state.config.gridSize + 1 } })}); return "NO THROW"; } catch (e) { return e.name + ": " + e.message; } })()`);
  P.L.check(bad.startsWith("BattleStateError"), `grid-size mismatch refused: ${bad}`);
  P.L.same(P.liveFingerprint(c), cBefore, "refused load changed nothing");
  out.freshContextLoad = {
    loadedState: { units: state.units.map((u) => `${u.id} r${u.row} c${u.col} hp${u.health} q=[${u.queue}]`), hand: state.hand.cards.join(","), rng: state.rng },
    snapshotIdentical: true,
    next3Draws: drawsA.map((v) => Math.round(v * 1e6) / 1e6),
    dryRunEventHash: dryA.result.eventHash,
    mismatchedGridSize: bad,
  };
  return out;
}
module.exports = { id: ID, run };
