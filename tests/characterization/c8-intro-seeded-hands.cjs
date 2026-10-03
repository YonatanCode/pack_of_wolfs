"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C8: the concrete hands the seeded gameplay stream deals for the intro scenario (seeds 1..8), the
// hand after a play-2-and-refill cycle, and after a reshuffle. Changing the stream/draw order
// changes this golden on purpose (that is what makes accidental changes visible).
const { HEADER } = require("./_lib.cjs");
const { bootScenario, hand, seeds } = require("./_scn.cjs");

const ID = "c8-intro-seeded-hands";

async function run() {
  const out = { header: HEADER, bySeed: [] };
  for (let s = 1; s <= 8; s += 1) {
    const g = bootScenario(s);
    const start = hand(g);
    g.ev(`consumeAvailableAction(${JSON.stringify(start[0])}); consumeAvailableAction(${JSON.stringify(start[4])}); refillAvailableActions()`);
    const afterRefill = hand(g);
    g.ev("reshuffleActions()");
    out.bySeed.push({ seed: s, seeds: seeds(g), start, afterPlayTwoAndRefill: afterRefill, afterReshuffle: hand(g) });
  }
  return out;
}
module.exports = { id: ID, run };
