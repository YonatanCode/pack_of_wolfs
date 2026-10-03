"use strict";
// REQUIREMENT — P1d acceptance
// R9: the headless core and the playable game run the SAME rules. For each hand-authored case (one turn,
// scripted terminal outcomes only) two fresh contexts get the identical setup and orders; context A plays
// the turn through the real presentation driver (executePlayerActionQueue, every step replayed and
// animated), context B drains the very same lifecycle with window.devTest.drainTurnCore() (no replay, no
// animation, nothing rendered). Asserted: identical event logs, identical final state (c9's stateSnapshot
// from _trace.cjs, read-only; B's hand view is first rebuilt from the data with rebuildPlayerHandView()
// because the drain never touches the view), identical hand data and identical battle-note text. The
// result overlay is presentation (concludeBattle is a replay of the outcome event), so instead of comparing
// it, A's overlay is checked against the outcome event. Cases cover a recovery turn, an enemy death with
// casualty replanning, a victory via scripted kill and a double KO (a defeat: the player side is checked first).
const L = require("./_lifecycle.cjs");

const ID = "r9-core-equals-presentation";

const CASES = [
  {
    id: "recovery-turn",
    description: "Untouched intro board, wounded P2 (8 HP, 1 safe turn) heals at turn end; cards 0/1/2 to P1/P2/P3.",
    setup: (g) => {
      g.ev("playerSupport.health = 8; playerSupport.turnsSinceHit = 1; updateUnitHealthBar(playerSupport);");
      const h = L.domHand(g);
      L.queueByIndex(g, "player", [0]);
      L.queueByIndex(g, "playerSupport", [0]);
      L.queueByIndex(g, "playerFlank", [0]);
      return h.slice(0, 3);
    },
    expect: (events) => events.find((e) => e.type === "recovery").heals.some((h) => h.unit === "P2"),
  },
  {
    id: "casualty-replan",
    description: "1-HP E1 between P1 (1 HP) and P2 dies in tick 1; E2/E3 survive and the pack is replanned mid-turn.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" }, null,
        { row: 5, col: 6, direction: "topLeft", health: 1 }, { row: 0, col: 9, direction: "bottomLeft" }, { row: 0, col: 2, direction: "bottomLeft" }]);
      L.pushOrders(g, "player", ["Attack"]);
      L.pushOrders(g, "playerSupport", ["Attack", "Defend"]);
      return ["P1:Attack", "P2:Attack,Defend"];
    },
    expect: (events) => events.some((e) => e.type === "death" && e.unit === "E1") && events.some((e) => e.type === "replan"),
  },
  {
    id: "victory-via-scripted-kill",
    description: "1-HP E1 (only enemy) attacked by P1 (1 HP) and P2; it dies in tick 1 and the outcome is a win.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" }, null,
        { row: 5, col: 6, direction: "topLeft", health: 1 }]);
      L.pushOrders(g, "player", ["Attack"]);
      L.pushOrders(g, "playerSupport", ["Attack"]);
      return ["P1:Attack", "P2:Attack"];
    },
    expect: (events) => events.find((e) => e.type === "outcome").winner === "player",
  },
  {
    id: "double-ko",
    description: "Last units P1 and E1 (1 HP each) kill each other in tick 1: outcome enemy (defeat), doubleKO true.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 4, direction: "topRight", health: 1 }, null, null, { row: 4, col: 4, direction: "bottomLeft", health: 1 }]);
      L.pushOrders(g, "player", ["Attack"]);
      return ["P1:Attack"];
    },
    expect: (events) => {
      const o = events.find((e) => e.type === "outcome");
      return o.winner === "enemy" && o.doubleKO === true;
    },
  },
];

async function runSide(def, mode) {
  const g = L.bootIntro();
  const orders = def.setup(g);
  const events = mode === "play" ? await L.playTurn(g) : L.drainTurn(g);
  if (mode === "drain") g.ev("rebuildPlayerHandView()");
  const snap = L.T.stateSnapshot(g, "final");
  return { orders, events, snap, data: L.dataHand(g), note: g.ev("lastBattleDebugReport"), usage: g.usage() };
}

async function run() {
  const out = { header: L.REQ_HEADER, cases: {} };
  for (const def of CASES) {
    const a = await runSide(def, "play");
    const b = await runSide(def, "drain");
    L.check(def.expect(a.events), `${def.id}: scenario precondition (see description)`);
    L.same(b.events, a.events, `${def.id}: drained event log == played event log`);
    const { resultOverlay: overlayA, ...stateA } = a.snap;
    const { resultOverlay: overlayB, ...stateB } = b.snap;
    L.same(stateB, stateA, `${def.id}: drained final state == played final state`);
    L.same(b.data, a.data, `${def.id}: hand data`);
    L.check(a.note !== "" && b.note === a.note, `${def.id}: battle note text identical`);
    L.check(b.usage.steps === 0, `${def.id}: the drain scheduled no frame or timer`);
    const outcome = a.events.find((e) => e.type === "outcome");
    const expectedOverlay = outcome.winner === "none" ? "hidden"
      : `shown msg=${JSON.stringify(outcome.winner === "player" ? "You Win!" : "You Lose")} win=${outcome.winner === "player"} lose=${outcome.winner === "enemy"}`;
    L.check(overlayA === expectedOverlay, `${def.id}: played overlay matches the outcome event (${overlayA})`);
    L.check(overlayB === "hidden", `${def.id}: the drain left the overlay alone`);
    out.cases[def.id] = {
      description: def.description,
      orders: a.orders,
      outcome,
      ticks: a.events.find((e) => e.type === "turnEnd").ticks,
      eventCount: a.events.length,
      eventHash: L.hashEvents(a.events),
      finalState: { units: stateA.units, packQueue: stateA.packQueue, focus: stateA.focus, hand: stateA.hand, handRng: stateA.handRng },
      playedOverlay: overlayA,
      identical: "events, state (c9 snapshot minus overlay), hand data, battle note",
    };
  }
  return out;
}
module.exports = { id: ID, run };
