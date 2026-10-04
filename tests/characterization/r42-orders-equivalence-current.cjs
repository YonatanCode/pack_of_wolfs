"use strict";
// REQUIREMENT — L1 player orders: headless = live under the current preset (hard assertions; evidence in the golden)
// Every comparison: the SAME hand-authored orders driven through the live UI paths + Play (executePlayerActionQueue) in
// one context, and through runHeadlessTurn in another booted identically (intro, seed 1), give the same turn events,
// final BattleState (units, queues, enemy plan, hand, RNG position), battle note and observation.
// R42a TWO TURNS of orders only: turn 1 [P1 Attack, P2 Move, P3 Defend], turn 2 [P1 Move, P2 Attack, P3 Attack,
//      P1 Defend] (written from the recorded turn-2 hand).
// R42b UI THEN HEADLESS, no double charge: P1 Attack queued by a UI click (the hand loses it), then runHeadlessTurn
//      [P2 Move, P3 Defend]: the turn plays P1's Attack once (turnStart.planned), the turn-end draw refills exactly the
//      3 spent cards, and the result equals R42a's live turn 1 (same three orders, same order).
// R42c HEADLESS THEN UI, no double charge: applyPlayerOrders [P1 Attack, P2 Move] (door only, no turn), then a UI click
//      P3 Defend (the stale hand view is rebuilt from the data by the click's own hand edit) and the UI Play: equals
//      R42a's live turn 1. A card queued by the door and removed again through the UI's queue button
//      (removeUnitActionAt) goes back to the hand exactly once.
// R42d LETHAL BOARD (r10 / _preview "lethal" positions): a death and a casualty replan in the turn; same equivalence.
const O = require("./_orders.cjs");
const { PV, S } = O;
const { check, same } = S;

const ID = "r42-orders-equivalence-current";
const T1 = [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Defend" }];
const T2 = [{ unit: "P1", action: "Move" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Attack" }, { unit: "P1", action: "Defend" }];
const LETHAL = [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" }, { row: 10, col: 9, direction: "topRight", health: 7 },
  { row: 5, col: 6, direction: "topLeft", health: 1 }, { row: 0, col: 9, direction: "bottomLeft" }, { row: 0, col: 2, direction: "bottomLeft" }];
const LETHAL_ORDERS = [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Attack" }, { unit: "P2", action: "Defend" }, { unit: "P3", action: "Move" }];

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R42a
  const live = track(O.boot());
  const head = track(O.boot());
  const live1 = await O.playLive(live, T1);
  const head1 = O.playHeadless(head, T1);
  const turn1 = O.sameTurn(live1, head1, "R42a turn 1");
  same(head1.observation.hand.cards, ["Move", "Attack", "Defend", "Attack", "Defend"], "turn-2 hand (T2 is written from it)");
  const turn2 = O.sameTurn(await O.playLive(live, T2), O.playHeadless(head, T2), "R42a turn 2");

  // ---- R42b UI click, then headless
  const mix = track(O.boot());
  O.uiOrders(mix, T1.slice(0, 1));
  const afterClick = { hand: O.hand(mix), queues: O.queues(mix) };
  same(afterClick.hand, ["Move", "Attack", "Defend", "Defend"], "the UI click took the first Attack");
  const mixTurn = O.playHeadless(mix, T1.slice(1));
  const { P1, P2, P3 } = mixTurn.events.find((e) => e.type === "turnStart").planned;
  const planned = { P1, P2, P3 };
  same(planned, { P1: ["Attack"], P2: ["Move"], P3: ["Defend"] }, "the turn plays P1's UI-queued Attack once, beside the two headless orders");
  const draw = mixTurn.events.find((e) => e.type === "handDraw");
  check(draw.drawn.length === 3, "the turn-end draw refills exactly the 3 spent cards");
  const mixed = O.sameTurn(live1, mixTurn, "R42b UI + headless vs live turn 1");

  // ---- R42c door, then UI click and UI Play
  const rev = track(O.boot());
  same(O.applyOrders(rev, T1.slice(0, 2)), { ok: true, queuedTotal: 2 }, "door applied P1 Attack, P2 Move (no turn)");
  const afterDoor = { hand: O.hand(rev), queues: O.queues(rev), handView: O.J(rev, "__p1e.view().handView") };
  same(afterDoor.hand, ["Attack", "Defend", "Defend"], "the door took one Attack and the Move");
  const revTurn = await O.playLive(rev, T1.slice(2));
  same(revTurn.ui, ["P3 Defend: queued"], "the UI click after the door");
  const reversed = O.sameTurn(live1, revTurn, "R42c headless + UI Play vs live turn 1");
  const back = track(O.boot());
  O.applyOrders(back, [{ unit: "P1", action: "Move" }]);
  const unqueue = { afterDoor: O.hand(back) };
  back.ev("removeUnitActionAt(player, 0)");
  unqueue.afterRemove = O.hand(back);
  unqueue.queues = O.queues(back);
  same(unqueue.afterRemove.filter((c) => c === "Move").length, 1, "the removed Move went back to the hand once");
  same(unqueue.afterRemove.length, 5, "hand full again (5)");
  same(O.verdictOf(O.validate(back, [{ unit: "P1", action: "Move" }, { unit: "P2", action: "Move" }])), "card-not-in-hand@1", "still one Move card: not duplicated");

  // ---- R42d lethal board
  const lethalLive = track(O.boot());
  const lethalHead = track(O.boot());
  [lethalLive, lethalHead].forEach((g) => { S.check(g.ev("playerHand.join()") === "Attack,Move,Attack,Defend,Defend", "boot hand"); PV.L.resetUnits(g, LETHAL); g.ev("playerFlank.turnsSinceHit = 1;"); });
  const lethalA = await O.playLive(lethalLive, LETHAL_ORDERS);
  const lethalB = O.playHeadless(lethalHead, LETHAL_ORDERS);
  const lethal = O.sameTurn(lethalA, lethalB, "R42d lethal board");
  check(lethalA.events.some((e) => e.type === "death") && lethalA.events.some((e) => e.type === "replan"), "the lethal turn has a death and a casualty replan");

  return {
    header: "REQUIREMENT — L1 player orders: headless = live (current preset)",
    hands: O.reportOrderHands(ID, ctxs),
    twoTurns: { orders: [T1, T2], liveUi: live1.ui, turn1, turn2, outcome: head1.outcome },
    uiThenHeadless: { afterClick, planned, drawn: draw.drawn, turn: mixed },
    headlessThenUi: { afterDoor, turn: reversed, unqueue },
    lethal: { orders: LETHAL_ORDERS, turn: lethal },
  };
}
module.exports = { id: ID, run };
