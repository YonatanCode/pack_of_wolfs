"use strict";
// REQUIREMENT — L1 player orders: headless = live under the commander preset (hard assertions; evidence in the golden)
// Same comparison as r42 (events, final BattleState incl. targets and the frozen enemy plan, battle note, observation),
// with target orders. Live target orders are enemy clicks through the real tile handler with the wolf selected; a
// { target: null } order is a click on the wolf's current target (the UI's clear).
// R43a TWO TURNS: turn 1 [P1 -> E2, P1 Move, P2 Attack (first queue: auto-pick), P3 Attack (auto-pick), P3 -> E3
//      (chosen over its auto pick)]; turn 2 [P2 -> E1, P1 Attack, P2 Move, P3 Defend, P1 cleared (Play auto-picks
//      it)], written from the recorded turn-2 hand.
// R43b UI TARGET CLICK, THEN HEADLESS: P1 -> E2 clicked in the UI, the rest of turn 1 through runHeadlessTurn: equals
//      R43a's live turn 1.
// R43c DOOR, THEN UI PLAY: the whole turn-1 list through applyPlayerOrders (no turn), then the UI Play: equals R43a's
//      live turn 1 (the door's queued cards and targets are not charged or chosen again by Play).
const O = require("./_orders.cjs");
const { S } = O;
const { same } = S;

const ID = "r43-orders-equivalence-commander";
const T1 = [{ unit: "P1", target: "E2" }, { unit: "P1", action: "Move" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Attack" }, { unit: "P3", target: "E3" }];
const T2 = [{ unit: "P2", target: "E1" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Defend" }, { unit: "P1", target: null }];
const committed = (events) => events.find((e) => e.type === "targetsCommitted");

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R43a
  const live = track(O.boot(O.CMD));
  const head = track(O.boot(O.CMD));
  const live1 = await O.playLive(live, T1);
  const head1 = O.playHeadless(head, T1);
  const turn1 = O.sameTurn(live1, head1, "R43a turn 1");
  same(head1.observation.hand.cards, ["Move", "Attack", "Defend", "Defend", "Defend"], "turn-2 hand (T2 is written from it)");
  const live2 = await O.playLive(live, T2);
  const turn2 = O.sameTurn(live2, O.playHeadless(head, T2), "R43a turn 2");

  // ---- R43b
  const mix = track(O.boot(O.CMD));
  const click = O.uiOrders(mix, T1.slice(0, 1));
  const mixed = O.sameTurn(live1, O.playHeadless(mix, T1.slice(1)), "R43b UI target click + headless vs live turn 1");

  // ---- R43c
  const rev = track(O.boot(O.CMD));
  same(O.applyOrders(rev, T1), { ok: true, queuedTotal: 3 }, "door applied the whole turn-1 list (no turn)");
  const afterDoor = { hand: O.hand(rev), queues: O.queues(rev), targets: O.TG.targets(rev) };
  const reversed = O.sameTurn(live1, await O.playLive(rev, []), "R43c door + UI Play vs live turn 1");

  return {
    header: "REQUIREMENT — L1 player orders: headless = live (commander preset)",
    hands: O.reportOrderHands(ID, ctxs),
    twoTurns: { orders: [T1, T2], liveUi: [live1.ui, live2.ui], turn1, turn2, committed: [committed(live1.events), committed(live2.events)] },
    uiClickThenHeadless: { click, turn: mixed },
    doorThenUiPlay: { afterDoor, turn: reversed },
  };
}
module.exports = { id: ID, run };
