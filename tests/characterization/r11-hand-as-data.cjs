"use strict";
// REQUIREMENT — P1d acceptance
// R11: the shared hand is ordered DATA (playerHand, index 0 = first <li>) and #actions-list is its view.
// After every hand operation (draw/refill, consume, reshuffle, return a queued card, tutorial seed, fill,
// restart, a played turn) the view's order equals the data and the view's <li> elements are exactly the
// ones the view rendered. Draws are PREPENDED (newest block first) and removal by name is FIRST-MATCH.
// Hands are asserted against the recorded c1-hand-draws / c8-intro-seeded-hands goldens (read, not
// re-derived), through both the data API and the legacy direct-DOM edits fixtures still use
// (actionsList.replaceChildren(...)), which the data adopts. A drained turn changes the data only; the view
// catches up at the next presentation call without drawing again.
const fs = require("node:fs");
const path = require("node:path");
const L = require("./_lifecycle.cjs");

const ID = "r11-hand-as-data";
const golden = (id) => JSON.parse(fs.readFileSync(path.join(__dirname, "goldens", `${id}.json`), "utf8"));

const HAND_STATE = `JSON.stringify({ data: [...playerHand], view: Array.from(actionsList.children).map((i) => i.dataset.action),
  sameElements: playerHandViewItems.length === actionsList.children.length && playerHandViewItems.every((it, i) => it === actionsList.children[i]) })`;

/** Asserts view == data (order and elements) and returns the hand. */
function viewIsData(g, label) {
  const s = JSON.parse(g.ev(HAND_STATE));
  L.same(s.view, s.data, `${label}: view order == data`);
  L.check(s.sameElements, `${label}: view shows exactly the rendered <li> elements`);
  return s.data;
}

async function run() {
  const c1 = golden("c1-hand-draws");
  const c8 = golden("c8-intro-seeded-hands");
  const out = { header: L.REQ_HEADER, c1: {}, c8: [], mutators: {}, turn: {} };

  // ---- c1 values on the original headless boot (no scenario), data API and legacy DOM edits -------------
  const g = L.loadGame();
  const drawData = (seed) => { g.ev(`clearPlayerHand(); seedHandRandom(${seed}); refillAvailableActions()`); return viewIsData(g, `data draw seed ${seed}`); };
  const drawLegacy = (seed) => { g.ev(`actionsList.replaceChildren(); seedHandRandom(${seed}); refillAvailableActions()`); return viewIsData(g, `legacy draw seed ${seed}`); };
  out.c1.seededHands = c1.seededHands.map(({ seed, hand }) => {
    L.same(drawData(seed), hand, `c1 seeded hand ${seed} (data API)`);
    L.same(drawLegacy(seed), hand, `c1 seeded hand ${seed} (legacy DOM clear adopted)`);
    return { seed, hand };
  });

  const co = c1.carryOver;
  L.same(drawData(co.seed), co.before, "carry-over: before");
  co.consumeCalledWithNames.forEach((name) => g.ev(`consumeAvailableAction(${JSON.stringify(name)})`));
  const kept = viewIsData(g, "carry-over: after consuming");
  L.same(kept, co.kept, "carry-over: consume removes the FIRST card with that name");
  g.ev("refillAvailableActions()");
  const after = viewIsData(g, "carry-over: after refill");
  L.same(after, co.after, "carry-over: refill result");
  L.same(after.slice(after.length - kept.length), kept, "carry-over: new draws are prepended, kept cards keep their order");
  out.c1.carryOver = { before: co.before, consumed: co.consumeCalledWithNames, kept, after };

  out.c1.capCarry = c1.capCarry.samples.map(({ seed, hand }) => {
    g.ev(`actionsList.replaceChildren(...['Move','Move','Move'].map(createAvailableActionItem)); seedHandRandom(${seed}); refillAvailableActions()`);
    L.same(viewIsData(g, `cap carry ${seed}`), hand, `c1 cap-carry sample ${seed} (legacy DOM hand adopted, cap counts kept cards)`);
    return { seed, hand };
  });

  const rs = c1.reshuffle;
  drawData(11);
  g.ev(`getUnitActionQueue(player).push("Move","Attack"); getUnitActionQueue(playerSupport).push("Defend");`);
  L.same(viewIsData(g, "reshuffle start"), rs.start.hand, "reshuffle start hand");
  g.ev("seedHandRandom(12); reshuffleActions()");
  L.same(viewIsData(g, "reshuffle 1"), rs.afterFirst.hand, "reshuffle 1 hand");
  g.ev(`getUnitActionQueue(player).push("Move"); seedHandRandom(13); reshuffleActions()`);
  L.same(viewIsData(g, "reshuffle 2"), rs.afterSecond.hand, "reshuffle 2 hand");
  g.ev(`getUnitActionQueue(player).push("Attack"); seedHandRandom(14); reshuffleActions()`);
  L.same(viewIsData(g, "reshuffle 3 (no charges)"), rs.afterThirdNoCharges.hand, "reshuffle with no charges leaves the hand");
  out.c1.reshuffle = [rs.start.hand, rs.afterFirst.hand, rs.afterSecond.hand, rs.afterThirdNoCharges.hand];

  // ---- c8 values: scenario boot, play two cards + refill, reshuffle --------------------------------------
  for (const rec of c8.bySeed.slice(0, 4)) {
    const s = L.loadGame({ query: `?scenario=intro&seed=${rec.seed}`, scenarios: true });
    L.same(viewIsData(s, `c8 seed ${rec.seed} start`), rec.start, `c8 seed ${rec.seed}: start hand`);
    s.ev(`consumeAvailableAction(${JSON.stringify(rec.start[0])}); consumeAvailableAction(${JSON.stringify(rec.start[4])}); refillAvailableActions()`);
    L.same(viewIsData(s, `c8 seed ${rec.seed} refill`), rec.afterPlayTwoAndRefill, `c8 seed ${rec.seed}: after play two + refill`);
    s.ev("reshuffleActions()");
    L.same(viewIsData(s, `c8 seed ${rec.seed} reshuffle`), rec.afterReshuffle, `c8 seed ${rec.seed}: after reshuffle`);
    out.c8.push({ seed: rec.seed, start: rec.start, afterPlayTwoAndRefill: rec.afterPlayTwoAndRefill, afterReshuffle: rec.afterReshuffle });
  }

  // ---- the other mutators on the intro (seed 1) board -----------------------------------------------------
  const m = L.bootIntro();
  const start = viewIsData(m, "intro start");
  L.same(start, c8.bySeed[0].start, "intro seed 1 start hand == c8");
  const card = start[1];
  m.ev(`setPlayerSelected(player); applyPlayerAction(${JSON.stringify(card)})`);
  const afterQueue = viewIsData(m, "queued one card");
  m.ev("removeUnitActionAt(player, 0)");
  const afterReturn = viewIsData(m, "returned the queued card");
  L.check(afterReturn[0] === card && afterReturn.length === start.length, "a card removed from a queue goes back to the FRONT of the hand");
  out.mutators.queueThenReturn = { card, afterQueue, afterReturn };

  m.ev("seedTutorialActionHand()");
  out.mutators.tutorialSeed = viewIsData(m, "tutorial seed");
  L.same(out.mutators.tutorialSeed.slice(0, 3), ["Move", "Attack", "Defend"], "tutorial hand starts with one of every action");
  m.ev('fillAvailableActions("Attack")');
  out.mutators.fillAttack = viewIsData(m, "fill");
  L.same(out.mutators.fillAttack, ["Attack", "Attack", "Attack", "Attack", "Attack"], "fill hand");
  m.ev("restartBattle()");
  out.mutators.restart = viewIsData(m, "restart");
  L.same(out.mutators.restart, c8.bySeed[0].start, "restart deals the seed-1 start hand again");

  // ---- a played turn and a drained turn ----------------------------------------------------------------------
  L.queueByIndex(m, "player", [0, 1]);
  L.queueByIndex(m, "playerSupport", [0]);
  const kept1 = viewIsData(m, "orders queued");
  const events = await L.playTurn(m);
  const played = viewIsData(m, "after a played turn");
  const draw = events.find((e) => e.type === "handDraw");
  L.same(draw.hand, played, "handDraw event hand == data == view");
  L.same(played.slice(draw.drawn.length), kept1, "turn-end draws are prepended to the kept cards");
  out.turn.played = { kept: kept1, drawn: draw.drawn, hand: played };

  L.queueByIndex(m, "player", [0]);
  const kept2 = viewIsData(m, "orders queued (drain)");
  const drained = L.drainTurn(m).find((e) => e.type === "handDraw");
  const stale = JSON.parse(m.ev(HAND_STATE));
  L.same(stale.view, kept2, "the drain did not touch the view");
  L.same(stale.data, drained.hand, "the drain drew into the data");
  const drawsBefore = m.ev("__handDraws");
  m.ev("refillAvailableActions()");
  L.same(viewIsData(m, "view caught up"), drained.hand, "the next refill renders the drained draws");
  L.check(m.ev("__handDraws") === drawsBefore, "catching the view up draws nothing");
  out.turn.drained = { kept: kept2, drawn: drained.drawn, hand: drained.hand };
  return out;
}
module.exports = { id: ID, run };
