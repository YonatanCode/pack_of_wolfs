"use strict";
/*
 * Battle Lab bots (L2). Dev-only. Pure and deterministic: a bot reads ONLY its observation argument (the return of
 * observeBattle(), schema "player-observation/1") and ctx.rng(), and returns an order array for
 * applyPlayerOrders / runHeadlessTurn. No game, window or global access, no Math.random, no clock, no mutation of the
 * observation. See BOTS.md and CONTRACT.md.
 *
 * legalOrderCheck(observation, orders) mirrors validatePlayerOrders over the observation alone so tests can assert
 * legality without loading the game.
 */

const WOLF_IDS = ["P1", "P2", "P3"];
const ACTION_LIST = ["Move", "Attack", "Defend"];

const unitById = (obs, id) => obs.units.find((u) => u.id === id) ?? null;
const aliveWolves = (obs) =>
  obs.units.filter((u) => u.team === "player" && WOLF_IDS.includes(u.id) && !u.defeated).sort((a, b) => (a.id < b.id ? -1 : 1));
// Visible = alive and not concealed (concealment hides intent, not position, but bots only act on what is shown plainly).
const visibleEnemies = (obs) =>
  obs.units.filter((u) => u.team === "enemy" && !u.defeated && !u.concealed).sort((a, b) => (a.id < b.id ? -1 : 1));
const targetsActive = (obs) => obs.rules.preset === "commander" && obs.config.enemyMode === "wolves";
const queuedTotal = (obs) => obs.units.filter((u) => u.team === "player").reduce((n, u) => n + (u.queue ? u.queue.length : 0), 0);
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const isAdjacent = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1; // 8 neighbours, as the engine
const pick = (rng, n) => Math.min(n - 1, Math.floor(rng() * n));

function legalOrderCheck(observation, orders) {
  const obs = observation;
  const reject = (index, reason, message) => ({ ok: false, index, reason, message });
  if (!Array.isArray(orders)) return reject(-1, "malformed-orders", "orders must be an array");
  let hand = [...obs.hand.cards];
  let queued = queuedTotal(obs);
  let charges = obs.hand.reshuffleChargesRemaining ?? 0;
  let queuesCleared = false; // a reshuffle discards every queued card
  let handUnobserved = false; // a reshuffle earlier in the list draws a hand the caller has not seen
  const sameQueued = (a) => (queuesCleared ? 0 : obs.units.filter((u) => u.team === "player").reduce((n, u) => n + (u.queue ?? []).filter((x) => x === a).length, 0));
  const added = {};
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index];
    // reshuffle order (L3a): pack-wide, exactly { reshuffle: true }
    if (order && typeof order === "object" && "reshuffle" in order) {
      if (order.reshuffle !== true || "unit" in order || "action" in order || "target" in order) {
        return reject(index, "malformed-order", "a reshuffle order is exactly { reshuffle: true }");
      }
      if (charges <= 0) return reject(index, "no-reshuffle-charges", "no reshuffle charges left");
      charges -= 1;
      hand = [];
      queued = 0;
      queuesCleared = true;
      handUnobserved = true;
      for (const k of Object.keys(added)) delete added[k];
      continue;
    }
    if (!order || typeof order !== "object" || ("action" in order) === ("target" in order)) {
      return reject(index, "malformed-order", "an order is { unit, action } or { unit, target }");
    }
    if ("target" in order) {
      const t = order.target === null ? null : unitById(obs, order.target);
      if (!targetsActive(obs)) return reject(index, "target-selection-inactive", "targets exist only under the commander preset (wolves mode)");
      if (order.target !== null && (!t || t.team !== "enemy")) return reject(index, "invalid-target", `${order.target} is not an enemy in this battle`);
      if (t && t.defeated) return reject(index, "target-defeated", `${order.target} is defeated`);
    }
    const unit = WOLF_IDS.includes(order.unit) ? unitById(obs, order.unit) : null;
    if (!unit || unit.team !== "player") return reject(index, "unknown-unit", `${order.unit} is not a player wolf`);
    if (unit.defeated) return reject(index, "unit-defeated", `${order.unit} is absent or defeated`);
    if ("action" in order) {
      if (queued >= obs.rules.playerActionBudget) return reject(index, "action-budget", `the pack already queued ${queued} of ${obs.rules.playerActionBudget} actions`);
      if (!ACTION_LIST.includes(order.action)) return reject(index, "unknown-action", `${order.action} is not an action`);
      if (handUnobserved) return reject(index, "hand-not-observed", "a reshuffle earlier in this list draws a hand that has not been observed: queue cards in a later call");
      const ci = hand.indexOf(order.action);
      if (ci === -1) {
        return sameQueued(order.action) + (added[order.action] ?? 0) >= obs.rules.maxSameAction
          ? reject(index, "max-same-action", `the pack already queued ${obs.rules.maxSameAction} ${order.action} (max per action)`)
          : reject(index, "card-not-in-hand", `no ${order.action} card in the hand`);
      }
      hand.splice(ci, 1);
      added[order.action] = (added[order.action] ?? 0) + 1;
      queued += 1;
    }
  }
  return { ok: true, queuedTotal: queued };
}

// ---------------------------------------------------------------------------------------------------------------------
// random-legal
// ---------------------------------------------------------------------------------------------------------------------
function decideRandomLegal(obs, ctx) {
  const wolves = aliveWolves(obs);
  const hand = [...obs.hand.cards];
  const room = obs.rules.playerActionBudget - queuedTotal(obs);
  const count = Math.min(room, hand.length);
  if (wolves.length === 0 || count <= 0) return [];
  const orders = [];
  if (targetsActive(obs)) {
    const enemies = visibleEnemies(obs);
    for (const wolf of wolves) {
      if (enemies.length === 0) break;
      // one draw per wolf: 0 = no target order, else pick an enemy
      const roll = pick(ctx.rng, enemies.length + 1);
      if (roll > 0) orders.push({ unit: wolf.id, target: enemies[roll - 1].id });
    }
  }
  const n = 1 + pick(ctx.rng, count); // 1..count actions
  for (let i = 0; i < n; i += 1) {
    const wolf = wolves[pick(ctx.rng, wolves.length)];
    const card = hand.splice(pick(ctx.rng, hand.length), 1)[0];
    orders.push({ unit: wolf.id, action: card });
  }
  return orders;
}

// ---------------------------------------------------------------------------------------------------------------------
// aggressive-pursuit (v2: reachability-aware, may reshuffle a poor hand in its own round)
// ---------------------------------------------------------------------------------------------------------------------
const MOVE_TILES = 3; // a Move covers 1..3 tiles in a straight line (8 directions), as the engine's moveActionTileCount
const NEEDED_CAP = 9; // "unreachable" sentinel (also used for no route)
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

// Fewest Move actions for `wolf` to stand adjacent (8 neighbours) to `target`, over the observation's terrain and the
// units' CURRENT positions (blockers). 0 = already adjacent. NEEDED_CAP = none within the cap. Static: enemy motion is
// not predicted (see BOTS.md).
function movesNeeded(obs, wolf, target) {
  if (isAdjacent(wolf, target)) return 0;
  const size = obs.config.gridSize;
  const blocked = new Set([...obs.terrain.pond, ...obs.terrain.hill, ...obs.terrain.tree]);
  for (const u of obs.units) if (!u.defeated && u.id !== wolf.id) blocked.add(`${u.row},${u.col}`);
  const seen = new Set([`${wolf.row},${wolf.col}`]);
  let frontier = [{ row: wolf.row, col: wolf.col }];
  for (let moves = 1; moves < NEEDED_CAP && frontier.length > 0; moves += 1) {
    const next = [];
    for (const from of frontier) {
      for (const [dr, dc] of DIRS) {
        for (let step = 1; step <= MOVE_TILES; step += 1) {
          const row = from.row + dr * step;
          const col = from.col + dc * step;
          if (row < 0 || col < 0 || row >= size || col >= size || blocked.has(`${row},${col}`)) break;
          const key = `${row},${col}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (isAdjacent({ row, col }, target)) return moves;
          next.push({ row, col });
        }
      }
    }
    frontier = next;
  }
  return NEEDED_CAP;
}

// Attack plausibility for the wolf's action in queue slot `slot` (it resolves in tick `slot`), given `movesBefore` Moves in
// its earlier slots. Slot 0: only if the target is adjacent now. Later slots the target may have stepped away (it moves
// simultaneously), so the wolf also needs one spare Move beyond the route to follow: movesBefore >= needed + 1.
const attackPlausible = (slot, movesBefore, needed) => needed < NEEDED_CAP && (slot === 0 ? needed === 0 : movesBefore >= needed + 1);

function planAggressive(obs) {
  const wolves = aliveWolves(obs);
  const enemies = visibleEnemies(obs);
  const hand = [...obs.hand.cards];
  const takeCard = (prefs) => {
    for (const a of prefs) {
      const i = hand.indexOf(a);
      if (i !== -1) { hand.splice(i, 1); return a; }
    }
    return null;
  };
  const plan = wolves.map((wolf) => {
    let target = null;
    for (const e of enemies) if (!target || manhattan(wolf, e) < manhattan(wolf, target)) target = e; // ties: lowest id (sorted)
    const queue = wolf.queue ?? [];
    return {
      wolf, target, slot: queue.length, moves: queue.filter((a) => a === "Move").length, done: false,
      needed: target ? movesNeeded(obs, wolf, target) : NEEDED_CAP,
    };
  });
  const targetOrders = targetsActive(obs)
    ? plan.filter((p) => p.target && p.wolf.target !== p.target.id).map((p) => ({ unit: p.wolf.id, target: p.target.id }))
    : [];
  let nearest = NEEDED_CAP;
  for (const p of plan) nearest = Math.min(nearest, p.needed);

  const actions = [];
  let room = obs.rules.playerActionBudget - queuedTotal(obs);
  while (room > 0 && hand.length > 0) {
    let progressed = false;
    for (const p of plan) {
      if (room <= 0 || hand.length === 0) break;
      if (p.done) continue;
      const strike = p.target !== null && attackPlausible(p.slot, p.moves, p.needed);
      // strike when it can land; else close in (Move, which also builds the spare Move later Attacks need); Defend fills.
      const card = takeCard(strike ? ["Attack", "Defend", "Move"] : ["Move", "Defend"]);
      if (card === null) { p.done = true; continue; }
      actions.push({ unit: p.wolf.id, action: card });
      p.slot += 1;
      if (card === "Move") p.moves += 1;
      room -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }
  return { targetOrders, actions, nearest };
}

// Round-0 reshuffle rule (player-visible information only). Reshuffle iff charges > 0, nothing is queued yet (a reshuffle
// discards queued cards, so carry-over is never thrown away), the hand is not empty, there is budget, and the plan this
// hand would give is poor: with USEFUL = its Moves and Attacks (Defend is filler),
//   - an enemy is within reach (needs <= 1 Move for some wolf) but the plan has no Attack; or
//   - no enemy is within reach (or none is visible) and the plan has fewer than 2 Moves; or
//   - the plan has fewer than min(2, budget) useful actions.
function shouldReshuffle(obs, planned) {
  if ((obs.hand.reshuffleChargesRemaining ?? 0) <= 0) return false;
  if (queuedTotal(obs) > 0 || obs.hand.cards.length === 0) return false;
  if (obs.rules.playerActionBudget <= 0 || aliveWolves(obs).length === 0) return false;
  const attacks = planned.actions.filter((x) => x.action === "Attack").length;
  const moves = planned.actions.filter((x) => x.action === "Move").length;
  if (planned.nearest <= 1) { if (attacks === 0) return true; }
  else if (moves < 2) return true;
  return attacks + moves < Math.min(2, obs.rules.playerActionBudget);
}

function decideAggressivePursuit(obs, ctx) {
  const planned = planAggressive(obs);
  // Only in an explicit round 0 of a two-round protocol (ctx.round === 0, maxRounds >= 2); round 1 and legacy callers never reshuffle.
  if (ctx && ctx.round === 0 && ctx.maxRounds >= 2 && shouldReshuffle(obs, planned)) return [{ reshuffle: true }];
  if (planned.actions.length === 0) return []; // target orders alone would change nothing worth sending
  return [...planned.targetOrders, ...planned.actions];
}

const BOTS = {
  "random-legal": {
    description: "Queues a random number of random hand cards on random living wolves; under commander also random targets among visible enemies. Uses only ctx.rng.",
    decide: decideRandomLegal,
  },
  "aggressive-pursuit": {
    description: "Targets the nearest visible enemy per wolf (commander); queues Move to close in and Attack only where it can plausibly land (reachability from visible positions); in its own round 0 reshuffles a poor hand when charges remain.",
    decide: decideAggressivePursuit,
  },
};

module.exports = { BOTS, legalOrderCheck };
