"use strict";
/*
 * Battle Lab search (dev-only, PoC-grade): the `search-benchmark` strategy's one-turn-lookahead search. See BOTS.md
 * ("search-benchmark") and CONTRACT.md ("Full-information strategies").
 *
 * FULL-INFORMATION BENCHMARK. Unlike the observation-only bots, this search reads the live battle's full state (hidden
 * enemy plan, concealed enemies) and simulates candidate turns with the game's own rules. Its win rate does NOT estimate
 * how hard the game is for a human; it is a strength benchmark for legal play.
 *
 * Two parts:
 *   createGameSearchHandle(game) -> { state(), validate(orders), evaluate(orders) }: the ONLY game access, all through
 *     game.ev on existing script.js seams. Never mutates the live battle:
 *       state()     a plain view built in the game from the live units / enemy plan / hand (no RNG, no seed, no stream).
 *       validate()  validatePlayerOrders(orders) (pure, the real validator).
 *       evaluate()  validatePlayerOrders first; then, on a snapshotBattleState() copy run through withBattleState: the
 *                   door's own per-order functions (setUnitTarget / consumeAvailableAction / queueUnitAction inside
 *                   runInTurnCore, as applyPlayerOrders does) and the real turn core (runTurnCore), drained only up
 *                   to and including the turn-end "recovery" step. It STOPS THERE: the turn-end hand draw and the
 *                   next turn's enemy plan never run on the copy, and the copy's hand stream is replaced by a fixed
 *                   neutral seed (NEUTRAL_HAND_STATE), so an evaluation can neither compute nor reveal a future draw.
 *                   Under the commanderdraw preset the copy's enemy draw stream is replaced the same way
 *                   (NEUTRAL_ENEMY_DRAW_STATE); the next plan's draw runs at the turn end, after the stop, so it never
 *                   happens on the copy. The CURRENT turn's drawn list (enemyPack.drawnPool) stays: it is the frozen plan.
 *                   Returns only units (id, team, row, col, health, defeated) after the turn.
 *   searchDecide(observation, { handle, limits, now, round, maxRounds }) -> { orders, stats, ms }: candidate generation,
 *     static ranking, real evaluation under the per-decision limits, scoring, deterministic tie-break and fallback.
 *
 * Information rules: the search MAY read the current hidden enemy plan (it is in the live state the copy runs). It never
 * reads the hand stream, never evaluates a reshuffle, never sees the post-turn hand or the next enemy plan. A reshuffle is
 * decided from the CURRENT hand only (the best current-hand plan is "poor", see isPoor) and returned alone in round 0.
 *
 * Limits (per decision; the manifest's `searchLimits`, validated in manifest.cjs): maxCandidates (ranked candidates kept),
 * maxEvaluations (real turn simulations), maxMsPerDecision (wall-clock safety net, read through the injected now()).
 * MAX_GENERATED is a fixed internal cap on the candidate pool before ranking.
 */
const { movesNeeded, NEEDED_CAP } = require("./bots.cjs");

const ACTIONS = ["Attack", "Move", "Defend"]; // enumeration order (deterministic)
const WOLF_IDS = ["P1", "P2", "P3"];
const MAX_GENERATED = 60000; // internal hard cap on the candidate pool before ranking (limitHits.generation)
const FALLBACK_VALIDATIONS = 10; // at most this many validator calls when nothing was evaluated
const NEUTRAL_HAND_STATE = 0x5eed1e55 >>> 0; // the copy's hand stream: never the live stream position
const NEUTRAL_ENEMY_DRAW_STATE = 0x0e5eed1e >>> 0; // commanderdraw: the copy's enemy draw stream, never the live position
const LIMIT_KEYS = ["maxCandidates", "maxEvaluations", "maxMsPerDecision"];

// ---------------------------------------------------------------------------------------------------------------------
// Game access (game.ev only)
// ---------------------------------------------------------------------------------------------------------------------
const evalJson = (game, expr) => {
  const text = game.ev(`JSON.stringify(${expr})`);
  return text === undefined ? undefined : JSON.parse(text);
};

const STATE_EXPR = `(function () {
  const alive = (u) => isUnitAlive(u);
  return {
    gridSize: GRID_SIZE,
    enemyMode: enemyMode,
    targetsActive: isTargetSelectionActive(),
    rules: { playerActionBudget: activeRules.playerActionBudget, maxSameAction: activeRules.maxSameAction },
    terrain: { pond: [...pondTileKeys], hill: [...hillTileKeys], tree: [...treeTileKeys] },
    units: units.filter((u) => isUnitActive(u)).map((u) => ({
      id: getBattleDebugUnitId(u), team: u.team, row: u.row, col: u.col, health: u.health, maxHealth: u.maxHealth,
      defeated: !alive(u), concealed: Boolean(u.isHidden),
      queue: u.team === "player" ? [...(unitActionQueues.get(u) ?? [])] : [],
      target: u.team === "player" ? (u.targetId ?? null) : null,
    })),
    enemyPlan: getPackQueueData(),
    hand: { cards: [...playerHand], reshuffleChargesRemaining: reshuffleChargesRemaining },
  };
})()`;

const evaluateExpr = (orders) => `(function (orders) {
  const verdict = validatePlayerOrders(orders);
  if (!verdict.ok) return { ok: false, stage: "validate", reason: verdict.reason, index: verdict.index, message: verdict.message };
  if (verdict.queuedTotal === 0) return { ok: false, stage: "validate", reason: "no-player-orders", index: -1, message: "no player action would be queued" };
  const state = snapshotBattleState();
  const hadEnemyDraw = "enemyDrawState" in state.rng;
  state.rng = { handSeed: 0, handState: ${NEUTRAL_HAND_STATE} };
  if (hadEnemyDraw) state.rng.enemyDrawState = ${NEUTRAL_ENEMY_DRAW_STATE};
  try {
    return withBattleState(state, function () {
      runInTurnCore(function () {
        orders.forEach(function (order) {
          const unit = getUnitByBattleId(order.unit);
          if ("target" in order) setUnitTarget(unit, order.target === null ? null : getUnitByBattleId(order.target), "chosen");
          else if (!consumeAvailableAction(order.action) || !queueUnitAction(unit, order.action)) throw new Error("validated order did not apply: " + order.unit + " " + order.action);
        });
      });
      const context = createTurnContext("labSearch");
      const core = guardTurnCore(runTurnCore(context));
      let reached = false;
      for (let step = core.next(); !step.done; step = core.next()) {
        if (step.value && step.value.kind === "recovery") { reached = true; break; }
      }
      if (!reached) throw new Error("the turn core ended without a recovery step");
      return { ok: true, units: units.filter((u) => isUnitActive(u)).map((u) => ({
        id: getBattleDebugUnitId(u), team: u.team, row: u.row, col: u.col, health: u.health, defeated: !isUnitAlive(u) })) };
    });
  } catch (e) {
    return { ok: false, stage: "engine", reason: e && e.name === "DryRunRejected" ? e.reason : "engine-error", index: -1, message: String(e && e.message ? e.message : e).slice(0, 200) };
  }
})(${JSON.stringify(orders)})`;

function createGameSearchHandle(game) {
  if (!game || typeof game.ev !== "function") throw new TypeError("createGameSearchHandle: game.ev must be a function");
  return Object.freeze({
    state: () => evalJson(game, STATE_EXPR),
    validate: (orders) => evalJson(game, `validatePlayerOrders(${JSON.stringify(orders)})`),
    evaluate: (orders) => {
      if (!Array.isArray(orders) || orders.some((o) => o && typeof o === "object" && "reshuffle" in o)) {
        return { ok: false, stage: "refused", reason: "reshuffle-not-evaluated", index: -1, message: "the search never evaluates a reshuffle" };
      }
      return evalJson(game, evaluateExpr(orders));
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------------------------------------------------
function checkLimits(limits) {
  if (!limits || typeof limits !== "object") throw new TypeError("search limits must be an object");
  for (const k of Object.keys(limits)) if (!LIMIT_KEYS.includes(k)) throw new TypeError(`unknown search limit: ${k}`);
  for (const k of LIMIT_KEYS) {
    if (!Number.isSafeInteger(limits[k]) || limits[k] < 1) throw new TypeError(`search limit ${k} must be a positive integer`);
  }
  return limits;
}

// ---------------------------------------------------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------------------------------------------------
const living = (view, team) => view.units.filter((u) => u.team === team && !u.defeated).sort((a, b) => (a.id < b.id ? -1 : 1));
const chebyshev = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const queuedTotal = (view) => view.units.filter((u) => u.team === "player").reduce((n, u) => n + u.queue.length, 0);

/** The movesNeeded() observation shape over the full-information view (concealed enemies included as blockers). */
const asObservation = (view) => ({
  config: { gridSize: view.gridSize }, terrain: view.terrain,
  units: view.units.map((u) => ({ id: u.id, team: u.team, row: u.row, col: u.col, defeated: u.defeated })),
});

/** Order list of a candidate: target orders (wolf id order), then each wolf's new actions in queue order. */
function ordersOf(candidate) {
  const orders = [];
  for (const id of WOLF_IDS) if (candidate.targets[id] !== undefined) orders.push({ unit: id, target: candidate.targets[id] });
  for (const id of WOLF_IDS) for (const action of candidate.seqs[id] ?? []) orders.push({ unit: id, action });
  return orders;
}

/**
 * Every action plan: per living wolf (id order) a sequence of hand cards, total <= the remaining pack budget, cards
 * taken from the hand multiset (so maxSameAction, a draw cap, is honoured by construction), at least one card unless
 * cards are already queued. Then, under commander target selection, every wolf whose queue would hold a Move or Attack
 * gets each living enemy (concealed included) as target; the target order is emitted only when it differs from the
 * wolf's current target. Deterministic enumeration order; stops at MAX_GENERATED (generationCapped).
 */
function enumerateCandidates(view, maxGenerated = MAX_GENERATED) {
  const wolves = living(view, "player");
  const enemies = living(view, "enemy");
  const room = Math.max(0, view.rules.playerActionBudget - queuedTotal(view));
  const counts = {};
  for (const c of view.hand.cards) counts[c] = (counts[c] ?? 0) + 1;
  const needOne = queuedTotal(view) === 0;
  const out = [];
  let capped = false;

  const emit = (seqs) => {
    const targetable = view.targetsActive && enemies.length > 0
      ? wolves.filter((w) => [...w.queue, ...(seqs[w.id] ?? [])].some((a) => a === "Move" || a === "Attack"))
      : [];
    const combo = (i, targets) => {
      if (capped) return;
      if (i === targetable.length) {
        if (out.length >= maxGenerated) { capped = true; return; }
        out.push({ seqs, targets: { ...targets } });
        return;
      }
      const wolf = targetable[i];
      for (const e of enemies) {
        const next = { ...targets };
        if (wolf.target !== e.id) next[wolf.id] = e.id;
        combo(i + 1, next);
      }
    };
    combo(0, {});
  };

  // taken[a] = cards of action a already used by earlier wolves and this wolf's sequence so far.
  const perWolf = (wi, taken, seqs, used) => {
    if (capped) return;
    if (wi === wolves.length) {
      if (!needOne || used > 0) emit(seqs);
      return;
    }
    const id = wolves[wi].id;
    const extend = (seq, takenNow) => {
      if (capped) return;
      perWolf(wi + 1, takenNow, seq.length ? { ...seqs, [id]: [...seq] } : seqs, used + seq.length);
      if (used + seq.length >= room) return;
      for (const a of ACTIONS) {
        if ((counts[a] ?? 0) - (takenNow[a] ?? 0) <= 0) continue;
        seq.push(a);
        extend(seq, { ...takenNow, [a]: (takenNow[a] ?? 0) + 1 });
        seq.pop();
      }
    };
    extend([], taken);
  };

  if (wolves.length > 0 && enemies.length > 0 && room > 0) perWolf(0, {}, {}, 0);
  return { candidates: out, generationCapped: capped };
}

/**
 * Static ranking score (ranking ONLY; the real evaluation decides). Per wolf with target t (its committed target, else
 * the nearest living enemy, as the game's auto-pick): needed = movesNeeded over current positions; walking its queue
 * (existing cards first): Attack +10 when the Moves before it reach `needed`, else -2; Move +3 while short of `needed`,
 * else -1; Defend +2 when an enemy that plans an Attack stands within 4 tiles, else +0.5. Plus +50 per enemy whose
 * expected damage (3 per likely hit) reaches its health.
 */
function staticScore(view, candidate, cache) {
  const enemies = living(view, "enemy");
  const obs = cache.obs;
  const plannedAttackers = new Set(view.enemyPlan.filter((e) => e.action === "Attack").map((e) => e.unit));
  const damage = {};
  let score = 0;
  for (const wolf of living(view, "player")) {
    const seq = candidate.seqs[wolf.id] ?? [];
    const all = [...wolf.queue, ...seq];
    const targetId = candidate.targets[wolf.id] !== undefined ? candidate.targets[wolf.id] : wolf.target;
    let target = enemies.find((e) => e.id === targetId) ?? null;
    if (!target) for (const e of enemies) if (!target || chebyshev(wolf, e) < chebyshev(wolf, target)) target = e;
    const key = `${wolf.id}>${target ? target.id : "-"}`;
    if (!(key in cache.needed)) cache.needed[key] = target ? movesNeeded(obs, wolf, target) : NEEDED_CAP;
    const needed = cache.needed[key];
    const threatened = enemies.some((e) => plannedAttackers.has(e.id) && chebyshev(e, wolf) <= 4);
    let moves = 0;
    all.forEach((a, slot) => {
      const mine = slot >= wolf.queue.length; // existing cards are scored too (they shape the turn) but are not new
      if (a === "Attack") {
        const hit = target && needed < NEEDED_CAP && moves >= needed;
        if (mine) score += hit ? 10 : -2;
        if (hit) damage[target.id] = (damage[target.id] ?? 0) + 3;
      } else if (a === "Move") {
        if (mine) score += moves < needed ? 3 : -1;
        moves += 1;
      } else if (mine) {
        score += threatened ? 2 : 0.5;
      }
    });
  }
  for (const e of enemies) if ((damage[e.id] ?? 0) >= e.health) score += 50;
  return score;
}

/** Ranked candidate list (static score desc, enumeration order on ties), cut to maxCandidates. */
function generateCandidates(view, { maxCandidates, maxGenerated = MAX_GENERATED }) {
  const { candidates, generationCapped } = enumerateCandidates(view, maxGenerated);
  const cache = { obs: asObservation(view), needed: {} };
  const ranked = candidates.map((c, i) => ({ c, i, s: staticScore(view, c, cache) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i));
  return {
    generated: candidates.length,
    generationCapped,
    candidatesCapped: ranked.length > maxCandidates,
    kept: ranked.slice(0, maxCandidates).map((r) => ({ orders: ordersOf(r.c), staticScore: r.s })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Scoring (documented in BOTS.md)
// ---------------------------------------------------------------------------------------------------------------------
function proximity(unitsList) {
  const wolves = unitsList.filter((u) => u.team === "player" && !u.defeated);
  const enemies = unitsList.filter((u) => u.team === "enemy" && !u.defeated);
  if (!enemies.length) return 0;
  return wolves.reduce((n, w) => n + Math.min(...enemies.map((e) => chebyshev(w, e))), 0);
}

/**
 * Score of one evaluated turn, compared lexicographically (higher is better at every position):
 *   [ win, notLoss, wolvesAlive, enemiesKilled, damageDealt - damageReceived, -proximity, -cardsUsed ]
 * win = every enemy defeated with a wolf alive; notLoss = a wolf alive; damage from health before / after the turn
 * (after the turn-end recovery, which is part of this turn's rules); proximity = sum over living wolves of the Chebyshev
 * distance to the nearest living enemy after the turn; cardsUsed = new action orders (unplayed cards carry over).
 * Equal tuples keep the earlier (higher-ranked) candidate.
 */
function scoreOutcome(before, afterUnits, orders) {
  const by = (list) => Object.fromEntries(list.map((u) => [u.id, u]));
  const pre = by(before.units);
  let dealt = 0; let received = 0; let killed = 0;
  for (const u of afterUnits) {
    const b = pre[u.id];
    if (!b) continue;
    const loss = Math.max(0, b.health - Math.max(0, u.health));
    if (u.team === "enemy") { dealt += loss; if (!b.defeated && u.defeated) killed += 1; } else received += loss;
  }
  const wolvesAlive = afterUnits.filter((u) => u.team === "player" && !u.defeated).length;
  const enemiesAlive = afterUnits.filter((u) => u.team === "enemy" && !u.defeated).length;
  return {
    tuple: [enemiesAlive === 0 && wolvesAlive > 0 ? 1 : 0, wolvesAlive > 0 ? 1 : 0, wolvesAlive, killed, dealt - received,
      -proximity(afterUnits), -orders.filter((o) => "action" in o).length],
    dealt, received, killed, proximityBefore: proximity(before.units), proximityAfter: proximity(afterUnits),
  };
}

const better = (a, b) => {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return false; // equal: keep the earlier candidate
};

/** Poor plan (reshuffle trigger): not a win, no kill, no damage dealt and no approach (proximity not reduced). */
const isPoor = (s) => s.tuple[0] === 0 && s.killed === 0 && s.dealt === 0 && s.proximityAfter >= s.proximityBefore;

// ---------------------------------------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------------------------------------
const emptyStats = () => ({
  decisions: 1, candidatesGenerated: 0, candidatesKept: 0, evaluated: 0, rejectedByValidator: 0, engineErrors: 0,
  limitHits: { generation: 0, candidates: 0, evaluations: 0, time: 0 }, fallbacks: 0, reshuffles: 0,
});

/**
 * searchDecide(observation, { handle, limits, now, round, maxRounds }) -> { orders, stats, ms, best }
 * observation (the driver's observeBattle() copy) is accepted for the bot interface but not read: the search reads the
 * same live battle's full view from handle.state(). ms = now() at the end minus now() at the start (wall clock; never
 * part of stats).
 */
function searchDecide(observation, { handle, limits, now, round = 0, maxRounds = 1 } = {}) {
  if (!handle || typeof handle.state !== "function" || typeof handle.evaluate !== "function" || typeof handle.validate !== "function") {
    throw new TypeError("searchDecide: handle { state, validate, evaluate } is required");
  }
  checkLimits(limits);
  if (typeof now !== "function") throw new TypeError("searchDecide: now() is required");
  const start = now();
  const stats = emptyStats();
  const done = (orders, best = null) => ({ orders, stats, ms: Math.max(0, now() - start), best });

  const view = handle.state();
  const gen = generateCandidates(view, limits);
  stats.candidatesGenerated = gen.generated;
  stats.candidatesKept = gen.kept.length;
  if (gen.generationCapped) stats.limitHits.generation = 1;
  if (gen.candidatesCapped) stats.limitHits.candidates = 1;
  if (gen.kept.length === 0) return done([]); // nothing legal to queue (no wolf, no enemy, no budget or no card)

  let best = null;
  let attempts = 0; // every evaluate() call counts against maxEvaluations, also a refused or failed one
  for (let i = 0; i < gen.kept.length; i += 1) {
    if (attempts >= limits.maxEvaluations) { stats.limitHits.evaluations = 1; break; }
    if (now() - start >= limits.maxMsPerDecision) { stats.limitHits.time = 1; break; }
    const { orders } = gen.kept[i];
    attempts += 1;
    const r = handle.evaluate(orders);
    if (!r || r.ok !== true) {
      if (r && r.stage === "validate") stats.rejectedByValidator += 1; else stats.engineErrors += 1;
      continue;
    }
    stats.evaluated += 1;
    const score = scoreOutcome(view, r.units, orders);
    if (!best || better(score.tuple, best.score.tuple)) best = { index: i, orders, score };
  }

  if (!best) {
    // Deterministic fallback: the highest-ranked candidate the real validator accepts.
    stats.fallbacks = 1;
    for (let i = 0; i < Math.min(gen.kept.length, FALLBACK_VALIDATIONS); i += 1) {
      const v = handle.validate(gen.kept[i].orders);
      if (v && v.ok === true && v.queuedTotal > 0) return done(gen.kept[i].orders);
      stats.rejectedByValidator += 1;
    }
    return done([]);
  }

  const canReshuffle = round === 0 && maxRounds >= 2 && (view.hand.reshuffleChargesRemaining ?? 0) > 0
    && queuedTotal(view) === 0 && view.hand.cards.length > 0;
  if (canReshuffle && isPoor(best.score)) {
    stats.reshuffles = 1;
    return done([{ reshuffle: true }], best);
  }
  return done(best.orders, best);
}

/** Sum per-decision stats (plain counts). */
function addStats(total, s) {
  const out = total ? JSON.parse(JSON.stringify(total)) : { ...emptyStats(), decisions: 0 };
  for (const k of ["decisions", "candidatesGenerated", "candidatesKept", "evaluated", "rejectedByValidator", "engineErrors", "fallbacks", "reshuffles"]) out[k] += s[k];
  for (const k of Object.keys(out.limitHits)) out.limitHits[k] += s.limitHits[k];
  return out;
}

module.exports = {
  createGameSearchHandle, searchDecide, generateCandidates, enumerateCandidates, staticScore, scoreOutcome, isPoor, addStats,
  checkLimits, ordersOf, emptyStats, LIMIT_KEYS, MAX_GENERATED, NEUTRAL_HAND_STATE, NEUTRAL_ENEMY_DRAW_STATE,
};
