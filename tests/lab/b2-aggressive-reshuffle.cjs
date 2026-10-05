"use strict";
// REQUIREMENT — L3 aggressive-pursuit v2 (reshuffle round + reachability)
// Testing boundary (tools/lab/CONTRACT.md): hand-authored observation objects only, decide() called directly with
// ctx { rng, round, maxRounds: 2 }. No game is loaded, no battle is run, nothing is generated or fuzzed. Nine hand-written
// observations. random-legal is pinned to the L2 b1 golden by hash (its behaviour must stay byte-identical).
const crypto = require("node:crypto");
const { BOTS, legalOrderCheck } = require("../../tools/lab/bots.cjs");
const b1 = require("./b1-bots-decide.cjs");

const ID = "b2-aggressive-reshuffle";
const B1_RANDOM_LEGAL_SHA256 = "ea49f2b5c9f20a3692ac647b73bf5639036b1aa986c70eb620c95c0c7678b247"; // sha256 of the L2 golden's random-legal entries

const wolf = (id, row, col, extra = {}) => ({ id, team: "player", type: "wolf", row, col, direction: "right", health: 5, maxHealth: 5, defeated: false, concealed: false, movementMode: null, queue: [], ...extra });
const foe = (id, row, col, extra = {}) => ({ id, team: "enemy", type: "deer", row, col, direction: "left", health: 3, maxHealth: 3, defeated: false, concealed: false, ...extra });
const obs = ({ budget = 5, hand, charges = 1, units, tree = [] }) => ({
  schema: "player-observation/1",
  config: { gridSize: 10, enemyMode: "wolves" },
  rules: { preset: "commander", version: "t", hash: "t", playerActionBudget: budget, enemyActionBudget: 3, handSize: 5, maxSameAction: 5 },
  terrain: { pond: [], hill: [], tree, hillLevels: [] },
  units,
  hand: { cards: hand, reshuffleChargesRemaining: charges },
  outcome: null,
});
const ring = (r, c) => [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].map(([a, b]) => `${r + a},${c + b}`);

const OBS = {
  // poor hand (all Defend) with an enemy adjacent to the lone wolf, one charge
  poor: obs({ hand: ["Defend", "Defend", "Defend", "Defend", "Defend"], units: [wolf("P1", 5, 5), foe("E1", 5, 6)] }),
  // the same board and hand with zero charges
  noCharges: obs({ charges: 0, hand: ["Defend", "Defend", "Defend", "Defend", "Defend"], units: [wolf("P1", 5, 5), foe("E1", 5, 6)] }),
  // good hand: enemy far (not in reach), two Moves and an Attack in hand
  good: obs({ hand: ["Move", "Move", "Attack", "Defend"], units: [wolf("P1", 0, 0), foe("E1", 9, 9)] }),
  // far enemy, Attack-heavy hand, no charges: Attacks cannot land
  unreachable: obs({ charges: 0, budget: 4, hand: ["Attack", "Attack", "Move", "Attack"], units: [wolf("P1", 0, 0), foe("E1", 9, 9)] }),
  // enemy 2 Moves away (6 tiles: 3 + 2 to the adjacent tile), 3 Moves + Attack in hand
  reachable: obs({ charges: 0, budget: 4, hand: ["Move", "Move", "Move", "Attack"], units: [wolf("P1", 5, 2), foe("E1", 5, 8)] }),
  // adjacent enemy, two Attacks in hand: first lands, the second (target may step away) is not queued without a follow Move
  adjacent: obs({ charges: 0, hand: ["Attack", "Attack", "Defend"], units: [wolf("P1", 5, 5), foe("E1", 5, 6)] }),
  // nearest enemy E1 adjacent but concealed: ignored; only far E2 counts
  concealed: obs({ charges: 0, hand: ["Attack", "Move", "Defend"], units: [wolf("P1", 3, 3), foe("E1", 3, 4, { concealed: true }), foe("E2", 8, 8)] }),
  // enemy ringed by trees: no adjacent tile can be reached
  walled: obs({ charges: 0, hand: ["Attack", "Move", "Move"], tree: ring(5, 5), units: [wolf("P1", 5, 1), foe("E1", 5, 5)] }),
  // poor hand but a card is already queued (carry-over): never reshuffle
  queued: obs({ hand: ["Defend", "Defend", "Defend"], units: [wolf("P1", 5, 5, { queue: ["Move"] }), foe("E1", 5, 6)] }),
};

function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function check(cond, msg) { if (!cond) throw new Error(`b2 assertion failed: ${msg}`); }
const j = (v) => JSON.stringify(v);

async function run() {
  Object.values(OBS).forEach(deepFreeze);
  const decide = BOTS["aggressive-pursuit"].decide;
  const r0 = (o) => decide(o, { rng: lcg(1), round: 0, maxRounds: 2 });
  const r1 = (o) => decide(o, { rng: lcg(1), round: 1, maxRounds: 2 });
  const acts = (orders) => orders.filter((x) => "action" in x).map((x) => x.action);
  const result = {};
  const globalsBefore = Object.getOwnPropertyNames(globalThis).sort().join(",");

  for (const [name, o] of Object.entries(OBS)) {
    const a = r0(o), b = decide(o, { rng: lcg(99), round: 0, maxRounds: 2 }), c = r1(o);
    check(j(a) === j(b), `${name}: round 0 is deterministic and ignores the rng`);
    check(!c.some((x) => "reshuffle" in x), `${name}: round 1 never reshuffles`);
    check(legalOrderCheck(o, a).ok, `${name}: round 0 output is legal ${j(legalOrderCheck(o, a))}`);
    check(legalOrderCheck(o, c).ok, `${name}: round 1 output is legal ${j(legalOrderCheck(o, c))}`);
    result[name] = { round0: a, round1: c };
  }
  check(Object.getOwnPropertyNames(globalThis).sort().join(",") === globalsBefore, "decide() created or removed a global"); // frozen inputs: a write would have thrown

  // reshuffle: poor hand + charge -> exactly [{reshuffle:true}] in round 0 only
  check(j(result.poor.round0) === j([{ reshuffle: true }]), "poor hand with a charge reshuffles in round 0");
  check(acts(result.poor.round1).every((x) => x === "Defend") && !acts(result.poor.round1).includes("Attack"), "poor, round 1: Defend only, no Attack, no reshuffle");
  check(j(decide(OBS.poor, { rng: lcg(1) })) === j(result.poor.round1), "legacy ctx without a round never reshuffles");
  check(!result.noCharges.round0.some((x) => "reshuffle" in x), "zero charges: no reshuffle");
  check(!result.good.round0.some((x) => "reshuffle" in x) && acts(result.good.round0).join() === "Move,Move,Defend", "good hand: no reshuffle");
  check(!result.queued.round0.some((x) => "reshuffle" in x), "queued cards (carry-over): no reshuffle");
  // reachability
  check(!acts(result.unreachable.round1).includes("Attack") || false, "unreachable: no Attack");
  check(acts(result.unreachable.round1).join() === "Move", "unreachable: only the Move is queued (Attacks left unspent)");
  check(acts(result.reachable.round1).join() === "Move,Move,Move,Attack", "reachable: Move x3 then Attack once the route plus a spare Move are queued");
  check(acts(result.adjacent.round1).join() === "Attack,Defend", "adjacent: Attack first; second Attack not queued, Defend instead");
  check(!result.concealed.round1.some((x) => x.target === "E1") && acts(result.concealed.round1)[0] === "Move", "concealed adjacent enemy ignored: moves toward E2 instead of attacking");
  check(!acts(result.walled.round1).includes("Attack"), "walled target: no Attack");

  // legality of reshuffle rounds via legalOrderCheck (mirrors validatePlayerOrders)
  const reason = (o, orders) => legalOrderCheck(OBS[o], orders).reason ?? "ok";
  result.legalOrderCheck = {
    reshuffle: reason("poor", [{ reshuffle: true }]),
    noCharges: reason("noCharges", [{ reshuffle: true }]),
    twice: reason("poor", [{ reshuffle: true }, { reshuffle: true }]),
    cardAfter: reason("poor", [{ reshuffle: true }, { unit: "P1", action: "Move" }]),
    malformedUnit: reason("poor", [{ reshuffle: true, unit: "P1" }]),
    malformedValue: reason("poor", [{ reshuffle: false }]),
    targetAfterOk: reason("poor", [{ reshuffle: true }, { unit: "P1", target: "E1" }]),
  };
  check(j(result.legalOrderCheck) === j({ reshuffle: "ok", noCharges: "no-reshuffle-charges", twice: "no-reshuffle-charges", cardAfter: "hand-not-observed", malformedUnit: "malformed-order", malformedValue: "malformed-order", targetAfterOk: "ok" }), "legalOrderCheck reshuffle reasons");

  // random-legal byte-identical to the L2 golden (b1 is re-run on its own hand-authored observations)
  const b1r = (await b1.run()).result;
  const rl = {};
  for (const k of Object.keys(b1r).filter((x) => x !== "legalOrderCheck")) rl[k] = b1r[k]["random-legal"];
  check(crypto.createHash("sha256").update(j(rl)).digest("hex") === B1_RANDOM_LEGAL_SHA256, "random-legal outputs differ from the L2 golden");

  return { id: ID, header: "REQUIREMENT — L3 aggressive-pursuit v2", observations: Object.keys(OBS), result };
}

module.exports = { id: ID, run };
