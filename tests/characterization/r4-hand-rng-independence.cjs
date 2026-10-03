"use strict";
// REQUIREMENT — P1b acceptance (hard assertions; counts are reported in the golden, no tight bounds)
// R4a: hand randomness is independent of cosmetic randomness: hammering Math.random /
//      getRandomIdleStartFrame between draws and across restarts, and using a different harness
//      Math.random seed, leaves the hand sequence unchanged.
// R4b: draw rules are unchanged under the new stream over many seeds (<=500 hands total):
//      cap <=3 per action, 5 cards, carry-over keeps the 3 unplayed (suffix, drawn prepended),
//      reshuffle (2 charges, queues cleared, 3rd is a no-op), cap applies to kept+drawn.
const { REQ_HEADER, check, same, bootScenario, hand, counts, evJson } = require("./_scn.cjs");

const ID = "r4-hand-rng-independence";

/** A fixed series of hands: initial, then 7 cycles (play 2 + refill; cycle 3 is a reshuffle). */
function sequence(g, noise) {
  const out = [];
  const n = () => { if (noise) { for (let i = 0; i < 500; i += 1) g.ev("Math.random()"); for (let i = 0; i < 50; i += 1) g.ev("getRandomIdleStartFrame('wolf')"); } };
  n(); out.push(hand(g));
  for (let k = 0; k < 7; k += 1) {
    n();
    if (k === 3) g.ev("reshuffleActions()");
    else { const h = hand(g); g.ev(`consumeAvailableAction(${JSON.stringify(h[0])}); consumeAvailableAction(${JSON.stringify(h[3])}); refillAvailableActions()`); }
    out.push(hand(g));
  }
  return out;
}

async function run() {
  // ---- R4a
  const quiet = sequence(bootScenario(5), false);
  const noisy = sequence(bootScenario(5), true);
  const otherMath = sequence(bootScenario(5, { seed: 0xdeadbeef }), true);
  same(noisy, quiet, "Math.random / idle-frame noise between draws does not change the hand sequence");
  same(otherMath, quiet, "different harness Math.random seed: same hand sequence");
  const g = bootScenario(5);
  const acrossRestarts = [];
  for (let r = 0; r < 3; r += 1) {
    acrossRestarts.push(sequence(g, true));
    check(g.ev("window.devTest.restartBattle()") === true, "restart ok");
  }
  acrossRestarts.forEach((s, i) => same(s, quiet, `restart #${i}: hand sequence unchanged`));
  const seq2 = sequence(bootScenario(6), false);
  check(JSON.stringify(seq2) !== JSON.stringify(quiet), "a different seed gives a different sequence");

  // ---- R4b (hands counted: 120 seeds x 3 + 100 cap-carry = 460)
  const hist = {}; const totals = {}; let hands = 0;
  const tally = (h, label) => {
    hands += 1;
    const c = counts(h);
    check(h.length === 5, `${label}: 5 cards`);
    check(Math.max(...Object.values(c)) <= 3, `${label}: <=3 of one action (${h.join(",")})`);
    const m = Math.max(...Object.values(c)); hist[m] = (hist[m] ?? 0) + 1;
    Object.entries(c).forEach(([a, k]) => { totals[a] = (totals[a] ?? 0) + k; });
  };
  const h = bootScenario(1);
  let carryChecked = 0; let reshuffleChecked = 0;
  for (let s = 1; s <= 120; s += 1) {
    h.ev(`window.devTest.loadScenario("intro", ${s})`);
    const first = hand(h); tally(first, `seed ${s} initial`);
    // carry-over: play 2 (first-match by name), refill
    const picks = [first[1], first[3]];
    h.ev(`consumeAvailableAction(${JSON.stringify(picks[0])}); consumeAvailableAction(${JSON.stringify(picks[1])})`);
    const kept = hand(h);
    check(kept.length === 3, "3 unplayed remain");
    h.ev("refillAvailableActions()");
    const after = hand(h); tally(after, `seed ${s} refill`);
    same(after.slice(2), kept, `seed ${s}: kept cards are the suffix, drawn cards are prepended`);
    carryChecked += 1;
    // reshuffle: charge spent, queue cleared, hand replaced; third is a no-op
    h.ev(`setPlayerSelected(player); applyPlayerAction(${JSON.stringify(after[0])})`);
    check(evJson(h, "getUnitActionQueue(player).length") === 1, "order queued before reshuffle");
    h.ev("reshuffleActions()");
    const r1 = hand(h); tally(r1, `seed ${s} reshuffle#1`);
    check(h.ev("reshuffleChargesRemaining") === 1 && evJson(h, "getUnitActionQueue(player).length") === 0, "reshuffle: charge spent, queues cleared");
    if (s <= 20) {
      h.ev("reshuffleActions()");
      check(h.ev("reshuffleChargesRemaining") === 0, "second charge spent");
      const r2 = hand(h);
      h.ev("reshuffleActions()");
      same(hand(h), r2, "third reshuffle (no charges) is a no-op");
      reshuffleChecked += 1;
    }
  }
  // cap applies to kept + drawn
  let extraMoves = 0;
  for (let s = 1000; s < 1100; s += 1) {
    h.ev(`window.devTest.loadScenario("intro", ${s}); actionsList.replaceChildren(...['Move','Move','Move'].map(createAvailableActionItem)); refillAvailableActions()`);
    const hh = hand(h); hands += 1;
    check(hh.length === 5 && counts(hh).Move === 3, `cap-carry seed ${s}: no 4th Move`);
    extraMoves += hh.filter((a) => a === "Move").length - 3;
  }
  check(hands <= 500, "stayed within 500 hands");
  Object.values(totals).forEach((n) => check(n > 0, "every action is drawn"));
  check(Object.keys(totals).length === 3, "three action types drawn");

  return { header: REQ_HEADER, independence: { hands: quiet.length, checkedAgainst: ["Math.random + getRandomIdleStartFrame noise", "other harness Math.random seed", "3 restarts with noise"], firstSequence: quiet },
    rules: { handsDrawn: hands, seeds: "1..120 (loadScenario) + 1000..1099 cap-carry", maxSameCountHistogram: hist, actionTotals: totals,
      carryOverChecks: carryChecked, reshuffleChecks: reshuffleChecked, extraMovesWithThreeKept: extraMoves,
      note: "counts only; uniform expectation would be equal action totals (not asserted)" } };
}
module.exports = { id: ID, run };
