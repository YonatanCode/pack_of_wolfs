"use strict";
// REQUIREMENT — search-benchmark candidates (hand-written views + one hand-placed board; nothing is played)
// S1a ENUMERATION by hand: V1 (commander, P1 alone, untargeted, E1 two tiles away, budget 2, hand Move+Attack) gives exactly
//     4 candidates, each with the target order P1 -> E1: [Attack], [Attack, Move], [Move], [Move, Attack] (enumeration
//     order Attack, Move, Defend). V2 (current preset, two wolves, hand Defend) gives 2 candidates without target orders.
//     V3 (commander, P1 already queued Move and targeting E1, P2 untargeted, enemies E1 and a CONCEALED E2, budget 3 -> room
//     2, hand Attack+Defend) gives 30 (11 card allocations incl. the empty one, since a card is already queued; P1 is
//     targetable through its queued Move, P2 only with an Attack; P1 -> E1 emits no order): counted by hand in the source.
// S1b LEGALITY: every enumerated candidate of V1..V3 passes legalOrderCheck (the validator mirror) on the matching
//     observation; budget, hand multiset and maxSameAction are never exceeded.
// S1c RANKING: generateCandidates is deterministic (same list twice), keeps maxCandidates, and on V1 ranks
//     [Move, Attack] (closes in, then a likely hit that kills the 3 HP E1) first.
// S1d GENERATION CAP: enumerateCandidates(V4, 50) stops at 50 with generationCapped (V4: three wolves, three enemies,
//     budget 5, five cards).
// S1e REAL VALIDATOR: on a hand-placed commander board (3 wolves, 3 enemies, boot hand), EVERY generated candidate (no
//     cap) is accepted by the game's validatePlayerOrders (handle.validate) and by legalOrderCheck on observeBattle();
//     the live battle is unchanged (fingerprint).
const T = require("./_s.cjs");
const { legalOrderCheck } = require("../../tools/lab/bots.cjs");

const ID = "s1-search-candidates";
const { SR, check, same } = T;

const wolf = (id, row, col, extra = {}) => ({ id, team: "player", row, col, health: 10, maxHealth: 10, defeated: false, concealed: false, queue: [], target: null, ...extra });
const foe = (id, row, col, extra = {}) => ({ id, team: "enemy", row, col, health: 10, maxHealth: 10, defeated: false, concealed: false, queue: [], target: null, ...extra });
const view = ({ targets = true, budget, cap = 3, hand, units, plan = [] }) => ({
  gridSize: 12, enemyMode: "wolves", targetsActive: targets, rules: { playerActionBudget: budget, maxSameAction: cap },
  terrain: { pond: [], hill: [], tree: [] }, units, enemyPlan: plan, hand: { cards: hand, reshuffleChargesRemaining: 2 },
});
/** The observation legalOrderCheck expects, built from a view. */
const obsOf = (v) => ({
  config: { gridSize: v.gridSize, enemyMode: v.enemyMode },
  rules: { preset: v.targetsActive ? "commander" : "current", playerActionBudget: v.rules.playerActionBudget, maxSameAction: v.rules.maxSameAction },
  units: v.units.map((u) => (u.team === "player" ? { ...u } : { id: u.id, team: u.team, row: u.row, col: u.col, defeated: u.defeated, concealed: u.concealed })),
  hand: { cards: [...v.hand.cards], reshuffleChargesRemaining: v.hand.reshuffleChargesRemaining },
});

const V1 = view({ budget: 2, hand: ["Move", "Attack"], units: [wolf("P1", 5, 5), foe("E1", 5, 7, { health: 3 })] });
const V2 = view({ targets: false, budget: 5, hand: ["Defend"], units: [wolf("P1", 5, 5), wolf("P2", 8, 8), foe("E1", 0, 0)] });
const V3 = view({ budget: 3, hand: ["Attack", "Defend"], units: [wolf("P1", 5, 5, { queue: ["Move"], target: "E1" }), wolf("P2", 7, 7), foe("E1", 3, 3), foe("E2", 9, 9, { concealed: true })] });
const V4 = view({ budget: 5, hand: ["Move", "Attack", "Defend", "Move", "Attack"], units: [wolf("P1", 9, 3), wolf("P2", 9, 5), wolf("P3", 9, 7), foe("E1", 2, 3), foe("E2", 2, 5), foe("E3", 2, 7)] });

function counts(orders) {
  const c = {};
  orders.filter((o) => "action" in o).forEach((o) => { c[o.action] = (c[o.action] ?? 0) + 1; });
  return c;
}

function run() {
  const out = {};
  // S1a
  const e1 = SR.enumerateCandidates(V1).candidates.map(SR.ordersOf);
  same(e1, [
    [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }],
    [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }, { unit: "P1", action: "Move" }],
    [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Move" }],
    [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Move" }, { unit: "P1", action: "Attack" }],
  ], "S1a: V1 candidates");
  const e2 = SR.enumerateCandidates(V2).candidates.map(SR.ordersOf);
  same(e2, [[{ unit: "P2", action: "Defend" }], [{ unit: "P1", action: "Defend" }]], "S1a: V2 candidates (no target orders under current)");
  const e3 = SR.enumerateCandidates(V3).candidates.map(SR.ordersOf);
  check(e3.length === 30, `S1a: V3 has 30 candidates (got ${e3.length})`);
  check(e3.some((o) => o.some((x) => x.target === "E2")), "S1a: the concealed E2 is a target choice");
  check(!e3.some((o) => o.some((x) => x.unit === "P1" && x.target === "E1")), "S1a: P1 already targets E1: no order emitted for it");
  check(e3.some((o) => o.length === 0), "S1a: with a card already queued, the plan adding nothing (P1 keeps E1) is a candidate");
  out.enumeration = { V1: e1.length, V2: e2.length, V3: e3.length };

  // S1b
  [[V1, e1], [V2, e2], [V3, e3]].forEach(([v, list], i) => {
    const o = obsOf(v);
    list.forEach((orders) => {
      const r = legalOrderCheck(o, orders);
      check(r.ok, `S1b: V${i + 1} candidate ${JSON.stringify(orders)} illegal: ${JSON.stringify(r)}`);
      const c = counts(orders);
      const hand = counts(v.hand.cards.map((a) => ({ action: a })));
      Object.keys(c).forEach((a) => check(c[a] <= (hand[a] ?? 0) && c[a] <= v.rules.maxSameAction, `S1b: V${i + 1} uses only hand cards (${a})`));
      const queued = v.units.reduce((n, u) => n + u.queue.length, 0);
      check(queued + orders.filter((x) => "action" in x).length <= v.rules.playerActionBudget, `S1b: V${i + 1} within the pack budget`);
    });
  });
  out.legal = "every V1..V3 candidate passes legalOrderCheck";

  // S1c
  const g1 = SR.generateCandidates(V1, { maxCandidates: 3 });
  same(g1, SR.generateCandidates(V1, { maxCandidates: 3 }), "S1c: deterministic ranking");
  check(g1.kept.length === 3 && g1.candidatesCapped === true && g1.generated === 4, "S1c: maxCandidates keeps 3 of 4");
  same(g1.kept[0].orders, [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Move" }, { unit: "P1", action: "Attack" }], "S1c: Move then Attack ranks first");
  out.ranking = g1.kept.map((k) => ({ orders: k.orders.filter((x) => "action" in x).map((x) => x.action).join(","), staticScore: k.staticScore }));

  // S1d
  const capped = SR.enumerateCandidates(V4, 50);
  check(capped.candidates.length === 50 && capped.generationCapped === true, "S1d: generation stops at the cap");
  const full = SR.enumerateCandidates(V4);
  check(full.generationCapped === false && full.candidates.length > 50, "S1d: below MAX_GENERATED the pool is complete");
  out.generationCap = { capped: capped.candidates.length, uncapped: full.candidates.length };

  // S1e
  const g = T.board([{ row: 9, col: 3 }, { row: 9, col: 5 }, { row: 9, col: 7 }, { row: 3, col: 3 }, { row: 3, col: 5, isHidden: true }, { row: 3, col: 7 }],
    [{ unitId: "enemy", action: "Move" }, { unitId: "enemySupport", action: "Attack" }]);
  const before = T.fingerprint(g);
  const handle = SR.createGameSearchHandle(g);
  const live = handle.state();
  const all = SR.generateCandidates(live, { maxCandidates: Number.MAX_SAFE_INTEGER });
  const obs = T.S.J(g, "window.devTest.observeBattle()");
  let accepted = 0;
  all.kept.forEach(({ orders }) => {
    const v = handle.validate(orders);
    check(v && v.ok === true && v.queuedTotal > 0, `S1e: the game refused ${JSON.stringify(orders)}: ${JSON.stringify(v)}`);
    check(legalOrderCheck(obs, orders).ok, `S1e: legalOrderCheck refused ${JSON.stringify(orders)}`);
    accepted += 1;
  });
  check(T.fingerprint(g) === before, "S1e: validating every candidate left the live battle unchanged");
  out.realValidator = { hand: live.hand.cards.join(","), generated: all.generated, accepted, concealedTargeted: all.kept.some((k) => k.orders.some((o) => o.target === "E2")) };
  out.hands = T.reportSearchHands(ID, [g]);
  return { header: "REQUIREMENT — search-benchmark candidates", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
