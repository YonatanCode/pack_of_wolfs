"use strict";
// REQUIREMENT — L2 driver (scripted bot only; hand-authored boards; <= 2 turns per battle)
// Testing boundary (tools/lab/CONTRACT.md): the driver is exercised ONLY with a SCRIPTED bot whose order lists are written
// below, on hand-placed boards, every record labelled fixtureOnly: true. No real bot, no generated board / orders / seed,
// no batch. Each battle boots one fresh context (intro, seed 1, commander) and hand-places the board through the existing
// fixture helper (TG.board = resetDevTest, enemy plan of the FIRST turn scripted empty); later enemy plans are the game's.
// D1a WIN IN 2 TURNS: P1 (6,6) next to E1 (6,5, 4 HP), alone; the loader adds rules=eab:0 (the enemy passes, a scripted
//     terminal outcome; the record's query does not carry the loader's board or rules). Turn 1 [target E1, Attack] -> E1 1 HP; turn 2 [Attack] ->
//     E1 dies: result win, 2 turns, budget/planned/executed/wasted per turn, byUnit, enemy side, replay data. The bot
//     mutates its observation on turn 1 (no effect: it gets a copy) and draws from ctx.rng (= mulberry32(botSeed)).
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
const S = require("../characterization/_settings.cjs");
const TG = require("../characterization/_targets.cjs");
const { mulberry32 } = require("../harness/load-game.cjs");
const { runBattle, replayBattle, diffRecords, MAX_ORDERS_PER_TURN } = require("../../tools/lab/driver.cjs");

const ID = "d1-driver-scripted";
const HAND_LIMIT = 40; // this fixture's own hand ledger (boot hand + every dealt / refilled hand)
const P1_E1 = (e1Health) => [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight", health: e1Health }, null, null];
const BASE = { scenarioId: "intro", seed: 1, preset: "commander", botSeed: 7, fixtureOnly: true };

function check(cond, msg) { if (!cond) throw new Error(`d1 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const contexts = [];
/** load-game shaped loader: real boot route with the hand counter, then the hand-placed board (+ optional fault). */
const boardLoad = (setups, { fault = false, queryOverride = null, rules = null } = {}) => (opts) => {
  const g = S.boot(queryOverride ?? `${opts.query}${rules ? `&rules=${rules}` : ""}`);
  contexts.push(g);
  TG.board(g, setups, []);
  if (fault) g.ev("drainTurnCore = function () { throw new Error('injected fault (d1e)'); }");
  return g;
};

/** Scripted bot: fixed per-turn outputs (a value, or a function returning / throwing). Logs what it saw. */
function scripted(id, perTurn, log = []) {
  let turn = 0;
  return {
    id,
    decide(observation, ctx) {
      const step = perTurn[turn];
      turn += 1;
      log.push({ turn, hand: observation.hand.cards.join(","), units: observation.units.map((u) => `${u.id}:${u.health}`).join(" "), keys: Object.keys(ctx).join(",") });
      if (step === undefined) throw new Error(`scripted bot has no order list for turn ${turn}`);
      return typeof step === "function" ? step(observation, ctx) : step;
    },
  };
}

/** Golden view of a record: everything except the bulky replay copy (checked equal to orders instead). */
function view(record) {
  same(record.replay.orders, record.orders, `${record.strategy}: replay.orders equals orders`);
  const { replay, ...rest } = record;
  return { ...rest, replayQuery: replay.query };
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
  records.a = runBattle({ ...BASE, load: boardLoad(P1_E1(4), { rules: "eab:0" }), bot: botA, limits: { maxTurnsPerBattle: 2 } });
  same(rngSeen, [mulberry32(7)()], "D1a: ctx.rng is mulberry32(botSeed)");
  check(records.a.result === "win" && records.a.turns === 2 && records.a.stopReason === "battle-end", "D1a: win after 2 turns");
  same(records.a.perTurn.map((t) => [t.status, t.budget, t.planned, t.executed, t.wasted]), [["ran", 5, 1, 1, 0], ["ran", 5, 1, 1, 0]], "D1a: per-turn metrics");
  same(logA.map((l) => l.keys), ["rng", "rng"], "D1a: ctx exposes only rng");
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
  check(c1.planned === 3 && c1.executed === 0 && c1.wasted === 3 && c1.eventHash === null, "D1c: the refused list wastes all 3 planned actions");
  check(c2.status === "ran" && c2.executed === 1, "D1c: turn 2 runs");
  check(records.c.result === "timeout", "D1c: timeout after 2 slots");
  out.c = view(records.c);

  // D1d
  const many = Array.from({ length: MAX_ORDERS_PER_TURN + 1 }, () => ({ unit: "P1", action: "Defend" })); // one fixed list, not generated data
  records.d = runBattle({ ...BASE, load: boardLoad(P1_E1(10)), bot: scripted("scripted-local", [{ not: "an array" }, many]), limits: { maxTurnsPerBattle: 2 } });
  same(records.d.perTurn.map((t) => [t.status, t.refusal && t.refusal.by, t.refusal && t.refusal.reason, t.planned, t.wasted]),
    [["refused", "driver", "malformed-orders", 0, 0], ["refused", "driver", "too-many-orders", 65, 65]], "D1d: driver-local refusals");
  check(records.d.result === "timeout", "D1d: timeout");
  out.d = { ...view(records.d), orders: records.d.orders.map((o) => (Array.isArray(o) ? `${o.length} orders` : o)), perTurn: records.d.perTurn.map(({ orders, ...t }) => t) };

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

  // D1i replay
  const loads = { a: boardLoad(P1_E1(4), { rules: "eab:0" }), b: boardLoad(P1_E1(10)), c: boardLoad(P1_E1(10)), d: boardLoad(P1_E1(10)), e: boardLoad(P1_E1(10), { fault: true }), h: boardLoad(P1_E1(10)) };
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
  ];
  out.optionErrors = refusals.map(([opts, expected]) => {
    try { runBattle(opts); } catch (e) { check(e instanceof TypeError && e.message.includes(expected), `D1j: ${expected}`); return e.message; }
    throw new Error(`D1j: ${expected} was accepted`);
  });
  check(contexts.length === before, "D1j: no context was created for invalid options");

  const hands = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  check(hands <= HAND_LIMIT, `d1 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return { header: "REQUIREMENT — L2 driver", fixtureOnly: true, contexts: contexts.length, hands, result: out };
}

module.exports = { id: ID, run };
