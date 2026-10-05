"use strict";
/*
 * Battle Lab driver (L2, dev-only, PoC-grade). See tools/lab/CONTRACT.md ("Driver").
 *
 * runBattle(options) -> BattleRecord. Synchronous; never throws for anything that happens INSIDE a battle (load / setup
 * failure, refused order list, engine error, bot error): it is recorded in the BattleRecord. It throws a TypeError only for
 * invalid OPTIONS (a programming error, before anything runs).
 *
 * The game is touched only through load() (tests/harness/load-game.cjs shape) and window.devTest.observeBattle /
 * runHeadlessTurn. The driver itself reads runHeadlessTurn's dev-only `includeEvents` log to COUNT executed actions (and
 * hash the turn); the bot never sees it: decide() gets exactly a fresh copy of observeBattle() and ctx = { rng }.
 *
 * Options:
 *   load(opts) -> game         a fresh game context; called as load({ query, scenarios: true }) so loadGame from
 *                              tests/harness/load-game.cjs can be passed directly (a fixture may wrap it to hand-place a
 *                              board). game.ev(src) evaluates in the game. One context per battle.
 *   bot                        { decide(observation, ctx) -> orders } (bots.cjs entry; may carry `id`).
 *   strategy                   optional strategy id; else bot.id; else the key under which bot appears in bots.cjs BOTS.
 *   scenarioId, seed, preset   the battle: query "?scenario=<id>&seed=<n>&preset=<preset>".
 *   limits                     { maxTurnsPerBattle (required), maxTotalTurns? }; other manifest keys are ignored here.
 *   botSeed                    unsigned 32-bit integer: the bot-private stream mulberry32(botSeed), fresh per battle.
 *   fixtureOnly                boolean, copied into the record (true for hand-authored scripted fixtures).
 *   turnsRemaining             optional run-wide budget (defaults to limits.maxTotalTurns when present).
 *   deadlineMs, now            optional wall-clock stop (now() >= deadlineMs before a turn -> timeout "max-runtime").
 *                              The only non-deterministic stop; never used by fixtures.
 *
 * Turn loop (each iteration is one "turn" slot, counted against maxTurnsPerBattle whether or not the engine ran it):
 *   outcome decided -> win / loss / draw; slot limits -> timeout; else observe -> decide -> normalise orders ->
 *   runHeadlessTurn(orders, { includeEvents: true }).
 *   - bot-attributable refusal (validatePlayerOrders reasons, no-player-orders, driver-local malformed-orders /
 *     too-many-orders): recorded on the turn (status "refused"), every planned action is wasted, the battle continues
 *     (the next slot gets a fresh decide with the advanced bot stream).
 *   - environment refusal (busy, tutorial, no scenario battle, battle-over, turn-executing): result "error".
 *   - engine exception: result "error" (the engine keeps any partial turn, ENGINE-NOTES section 3; executed counts 0).
 *   - bot exception: result "error" (status "bot-error", orders null).
 *
 * Per turn: budget = observation.rules.playerActionBudget at the turn start; planned = action orders in the list;
 * executed = player actions consumed by a tick minus targetSkipped (a Miss counts as executed); wasted = planned -
 * executed (refused lists, skips, actions cleared by a death or unplayed at the battle end). Per wolf (byUnit) and the
 * enemy side (budget = enemyActionBudget, executed = enemy actions consumed) as the plan's metric requires.
 *
 * replayBattle(record, load) re-applies record.orders through the same step function on a fresh context and returns the
 * reproduced record (bot errors and wall-clock stops cannot be reproduced from orders: they are taken from the record).
 */
const crypto = require("node:crypto");
const { mulberry32 } = require("../../tests/harness/load-game.cjs");

const MAX_ORDERS_PER_TURN = 64; // turn-level guard: a longer list is refused locally (too-many-orders), never sent
const PLAYER_IDS = ["P1", "P2", "P3"];
const BOT_REFUSAL_REASONS = new Set([
  "malformed-orders", "malformed-order", "target-selection-inactive", "invalid-target", "target-defeated", "unknown-unit",
  "unit-defeated", "action-budget", "unknown-action", "max-same-action", "card-not-in-hand", "no-player-orders", "too-many-orders",
]);

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
const errText = (e) => String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 200);
const queryOf = (scenarioId, seed, preset) => `?scenario=${encodeURIComponent(scenarioId)}&seed=${seed}&preset=${encodeURIComponent(preset)}`;

/** Evaluate an expression in the game and bring the result back as Node-realm plain data. */
const evalJson = (game, expr) => {
  const text = game.ev(`JSON.stringify(${expr})`);
  return text === undefined ? undefined : JSON.parse(text);
};
const observe = (game) => evalJson(game, "window.devTest.observeBattle()");

/** Bot output -> JSON data exactly as the engine will see it, or null when it is not JSON-serialisable. */
function normaliseOrders(raw) {
  try {
    const text = JSON.stringify(raw);
    return text === undefined ? null : JSON.parse(text);
  } catch (_) {
    return null;
  }
}

const isActionOrder = (o) => Boolean(o) && typeof o === "object" && !Array.isArray(o) && "action" in o && !("target" in o);
function plannedByUnit(orders) {
  const out = {};
  (Array.isArray(orders) ? orders : []).filter(isActionOrder).forEach((o) => {
    const id = typeof o.unit === "string" ? o.unit : String(o.unit);
    out[id] = (out[id] ?? 0) + 1;
  });
  return out;
}

/** Player / enemy actions consumed by the turn's ticks, minus commander target-defeated skips. */
function countExecuted(events) {
  const byUnit = {};
  let enemy = 0;
  events.forEach((e) => {
    if (e.type === "consumed") {
      (e.actions ?? []).forEach((a) => {
        if (PLAYER_IDS.includes(a.unit)) byUnit[a.unit] = (byUnit[a.unit] ?? 0) + 1;
        else enemy += 1;
      });
    } else if (e.type === "targetSkipped" && PLAYER_IDS.includes(e.unit)) {
      byUnit[e.unit] = (byUnit[e.unit] ?? 0) - 1;
    }
  });
  return { byUnit, enemy };
}

function outcomeOf(observation) {
  const alive = (team) => observation.units.some((u) => u.team === team && !u.defeated);
  const p = alive("player");
  const e = alive("enemy");
  if (!p && !e) return "draw";
  if (!e) return "win";
  if (!p) return "loss";
  return null;
}

/**
 * One turn slot with already-normalised orders (null = not JSON data). Shared by runBattle and replayBattle.
 * -> { entry, stop: null | "error", observation (after, or the same one if the engine did not run) }
 */
function stepTurn(game, turn, before, orders) {
  const planned = plannedByUnit(orders);
  const plannedTotal = Object.values(planned).reduce((a, b) => a + b, 0);
  const entry = {
    turn, status: "ran", budget: before.rules.playerActionBudget, planned: plannedTotal, executed: 0, wasted: plannedTotal,
    orders, byUnit: {}, enemy: { budget: before.rules.enemyActionBudget, executed: 0 }, refusal: null, error: null, eventHash: null, observationHash: null,
  };
  const unitIds = before.units.filter((u) => u.team === "player").map((u) => u.id).sort();
  const fillByUnit = (executed) => {
    const ids = [...new Set([...unitIds, ...Object.keys(planned), ...Object.keys(executed)])].sort();
    ids.forEach((id) => { entry.byUnit[id] = { planned: planned[id] ?? 0, executed: executed[id] ?? 0 }; });
  };

  let local = null;
  if (orders === null || !Array.isArray(orders)) local = { index: -1, reason: "malformed-orders", message: "the bot did not return an array of JSON orders" };
  else if (orders.length > MAX_ORDERS_PER_TURN) local = { index: -1, reason: "too-many-orders", message: `more than ${MAX_ORDERS_PER_TURN} orders in one turn` };
  if (local) {
    entry.status = "refused";
    entry.refusal = { by: "driver", ...local };
    fillByUnit({});
    return { entry, stop: null, observation: before };
  }

  let result;
  try {
    result = evalJson(game, `window.devTest.runHeadlessTurn(${JSON.stringify(orders)}, { includeEvents: true })`);
  } catch (e) {
    entry.status = "engine-error";
    entry.error = errText(e);
    fillByUnit({});
    return { entry, stop: "error", observation: before };
  }

  if (!result || result.ok !== true) {
    const reason = result && typeof result.reason === "string" ? result.reason : "unknown";
    entry.refusal = { by: "engine", index: result && Number.isInteger(result.index) ? result.index : -1, reason, message: result && result.message ? String(result.message) : "" };
    fillByUnit({});
    if (BOT_REFUSAL_REASONS.has(reason)) {
      entry.status = "refused";
      return { entry, stop: null, observation: before };
    }
    entry.status = "environment-refused";
    return { entry, stop: "error", observation: before };
  }

  if (!Array.isArray(result.events)) {
    entry.status = "engine-error";
    entry.error = "runHeadlessTurn returned no event log (the turn did not run)";
    fillByUnit({});
    return { entry, stop: "error", observation: result.observation ?? before };
  }

  const counted = countExecuted(result.events);
  entry.executed = Object.values(counted.byUnit).reduce((a, b) => a + b, 0);
  entry.wasted = plannedTotal - entry.executed;
  entry.enemy.executed = counted.enemy;
  entry.eventHash = sha(JSON.stringify(result.events));
  entry.observationHash = sha(JSON.stringify(result.observation));
  fillByUnit(counted.byUnit);
  return { entry, stop: null, observation: result.observation };
}

function emptyRecord(meta) {
  return {
    scenarioId: meta.scenarioId, seed: meta.seed, preset: meta.preset, rulesVersion: null, rulesHash: null,
    strategy: meta.strategy, botSeed: meta.botSeed, fixtureOnly: meta.fixtureOnly,
    result: "error", stopReason: null, error: null, turns: 0, perTurn: [], orders: [],
    replay: { query: queryOf(meta.scenarioId, meta.seed, meta.preset), orders: [] },
  };
}

/** Boot + setup checks. -> { game, observation } or { failure: message } */
function setUp(load, record) {
  let game;
  try {
    game = load({ query: record.replay.query, scenarios: true });
    const observation = observe(game);
    if (!observation || !observation.rules || !Array.isArray(observation.units)) return { failure: "observeBattle() returned no observation" };
    record.rulesVersion = observation.rules.version ?? null;
    record.rulesHash = observation.rules.hash ?? null;
    if (observation.rules.preset !== record.preset) {
      return { failure: `the battle booted with preset ${observation.rules.preset}, not ${record.preset} (rejected link?)` };
    }
    return { game, observation };
  } catch (e) {
    return { failure: `setup failed: ${errText(e)}` };
  }
}

function finish(record, result, stopReason, error = null) {
  record.result = result;
  record.stopReason = stopReason;
  record.error = error;
  record.turns = record.perTurn.length;
  record.orders = record.perTurn.map((t) => t.orders);
  record.replay.orders = record.orders.map((o) => (o === null ? null : JSON.parse(JSON.stringify(o))));
  return record;
}

function resolveStrategy(options) {
  if (typeof options.strategy === "string" && options.strategy) return options.strategy;
  if (options.bot && typeof options.bot.id === "string" && options.bot.id) return options.bot.id;
  try {
    const { BOTS } = require("./bots.cjs");
    const key = Object.keys(BOTS).find((k) => BOTS[k] === options.bot);
    if (key) return key;
  } catch (_) { /* bots.cjs unavailable: fall through */ }
  return null;
}

function checkOptions(options) {
  const o = options || {};
  const fail = (msg) => { throw new TypeError(`runBattle: ${msg}`); };
  if (typeof o.load !== "function") fail("load must be a function (opts) -> game");
  if (!o.bot || typeof o.bot.decide !== "function") fail("bot.decide must be a function");
  if (typeof o.scenarioId !== "string" || !o.scenarioId) fail("scenarioId must be a non-empty string");
  if (!Number.isInteger(o.seed)) fail("seed must be an integer");
  if (typeof o.preset !== "string" || !o.preset) fail("preset must be a non-empty string");
  if (!o.limits || !Number.isInteger(o.limits.maxTurnsPerBattle) || o.limits.maxTurnsPerBattle < 1) fail("limits.maxTurnsPerBattle must be a positive integer");
  if (o.limits.maxTotalTurns !== undefined && (!Number.isInteger(o.limits.maxTotalTurns) || o.limits.maxTotalTurns < 1)) fail("limits.maxTotalTurns must be a positive integer");
  if (!Number.isInteger(o.botSeed) || o.botSeed < 0 || o.botSeed > 0xffffffff) fail("botSeed must be an unsigned 32-bit integer");
  if (typeof o.fixtureOnly !== "boolean") fail("fixtureOnly must be a boolean");
  if (o.turnsRemaining !== undefined && (!Number.isInteger(o.turnsRemaining) || o.turnsRemaining < 0)) fail("turnsRemaining must be a non-negative integer");
  if (o.deadlineMs !== undefined && !Number.isFinite(o.deadlineMs)) fail("deadlineMs must be a finite number");
  const strategy = resolveStrategy(o);
  if (!strategy) fail("strategy unknown: pass options.strategy or a bot with an id");
  return strategy;
}

function runBattle(options) {
  const strategy = checkOptions(options);
  const { load, bot, scenarioId, seed, preset, limits, botSeed, fixtureOnly } = options;
  const turnsRemaining = options.turnsRemaining ?? limits.maxTotalTurns;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const record = emptyRecord({ scenarioId, seed, preset, strategy, botSeed, fixtureOnly });

  const setup = setUp(load, record);
  if (setup.failure) return finish(record, "error", "setup-error", setup.failure);
  const { game } = setup;
  let observation = setup.observation;
  const rng = mulberry32(botSeed);
  const ctx = Object.freeze({ rng: () => rng() });

  for (;;) {
    const decided = outcomeOf(observation);
    if (decided) return finish(record, decided, "battle-end");
    const turn = record.perTurn.length + 1;
    if (record.perTurn.length >= limits.maxTurnsPerBattle) return finish(record, "timeout", "max-turns-per-battle");
    if (turnsRemaining !== undefined && record.perTurn.length >= turnsRemaining) return finish(record, "timeout", "max-total-turns");
    if (options.deadlineMs !== undefined && now() >= options.deadlineMs) return finish(record, "timeout", "max-runtime");

    let raw;
    try {
      raw = bot.decide(JSON.parse(JSON.stringify(observation)), ctx);
    } catch (e) {
      record.perTurn.push({
        turn, status: "bot-error", budget: observation.rules.playerActionBudget, planned: 0, executed: 0, wasted: 0, orders: null, byUnit: {},
        enemy: { budget: observation.rules.enemyActionBudget, executed: 0 }, refusal: null, error: errText(e), eventHash: null, observationHash: null,
      });
      return finish(record, "error", "bot-error", errText(e));
    }
    const step = stepTurn(game, turn, observation, normaliseOrders(raw));
    record.perTurn.push(step.entry);
    if (step.stop) return finish(record, "error", step.entry.status, step.entry.error ?? step.entry.refusal?.message ?? null);
    observation = step.observation;
  }
}

/**
 * Re-apply record.orders on a fresh context from the same load and return the reproduced record (no assertions; compare
 * with diffRecords). Metadata the engine cannot reproduce (strategy, botSeed, fixtureOnly, bot errors, wall-clock or
 * run-wide stops) is taken from the record.
 */
function replayBattle(record, load) {
  const copy = emptyRecord({ scenarioId: record.scenarioId, seed: record.seed, preset: record.preset, strategy: record.strategy, botSeed: record.botSeed, fixtureOnly: record.fixtureOnly });
  copy.replay.query = record.replay.query;
  const setup = setUp(load, copy);
  if (setup.failure) return finish(copy, "error", "setup-error", setup.failure);
  const { game } = setup;
  let observation = setup.observation;
  for (const original of record.perTurn) {
    const decided = outcomeOf(observation);
    if (decided) return finish(copy, decided, "battle-end");
    if (original.status === "bot-error") {
      copy.perTurn.push(JSON.parse(JSON.stringify(original)));
      return finish(copy, "error", "bot-error", original.error);
    }
    const step = stepTurn(game, original.turn, observation, original.orders === null ? null : JSON.parse(JSON.stringify(original.orders)));
    copy.perTurn.push(step.entry);
    if (step.stop) return finish(copy, "error", step.entry.status, step.entry.error ?? step.entry.refusal?.message ?? null);
    observation = step.observation;
  }
  const decided = outcomeOf(observation);
  if (decided) return finish(copy, decided, "battle-end");
  // Undecided after every recorded turn: only a limit stop (driver policy, not engine state) is taken from the record.
  if (record.result === "timeout") return finish(copy, "timeout", record.stopReason, record.error);
  return finish(copy, "error", "replay-diverged", `the record says ${record.result} but the replay is undecided after ${copy.perTurn.length} turn(s)`);
}

/** First differing paths between two plain-data values ([] when equal). */
function diffRecords(a, b, path = "$", out = [], limit = 10) {
  if (out.length >= limit || JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    [...new Set([...Object.keys(a), ...Object.keys(b)])].forEach((k) => diffRecords(a[k], b[k], `${path}.${k}`, out, limit));
  } else {
    out.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  }
  return out;
}

module.exports = { runBattle, replayBattle, diffRecords, stepTurn, countExecuted, outcomeOf, normaliseOrders, queryOf, MAX_ORDERS_PER_TURN, BOT_REFUSAL_REASONS };
