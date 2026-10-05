"use strict";
// REQUIREMENT — L2 bots (hand-authored observations only; decide() is called directly)
// Testing boundary (tools/lab/CONTRACT.md): no game is loaded, no battle is run, no generated observations. Six
// hand-written observations; random-legal is called with three hand-picked seeds on each.
// Checks per observation: legality via legalOrderCheck, determinism (same observation + same seed twice -> identical
// orders), no mutation (the observation is deep-frozen; a frozen write would throw in strict mode), no new globals,
// plus the strategy-specific expectations of aggressive-pursuit. The bots' source is scanned for forbidden names.
const fs = require("node:fs");
const path = require("node:path");
const { BOTS, legalOrderCheck } = require("../../tools/lab/bots.cjs");

const ID = "b1-bots-decide";

const wolf = (id, row, col, extra = {}) => ({ id, team: "player", type: "wolf", row, col, direction: "right", health: 5, maxHealth: 5, defeated: false, concealed: false, movementMode: null, queue: [], ...extra });
const foe = (id, row, col, extra = {}) => ({ id, team: "enemy", type: "deer", row, col, direction: "left", health: 3, maxHealth: 3, defeated: false, concealed: false, ...extra });
const obs = ({ preset = "commander", budget = 3, hand, units, enemyMode = "wolves" }) => ({
  schema: "player-observation/1",
  config: { gridSize: 10, enemyMode },
  rules: { preset, version: "t", hash: "t", playerActionBudget: budget, enemyActionBudget: 3, handSize: 5, maxSameAction: 2 },
  terrain: { pond: [], hill: [], tree: [], hillLevels: [] },
  units,
  hand: { cards: hand, reshuffleChargesRemaining: 1 },
  outcome: null,
});

const OBS = {
  // A: commander; P1 adjacent (diagonal) to E1, P2 far from everything, P3 defeated, budget 3, mixed hand
  A_adjacent: obs({ hand: ["Move", "Attack", "Defend", "Attack", "Move"], units: [wolf("P1", 5, 5), wolf("P2", 8, 2), wolf("P3", 0, 0, { defeated: true }), foe("E1", 6, 6), foe("E2", 2, 8)] }),
  // B: current preset (no targets), enemy far away, hand without Attack
  B_far_current: obs({ preset: "current", hand: ["Move", "Move", "Defend"], units: [wolf("P1", 0, 0), foe("E1", 9, 9)] }),
  // C: empty hand
  C_empty_hand: obs({ hand: [], units: [wolf("P1", 5, 5), foe("E1", 5, 6)] }),
  // D: budget exhausted by already queued actions (hand still full)
  D_budget_exhausted: obs({ budget: 2, hand: ["Move", "Attack", "Defend"], units: [wolf("P1", 5, 5, { queue: ["Move", "Attack"] }), wolf("P2", 7, 7), foe("E1", 5, 6)] }),
  // E: commander; P1 already targets E2 (farther), P2 targets nothing, E1 is nearest to both
  E_targets: obs({ hand: ["Attack", "Move", "Move", "Defend", "Attack"], units: [wolf("P1", 4, 4, { target: "E2", targetSource: "chosen" }), wolf("P2", 4, 6, { target: null, targetSource: null }), foe("E1", 4, 5), foe("E2", 9, 9)] }),
  // F: commander; the nearest enemy E1 is concealed, so only E2 is visible
  F_concealed: obs({ hand: ["Move", "Attack", "Defend"], units: [wolf("P1", 3, 3), foe("E1", 3, 4, { concealed: true }), foe("E2", 8, 8)] }),
};

function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function check(cond, msg) { if (!cond) throw new Error(`b1 assertion failed: ${msg}`); }
const j = (v) => JSON.stringify(v);

async function run() {
  const src = fs.readFileSync(path.join(__dirname, "../../tools/lab/bots.cjs"), "utf8").replace(/\/\*[\s\S]*?\*\//, "").replace(/^\s*\/\/.*$/gm, "");
  ["window", "document", "globalThis", "Math.random", "Date", "process", "setTimeout", "devTest"].forEach((w) => check(!src.includes(w), `bots.cjs source mentions ${w}`));
  check(!/require\(/.test(src), "bots.cjs has no require");

  Object.values(OBS).forEach(deepFreeze);
  const globalsBefore = Object.getOwnPropertyNames(globalThis).sort().join(",");
  const result = {};

  for (const [name, o] of Object.entries(OBS)) {
    result[name] = {};
    const aggressive = BOTS["aggressive-pursuit"].decide(o, { rng: lcg(1) });
    check(j(aggressive) === j(BOTS["aggressive-pursuit"].decide(o, { rng: lcg(99) })), `${name}: aggressive ignores the rng`);
    const legal = legalOrderCheck(o, aggressive);
    check(legal.ok, `${name}: aggressive illegal ${j(legal)}`);
    result[name]["aggressive-pursuit"] = aggressive;
    result[name]["random-legal"] = {};
    for (const seed of [1, 2, 3]) {
      const a = BOTS["random-legal"].decide(o, { rng: lcg(seed) });
      const b = BOTS["random-legal"].decide(o, { rng: lcg(seed) });
      check(j(a) === j(b), `${name}: random-legal not deterministic for seed ${seed}`);
      const v = legalOrderCheck(o, a);
      check(v.ok, `${name}: random-legal seed ${seed} illegal ${j(v)}`);
      result[name]["random-legal"][`seed${seed}`] = a;
    }
  }
  check(Object.getOwnPropertyNames(globalThis).sort().join(",") === globalsBefore, "decide() created or removed a global");

  // Strategy-specific expectations
  const agg = (n) => result[n]["aggressive-pursuit"];
  const rand = (n) => Object.values(result[n]["random-legal"]);
  const actionsOf = (orders) => orders.filter((x) => "action" in x);
  // A: three actions (budget), P1 adjacent strikes first, P2 moves; P3 (defeated) gets nothing; targets E1 / E1 (nearest visible)
  check(agg("A_adjacent").filter((x) => "target" in x).map((x) => `${x.unit}>${x.target}`).join() === "P1>E1,P2>E1", "A: targets nearest enemy per wolf");
  check(actionsOf(agg("A_adjacent")).length === 3, "A: budget fully spent");
  check(actionsOf(agg("A_adjacent"))[0].unit === "P1" && actionsOf(agg("A_adjacent"))[0].action === "Attack", "A: adjacent wolf attacks");
  check(actionsOf(agg("A_adjacent"))[1].unit === "P2" && actionsOf(agg("A_adjacent"))[1].action === "Move", "A: far wolf moves");
  check(!agg("A_adjacent").some((x) => x.unit === "P3"), "A: defeated wolf never ordered");
  // B: current preset -> no target orders from either bot; hand-limited: Move, Move, Defend only
  check(agg("B_far_current").every((x) => "action" in x) && actionsOf(agg("B_far_current")).map((x) => x.action).join() === "Move,Move,Defend", "B: Move toward the far enemy using the hand only");
  check(rand("B_far_current").every((o) => o.every((x) => "action" in x)), "B: random emits no target orders under current");
  // C and D: nothing legal / nothing to spend
  check(j(agg("C_empty_hand")) === "[]" && rand("C_empty_hand").every((o) => o.length === 0), "C: empty hand gives []");
  check(j(agg("D_budget_exhausted")) === "[]" && rand("D_budget_exhausted").every((o) => o.length === 0), "D: exhausted budget gives []");
  // E: P1 re-targets E1 (its target E2 is not the nearest), P2 targets E1
  check(agg("E_targets").filter((x) => "target" in x).map((x) => `${x.unit}>${x.target}`).join() === "P1>E1,P2>E1", "E: re-targets to the nearest enemy");
  // F: concealed E1 is never targeted
  check(agg("F_concealed").filter((x) => "target" in x).every((x) => x.target === "E2"), "F: aggressive ignores the concealed enemy");
  check(rand("F_concealed").every((o) => o.filter((x) => "target" in x).every((x) => x.target === "E2")), "F: random never targets the concealed enemy");
  // Output differs by strategy where expected
  check(j(agg("A_adjacent")) !== j(result.A_adjacent["random-legal"].seed1), "A: strategies differ");
  check(new Set(rand("A_adjacent").map(j)).size > 1, "A: random-legal varies with the seed");
  // legalOrderCheck itself rejects illegal orders (mirrors the validator's reasons)
  const rej = (o, orders) => (legalOrderCheck(OBS[o], orders).reason ?? "ok");
  result.legalOrderCheck = {
    cardNotInHand: rej("B_far_current", [{ unit: "P1", action: "Attack" }]),
    budget: rej("D_budget_exhausted", [{ unit: "P1", action: "Move" }]),
    deadWolf: rej("A_adjacent", [{ unit: "P3", action: "Move" }]),
    targetInactive: rej("B_far_current", [{ unit: "P1", target: "E1" }]),
    maxSameAction: rej("B_far_current", [{ unit: "P1", action: "Move" }, { unit: "P1", action: "Move" }, { unit: "P1", action: "Move" }]),
    malformed: rej("A_adjacent", [{ unit: "P1" }]),
  };
  check(j(result.legalOrderCheck) === j({ cardNotInHand: "card-not-in-hand", budget: "action-budget", deadWolf: "unit-defeated", targetInactive: "target-selection-inactive", maxSameAction: "max-same-action", malformed: "malformed-order" }), "legalOrderCheck reasons");
  return { id: ID, header: "REQUIREMENT — L2 bots", observations: Object.keys(OBS), result };
}

module.exports = { id: ID, run };
