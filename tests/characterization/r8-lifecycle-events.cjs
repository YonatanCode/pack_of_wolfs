"use strict";
// REQUIREMENT — P1d acceptance
// R8: the complete turn lifecycle emits a deterministic plain-data event log. Boot ?scenario=intro&seed=1,
// queue hand-chosen cards (by index) for the 3 wolves and play 2 turns through the REAL
// executePlayerActionQueue. Asserted per turn:
//   - phase order: turnStart -> enemyPlan(turnStart) -> fighters -> ticks[tickStart, consumed, move*, swing*,
//     miss*, hit*, damage*, (death, queueCleared)*, replan?, tickEnd]+ -> recovery -> debugNote -> handDraw ->
//     enemyPlan(preview) -> turnEnd -> outcome; ticks numbered 1..n and every tick-scoped event carries its tick;
//   - stable ids: every unit reference is one of P1..P3 / E1..E3; fighters = the units alive at turn start;
//   - the handDraw event's hand is the hand left in the data and in the DOM view after the turn;
//   - the log is JSON round-trip safe, and its hash is identical across two fresh contexts and across
//     different harness Math.random seeds (the harness seed only feeds non-gameplay randomness).
const L = require("./_lifecycle.cjs");

const ID = "r8-lifecycle-events";
const PLAN = [
  { p1: [0, 1], p2: [2], p3: [0] },
  { p1: [1], p2: [0], p3: [1] }, // indices into the hand as it is at each call (cards are consumed in between)
];
const HARNESS_SEEDS = [undefined, undefined, 1, 0xbeef];

const TOKEN = {
  turnStart: "S", fighters: "F", tickStart: "[", consumed: "c", move: "m", attackSwing: "a", defendSwing: "d",
  miss: "x", hit: "h", damage: "D", death: "K", queueCleared: "Q", replan: "R", tickEnd: "]", recovery: "r",
  debugNote: "n", handDraw: "H", turnEnd: "E", outcome: "O",
};
const PHASES = /^SPF(\[cm*[ad]*x*h*D*(KQ)*R?\])+rnHpEO$/;
const phaseString = (events) => events.map((e) => (e.type === "enemyPlan" ? (e.reason === "turnStart" ? "P" : "p") : TOKEN[e.type] ?? "?")).join("");

function checkTurn(g, events, label) {
  L.check(JSON.stringify(JSON.parse(JSON.stringify(events))) === JSON.stringify(events), `${label}: events JSON round-trip`);
  const phases = phaseString(events);
  L.check(PHASES.test(phases), `${label}: phase order ${phases}`);
  let tick = 0;
  events.forEach((e) => {
    if (e.type === "tickStart") { tick += 1; L.check(e.tick === tick, `${label}: tick numbering`); }
    if ("tick" in e) L.check(e.tick === tick, `${label}: ${e.type} carries its tick`);
  });
  L.check(events.find((e) => e.type === "turnEnd").ticks === tick, `${label}: turnEnd.ticks`);
  const ids = L.collectIds(events);
  L.check(ids.every((id) => L.UNIT_IDS.includes(id)), `${label}: stable ids only (${ids})`);
  const draw = events.find((e) => e.type === "handDraw");
  L.same(draw.hand, L.dataHand(g), `${label}: handDraw.hand == hand data`);
  L.same(draw.hand, L.domHand(g), `${label}: handDraw.hand == hand view`);
  return phases;
}

async function play(harnessSeed) {
  const g = L.bootIntro({ harnessSeed });
  const turns = [];
  for (const [i, t] of PLAN.entries()) {
    const aliveAtStart = JSON.parse(g.ev("JSON.stringify(units.filter(isUnitAlive).map(getBattleDebugUnitId))"));
    const cards = [L.queueByIndex(g, "player", t.p1), L.queueByIndex(g, "playerSupport", t.p2), L.queueByIndex(g, "playerFlank", t.p3)];
    L.check(cards.flat().every((c) => typeof c === "string"), `turn ${i + 1}: every planned card index exists`);
    const events = await L.playTurn(g);
    const phases = checkTurn(g, events, `turn ${i + 1}`);
    L.same(events.find((e) => e.type === "fighters").units, aliveAtStart, `turn ${i + 1}: fighters = alive at turn start`);
    turns.push({ cards, phases, eventCount: events.length, hash: L.hashEvents(events), events });
  }
  return turns;
}

async function run() {
  const runs = [];
  for (const s of HARNESS_SEEDS) runs.push(await play(s));
  const hashes = runs.map((r) => r.map((t) => t.hash));
  hashes.forEach((h, i) => L.same(h, hashes[0], `event-log hashes identical in context ${i} (harness seed ${HARNESS_SEEDS[i] ?? "default"})`));
  return {
    header: L.REQ_HEADER,
    boot: "?scenario=intro&seed=1",
    plan: PLAN,
    turns: runs[0].map((t) => ({ cards: t.cards, phases: t.phases, eventCount: t.eventCount, hash: t.hash, events: t.events.map(L.fmtEvent) })),
    determinism: { contexts: HARNESS_SEEDS.length, harnessSeeds: HARNESS_SEEDS.map((s) => s ?? "default"), identicalHashes: true },
  };
}
module.exports = { id: ID, run };
