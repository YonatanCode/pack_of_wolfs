"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C1: action-hand draws (refillAvailableActions), carry-over, MAX_SAME_ACTION cap, reshuffleActions.
// Hand draws come from the gameplay stream handRandom (P1b); this fixture seeds it with the game's own
// seedHandRandom(seed) (the same call loadScenario makes with the scenario seed), instead of reseeding
// Math.random as it did before P1b. Hand order = actionsList child order (new draws are prepended,
// so the newest draw is first).
const { HEADER, evJson, loadGame } = require("./_lib.cjs");

const ID = "c1-hand-draws";
const reseedHand = (g, seed) => g.ev(`seedHandRandom(${seed})`);
const hand = (g) => evJson(g, "Array.from(actionsList.children).map((i) => i.dataset.action)");
const counts = (h) => h.reduce((m, a) => ({ ...m, [a]: (m[a] ?? 0) + 1 }), {});

async function run() {
  const out = {
    declaredChange: "P1b: hand draws now come from a seeded gameplay stream (handRandom, seedHandRandom -> createSeededRandom, the same mulberry32 algorithm the harness used for Math.random) instead of Math.random; the fixture seeds it via seedHandRandom(seed) rather than reseeding Math.random. Measured old->new: every seeded hand, the 500-seed sweep, carry-over, cap-carry and reshuffle sections are IDENTICAL; the only difference is startupHand (pre-P1b: boot draw straight from the harness Math.random stream; now: boot seeds handRandom from one Math.random value first, so the boot hand changed from [Move,Attack,Defend,Move,Attack] to [Attack,Defend,Move,Attack,Move]). Draw RULES unchanged.",
    header: HEADER, constants: null, seededHands: [], sweep: null, carryOver: null, capCarry: null, reshuffle: null };
  const g = loadGame();
  out.constants = evJson(g, "({ ACTION_SLOT_COUNT, MAX_SAME_ACTION, RESHUFFLE_CHARGES_PER_BATTLE, ACTIONS })");
  out.startupHand = hand(g); // drawn by script.js's own startup refill from the seeded stream

  const draw = (seed) => {
    g.ev("actionsList.replaceChildren()");
    reseedHand(g, seed);
    g.ev("refillAvailableActions()");
    return hand(g);
  };

  for (const seed of [1, 2, 3, 4, 5]) out.seededHands.push({ seed, hand: draw(seed) });

  // Sweep: 500 seeds, how often does the cap bite?
  const maxHist = {};
  const totals = {};
  let violations = 0;
  for (let s = 100; s < 600; s += 1) {
    const h = draw(s);
    const c = counts(h);
    const max = Math.max(...Object.values(c));
    if (max > 3 || h.length !== 5) violations += 1;
    maxHist[max] = (maxHist[max] ?? 0) + 1;
    Object.entries(c).forEach(([a, n]) => { totals[a] = (totals[a] ?? 0) + n; });
  }
  out.sweep = { seeds: "100..599", violations, maxSameCountHistogram: maxHist, actionTotals: totals };

  // Carry-over: draw 5, consume 2, refill -> 3 kept stay, 2 drawn.
  const before = draw(7);
  // NOTE: consumeAvailableAction(name) removes the FIRST item whose action equals `name`; it does not
  // remove the item at the index we picked the name from. So we record both the picked indices (where
  // the names came from) and the indices actually removed.
  const pickedIndices = [1, 3];
  const names = pickedIndices.map((i) => before[i]);
  const remaining = before.map((action, index) => ({ action, index }));
  const removedIndices = names.map((n) => {
    const pos = remaining.findIndex((r) => r.action === n);
    return remaining.splice(pos, 1)[0].index;
  });
  g.ev(`consumeAvailableAction(${JSON.stringify(names[0])}); consumeAvailableAction(${JSON.stringify(names[1])});`);
  const kept = hand(g);
  g.ev("refillAvailableActions()");
  const after = hand(g);
  out.carryOver = {
    seed: 7, before,
    consumeCalledWithNames: names, namesWerePickedFromIndices: pickedIndices,
    consumeRemovesFirstMatchByName: true, indicesActuallyRemoved: removedIndices,
    kept, after,
    keptIsSuffixOfAfter: JSON.stringify(after.slice(2)) === JSON.stringify(kept),
  };

  // Cap applies to kept + drawn: keep 3 Moves, draw 2 under many seeds; count Move draws.
  let moveDrawn = 0;
  const samples = [];
  for (let s = 1000; s < 1100; s += 1) {
    g.ev("actionsList.replaceChildren(...['Move','Move','Move'].map(createAvailableActionItem))");
    reseedHand(g, s);
    g.ev("refillAvailableActions()");
    const h = hand(g);
    moveDrawn += h.filter((a) => a === "Move").length - 3;
    if (s < 1003) samples.push({ seed: s, hand: h });
  }
  out.capCarry = { keptMoves: 3, seeds: "1000..1099", extraMovesDrawnTotal: moveDrawn, samples };

  // Reshuffle: charge decrement, queues cleared, hand replaced; no-op at 0 charges.
  const r = {};
  draw(11);
  g.ev(`getUnitActionQueue(player).push("Move","Attack"); getUnitActionQueue(playerSupport).push("Defend");`);
  r.start = { hand: hand(g), charges: g.ev("reshuffleChargesRemaining"), queues: evJson(g, `[getUnitActionQueue(player), getUnitActionQueue(playerSupport)]`) };
  reseedHand(g, 12);
  g.ev("reshuffleActions()");
  r.afterFirst = { hand: hand(g), charges: g.ev("reshuffleChargesRemaining"), queues: evJson(g, `[getUnitActionQueue(player), getUnitActionQueue(playerSupport)]`) };
  g.ev(`getUnitActionQueue(player).push("Move")`);
  reseedHand(g, 13);
  g.ev("reshuffleActions()");
  r.afterSecond = { hand: hand(g), charges: g.ev("reshuffleChargesRemaining"), queues: evJson(g, `[getUnitActionQueue(player)]`) };
  g.ev(`getUnitActionQueue(player).push("Attack")`);
  reseedHand(g, 14);
  g.ev("reshuffleActions()");
  r.afterThirdNoCharges = { hand: hand(g), charges: g.ev("reshuffleChargesRemaining"), queues: evJson(g, `[getUnitActionQueue(player)]`), handUnchanged: JSON.stringify(hand(g)) === JSON.stringify(r.afterSecond.hand) };
  out.reshuffle = r;
  return out;
}

module.exports = { id: ID, run };
