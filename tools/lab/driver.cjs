"use strict";
/*
 * Battle Lab driver (L2 + L3, dev-only, PoC-grade). See tools/lab/CONTRACT.md ("Driver", "L3 additions").
 *
 * runBattle(options) -> BattleRecord. Synchronous; never throws for anything that happens INSIDE a battle (load / setup
 * failure, refused order list, engine error, bot error): it is recorded in the BattleRecord. It throws a TypeError only for
 * invalid OPTIONS (a programming error, before anything runs).
 *
 * The game is touched only through load() (tests/harness/load-game.cjs shape) and window.devTest.observeBattle /
 * applyPlayerOrders / runHeadlessTurn / hashTurnEvents. The driver reads runHeadlessTurn's dev-only `includeEvents` log
 * to COUNT actions and hash the turn; the bot never sees it: decide() gets a fresh JSON copy of observeBattle() and
 * ctx = { rng, round, maxRounds }.
 *
 * Options:
 *   load(opts) -> game         a fresh game context; called as load({ query, scenarios: true }) so loadGame from
 *                              tests/harness/load-game.cjs can be passed directly (a fixture may wrap it to hand-place a
 *                              board; then pass customSetup). game.ev(src) evaluates in the game. One context per battle.
 *   bot                        { decide(observation, ctx) -> orders } (bots.cjs entry; may carry `id`).
 *   strategy                   optional strategy id; else bot.id; else the key under which bot appears in bots.cjs BOTS.
 *   scenarioId, seed, preset   the battle setup.
 *   rulesQuery                 "" (default) or one rules link parameter "rules=<k>:<v>,..."; appended to the query.
 *                              query = "?scenario=<id>&seed=<n>&preset=<preset>[&<rulesQuery>]".
 *   buildId                    64-hex gameplay build ID for the replay payload (optional; without it no payload).
 *   customSetup                optional text: the loader changes the setup beyond the query (e.g. a hand-placed board),
 *                              so the replay page could not reproduce it: no payload, payloadNote says why.
 *   limits                     { maxTurnsPerBattle (required), maxTotalTurns? }; other manifest keys are ignored here.
 *   botSeed                    unsigned 32-bit integer: the bot-private stream mulberry32(botSeed), fresh per battle.
 *   fixtureOnly                boolean, copied into the record (true for hand-authored scripted fixtures).
 *   turnsRemaining             optional run-wide budget (defaults to limits.maxTotalTurns when present).
 *   deadlineMs, now            optional wall-clock stop (now() >= deadlineMs before a turn -> timeout "max-runtime").
 *                              The only non-deterministic stop; never used by fixtures.
 *
 * Bot protocol v2 (one "turn slot" = up to MAX_ROUNDS decision rounds; every slot counts against maxTurnsPerBattle):
 *   round 0: decide(obs, { rng, round: 0, maxRounds: 2 }). If it returns EXACTLY [{ reshuffle: true }], the driver applies
 *     it with applyPlayerOrders (no turn), re-observes and calls decide(obs', { round: 1, ... }); the round-1 list runs the
 *     turn. Any other round-0 list runs the turn directly. A legacy bot that ignores ctx.round simply never reshuffles.
 *   Refusals (recorded on the slot, never thrown; status "refused"; the battle continues):
 *     - the reshuffle step refused by the game (no-reshuffle-charges, ...): no second round;
 *     - a round-1 list containing any reshuffle order: driver-local "reshuffle-in-last-round" (not sent);
 *     - driver-local malformed-orders (not an array of JSON orders) / too-many-orders (> 64);
 *     - the turn list refused by the game for a bot-attributable reason (validatePlayerOrders reasons, no-player-orders).
 *   Environment refusals (busy, tutorial, no scenario battle, battle-over, turn-executing) and engine exceptions end the
 *   battle with result "error"; so does a bot exception (status "bot-error").
 *
 * Per turn slot (perTurn[i]); planned / executed refer to the LAST step (the list that runs the turn):
 *   steps              every order list the bot returned this slot, in order (null for a non-JSON return)
 *   orders             the last step (the list that runs the turn); kept from L2
 *   budget             observation.rules.playerActionBudget at the slot start
 *   planned            action orders ({ unit, action }) in the last step
 *   unspentBudget      budget - planned when the list was accepted; budget when it was refused (nothing was queued)
 *   executed           (L3 meaning) player actions that resolved AND were not a missed Attack:
 *                      consumed by a tick - commander target-defeated skips - attacksMissed. (L2 counted misses too.)
 *   attacksHit         player "hit" events; attacksMissed = Attacks resolved - attacksHit (never below 0)
 *   missReasons        { reason: count } for the missed Attacks: the miss event's reason ("unspecified" when the event
 *                      has none, as under the current preset); an Attack with neither a hit nor a miss event: "no-swing"
 *   wasted             (L2 meaning, unchanged) planned actions that never resolved: refused, target-defeated skips,
 *                      cleared by a death, unplayed at the battle end = planned - executed - attacksMissed
 *   notExecuted        planned - executed = wasted + attacksMissed
 *   reshuffles         reshuffles the game applied in this slot (0 or 1); reshuffleChargesAfter = charges at the slot end
 *   byUnit             { P1: { planned, executed, attacksHit, attacksMissed }, ... } (player wolves, same meanings)
 *   enemy              { budget: enemyActionBudget, executed, attacksHit, attacksMissed } (same meanings, enemy units)
 *   refusal            null | { by: "driver" | "engine", step, index, reason, message }
 *   error, eventHash   eventHash = devTest.hashTurnEvents(that turn's events) (14 hex), null when no turn ran
 *   observationHash    sha256 (16 hex) of the observation after the turn, null when no turn ran
 *
 * Replay data: record.replay = { query, orders (= record.orders), steps (per slot), payload, payloadNote }.
 *   payload: the visual replay payload v1 (CONTRACT "Visual replay payload") covering the slots the page can replay: the
 *   leading run of slots whose turn ran (at most 60). payload null (with payloadNote) when: no buildId, customSetup,
 *   no slot ran, or the payload fails the page's documented limits. payloadNote also explains a truncated payload.
 *
 * replayBattle(record, load) re-applies the recorded steps on a fresh context through the same slot function and
 * returns the reproduced record (bot errors are re-raised from the record; wall-clock / run-wide stops are taken from it).
 */
const crypto = require("node:crypto");
const { mulberry32 } = require("../../tests/harness/load-game.cjs");

const MAX_ROUNDS = 2;
const MAX_ORDERS_PER_TURN = 64; // turn-level guard: a longer list is refused locally (too-many-orders), never sent
const PAYLOAD_LIMITS = { maxTurns: 60, maxStepsPerTurn: 2, maxOrdersPerStep: 64, maxTextLength: 128, maxRulesQueryLength: 512, maxEncodedLength: 262144 };
const RULES_QUERY = /^rules=[^&?#=\s]+$/;
const CUSTOM_PREFIX = "not replayable on the page: ";
const PLAYER_IDS = ["P1", "P2", "P3"];
const BOT_REFUSAL_REASONS = new Set([
  "malformed-orders", "malformed-order", "target-selection-inactive", "invalid-target", "target-defeated", "unknown-unit",
  "unit-defeated", "action-budget", "unknown-action", "max-same-action", "card-not-in-hand", "no-player-orders", "too-many-orders",
  "no-reshuffle-charges", "hand-not-observed", "reshuffle-in-last-round",
]);

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
const errText = (e) => String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 200);
const copy = (v) => (v === null || v === undefined ? null : JSON.parse(JSON.stringify(v)));
const queryOf = (scenarioId, seed, preset, rulesQuery = "") =>
  `?scenario=${encodeURIComponent(scenarioId)}&seed=${seed}&preset=${encodeURIComponent(preset)}${rulesQuery ? `&${rulesQuery}` : ""}`;

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

const isPlainObject = (o) => Boolean(o) && typeof o === "object" && !Array.isArray(o);
const isActionOrder = (o) => isPlainObject(o) && "action" in o && !("target" in o);
const hasReshuffle = (orders) => Array.isArray(orders) && orders.some((o) => isPlainObject(o) && "reshuffle" in o);
/** Exactly [{ reshuffle: true }]. */
const isReshuffleOnly = (orders) => Array.isArray(orders) && orders.length === 1 && isPlainObject(orders[0])
  && Object.keys(orders[0]).length === 1 && orders[0].reshuffle === true;

function plannedByUnit(orders) {
  const out = {};
  (Array.isArray(orders) ? orders : []).filter(isActionOrder).forEach((o) => {
    const id = typeof o.unit === "string" ? o.unit : String(o.unit);
    out[id] = (out[id] ?? 0) + 1;
  });
  return out;
}

/**
 * Per-unit action outcome from one turn's event log. -> { [unitId]: { resolved, attacks, hits, missEvents: {reason: n} } }
 * resolved = consumed by a tick - target-defeated skips; attacks = the Attacks among them.
 */
function tallyEvents(events) {
  const units = {};
  const u = (id) => (units[id] ??= { resolved: 0, attacks: 0, hits: 0, missEvents: {} });
  events.forEach((e) => {
    if (e.type === "consumed") {
      (e.actions ?? []).forEach((a) => { u(a.unit).resolved += 1; if (a.action === "Attack") u(a.unit).attacks += 1; });
    } else if (e.type === "targetSkipped") {
      u(e.unit).resolved -= 1;
      if (e.action === "Attack") u(e.unit).attacks -= 1;
    } else if (e.type === "hit") {
      u(e.attacker).hits += 1;
    } else if (e.type === "miss") {
      const reason = typeof e.reason === "string" ? e.reason : "unspecified";
      u(e.attacker).missEvents[reason] = (u(e.attacker).missEvents[reason] ?? 0) + 1;
    }
  });
  return units;
}

/** Outcome numbers of one unit (or a sum of units): executed excludes missed Attacks. */
function outcomeOfUnits(tallies) {
  let resolved = 0; let hits = 0; let missed = 0;
  const missReasons = {};
  tallies.forEach((t) => {
    const m = Math.max(0, t.attacks - t.hits);
    resolved += t.resolved;
    hits += t.hits;
    missed += m;
    let left = m;
    Object.keys(t.missEvents).sort().forEach((reason) => {
      const n = Math.min(left, t.missEvents[reason]);
      if (n > 0) { missReasons[reason] = (missReasons[reason] ?? 0) + n; left -= n; }
    });
    if (left > 0) missReasons["no-swing"] = (missReasons["no-swing"] ?? 0) + left;
  });
  return { executed: resolved - missed, attacksHit: hits, attacksMissed: missed, missReasons: sortObject(missReasons) };
}
const sortObject = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

function outcomeOf(observation) {
  const alive = (team) => observation.units.some((u) => u.team === team && !u.defeated);
  const p = alive("player");
  const e = alive("enemy");
  if (!p && !e) return "draw";
  if (!e) return "win";
  if (!p) return "loss";
  return null;
}

function newEntry(turn, before) {
  return {
    turn, status: "ran", steps: [], orders: null,
    budget: before.rules.playerActionBudget, planned: 0, unspentBudget: before.rules.playerActionBudget,
    executed: 0, notExecuted: 0, wasted: 0, attacksHit: 0, attacksMissed: 0, missReasons: {},
    reshuffles: 0, reshuffleChargesAfter: before.hand ? before.hand.reshuffleChargesRemaining ?? null : null,
    byUnit: {}, enemy: { budget: before.rules.enemyActionBudget, executed: 0, attacksHit: 0, attacksMissed: 0 },
    refusal: null, error: null, eventHash: null, observationHash: null,
  };
}

/** Fill planned-side numbers for a slot whose turn did not run (refused / error): every planned action is wasted. */
function notRun(entry, unitIds) {
  const planned = plannedByUnit(entry.orders);
  entry.planned = Object.values(planned).reduce((a, b) => a + b, 0);
  entry.unspentBudget = entry.budget;
  entry.wasted = entry.planned;
  entry.notExecuted = entry.planned;
  [...new Set([...unitIds, ...Object.keys(planned)])].sort().forEach((id) => {
    entry.byUnit[id] = { planned: planned[id] ?? 0, executed: 0, attacksHit: 0, attacksMissed: 0 };
  });
}

/**
 * One turn slot. nextStep(round, observationCopy) -> { orders } (normalised; null = not JSON) | { botError }.
 * Shared by runBattle (asks the bot) and replayBattle (returns the recorded steps).
 * -> { entry, stop: null | "error", observation }
 */
function playSlot(game, turn, before, nextStep) {
  const entry = newEntry(turn, before);
  const unitIds = before.units.filter((u) => u.team === "player").map((u) => u.id).sort();
  const refuse = (by, step, refusal) => { entry.status = "refused"; entry.refusal = { by, step, ...refusal }; notRun(entry, unitIds); };
  let observation = before;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const asked = nextStep(round, copy(observation));
    if (asked.botError !== undefined) {
      entry.status = "bot-error";
      entry.error = asked.botError;
      notRun(entry, unitIds);
      return { entry, stop: "error", observation };
    }
    const orders = asked.orders;
    entry.steps.push(orders);
    const last = round === MAX_ROUNDS - 1 || !isReshuffleOnly(orders);
    entry.orders = last ? orders : null;

    if (!last) {
      // The reshuffle round: applied without running the turn, then the bot observes the new hand.
      let r;
      try {
        r = evalJson(game, `window.devTest.applyPlayerOrders(${JSON.stringify(orders)})`);
      } catch (e) {
        entry.status = "engine-error"; entry.error = errText(e); notRun(entry, unitIds);
        return { entry, stop: "error", observation };
      }
      if (!r || r.ok !== true) {
        const refusal = { index: r && Number.isInteger(r.index) ? r.index : -1, reason: r && typeof r.reason === "string" ? r.reason : "unknown", message: r && r.message ? String(r.message) : "" };
        refuse("engine", round, refusal);
        if (BOT_REFUSAL_REASONS.has(refusal.reason)) return { entry, stop: null, observation };
        entry.status = "environment-refused";
        return { entry, stop: "error", observation };
      }
      entry.reshuffles += 1;
      try {
        observation = observe(game);
      } catch (e) {
        entry.status = "engine-error"; entry.error = errText(e); notRun(entry, unitIds);
        return { entry, stop: "error", observation };
      }
      entry.reshuffleChargesAfter = observation.hand.reshuffleChargesRemaining ?? null;
      continue;
    }

    // The last step runs the turn.
    if (orders === null || !Array.isArray(orders)) {
      refuse("driver", round, { index: -1, reason: "malformed-orders", message: "the bot did not return an array of JSON orders" });
      return { entry, stop: null, observation };
    }
    if (orders.length > MAX_ORDERS_PER_TURN) {
      refuse("driver", round, { index: -1, reason: "too-many-orders", message: `more than ${MAX_ORDERS_PER_TURN} orders in one turn` });
      return { entry, stop: null, observation };
    }
    if (round > 0 && hasReshuffle(orders)) {
      refuse("driver", round, { index: orders.findIndex((o) => isPlainObject(o) && "reshuffle" in o), reason: "reshuffle-in-last-round", message: `a reshuffle is allowed only in round 0 of ${MAX_ROUNDS}` });
      return { entry, stop: null, observation };
    }

    let result;
    try {
      result = evalJson(game, `(function () {
        const r = window.devTest.runHeadlessTurn(${JSON.stringify(orders)}, { includeEvents: true });
        if (r && r.ok === true && Array.isArray(r.events)) r.eventHash = window.devTest.hashTurnEvents(r.events);
        return r;
      })()`);
    } catch (e) {
      entry.status = "engine-error"; entry.error = errText(e); notRun(entry, unitIds);
      return { entry, stop: "error", observation };
    }
    if (!result || result.ok !== true) {
      const refusal = { index: result && Number.isInteger(result.index) ? result.index : -1, reason: result && typeof result.reason === "string" ? result.reason : "unknown", message: result && result.message ? String(result.message) : "" };
      refuse("engine", round, refusal);
      if (BOT_REFUSAL_REASONS.has(refusal.reason)) return { entry, stop: null, observation };
      entry.status = "environment-refused";
      return { entry, stop: "error", observation };
    }
    if (!Array.isArray(result.events)) {
      entry.status = "engine-error"; entry.error = "runHeadlessTurn returned no event log (the turn did not run)"; notRun(entry, unitIds);
      return { entry, stop: "error", observation: result.observation ?? observation };
    }

    const planned = plannedByUnit(orders);
    const tallies = tallyEvents(result.events);
    const empty = { resolved: 0, attacks: 0, hits: 0, missEvents: {} };
    const playerIds = [...new Set([...unitIds, ...Object.keys(planned), ...Object.keys(tallies).filter((id) => PLAYER_IDS.includes(id))])].sort();
    playerIds.forEach((id) => {
      const o = outcomeOfUnits([tallies[id] ?? empty]);
      entry.byUnit[id] = { planned: planned[id] ?? 0, executed: o.executed, attacksHit: o.attacksHit, attacksMissed: o.attacksMissed };
    });
    const pack = outcomeOfUnits(Object.keys(tallies).filter((id) => PLAYER_IDS.includes(id)).sort().map((id) => tallies[id]));
    const foes = outcomeOfUnits(Object.keys(tallies).filter((id) => !PLAYER_IDS.includes(id)).sort().map((id) => tallies[id]));
    entry.planned = Object.values(planned).reduce((a, b) => a + b, 0);
    entry.unspentBudget = entry.budget - entry.planned;
    entry.executed = pack.executed;
    entry.attacksHit = pack.attacksHit;
    entry.attacksMissed = pack.attacksMissed;
    entry.missReasons = pack.missReasons;
    entry.notExecuted = entry.planned - entry.executed;
    entry.wasted = entry.notExecuted - entry.attacksMissed;
    entry.enemy = { budget: before.rules.enemyActionBudget, executed: foes.executed, attacksHit: foes.attacksHit, attacksMissed: foes.attacksMissed };
    entry.reshuffleChargesAfter = result.observation && result.observation.hand ? result.observation.hand.reshuffleChargesRemaining ?? null : entry.reshuffleChargesAfter;
    entry.eventHash = typeof result.eventHash === "string" ? result.eventHash : null;
    entry.observationHash = sha(JSON.stringify(result.observation));
    return { entry, stop: null, observation: result.observation };
  }
  throw new Error("playSlot: unreachable (the last round always returns)");
}

/** Replay payload problems by the page's documented rules (script.js validateReplayPayload / getReplayLimits). */
function payloadProblem(p) {
  const L = PAYLOAD_LIMITS;
  const text = (v) => typeof v === "string" && v.length > 0 && v.length <= L.maxTextLength;
  if (!/^[0-9a-f]{64}$/.test(p.buildId)) return "buildId is not 64 hex";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(p.scenarioId)) return "scenarioId is not a scenario id";
  if (!Number.isInteger(p.seed) || p.seed < 0 || p.seed > 4294967295) return "seed is out of range";
  if (!/^[a-z]{1,32}$/.test(p.preset)) return "preset is not a preset name";
  if (p.rulesQuery.length > L.maxRulesQueryLength || (p.rulesQuery !== "" && !RULES_QUERY.test(p.rulesQuery))) return "rulesQuery is not one rules parameter";
  if (!text(p.rulesVersion)) return "rulesVersion is not a short text";
  if (!/^[0-9a-f]{14}$/.test(String(p.rulesHash))) return "rulesHash is not 14 hex";
  if (!text(p.strategy)) return `strategy is not a text of 1 to ${L.maxTextLength} characters`;
  if (!Number.isSafeInteger(p.botSeed)) return "botSeed is not an integer";
  if (p.turns.length < 1 || p.turns.length > L.maxTurns) return `turns must number 1 to ${L.maxTurns}`;
  for (const t of p.turns) {
    if (!/^[0-9a-f]{14}$/.test(String(t.eventHash))) return `turn ${t.turn}: eventHash is not 14 hex`;
    if (t.steps.length < 1 || t.steps.length > L.maxStepsPerTurn) return `turn ${t.turn}: 1 to ${L.maxStepsPerTurn} steps`;
    for (let s = 0; s < t.steps.length; s += 1) {
      const step = t.steps[s];
      if (!Array.isArray(step) || step.length > L.maxOrdersPerStep) return `turn ${t.turn} step ${s}: at most ${L.maxOrdersPerStep} orders`;
      if (s < t.steps.length - 1 && !isReshuffleOnly(step)) return `turn ${t.turn} step ${s}: only the last step may hold orders other than one reshuffle`;
      for (const o of step) {
        const keys = isPlainObject(o) ? Object.keys(o).sort().join(",") : "";
        const ok = (keys === "reshuffle" && o.reshuffle === true)
          || (keys === "action,unit" && PLAYER_IDS.includes(o.unit) && ["Move", "Attack", "Defend"].includes(o.action))
          || (keys === "target,unit" && PLAYER_IDS.includes(o.unit) && (o.target === null || ["E1", "E2", "E3"].includes(o.target)));
        if (!ok) return `turn ${t.turn} step ${s}: order ${JSON.stringify(o)} is not a replay order`;
      }
    }
  }
  const encoded = Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
  if (encoded.length > L.maxEncodedLength) return `encoded payload too long (${encoded.length} > ${L.maxEncodedLength})`;
  return null;
}

/** Build record.replay.payload / payloadNote from the finished record. */
function attachPayload(record, meta) {
  record.replay.payload = null;
  record.replay.payloadNote = null;
  if (meta.customSetup) { record.replay.payloadNote = `${CUSTOM_PREFIX}${meta.customSetup}`; return; }
  if (!meta.buildId) { record.replay.payloadNote = "no buildId was passed to runBattle"; return; }
  const firstOther = record.perTurn.findIndex((t) => t.status !== "ran");
  const ranPrefix = firstOther < 0 ? record.perTurn.length : firstOther;
  const count = Math.min(ranPrefix, PAYLOAD_LIMITS.maxTurns);
  if (count === 0) {
    record.replay.payloadNote = record.perTurn.length === 0 ? "no turn was played" : `turn 1 did not run (${record.perTurn[0].status}); the page cannot replay it`;
    return;
  }
  const payload = {
    v: 1, buildId: meta.buildId, scenarioId: record.scenarioId, seed: record.seed, preset: record.preset, rulesQuery: meta.rulesQuery,
    rulesVersion: record.rulesVersion, rulesHash: record.rulesHash, strategy: record.strategy, botSeed: record.botSeed, result: record.result,
    turns: record.perTurn.slice(0, count).map((t) => ({ turn: t.turn, steps: copy(t.steps), eventHash: t.eventHash })),
  };
  const problem = payloadProblem(payload);
  if (problem) { record.replay.payloadNote = `payload omitted: ${problem}`; return; }
  record.replay.payload = payload;
  if (count < record.perTurn.length) {
    record.replay.payloadNote = count < ranPrefix
      ? `payload covers turns 1-${count} of ${record.perTurn.length} (the page replays at most ${PAYLOAD_LIMITS.maxTurns})`
      : `payload covers turns 1-${count} of ${record.perTurn.length}: turn ${count + 1} did not run (${record.perTurn[count].status}); the page cannot replay it`;
  }
}

function emptyRecord(meta) {
  return {
    scenarioId: meta.scenarioId, seed: meta.seed, preset: meta.preset, rulesVersion: null, rulesHash: null,
    strategy: meta.strategy, botSeed: meta.botSeed, fixtureOnly: meta.fixtureOnly,
    result: "error", stopReason: null, error: null, turns: 0, perTurn: [], orders: [],
    replay: { query: queryOf(meta.scenarioId, meta.seed, meta.preset, meta.rulesQuery), orders: [], steps: [], payload: null, payloadNote: null },
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

function finish(record, meta, result, stopReason, error = null) {
  record.result = result;
  record.stopReason = stopReason;
  record.error = error;
  record.turns = record.perTurn.length;
  record.orders = record.perTurn.map((t) => copy(t.orders));
  record.replay.orders = record.perTurn.map((t) => copy(t.orders));
  record.replay.steps = record.perTurn.map((t) => copy(t.steps));
  attachPayload(record, meta);
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
  if (o.rulesQuery !== undefined && (typeof o.rulesQuery !== "string" || (o.rulesQuery !== "" && !RULES_QUERY.test(o.rulesQuery)))) fail("rulesQuery must be \"\" or \"rules=<k>:<v>,...\"");
  if (o.buildId !== undefined && (typeof o.buildId !== "string" || !/^[0-9a-f]{64}$/.test(o.buildId))) fail("buildId must be 64 lowercase hex characters");
  if (o.customSetup !== undefined && (typeof o.customSetup !== "string" || !o.customSetup)) fail("customSetup must be a non-empty string");
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

const slotEnd = (record, meta, step) => finish(record, meta, "error", step.entry.status, step.entry.error ?? step.entry.refusal?.message ?? null);

function runBattle(options) {
  const strategy = checkOptions(options);
  const { load, bot, scenarioId, seed, preset, limits, botSeed, fixtureOnly } = options;
  const meta = { scenarioId, seed, preset, strategy, botSeed, fixtureOnly, rulesQuery: options.rulesQuery ?? "", buildId: options.buildId ?? null, customSetup: options.customSetup ?? null };
  const turnsRemaining = options.turnsRemaining ?? limits.maxTotalTurns;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const record = emptyRecord(meta);

  const setup = setUp(load, record);
  if (setup.failure) return finish(record, meta, "error", "setup-error", setup.failure);
  const { game } = setup;
  let observation = setup.observation;
  const rng = mulberry32(botSeed);
  const rngFn = () => rng();
  const ask = (round, obs) => {
    let raw;
    try {
      raw = bot.decide(obs, Object.freeze({ rng: rngFn, round, maxRounds: MAX_ROUNDS }));
    } catch (e) {
      return { botError: errText(e) };
    }
    return { orders: normaliseOrders(raw) };
  };

  for (;;) {
    const decided = outcomeOf(observation);
    if (decided) return finish(record, meta, decided, "battle-end");
    if (record.perTurn.length >= limits.maxTurnsPerBattle) return finish(record, meta, "timeout", "max-turns-per-battle");
    if (turnsRemaining !== undefined && record.perTurn.length >= turnsRemaining) return finish(record, meta, "timeout", "max-total-turns");
    if (options.deadlineMs !== undefined && now() >= options.deadlineMs) return finish(record, meta, "timeout", "max-runtime");

    const step = playSlot(game, record.perTurn.length + 1, observation, ask);
    record.perTurn.push(step.entry);
    if (step.stop) return slotEnd(record, meta, step);
    observation = step.observation;
  }
}

/**
 * Re-apply the recorded steps on a fresh context from the same load and return the reproduced record (no assertions;
 * compare with diffRecords). Strategy, botSeed, fixtureOnly, buildId (from the payload, else options.buildId), customSetup
 * (from the payload note) and
 * wall-clock / run-wide stops cannot be derived from orders: they are taken from the record. Bot errors are re-raised at
 * the recorded round.
 */
function replayBattle(record, load, { buildId } = {}) {
  const note = record.replay.payloadNote ?? "";
  const customSetup = note.startsWith(CUSTOM_PREFIX) ? note.slice(CUSTOM_PREFIX.length) : null;
  const rulesQuery = record.replay.payload ? record.replay.payload.rulesQuery : rulesQueryOf(record.replay.query);
  const meta = {
    scenarioId: record.scenarioId, seed: record.seed, preset: record.preset, strategy: record.strategy, botSeed: record.botSeed, fixtureOnly: record.fixtureOnly,
    rulesQuery, buildId: buildId ?? (record.replay.payload ? record.replay.payload.buildId : null), customSetup,
  };
  const out = emptyRecord(meta);
  out.replay.query = record.replay.query;
  const setup = setUp(load, out);
  if (setup.failure) return finish(out, meta, "error", "setup-error", setup.failure);
  const { game } = setup;
  let observation = setup.observation;
  for (const original of record.perTurn) {
    const decided = outcomeOf(observation);
    if (decided) return finish(out, meta, decided, "battle-end");
    const recorded = (round) => {
      if (round < original.steps.length) return { orders: copy(original.steps[round]) };
      return { botError: original.status === "bot-error" ? original.error : "replay: no recorded step for this round" };
    };
    const step = playSlot(game, original.turn, observation, recorded);
    out.perTurn.push(step.entry);
    if (step.stop) return slotEnd(out, meta, step);
    observation = step.observation;
  }
  const decided = outcomeOf(observation);
  if (decided) return finish(out, meta, decided, "battle-end");
  // Undecided after every recorded slot: only a limit stop (driver policy, not engine state) is taken from the record.
  if (record.result === "timeout") return finish(out, meta, "timeout", record.stopReason, record.error);
  return finish(out, meta, "error", "replay-diverged", `the record says ${record.result} but the replay is undecided after ${out.perTurn.length} turn(s)`);
}
const rulesQueryOf = (query) => { const m = /[?&](rules=[^&]*)/.exec(query); return m ? m[1] : ""; };

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

/** base64url(JSON) of a payload: the #r= value of http://localhost:4173/?replay=1#r=<...>. */
const encodePayload = (payload) => Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

module.exports = {
  runBattle, replayBattle, diffRecords, playSlot, tallyEvents, outcomeOf, normaliseOrders, queryOf, payloadProblem, encodePayload,
  isReshuffleOnly, MAX_ROUNDS, MAX_ORDERS_PER_TURN, PAYLOAD_LIMITS, BOT_REFUSAL_REASONS,
};
