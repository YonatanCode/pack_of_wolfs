"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// Shared case definitions + driver for c9 (state trace) and c10 (presentation-call trace). Not a fixture itself.
// Every case: hand-authored player orders only, <= 3 turns, no bots, no autonomous play. Battles end only via a
// scripted terminal outcome (hand-set 1-HP units). Boot route for ALL cases is the real scenario route
// (?scenario=intro&seed=1 + scenarios/*.js), then loadScenario("intro", 1) is called once more AFTER the hand-RNG
// counter is installed (r2 asserts a reload reproduces the boot state exactly), so the hand stream is counted
// from the moment it is seeded. Units are then hand-placed with resetDevTest like the built-in dev scenarios.
const { loadGame } = require("../harness/load-game.cjs");
const { resetUnits } = require("./_lib.cjs");
const T = require("./_trace.cjs");

const hand = (g) => g.ev("Array.from(actionsList.children).map((i) => i.dataset.action)");
/** Queue specific hand cards (each really consumed from the hand) for one wolf through the real UI path. */
function queueCards(g, unitVar, cards) {
  g.ev(`setPlayerSelected(${unitVar})`);
  cards.forEach((c) => g.ev(`applyPlayerAction(${JSON.stringify(c)})`));
}
const pushOrders = (g, unitVar, actions) => g.ev(`${actions.map((a) => `getUnitActionQueue(${unitVar}).push(${JSON.stringify(a)})`).join(";")}`);
const nearestPlayerDistance = (g, unitVar) =>
  g.ev(`getNearestPlayerDistanceFrom(${unitVar}.row, ${unitVar}.col, getAliveUnitsByTeam("player"))`);

// setups order for resetUnits: [P1, P2, P3, E1, E2, E3]; null = inactive.
const CASES = [
  {
    id: "contested-move",
    description: "P1 (Hunt) and E1 both Move toward the same tile from 6 tiles apart; two ticks of simultaneous movement/collision resolution.",
    setup: (g) => {
      resetUnits(g, [{ row: 8, col: 4, direction: "topRight", movementMode: "Hunt" }, null, null, { row: 2, col: 4, direction: "bottomLeft" }]);
      g.ev(`queueDevTestActions(["Move","Move"], ["Move","Move"])`);
    },
    play: async (c) => { c.snap("start"); await c.tick(); await c.tick(); c.snap("end"); },
  },
  {
    id: "defend-reduces-damage",
    description: "Adjacent P1 vs E1 over three ticks: P1 defends vs attack (reduced), both attack (full), E1 defends vs attack (reduced).",
    setup: (g) => {
      resetUnits(g, [{ row: 5, col: 4, direction: "topRight" }, null, null, { row: 4, col: 4, direction: "bottomLeft" }]);
      g.ev(`queueDevTestActions(["Defend","Attack","Attack"], ["Attack","Attack","Defend"])`);
    },
    play: async (c) => { c.snap("start"); await c.tick(); await c.tick(); await c.tick(); c.snap("end"); },
  },
  {
    id: "kill-mid-turn-replan",
    description: "P1 and P2 kill the 1-HP E1/E2 in tick 1; the pack (E3 survives) is replanned mid-turn (known H1 behaviour, recorded not judged).",
    setup: (g) => {
      resetUnits(g, [
        { row: 5, col: 5, direction: "topLeft" }, { row: 5, col: 1, direction: "topRight" }, null,
        { row: 5, col: 6, direction: "bottomLeft", health: 1 }, { row: 5, col: 2, direction: "bottomRight", health: 1 },
        { row: 5, col: 10, direction: "bottomLeft" }]);
      g.ev(`queueDevTestPackActions([{unitId:"enemy",action:"Defend"},{unitId:"enemySupport",action:"Defend"},{unitId:"enemyFlank",action:"Defend"}]);
        getUnitActionQueue(player).push("Attack"); getUnitActionQueue(playerSupport).push("Attack");`);
    },
    play: async (c) => { c.snap("start (pack queue before the kill)"); await c.tick(); await c.tick(); c.snap("end"); },
  },
  {
    id: "double-ko",
    description: "Both sides' last units (1 HP each) attack each other in one tick; devTest.runTurn then concludes the battle (defeat is checked first).",
    setup: (g) => {
      resetUnits(g, [{ row: 5, col: 4, direction: "topRight", health: 1 }, null, null, { row: 4, col: 4, direction: "bottomLeft", health: 1 }]);
      g.ev(`queueDevTestActions(["Attack","Move"], ["Attack","Move"])`);
    },
    play: async (c) => { c.snap("start"); await c.devTurn(); c.snap("end (after concludeBattle)"); },
  },
  {
    id: "full-turn-recovery-refill",
    description: "Seed-1 intro, real executePlayerActionQueue x2: first three hand cards (by index) to P1/P2/P3, wounded P2 heals at turn end, hand refills, enemy preview replans.",
    setup: (g) => {
      g.ev("player; playerSupport.health = 8; playerSupport.turnsSinceHit = 1; updateUnitHealthBar(playerSupport);");
    },
    play: async (c) => {
      const g = c.g;
      c.snap("start");
      for (const turn of [1, 2]) {
        const h = hand(g).slice(0, 3);
        queueCards(g, "player", [h[0]]); queueCards(g, "playerSupport", [h[1]]); queueCards(g, "playerFlank", [h[2]]);
        c.snap(`turn ${turn} orders queued (cards ${h.join("/")})`);
        await c.exec(`turn ${turn}`);
      }
    },
  },
  {
    id: "victory-via-scripted-kill",
    description: "1-HP E1 (the only enemy) is killed by P1 (1 HP) and P2 attacking it; it dies in tick 1 and the real turn path concludes the battle (result overlay, win message).",
    setup: (g) => {
      // P1 has 1 HP so E1 (1 HP) can finish an adjacent target and therefore engages instead of fleeing (a fleeing E1 would dodge).
      resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" }, null,
        { row: 5, col: 6, direction: "topLeft", health: 1 }]);
      pushOrders(g, "player", ["Attack"]); pushOrders(g, "playerSupport", ["Attack"]);
    },
    play: async (c) => { c.snap("start"); await c.exec("turn 1"); },
  },
  {
    id: "flee-hysteresis",
    description: "1-HP E1 flees from P1 (turn 1 ends at distance 5, beyond the trigger range of 4 yet still fleeing), keeps fleeing in turn 2 (distance 2) and stops only at distance 7 (the safe range) after turn 3.",
    setup: (g) => {
      resetUnits(g, [{ row: 9, col: 5, direction: "topRight" }, null, null, { row: 5, col: 5, direction: "bottomLeft", health: 1 }]);
    },
    play: async (c) => {
      const g = c.g;
      c.snap("start", { nearestPlayerDistanceE1: nearestPlayerDistance(g, "enemy") });
      const orders = [["Move", "Move"], ["Move"], ["Defend"]]; // P1 chases, then holds
      for (const [i, acts] of orders.entries()) {
        pushOrders(g, "player", acts);
        await c.exec(`turn ${i + 1}`, () => ({ nearestPlayerDistanceE1: nearestPlayerDistance(g, "enemy") }));
      }
    },
  },
  {
    id: "intro-first-turn",
    description: "Smoke trace: untouched seed-1 intro board, one real turn with hand-chosen cards (P1 cards 0,1; P2 card 2; P3 card 0 by index).",
    setup: () => {},
    play: async (c) => {
      const g = c.g;
      const h = hand(g);
      c.snap("start");
      queueCards(g, "player", [h[0], h[1]]); queueCards(g, "playerSupport", [h[2]]); queueCards(g, "playerFlank", [h[0]]);
      c.snap(`orders queued (hand was ${h.join("/")})`);
      await c.exec("turn 1");
    },
  },
];

/** Run one case. wrap=false: state instrumentation only. wrap=true: also the presentation wrappers (installed after setup). */
async function runCase(def, { wrap = false, harnessSeed } = {}) {
  // harnessSeed (optional, scratch determinism checks only) re-seeds the harness Math.random; default is the harness default.
  // explicit old default: preset=current (_scn.pinCurrent, default battle setup)
  const g = loadGame({ query: "?scenario=intro&seed=1&preset=current", scenarios: true, ...(harnessSeed === undefined ? {} : { seed: harnessSeed }) });
  T.installHandRngCounter(g);
  g.ev('loadScenario("intro", 1)');
  T.installResultMessageProbe(g);
  const snaps = [];
  let tickNo = 0;
  let pt = null;
  const snap = (label, notes) => {
    const s = T.stateSnapshot(g, label);
    if (notes) s.notes = JSON.stringify(notes);
    snaps.push(s);
    if (pt) pt.mark(label);
  };
  def.setup(g);
  if (wrap) { pt = T.createPresentationTrace(g); pt.install(); }
  T.installTickHook(g,
    () => { tickNo += 1; if (pt) pt.mark(`tick ${tickNo} begin`); },
    () => { snaps.push(T.stateSnapshot(g, `after tick ${tickNo}`)); if (pt) pt.mark(`tick ${tickNo} end`); });
  const c = {
    g, snap,
    tick: () => g.runLimited(() => g.ev("window.devTest.runTick()")),
    devTurn: () => g.runLimited(() => g.ev("window.devTest.runTurn()")),
    exec: async (label, notesFn) => {
      if (pt) pt.mark(`${label} executePlayerActionQueue begin`);
      await g.runLimited(() => g.ev("executePlayerActionQueue()"));
      if (g.ev("isExecutingActionQueue") !== false) throw new Error("turn did not finish");
      snap(`${label} end`, notesFn ? notesFn() : undefined);
    },
  };
  await def.play(c);
  // Self-check of the hand-RNG observation: the predicted next3 must equal the live stream's next three draws.
  const predicted = T.handRngPosition(g).next3;
  const live = g.ev("[handRandom(), handRandom(), handRandom()]").map((v) => Math.round(v * 1e6) / 1e6);
  if (JSON.stringify(predicted) !== JSON.stringify(live)) throw new Error(`hand RNG peek mismatch: ${predicted} vs ${live}`);
  if (pt) pt.uninstall();
  return { snaps, events: pt ? pt.events : null, clock: g.clock.now, usage: g.usage(), ticks: tickNo };
}

const caseList = () => CASES.map(({ id, description }) => ({ id, description }));

module.exports = { CASES, runCase, caseList };
