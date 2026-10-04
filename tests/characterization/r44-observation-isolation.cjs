"use strict";
// REQUIREMENT — L1 player orders: player-limited observation and state isolation (hard assertions; evidence in golden)
// R44a WHAT IS HIDDEN EXISTS. Commander board with a hill between P1 (7,0) and E1 (4,0): the engine holds a frozen
//      enemy plan (E1 has a planned action), a pack focus, enemy pack objectives and an RNG position, E1 is concealed
//      and its intent tags are hidden ON SCREEN while E2's are shown.
// R44b KEY WALK. Every key of the whole observation is walked: none of the forbidden names (RNG / seed, enemy plan,
//      focus, objectives, frozen-plan and accounting state, AI flags, draw weights, enemy pool, intents, debug) occurs;
//      queue / movementMode / target / targetSource occur only on player records; the exact key sets of the top level,
//      the rules summary, enemy records and player records are pinned (current: no target keys); the RNG position
//      value does not occur in the observation text. The observation is plain data (only plain objects / arrays,
//      strings, numbers, booleans, null).
// R44c COPIES. Mutating every part of an observation (hand, units, queues, terrain, rules, config) changes nothing in
//      the game (live fingerprint: state, DOM, view, debug, flags) and a fresh observation equals the original; taking
//      an observation changes nothing. Same for runHeadlessTurn's returned observation and events.
// R44d REJECTION DOES NOT LEAK. Two refused headless turns (budget overflow, bad target), then a valid one, equal a
//      never-refused control (events, BattleState, note, observation; fingerprint equal before the valid turn). The
//      headless door runs NO presentation: with r10's DOM / timer spies active around refused and accepted
//      runHeadlessTurn calls, nothing is created, mutated or scheduled.
const O = require("./_orders.cjs");
const { PV, S } = O;
const { check, same } = S;

const ID = "r44-observation-isolation";
const FORBIDDEN = ["rng", "handSeed", "handState", "seed", "seeds", "enemyPack", "pack", "packQueue", "plan", "planned", "planFrozen", "frozen", "focus",
  "packObjective", "objective", "slotDelta", "isFleeing", "turnsSinceHit", "tookDamageThisTurn", "drawWeights", "weights", "weightMove", "weightAttack",
  "weightDefend", "enemyActionPool", "pool", "poolMove", "poolDefend", "poolAttack", "intent", "intents", "intentTags", "debug", "accounting",
  "enemyAccounting", "assigned", "unassigned", "forfeited", "isExecutingActionQueue", "isHidden"];
const PLAYER_ONLY = ["movementMode", "queue", "target", "targetSource"];
const SEEN = ["id", "team", "type", "row", "col", "direction", "health", "maxHealth", "defeated", "concealed"];
const PLAIN_CHECK = `(function (o) { const bad = []; const walk = (v, p) => {
  if (v === undefined || typeof v === "function" || typeof v === "symbol" || typeof v === "bigint") bad.push(p);
  else if (v && typeof v === "object") { const pr = Object.getPrototypeOf(v); if (pr !== Object.prototype && pr !== Array.prototype) bad.push(p + ":proto");
    Object.keys(v).forEach((k) => walk(v[k], p + "." + k)); } }; walk(o, "$"); return bad; })`;
const MUTATE = `(function (o) { o.hand.cards.push("Move"); o.hand.cards[0] = "X"; o.hand.reshuffleChargesRemaining = 99;
  o.units.forEach((u) => { u.row = 99; u.col = 99; u.health = -1; u.defeated = true; u.concealed = !u.concealed; if (u.queue) u.queue.push("Move"); if ("target" in u) u.target = "E9"; });
  o.units.push({ id: "P9" }); o.terrain.hill.push("1,1"); o.terrain.pond.push("2,2"); o.terrain.hillLevels.push(["1,1", 3]);
  o.rules.playerActionBudget = 99; o.rules.hash = "x"; o.config.gridSize = 3; o.outcome = "player"; return true; })`;

function keyWalk(obs, handState) {
  const paths = O.keyPaths(obs);
  const forbidden = paths.filter((p) => FORBIDDEN.includes(p.key)).map((p) => p.path);
  same(forbidden, [], "no forbidden key anywhere in the observation");
  const misplaced = paths.filter((p) => PLAYER_ONLY.includes(p.key)).filter((p) => {
    const m = /^\$\.units\[(\d+)\]\.[A-Za-z]+$/.exec(p.path);
    return !m || obs.units[Number(m[1])].team !== "player";
  }).map((p) => p.path);
  same(misplaced, [], "queue / movementMode / target keys only on player records");
  check(!JSON.stringify(obs).includes(String(handState)), "the RNG position value does not occur in the observation");
  return { keysWalked: paths.length, forbiddenFound: forbidden, misplaced };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R44a / R44b commander board with a concealed enemy
  const g = track(O.boot(O.CMD));
  g.ev(`resetDevTest({ row: 7, col: 0, direction: "topRight" }, { row: 4, col: 0, direction: "bottomLeft" }, { row: 11, col: 3 }, { row: 0, col: 7 },
    { isActive: false }, { isActive: false }); updateEnemyIntentPreview();`);
  same(O.applyOrders(g, [{ unit: "P1", action: "Attack" }, { unit: "P2", target: "E2" }]), { ok: true, queuedTotal: 1 }, "board orders applied");
  const hidden = O.J(g, `({ packQueue: getPackQueueData(), focus: getPackFocusData(), frozen: getEnemyPlanState().frozen,
    objectives: [enemy.packObjective, enemySupport.packObjective], concealed: units.filter((u) => u.isHidden).map(getBattleDebugUnitId),
    tagsShown: { E1: !enemy.intentTags.hidden, E2: !enemySupport.intentTags.hidden }, handState: handRandom.getState() })`);
  check(hidden.packQueue.some((e) => e.unit === "E1") && hidden.focus && hidden.frozen && hidden.objectives.every(Boolean), "the engine holds an enemy plan (incl. E1), focus, objectives");
  check(hidden.concealed.includes("E1") && !hidden.tagsShown.E1 && hidden.tagsShown.E2, "E1 is concealed: its intent tags are hidden on screen, E2's are shown");
  const obs = O.observe(g);
  const walk = keyWalk(obs, hidden.handState);
  same(Object.keys(obs), ["schema", "config", "rules", "terrain", "units", "hand", "outcome"], "top-level keys");
  same(Object.keys(obs.rules), ["preset", "version", "hash", "playerActionBudget", "enemyActionBudget", "handSize", "maxSameAction"], "rules summary keys");
  obs.units.forEach((u) => same(Object.keys(u), u.team === "player" ? [...SEEN, ...PLAYER_ONLY] : SEEN, `${u.id}: record keys`));
  same(obs.units.map((u) => u.id), ["P1", "P2", "E1", "E2"], "only the units on the board (absent units are not listed)");
  same(O.J(g, `${PLAIN_CHECK}(observeBattle())`), [], "plain data only");
  const cur = track(O.boot());
  const curObs = O.observe(cur);
  keyWalk(curObs, O.J(cur, "handRandom.getState()"));
  curObs.units.forEach((u) => same(Object.keys(u), u.team === "player" ? [...SEEN, "movementMode", "queue"] : SEEN, `current ${u.id}: record keys (no target)`));

  // ---- R44c copies
  const before = PV.liveFingerprint(g);
  g.ev("globalThis.__obs = observeBattle()");
  same(PV.liveFingerprint(g), before, "taking an observation changes nothing");
  check(O.J(g, `${MUTATE}(__obs)`) === true, "observation mutated in the context");
  same(PV.liveFingerprint(g), before, "mutating the observation changes nothing in the game");
  same(O.observe(g), obs, "a fresh observation equals the original");
  const headCtx = track(O.boot());
  const res = O.J(headCtx, `(globalThis.__res = runHeadlessTurn(${JSON.stringify([{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }])}))`);
  const afterTurn = PV.liveFingerprint(headCtx);
  headCtx.ev(`${MUTATE}(__res.observation); __res.events.forEach((e) => { e.type = "x"; }); __res.events.length = 0;`);
  same(PV.liveFingerprint(headCtx), afterTurn, "mutating runHeadlessTurn's observation and events changes nothing");
  same(O.observe(headCtx), res.observation, "a fresh observation equals the returned one");
  same(O.J(headCtx, "window.devTest.getTurnEventLog()"), res.events, "the engine's turn log still equals the returned events");

  // ---- R44d rejection does not leak; the door runs no presentation
  const rej = track(O.boot());
  const ctl = track(O.boot());
  rej.ev("__p1e.installSpies()");
  const spied = (fn) => { rej.ev("__p1e.spy.active = true; __p1e.spy.created = 0; __p1e.spy.mutations = {}; __p1e.spy.scheduled = {};");
    try { return { out: fn(), counters: O.J(rej, "__p1e.counters()") }; } finally { rej.ev("__p1e.spy.active = false;"); } };
  const refusals = [
    spied(() => O.verdictOf(O.headlessTurn(rej, [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Defend" },
      { unit: "P1", action: "Defend" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Attack" }]))),
    spied(() => O.verdictOf(O.headlessTurn(rej, [{ unit: "P1", action: "Move" }, { unit: "P1", target: "E1" }]))),
  ];
  same(refusals.map((r) => r.out), ["action-budget@5", "target-selection-inactive@1"], "two refused headless turns");
  refusals.forEach((r, i) => same(r.counters, PV.ZERO_COUNTERS, `refusal ${i + 1}: no presentation`));
  same(PV.liveFingerprint(rej), PV.liveFingerprint(ctl), "after the refusals the battle equals a never-refused control");
  const T = [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Defend" }];
  let rejTurn;
  const accepted = spied(() => { rejTurn = O.playHeadless(rej, T); return "ok"; });
  same(accepted.counters, PV.ZERO_COUNTERS, "accepted headless turn: no presentation (nothing created, mutated or scheduled)");
  const valid = O.sameTurn(rejTurn, O.playHeadless(ctl, T), "R44d after refusals vs control");
  const staleView = O.J(rej, "__p1e.view().handView");

  return {
    header: "REQUIREMENT — L1 player orders: observation and state isolation",
    hands: O.reportOrderHands(ID, ctxs),
    hiddenInEngine: { ...hidden, handState: "(recorded in the context; asserted absent from the observation)" },
    observation: obs,
    keyWalk: walk,
    currentObservationUnits: curObs.units,
    headlessResult: { outcome: res.outcome, eventCount: res.events.length },
    rejection: { refusals: refusals.map((r) => r.out), counters: [...refusals.map((r) => r.counters), accepted.counters], validTurn: valid,
      handViewAfterHeadless: staleView },
  };
}
module.exports = { id: ID, run };
