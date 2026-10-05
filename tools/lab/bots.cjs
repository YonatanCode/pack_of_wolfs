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
  const hand = [...obs.hand.cards];
  let queued = queuedTotal(obs);
  const sameQueued = (a) => obs.units.filter((u) => u.team === "player").reduce((n, u) => n + (u.queue ?? []).filter((x) => x === a).length, 0);
  const added = {};
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index];
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
// aggressive-pursuit
// ---------------------------------------------------------------------------------------------------------------------
function decideAggressivePursuit(obs) {
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
  const orders = [];
  const plan = wolves.map((wolf) => {
    let target = null;
    for (const e of enemies) if (!target || manhattan(wolf, e) < manhattan(wolf, target)) target = e; // ties: lowest id (sorted)
    return { wolf, target, slot: (wolf.queue ?? []).length };
  });
  const targetOrders = targetsActive(obs)
    ? plan.filter((p) => p.target && p.wolf.target !== p.target.id).map((p) => ({ unit: p.wolf.id, target: p.target.id }))
    : [];

  const actions = [];
  let room = obs.rules.playerActionBudget - queuedTotal(obs);
  while (room > 0 && hand.length > 0 && plan.length > 0) {
    let progressed = false;
    for (const p of plan) {
      if (room <= 0 || hand.length === 0) break;
      const adjacent = p.target ? isAdjacent(p.wolf, p.target) : false;
      // first action of a wolf that is not adjacent: close in; otherwise (adjacent, or already moving) strike
      const prefs = adjacent || p.slot > 0 ? ["Attack", "Move", "Defend"] : ["Move", "Attack", "Defend"];
      const card = takeCard(prefs);
      if (card === null) break;
      actions.push({ unit: p.wolf.id, action: card });
      p.slot += 1;
      room -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }
  if (actions.length === 0) return []; // target orders alone would change nothing worth sending
  return [...targetOrders, ...actions];
}

const BOTS = {
  "random-legal": {
    description: "Queues a random number of random hand cards on random living wolves; under commander also random targets among visible enemies. Uses only ctx.rng.",
    decide: decideRandomLegal,
  },
  "aggressive-pursuit": {
    description: "Targets the nearest visible enemy per wolf (commander) and spends the whole budget on Move toward it, then Attack once adjacent.",
    decide: decideAggressivePursuit,
  },
};

module.exports = { BOTS, legalOrderCheck };
