"use strict";
// REQUIREMENT — L2/L3 driver (scripted bot only; hand-authored boards; <= 2 turns per battle)
// Testing boundary (tools/lab/CONTRACT.md): the driver is exercised ONLY with a SCRIPTED bot whose order lists are written
// below, on hand-placed boards, every record labelled fixtureOnly: true. No real bot, no generated board / orders / seed,
// no batch. Each battle boots one fresh context (intro, seed 1, commander) and hand-places the board through the existing
// fixture helper (TG.board = resetDevTest, enemy plan of the FIRST turn scripted empty); later enemy plans are the game's.
// Every battle here passes customSetup (hand-placed board), so no visual replay payload is built (payloadNote says why);
// the payload itself is covered by d4 on the unmodified intro setup.
// D1a WIN IN 2 TURNS: P1 (6,6) next to E1 (6,5, 4 HP), alone; rulesQuery rules=eab:0 (the enemy passes, a scripted
//     terminal outcome; the query carries the rules, not the loader's board). Turn 1 [target E1, Attack] -> E1 1 HP; turn 2 [Attack] ->
//     E1 dies: result win, 2 turns, budget/planned/executed/wasted per turn, byUnit, enemy side, replay data. The bot
//     mutates its observation on turn 1 (no effect: it gets a copy) and draws from ctx.rng (= mulberry32(botSeed));
//     ctx is { rng, round: 0, maxRounds: 2 } (a legacy one-call bot never sees round 1).
// D1b TIMEOUT: same board, E1 10 HP, maxTurnsPerBattle 1, turn 1 [Defend]: result timeout, stopReason max-turns-per-battle.
// D1c REFUSED THEN LEGAL: turn 1 asks for three Attack cards (the hand holds two): refused by the engine
//     (card-not-in-hand @2), all 3 planned actions wasted, nothing changed; turn 2 [Attack] runs. maxTurnsPerBattle 2.
// D1d DRIVER-LOCAL REFUSALS: turn 1 returns a non-array (malformed-orders), turn 2 returns 65 orders (too-many-orders);
//     neither reaches the engine; result timeout after 2 slots.
// D1e ENGINE ERROR: drainTurnCore replaced by a throwing stub in this context only (fault injection, as r16 does):
//     result error, status engine-error, recorded not thrown; the planned action counts as wasted.
// D1f BOT ERROR: decide() throws on turn 1: result error, status bot-error.
// D1g PRESET MISMATCH (setup): load boots a current-preset battle for a commander request: result error, setup-error.
// D1h TOTAL-TURN LIMIT: turnsRemaining 0 -> timeout max-total-turns before any decide (the bot is never called).
// D1i REPLAY: replayBattle(record, load) on a fresh context reproduces D1a..D1e and D1h byte-identically (diffRecords = []).
// D1j OPTION ERRORS throw TypeError before anything loads (no context is created).
// L3 (bot protocol v2 and per-turn metrics):
// D1k MISS: P1 (6,6), E1 far at (2,2); turn 1 [Attack] -> a Miss (target-not-adjacent): executed 0, attacksMissed 1,
//     missReasons, wasted 0, notExecuted 1, unspentBudget 4 (planned = executed + attacksMissed + wasted).
// D1l RESHUFFLE ROUND: round 0 [reshuffle] is applied without a turn, round 1 sees the new hand (recorded once:
//     Move,Attack,Defend,Attack,Defend; charges 1) and [Defend] runs the turn: steps [[reshuffle], [Defend]], reshuffles 1,
//     reshuffleChargesAfter 1. Turn 2 is a one-round [Defend]. ctx.round 0 then 1.
// D1m RESHUFFLE REFUSED: rules rc:0: the reshuffle step is refused by the game (no-reshuffle-charges, step 0), no round 1.
// D1n RESHUFFLE IN THE LAST ROUND: round 1 returns [reshuffle] again: driver refusal reshuffle-in-last-round (step 1, not
//     sent); the round-0 reshuffle was applied (reshuffles 1, charges 1).
// D1o RESHUFFLE MIXED WITH A CARD in round 0: not a reshuffle-only list, so it runs the turn: the game refuses it
//     (hand-not-observed @1).
// D1i also replays D1f (bot error re-raised from the record) and D1k..D1o.
const S = require("../characterization/_settings.cjs");
const TG = require("../characterization/_targets.cjs");
const { mulberry32 } = require("../harness/load-game.cjs");
const { runBattle, replayBattle, diffRecords, MAX_ORDERS_PER_TURN } = require("../../tools/lab/driver.cjs");

const ID = "d1-driver-scripted";
const HAND_LIMIT = 60; // this fixture's own hand ledger (boot hand + every dealt / refilled hand)
const P1_E1 = (e1Health) => [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight", health: e1Health }, null, null];
const P1_FAR = [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 2, col: 2, direction: "bottomRight" }, null, null];
const BASE = { scenarioId: "intro", seed: 1, preset: "commander", botSeed: 7, fixtureOnly: true, customSetup: "hand-placed board (resetDevTest)" };
const R = { reshuffle: true };

function check(cond, msg) { if (!cond) throw new Error(`d1 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const contexts = [];
/** load-game shaped loader: real boot route with the hand counter, then the hand-placed board (+ optional fault). */
const boardLoad = (setups, { fault = false, queryOverride = null } = {}) => (opts) => {
  const g = S.boot(queryOverride ?? opts.query);
  contexts.push(g);
  TG.board(g, setups, []);
  if (fault) g.ev("drainTurnCore = function () { throw new Error('injected fault (d1e)'); }");
  return g;
};

/** Scripted bot: fixed outputs, one per decide() CALL (a value, or a function returning / throwing). Logs what it saw. */
function scripted(id, perCall, log = []) {
  let call = 0;
  return {
    id,
    decide(observation, ctx) {
      const step = perCall[call];
      call += 1;
      log.push({ call, round: ctx.round, hand: observation.hand.cards.join(","), charges: observation.hand.reshuffleChargesRemaining,
        units: observation.units.map((u) => `${u.id}:${u.health}`).join(" "), keys: Object.keys(ctx).join(",") });
      if (step === undefined) throw new Error(`scripted bot has no order list for call ${call}`);
      return typeof step === "function" ? step(observation, ctx) : step;
    },
  };
}

/** Golden view of a record: everything except the bulky replay copies (checked equal to orders / steps instead). */
function view(record) {
  same(record.replay.orders, record.orders, `${record.strategy}: replay.orders equals orders`);
  same(record.replay.steps, record.perTurn.map((t) => t.steps), `${record.strategy}: replay.steps equals the per-turn steps`);
  check(record.replay.payload === null && record.replay.payloadNote === `not replayable on the page: ${BASE.customSetup}`, `${record.strategy}: no payload for a hand-placed board`);
  const { replay, ...rest } = record;
  return { ...rest, replayQuery: replay.query };
}
/** planned = executed + attacksMissed + wasted; notExecuted = planned - executed (every slot). */
function checkRelations(record) {
  record.perTurn.forEach((t) => {
    check(t.planned === t.executed + t.attacksMissed + t.wasted && t.notExecuted === t.planned - t.executed, `${record.strategy} turn ${t.turn}: metric relations`);
  });
}

function run() {
  const out = {};
  const records = {};

  // D1a
  const logA = [];
  const rngSeen = [];
  const botA = scripted("scripted-win", [
    (obs, ctx) => { rngSeen.push(ctx.rng()); obs.units.length = 0; obs.hand.cards.length = 0; return [{ unit: "P1", target: "E1" }, { unit: "P1", action: "Attack" }]; },
    [{ unit: "P1", action: "Attack" }],
  ], logA);
  records.a = runBattle({ ...BASE, rulesQuery: "rules=eab:0", load: boardLoad(P1_E1(4)), bot: botA, limits: { maxTurnsPerBattle: 2 } });
  same(rngSeen, [mulberry32(7)()], "D1a: ctx.rng is mulberry32(botSeed)");
  check(records.a.result === "win" && records.a.turns === 2 && records.a.stopReason === "battle-end", "D1a: win after 2 turns");
  same(records.a.perTurn.map((t) => [t.status, t.budget, t.planned, t.executed, t.wasted, t.unspentBudget, t.attacksHit, t.attacksMissed]),
    [["ran", 5, 1, 1, 0, 4, 1, 0], ["ran", 5, 1, 1, 0, 4, 1, 0]], "D1a: per-turn metrics");
  same(logA.map((l) => `${l.keys}@${l.round}`), ["rng,round,maxRounds@0", "rng,round,maxRounds@0"], "D1a: ctx is { rng, round, maxRounds }, one round per slot");
  check(records.a.replay.query === "?scenario=intro&seed=1&preset=commander&rules=eab:0", "D1a: the query carries rulesQuery");
  check(logA[1].units.includes("E1:1"), "D1a: turn 2 observation shows E1 at 1 HP (the bot's turn-1 mutation had no effect)");
  out.a = { record: view(records.a), botSaw: logA, rngFirst: rngSeen[0] };

  // D1b
  records.b = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-timeout", [[{ unit: "P1", action: "Defend" }]]), limits: { maxTurnsPerBattle: 1 } });
  check(records.b.result === "timeout" && records.b.stopReason === "max-turns-per-battle" && records.b.turns === 1, "D1b: timeout after 1 turn");
  out.b = view(records.b);

  // D1c
  const attack3 = [{ unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }];
  records.c = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-refused", [attack3, [{ unit: "P1", action: "Attack" }]]), limits: { maxTurnsPerBattle: 2 } });
  const [c1, c2] = records.c.perTurn;
  check(c1.status === "refused" && c1.refusal.by === "engine" && c1.refusal.reason === "card-not-in-hand" && c1.refusal.index === 2, "D1c: turn 1 refused card-not-in-hand @2");
  check(c1.planned === 3 && c1.executed === 0 && c1.wasted === 3 && c1.notExecuted === 3 && c1.unspentBudget === 5 && c1.eventHash === null, "D1c: the refused list wastes all 3 planned actions");
  check(c2.status === "ran" && c2.executed === 1, "D1c: turn 2 runs");
  check(records.c.result === "timeout", "D1c: timeout after 2 slots");
  out.c = view(records.c);

  // D1d
  const many = Array.from({ length: MAX_ORDERS_PER_TURN + 1 }, () => ({ unit: "P1", action: "Defend" })); // one fixed list, not generated data
  records.d = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-local", [{ not: "an array" }, many]), limits: { maxTurnsPerBattle: 2 } });
  same(records.d.perTurn.map((t) => [t.status, t.refusal && t.refusal.by, t.refusal && t.refusal.reason, t.planned, t.wasted]),
    [["refused", "driver", "malformed-orders", 0, 0], ["refused", "driver", "too-many-orders", 65, 65]], "D1d: driver-local refusals");
  check(records.d.result === "timeout", "D1d: timeout");
  out.d = { ...view(records.d), orders: records.d.orders.map((o) => (Array.isArray(o) ? `${o.length} orders` : o)),
    perTurn: records.d.perTurn.map(({ orders, steps, ...t }) => ({ ...t, steps: steps.map((st) => (Array.isArray(st) ? `${st.length} orders` : st)) })) };

  // D1e
  records.e = runBattle({ ...BASE, load: boardLoad(P1_E1(10), { fault: true }), bot: scripted("scripted-fault", [[{ unit: "P1", action: "Attack" }]]), limits: { maxTurnsPerBattle: 2 } });
  check(records.e.result === "error" && records.e.stopReason === "engine-error" && /injected fault/.test(records.e.error), "D1e: engine error recorded");
  check(records.e.perTurn[0].wasted === 1, "D1e: the planned action counts as wasted");
  out.e = view(records.e);

  // D1f
  records.f = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-throws", [() => { throw new Error("bot bug (d1f)"); }]), limits: { maxTurnsPerBattle: 2 } });
  check(records.f.result === "error" && records.f.stopReason === "bot-error" && records.f.perTurn[0].orders === null, "D1f: bot error recorded");
  out.f = view(records.f);

  // D1g
  const notCalled = scripted("scripted-unused", []);
  records.g = runBattle({ ...BASE, load: boardLoad(P1_E1(10), { queryOverride: "?scenario=intro&seed=1" }), bot: notCalled, limits: { maxTurnsPerBattle: 2 } });
  check(records.g.result === "error" && records.g.stopReason === "setup-error" && records.g.turns === 0, "D1g: preset mismatch is a setup error");
  out.g = view(records.g);

  // D1h
  const neverAsked = [];
  records.h = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-total", [[{ unit: "P1", action: "Defend" }]], neverAsked), limits: { maxTurnsPerBattle: 2 }, turnsRemaining: 0 });
  check(records.h.result === "timeout" && records.h.stopReason === "max-total-turns" && neverAsked.length === 0, "D1h: run-wide turn budget stops before decide");
  out.h = view(records.h);

  // D1k
  records.k = runBattle({ ...BASE, load: boardLoad(P1_FAR), bot: scripted("scripted-miss", [[{ unit: "P1", action: "Attack" }]]), limits: { maxTurnsPerBattle: 1 } });
  const k1 = records.k.perTurn[0];
  same([k1.planned, k1.executed, k1.attacksHit, k1.attacksMissed, k1.missReasons, k1.wasted, k1.notExecuted, k1.unspentBudget],
    [1, 0, 0, 1, { "target-not-adjacent": 1 }, 0, 1, 4], "D1k: a missed Attack is not executed and not wasted");
  out.k = view(records.k);

  // D1l
  const logL = [];
  records.l = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-reshuffle", [[R], [{ unit: "P1", action: "Defend" }], [{ unit: "P1", action: "Defend" }]], logL), limits: { maxTurnsPerBattle: 2 } });
  same(logL.map((l) => `${l.round}:${l.hand}:${l.charges}`), ["0:Attack,Move,Attack,Defend,Defend:2", "1:Move,Attack,Defend,Attack,Defend:1", "0:Attack,Move,Attack,Attack,Defend:1"],
    "D1l: round 1 sees the reshuffled hand; turn 2 starts at round 0");
  const [l1, l2] = records.l.perTurn;
  same([l1.status, l1.steps, l1.orders, l1.reshuffles, l1.reshuffleChargesAfter, l1.executed], ["ran", [[R], [{ unit: "P1", action: "Defend" }]], [{ unit: "P1", action: "Defend" }], 1, 1, 1], "D1l: turn 1");
  same([l2.steps.length, l2.reshuffles, l2.reshuffleChargesAfter], [1, 0, 1], "D1l: turn 2 one round");
  out.l = { record: view(records.l), botSaw: logL };

  // D1m
  records.m = runBattle({ ...BASE, rulesQuery: "rules=rc:0", load: boardLoad(P1_E1(10)), bot: scripted("scripted-no-charges", [[R]]), limits: { maxTurnsPerBattle: 1 } });
  const m1 = records.m.perTurn[0];
  same([m1.status, m1.refusal.by, m1.refusal.step, m1.refusal.reason, m1.steps.length, m1.reshuffles, m1.orders], ["refused", "engine", 0, "no-reshuffle-charges", 1, 0, null], "D1m: refused reshuffle");
  out.m = view(records.m);

  // D1n
  records.n = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-late-reshuffle", [[R], [R]]), limits: { maxTurnsPerBattle: 1 } });
  const n1 = records.n.perTurn[0];
  same([n1.status, n1.refusal.by, n1.refusal.step, n1.refusal.reason, n1.reshuffles, n1.reshuffleChargesAfter], ["refused", "driver", 1, "reshuffle-in-last-round", 1, 1], "D1n: reshuffle in the last round");
  out.n = view(records.n);

  // D1o
  records.o = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-mixed", [[R, { unit: "P1", action: "Defend" }]]), limits: { maxTurnsPerBattle: 1 } });
  const o1 = records.o.perTurn[0];
  same([o1.status, o1.refusal.by, o1.refusal.step, o1.refusal.reason, o1.refusal.index, o1.reshuffles], ["refused", "engine", 0, "hand-not-observed", 1, 0], "D1o: mixed list refused");
  out.o = view(records.o);

  Object.values(records).forEach(checkRelations);

  // D1i replay
  const loads = { a: boardLoad(P1_E1(4)), b: boardLoad(P1_E1(10)), c: boardLoad(P1_E1(10)), d: boardLoad(P1_E1(10)), e: boardLoad(P1_E1(10), { fault: true }), f: boardLoad(P1_E1(10)),
    h: boardLoad(P1_E1(10)), k: boardLoad(P1_FAR), l: boardLoad(P1_E1(10)), m: boardLoad(P1_E1(10)), n: boardLoad(P1_E1(10)), o: boardLoad(P1_E1(10)) };
  out.replay = {};
  Object.entries(loads).forEach(([k, load]) => {
    const again = replayBattle(records[k], load);
    same(diffRecords(records[k], again), [], `D1i: replay of ${k} reproduces the record`);
    out.replay[k] = "identical";
  });

  // D1j
  const before = contexts.length;
  const refusals = [
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: botA, limits: {} }, "limits.maxTurnsPerBattle"],
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: botA, limits: { maxTurnsPerBattle: 1 }, fixtureOnly: "yes" }, "fixtureOnly"],
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: { decide: () => [] }, limits: { maxTurnsPerBattle: 1 } }, "strategy unknown"],
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: botA, limits: { maxTurnsPerBattle: 1 }, botSeed: -1 }, "botSeed"],
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: botA, limits: { maxTurnsPerBattle: 1 }, rulesQuery: "eab:0" }, "rulesQuery"],
    [{ ...BASE, load: boardLoad(P1_E1(10)), bot: botA, limits: { maxTurnsPerBattle: 1 }, buildId: "ABC" }, "buildId"],
  ];
  out.optionErrors = refusals.map(([opts, expected]) => {
    try { runBattle(opts); } catch (e) { check(e instanceof TypeError && e.message.includes(expected), `D1j: ${expected}`); return e.message; }
    throw new Error(`D1j: ${expected} was accepted`);
  });
  check(contexts.length === before, "D1j: no context was created for invalid options");

  const hands = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  check(hands <= HAND_LIMIT, `d1 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return { header: "REQUIREMENT — L2/L3 driver", fixtureOnly: true, contexts: contexts.length, hands, result: out };
}

module.exports = { id: ID, run };
