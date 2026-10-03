"use strict";
// REQUIREMENT — P1b acceptance
// R3: same scenario + seed + same hand-chosen player cards (by hand index) => identical results.
// Two turns (turn 1 incl. refill + recovery, turn 2 drawing from the refilled hand), enemy orders
// hand-authored; nothing chooses player orders automatically. A third context with a different
// harness Math.random seed must also match (cosmetic randomness must not leak). A different
// scenario seed must give a different hand.
const { REQ_HEADER, check, same, bootScenario, hand, snapshot, placeFight, queueByIndex, setEnemyOrders, turnEnd, runTurn, evJson } = require("./_scn.cjs");

const ID = "r3-same-seed-same-result";

async function play(seed, mathSeed) {
  const g = bootScenario(seed, mathSeed === undefined ? {} : { seed: mathSeed });
  const log = { startHand: hand(g), turns: [] };
  placeFight(g);
  const turns = [
    { enemy: [{ unitId: "enemy", action: "Attack" }, { unitId: "enemySupport", action: "Move" }], p1: [0, 2], p2: [1] },
    { enemy: [{ unitId: "enemy", action: "Defend" }], p1: [1], p2: [0, 3] },
  ];
  for (const t of turns) {
    setEnemyOrders(g, t.enemy);
    const cards = [queueByIndex(g, "player", t.p1), queueByIndex(g, "playerSupport", t.p2)];
    const state = await runTurn(g); // returned dev-test state (positions, health, queues, intent tags)
    const events = evJson(g, "window.devTest.state()");
    turnEnd(g);
    log.turns.push({ cards, afterTurn: JSON.parse(JSON.stringify(events)), snapshot: snapshot(g), returnedHealth: [state.player.health, state.enemy.health] });
  }
  log.finalHand = hand(g);
  return log;
}

async function run() {
  const a = await play(7);
  const b = await play(7);
  const c = await play(7, 0x1234abcd);
  same(a, b, "two fresh contexts, same seed + same card indices: identical");
  same(a, c, "different harness Math.random seed: identical (cosmetic randomness cannot leak)");
  check(a.turns.some((t) => t.snapshot.units.P1.health < 10 || t.snapshot.units.E1.health < 10), "the scripted turns produced combat");
  const other = await play(8);
  check(JSON.stringify(other.startHand) !== JSON.stringify(a.startHand), "different seed gives a different starting hand");
  const diffSeeds = [];
  for (let s = 1; s <= 6; s += 1) diffSeeds.push({ seed: s, hand: hand(bootScenario(s)) });
  const distinct = new Set(diffSeeds.map((x) => x.hand.join(","))).size;
  check(distinct > 1, "hands vary across seeds 1..6");
  return { header: REQ_HEADER, seed: 7, startHand: a.startHand, finalHand: a.finalHand, cardsPerTurn: a.turns.map((t) => t.cards),
    healthPerTurn: a.turns.map((t) => ({ ...Object.fromEntries(Object.entries(t.snapshot.units).map(([k, v]) => [k, v.health])) })),
    seed8StartHand: other.startHand, handsBySeed: diffSeeds, distinctHandsInSeeds1to6: distinct };
}
module.exports = { id: ID, run };
