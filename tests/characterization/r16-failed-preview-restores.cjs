"use strict";
// REQUIREMENT — P1e acceptance
// R16: a preview that fails half-way leaves the live battle exactly as it was. On the lethal board (orders as
// hand cards), faults are injected by monkeypatching rules functions in the vm context (script.js resolves
// its calls through the global object at call time, as c10's wrappers rely on):
//   turn start      planEnemyPackTurnRules throws (enemy planning at turn start);
//   mid-tick        applyDamageToUnit applies the damage to the copy, THEN throws (damage resolution);
//   turn end        drawPlayerHandToSize throws (hand refill);
//   purity guard    recordBattleDebugTick calls renderActionQueue() first, so assertNotInCore throws inside
//                   the core.
// For each: dryRunTurn throws (message recorded), and afterwards every binding the swap touches is restored BY
// IDENTITY and by contents (units array + its six members, the six named unit bindings, unit queue arrays,
// enemyPackActionQueue + its entries, enemyPackFocusTarget, playerHand, terrain sets / hill levels, the hand
// RNG function and its position, activeRules, debug log / report / last turn's events), turnCoreDepth and
// turnDriverDepth are 0, the swap is cleared, isExecutingActionQueue is false, and the full live fingerprint
// (_preview.liveFingerprint, DOM included) is unchanged. Then the fault is removed and a normal real turn
// (executePlayerActionQueue) is played: its events, final state, hand and battle note equal those of a
// control context that never failed.
const P = require("./_preview.cjs");

const ID = "r16-failed-preview-restores";

const FAULTS = [
  { id: "turn-start-planning", name: "planEnemyPackTurnRules",
    patch: "function () { throw new Error('injected fault: enemy planning'); }" },
  { id: "mid-tick-damage", name: "applyDamageToUnit",
    patch: "function (...a) { const r = __orig(...a); throw new Error('injected fault: damage resolution'); }" },
  { id: "turn-end-hand-refill", name: "drawPlayerHandToSize",
    patch: "function () { throw new Error('injected fault: hand refill'); }" },
  { id: "presentation-inside-core", name: "recordBattleDebugTick",
    patch: "function (...a) { renderActionQueue(); return __orig(...a); }" },
];

const CAPTURE_REFS = `(function () {
  globalThis.__refs = {
    units, unitMembers: [...units], named: [player, playerSupport, playerFlank, enemy, enemySupport, enemyFlank],
    queues: units.map((u) => unitActionQueues.get(u)), queueContents: units.map((u) => JSON.stringify(unitActionQueues.get(u) ?? null)),
    packQueue: enemyPackActionQueue, packEntries: [...enemyPackActionQueue], packText: JSON.stringify(enemyPackActionQueue.map((e) => [getBattleDebugUnitId(e.unit), e.action])),
    focus: enemyPackFocusTarget, playerHand, handContents: JSON.stringify(playerHand),
    pond: pondTileKeys, hill: hillTileKeys, tree: treeTileKeys, hillLevels: hillTileLevels,
    terrainText: JSON.stringify([[...pondTileKeys], [...hillTileKeys], [...treeTileKeys], [...hillTileLevels]]),
    handRandom, handState: handRandom.getState(), handSeed, activeRules,
    debugLog: activeBattleDebugLog, debugReport: lastBattleDebugReport, lastTurnEventLog, lastTurnText: JSON.stringify(lastTurnEventLog),
    reshuffle: reshuffleChargesRemaining, gridSize: GRID_SIZE, enemyMode,
  };
})()`;

const CHECK_REFS = `JSON.stringify((function () {
  const r = __refs;
  const bad = [];
  const id = (label, a, b) => { if (a !== b) bad.push(label); };
  id("units array", units, r.units);
  units.forEach((u, i) => id("units[" + i + "]", u, r.unitMembers[i]));
  [player, playerSupport, playerFlank, enemy, enemySupport, enemyFlank].forEach((u, i) => id("named unit " + i, u, r.named[i]));
  units.forEach((u, i) => { id("queue array " + i, unitActionQueues.get(u), r.queues[i]); if (JSON.stringify(unitActionQueues.get(u) ?? null) !== r.queueContents[i]) bad.push("queue contents " + i); });
  id("enemyPackActionQueue", enemyPackActionQueue, r.packQueue);
  if (enemyPackActionQueue.length !== r.packEntries.length || enemyPackActionQueue.some((e, i) => e !== r.packEntries[i])) bad.push("pack entries");
  if (JSON.stringify(enemyPackActionQueue.map((e) => [getBattleDebugUnitId(e.unit), e.action])) !== r.packText) bad.push("pack contents");
  id("enemyPackFocusTarget", enemyPackFocusTarget, r.focus);
  id("playerHand", playerHand, r.playerHand);
  if (JSON.stringify(playerHand) !== r.handContents) bad.push("hand contents");
  id("pondTileKeys", pondTileKeys, r.pond); id("hillTileKeys", hillTileKeys, r.hill); id("treeTileKeys", treeTileKeys, r.tree); id("hillTileLevels", hillTileLevels, r.hillLevels);
  if (JSON.stringify([[...pondTileKeys], [...hillTileKeys], [...treeTileKeys], [...hillTileLevels]]) !== r.terrainText) bad.push("terrain contents");
  id("handRandom", handRandom, r.handRandom); id("hand RNG position", handRandom.getState(), r.handState); id("handSeed", handSeed, r.handSeed);
  id("activeRules", activeRules, r.activeRules);
  id("activeBattleDebugLog", activeBattleDebugLog, r.debugLog); id("lastBattleDebugReport", lastBattleDebugReport, r.debugReport);
  id("lastTurnEventLog", lastTurnEventLog, r.lastTurnEventLog);
  if (JSON.stringify(lastTurnEventLog) !== r.lastTurnText) bad.push("last turn contents");
  id("reshuffleChargesRemaining", reshuffleChargesRemaining, r.reshuffle); id("GRID_SIZE", GRID_SIZE, r.gridSize); id("enemyMode", enemyMode, r.enemyMode);
  id("turnCoreDepth", turnCoreDepth, 0); id("turnDriverDepth", turnDriverDepth, 0); id("battleStateSwap", battleStateSwap, null);
  id("isExecutingActionQueue", isExecutingActionQueue, false);
  return bad;
})())`;

async function playedTurn(g) {
  const events = await P.L.playTurn(g);
  return { events, state: P.snapshot(g), hand: P.evJ(g, "playerHand"), note: g.ev("lastBattleDebugReport") };
}

async function run() {
  // Control: never failed.
  const control = P.boot();
  P.BOARDS.lethal.setup(control);
  const controlTurn = await playedTurn(control);

  const out = { header: P.REQ_HEADER, board: P.BOARDS.lethal.description, faults: {} };
  for (const f of FAULTS) {
    const g = P.boot();
    P.BOARDS.lethal.setup(g);
    const before = P.liveFingerprint(g);
    g.ev(CAPTURE_REFS);
    g.ev(`globalThis.__orig = ${f.name}; globalThis.${f.name} = (function () { return ${f.patch}; })();`);
    const r = P.dryRun(g);
    g.ev(`globalThis.${f.name} = __orig;`);
    P.L.check(!r.ok, `${f.id}: the faulted dry run threw`);
    const bad = JSON.parse(g.ev(CHECK_REFS));
    P.L.same(bad, [], `${f.id}: every swapped binding restored by identity and contents`);
    P.L.same(P.liveFingerprint(g), before, `${f.id}: live fingerprint unchanged`);
    const turn = await playedTurn(g);
    P.L.same(turn.events, controlTurn.events, `${f.id}: later real turn events equal the never-failed control`);
    P.L.same(turn.state, controlTurn.state, `${f.id}: later real turn final state equals the control`);
    P.L.same(turn.hand, controlTurn.hand, `${f.id}: later real turn hand equals the control`);
    P.L.same(turn.note, controlTurn.note, `${f.id}: later real turn battle note equals the control`);
    out.faults[f.id] = {
      patched: f.name,
      thrown: `${r.error.name}: ${r.error.message}`,
      bindingsRestored: true,
      liveFingerprintUnchanged: true,
      laterRealTurnEqualsControl: true,
    };
  }
  out.controlTurn = { events: P.summarizeEvents(controlTurn.events), handAfter: controlTurn.hand.join(",") };
  return out;
}
module.exports = { id: ID, run };
