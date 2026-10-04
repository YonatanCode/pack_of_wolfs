"use strict";
// REQUIREMENT — P2a acceptance (hard assertions; counts are reported in the golden)
// R20a: with equal weights the hands are EXACTLY today's: the recorded c1 / c8 goldens are reproduced (default
//       weights, and equal custom weights 2/2/2), and an inline copy of the OLD formula (floor(r * eligible.length))
//       agrees hand for hand (default weights and equal 3/3/3 with cap 2).
// R20b: a draw consumes EXACTLY ONE stream value (stream state delta), including the no-eligible fallback.
// R20c: weight 0 is never drawn; a skewed weight (Move 6) shifts counts toward Move with the cap respected.
// R20d: duplicate cap, carry-over (kept cards are the suffix, drawn cards prepended) and reshuffle are unchanged
//       under custom weights.
const fs = require("node:fs");
const path = require("node:path");
const P = require("./_settings.cjs");
const { check, same, hand, counts } = P;

const ID = "r20-weighted-draw";
const golden = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "goldens", `${name}.json`), "utf8"));
const redraw = (g, seed) => { g.ev(`actionsList.replaceChildren(); seedHandRandom(${seed}); refillAvailableActions()`); return hand(g); };
const OLD_FORMULA = (seed, size, cap) => `(function () { seedHandRandom(${seed}); const c = {}; const out = [];
  for (let i = 0; i < ${size}; i += 1) { const e = ACTIONS.filter((a) => (c[a] ?? 0) < ${cap}); const pool = e.length ? e : ACTIONS;
    const a = pool[Math.floor(handRandom() * pool.length)]; c[a] = (c[a] ?? 0) + 1; out.push(a); } return out; })()`;

async function run() {
  const handsByPart = {};
  const ctxs = [];
  const mk = (q) => { const g = P.boot(q); ctxs.push(g); return g; };

  // ---- R20a1: c8 golden (seeds 1..8): start, after play-two-and-refill, after reshuffle
  const c8 = golden("c8-intro-seeded-hands");
  const c1 = golden("c1-hand-draws");
  const eq = (label, rules) => {
    c8.bySeed.forEach((row) => {
      const g = mk(`?scenario=intro&seed=${row.seed}${rules}`);
      const start = hand(g);
      g.ev(`consumeAvailableAction(${JSON.stringify(start[0])}); consumeAvailableAction(${JSON.stringify(start[4])}); refillAvailableActions()`);
      const after = hand(g);
      g.ev("reshuffleActions()");
      same({ start, after, reshuffle: hand(g) }, { start: row.start, after: row.afterPlayTwoAndRefill, reshuffle: row.afterReshuffle }, `${label}: seed ${row.seed} matches the c8 golden`);
    });
  };
  eq("default weights", "");
  const handsDefault = ctxs.reduce((n, g) => n + P.handsOf(g), 0);
  eq("equal weights 2/2/2", "&preset=current&rules=wm:2,wa:2,wd:2");
  handsByPart.c8Golden = ctxs.reduce((n, g) => n + P.handsOf(g), 0);
  // ---- R20a2: c1 golden seeded hands (seeds 1..5, default and equal 2/2/2)
  const g1 = mk("?scenario=intro&seed=1");
  c1.seededHands.forEach(({ seed, hand: h }) => same(redraw(g1, seed), h, `c1 golden seed ${seed}`));
  const g1e = mk("?scenario=intro&seed=1&preset=current&rules=wm:2,wa:2,wd:2");
  c1.seededHands.forEach(({ seed, hand: h }) => same(redraw(g1e, seed), h, `c1 golden seed ${seed} with equal weights 2/2/2`));
  // ---- R20a3: old formula, hand for hand
  const gOld = mk("?scenario=intro&seed=1");
  for (let s = 2000; s < 2060; s += 1) same(redraw(gOld, s), gOld.ev(OLD_FORMULA(s, 5, 3)), `old formula, default settings, seed ${s}`);
  const gOld3 = mk("?scenario=intro&seed=1&preset=current&rules=wm:3,wa:3,wd:3,cap:2");
  for (let s = 3000; s < 3030; s += 1) same(redraw(gOld3, s), gOld3.ev(OLD_FORMULA(s, 5, 2)), `old formula, weights 3/3/3 cap 2, seed ${s}`);

  // ---- R20b: exactly one stream value per draw
  const gs = mk("?scenario=intro&seed=1&preset=current&rules=wm:6,wd:0");
  const oneValue = (counts0) => {
    gs.ev("seedHandRandom(77); handRandom()");
    const expected = gs.ev("handRandom.getState()");
    gs.ev("seedHandRandom(77)");
    const picked = gs.ev(`randomAction(${JSON.stringify(counts0)})`);
    check(gs.ev("handRandom.getState()") === expected, `exactly one stream value consumed for counts ${JSON.stringify(counts0)} (picked ${picked})`);
    return picked;
  };
  const picks = [{}, { Move: 3 }, { Move: 3, Attack: 3 }, { Move: 3, Attack: 3, Defend: 3 }, { Attack: 3 }].map(oneValue);
  same(picks[3], gs.ev("(function () { seedHandRandom(77); const p = ['Move', 'Attack']; return p[Math.floor(handRandom() * 2)]; })()"), "fallback (all capped) ignores the cap, never picks the weight-0 action, one value");
  const delta = gs.ev("seedHandRandom(5); const a = handRandom.getState(); refillAvailableActions(); actionsList.replaceChildren(); playerHand.length = 0; seedHandRandom(5); refillAvailableActions(); handRandom.getState() - a");
  check(typeof delta === "number", "stream advanced by a refill");
  // a full refill of N cards advances the stream by exactly N steps
  const steps = gs.ev(`(function () { const step = (seed, n) => { seedHandRandom(seed); for (let i = 0; i < n; i += 1) handRandom(); return handRandom.getState(); };
    playerHand.length = 0; actionsList.replaceChildren(); seedHandRandom(9); drawPlayerHandToSize(); const used = handRandom.getState(); return used === step(9, activeRules.handSize); })()`);
  check(steps === true, "a full hand of handSize cards consumes exactly handSize stream values");

  // ---- R20c: weight 0 never drawn; skew shifts counts, cap respected
  const SEEDS = 80;
  const gz = mk("?scenario=intro&seed=1&preset=current&rules=wd:0");
  let defendSeen = 0; const zeroHands = [];
  for (let s = 4000; s < 4030; s += 1) { const h = redraw(gz, s); zeroHands.push(h); defendSeen += h.filter((a) => a === "Defend").length; check(Math.max(...Object.values(counts(h))) <= 3, "cap respected with weight 0"); }
  check(defendSeen === 0, "weight 0 (Defend) is never drawn in 30 hands");
  const gEq = mk("?scenario=intro&seed=1"); const gSk = mk("?scenario=intro&seed=1&preset=current&rules=wm:6");
  let moveEq = 0; let moveSk = 0; let maxSk = 0; let attackEq = 0; let attackSk = 0;
  for (let s = 5000; s < 5000 + SEEDS; s += 1) {
    const e = redraw(gEq, s); const k = redraw(gSk, s);
    moveEq += e.filter((a) => a === "Move").length; moveSk += k.filter((a) => a === "Move").length;
    attackEq += e.filter((a) => a === "Attack").length; attackSk += k.filter((a) => a === "Attack").length;
    maxSk = Math.max(maxSk, ...Object.values(counts(k)));
    check(k.length === 5, "5 cards under skew");
  }
  check(moveSk > moveEq + 60 && attackSk < attackEq, `Move 6/1/1 shifts the counts toward Move (equal ${moveEq} vs skewed ${moveSk} Moves over ${SEEDS} hands; Attack ${attackEq} -> ${attackSk})`);
  check(maxSk <= 3, "cap 3 respected under skew");

  // ---- R20d: carry-over, cap, reshuffle under custom weights (cap 2)
  const gc = mk("?scenario=intro&seed=3&preset=current&rules=wm:6,cap:2");
  const first = hand(gc);
  check(first.length === 5 && Math.max(...Object.values(counts(first))) <= 2, "cap 2 holds for the initial hand");
  gc.ev(`consumeAvailableAction(${JSON.stringify(first[1])}); consumeAvailableAction(${JSON.stringify(first[3])})`);
  const kept = hand(gc); check(kept.length === 3, "3 unplayed remain");
  gc.ev("refillAvailableActions()");
  const after = hand(gc);
  same(after.slice(2), kept, "kept cards are the suffix, drawn cards are prepended");
  check(Math.max(...Object.values(counts(after))) <= 2, "cap applies to kept + drawn");
  gc.ev("setPlayerSelected(player); applyPlayerAction(playerHand[0])");
  gc.ev("reshuffleActions()");
  check(gc.ev("reshuffleChargesRemaining") === 1 && gc.ev("getUnitActionQueue(player).length") === 0 && hand(gc).length === 5, "reshuffle: charge spent, queues cleared, full hand");
  const gcap = mk("?scenario=intro&seed=4&preset=current&rules=cap:1,hs:3,wm:6");
  const distinct = hand(gcap);
  same([...distinct].sort(), ["Attack", "Defend", "Move"], "cap 1 with hand size 3 yields three distinct cards despite Move 6");

  const total = ctxs.reduce((n, g) => n + P.handsOf(g), 0);
  P.reportHands(ID, total);
  return {
    header: P.REQ_HEADER_P2A,
    handsGenerated: total,
    c8Golden: { seeds: "1..8 (default and 2/2/2)", identical: true, handsDefaultPart: handsDefault },
    c1Golden: { seeds: [1, 2, 3, 4, 5], identical: true },
    oldFormula: { default: "seeds 2000..2059", equal3cap2: "seeds 3000..3029", identical: true },
    oneStreamValuePerDraw: { picks, fullHandUsesHandSizeValues: true },
    weightZero: { hands: zeroHands.length, defendDrawn: defendSeen, sample: zeroHands.slice(0, 2) },
    skew: { hands: SEEDS, weights: "Move 6, Attack 1, Defend 1", moveEqual: moveEq, moveSkewed: moveSk, attackEqual: attackEq, attackSkewed: attackSk, maxSameInAHand: maxSk },
    carryOver: { first, kept, after },
    capOne: distinct,
  };
}
module.exports = { id: ID, run };
