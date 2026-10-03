"use strict";
// REQUIREMENT — P1b acceptance
// R2: restartBattle() restores EVERYTHING the battle owns. Dirty a battle with a hand-authored
// 2-turn history (turn 1 with applyTurnEndRecovery, turn 2 without, so tookDamageThisTurn is still
// set), a spent reshuffle charge, a queued order, a selected unit, hand-set isFleeing/packObjective and a
// shown result overlay; restart; compare full snapshots to a freshly booted context. Hard assertions.
const { REQ_HEADER, check, same, bootScenario, hand, snapshot, streamTail, placeFight, queueByIndex, setEnemyOrders, turnEnd, runTurn, evJson } = require("./_scn.cjs");

const ID = "r2-restart-resets";
const SEED = 1;

async function dirty(g) {
  placeFight(g);
  setEnemyOrders(g, [{ unitId: "enemy", action: "Attack" }, { unitId: "enemySupport", action: "Defend" }]);
  const t1 = queueByIndex(g, "player", [0, 1]);
  await runTurn(g);
  turnEnd(g); // refill + recovery
  g.ev("reshuffleActions()"); // spend a charge, clear queues, new hand
  setEnemyOrders(g, [{ unitId: "enemy", action: "Attack" }]);
  const t2 = queueByIndex(g, "player", [0]);
  await runTurn(g); // no recovery: tookDamageThisTurn stays true
  // leave live state behind: a queued order, a selected unit, a pack plan + focus, flags, overlay
  g.ev("refillAvailableActions()");
  queueByIndex(g, "playerSupport", [0]);
  g.ev(`enemyPackActionQueue.push({ unit: enemySupport, action: "Move" }); enemyPackFocusTarget = playerSupport;
    enemy.isFleeing = true; enemy.packObjective = "scripted-objective"; setPlayerSelected(playerFlank); showGameResult(true);`);
  return { t1, t2 };
}

async function run() {
  const fresh = bootScenario(SEED);
  const freshSnap = snapshot(fresh);
  const freshTail = streamTail(fresh);

  const g = bootScenario(SEED);
  const cards = await dirty(g);
  const d = snapshot(g);
  // sanity: the dirtying really changed what restart must reset
  const u = d.units;
  check(Object.values(u).some((x) => x.health < x.maxHealth), "dirty: some unit damaged");
  check(Object.values(u).some((x) => x.turnsSinceHit > 0), "dirty: non-zero turnsSinceHit");
  check(Object.values(u).some((x) => x.tookDamageThisTurn), "dirty: tookDamageThisTurn set");
  check(d.reshuffleCharges === 1, "dirty: reshuffle charge spent");
  check(Object.values(u).some((x) => x.queue.length > 0), "dirty: a queued order");
  check(d.selected === "P3" && d.overlayHidden === false, "dirty: unit selected, overlay shown");
  check(d.packQueue.length > 0 && d.packFocus !== null, "dirty: pack queue + focus");
  check(u.E1.isFleeing && u.E1.packObjective === "scripted-objective", "dirty: flags set");

  check(g.ev("window.devTest.restartBattle()") === true, "restartBattle returns true");
  const r1 = snapshot(g);
  same(r1, freshSnap, "restartBattle snapshot equals freshly loaded snapshot");
  const r1Tail = streamTail(g);
  same(r1Tail, freshTail, "hand RNG stream restarted (next 8 draws equal a fresh load's)");

  // second restart (after dirtying again) and resetGame() give identical snapshots
  await dirty(g);
  check(g.ev("window.devTest.restartBattle()") === true, "second restart ok");
  const r2 = snapshot(g);
  same(r2, r1, "second restart snapshot equals first");
  await dirty(g);
  g.ev("resetGame()");
  const r3 = snapshot(g);
  same(r3, r1, "resetGame() snapshot equals restartBattle snapshot");

  // ---- kill-then-restart: scripted terminal outcome in one turn
  g.ev("window.devTest.restartBattle()");
  placeFight(g);
  g.ev("enemy.health = 1; updateUnitHealthBar(enemy)");
  setEnemyOrders(g, [{ unitId: "enemySupport", action: "Defend" }]);
  g.ev("getUnitActionQueue(player).push('Attack')"); // scripted attack on the 1-HP wolf
  await runTurn(g);
  g.ev("refillAvailableActions(); applyTurnEndRecovery();");
  const killed = snapshot(g);
  check(killed.units.E1.isDefeated && killed.units.E1.health === 0, "kill case: E1 defeated");
  check(killed.units.E1.hasPlayedDeathAnimation === true && killed.units.E1.hasDeathPromise === true, "kill case: death animation played/promise set");
  const sprite = { anim: killed.units.E1.animationName, hidden: killed.units.E1.elementHidden };
  check(sprite.anim === "death" || sprite.hidden, "kill case: sprite is in death state or hidden");
  g.ev("lastBattleDebugReport = 'stale report'; window.lastBattleDebugReport = 'stale report'; activeBattleDebugLog = {};");
  check(snapshot(g).debugReport.lexical === "stale report", "kill case: stale debug report set");
  check(g.ev("window.devTest.restartBattle()") === true, "restart after kill");
  const afterKill = snapshot(g);
  same(afterKill, freshSnap, "restart after a kill equals the fresh snapshot (death flags, promise, sprite state, debug report cleared)");
  same(afterKill.debugReport, { lexical: "", window: "", activeLogIsNull: true }, "debug report cleared");
  check(afterKill.units.E1.hasDeathPromise === false && afterKill.units.E1.hasPlayedDeathAnimation === false && afterKill.units.E1.elementHidden === false, "E1 alive again, sprite shown");

  // ---- also: a non-empty debug report is cleared by a plain restart
  g.ev("lastBattleDebugReport = 'x'; window.lastBattleDebugReport = 'x'");
  g.ev("window.devTest.restartBattle()");
  same(snapshot(g).debugReport, { lexical: "", window: "", activeLogIsNull: true }, "debug report cleared by restart");

  // restart refused while a turn is executing (real in-flight turn, not a flag poke)
  placeFight(g);
  setEnemyOrders(g, [{ unitId: "enemy", action: "Attack" }]);
  queueByIndex(g, "player", [0]);
  const before = snapshot(g);
  const pending = g.ev("window.devTest.runTurn()");
  check(g.ev("isExecutingActionQueue") === true, "turn is in flight");
  const refused = g.ev("window.devTest.restartBattle()");
  check(refused === false, "restartBattle refused mid-turn");
  await g.runLimited(() => pending);
  check(g.ev("isExecutingActionQueue") === false, "turn finished");
  check(seedsOf(g).scenarioId === "intro", "scenario still active after refused restart");
  check(JSON.stringify(snapshot(g).hand) !== undefined && before.seeds.seed === SEED, "post-refusal state readable");
  check(g.ev("window.devTest.restartBattle()") === true, "restart allowed again after the turn");
  same(snapshot(g), freshSnap, "restart after refusal restores the fresh snapshot");

  return { header: REQ_HEADER, seed: SEED, freshHand: freshSnap.hand, dirtyEvidence: {
    cardsQueued: cards, healthAfterDirty: Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.health])),
    turnsSinceHit: Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.turnsSinceHit])),
    reshuffleCharges: d.reshuffleCharges, handAfterDirty: d.hand },
    compared: "terrain, hills/ponds/flowers/trees, 6 units (position, direction, health, movementMode, turnsSinceHit, tookDamageThisTurn, isFleeing, packObjective, queue), pack queue+focus, hand, reshuffle charges, overlay, selection, seeds, hand RNG tail(8)",
    killCase: { e1Sprite: sprite, restoredEqualsFresh: true }, freshStreamTail: freshTail, refusedMidTurn: true };
}
function seedsOf(g) { return evJson(g, "window.devTest.getBattleSeeds()"); }
module.exports = { id: ID, run };
