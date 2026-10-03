"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C9: per-tick STATE trace (Trace A) for 8 hand-authored cases, recorded on the unmodified script.js so a later
// rules/animation split can be proven order-preserving. After every tick (and at turn start/end) all six units'
// row/col/direction/health/isDefeated/movementMode/turnsSinceHit/tookDamageThisTurn/isFleeing/packObjective/queue,
// the enemy pack queue (unit:action pairs + length), pack focus target, ordered hand, reshuffle charges, result
// overlay (+message) and the hand-RNG position are recorded. Hand-RNG position = {seed, draws, next3}, observed
// without perturbing the live stream (see _trace.cjs header). One line per unit to keep the golden diffable.
const { HEADER } = require("./_trace.cjs");
const { CASES, runCase, caseList } = require("./_cases.cjs");

const ID = "c9-turn-trace-state";

async function run() {
  const out = { header: HEADER, caseIndex: caseList(), cases: {} };
  for (const def of CASES) {
    const r = await runCase(def, { wrap: false });
    out.cases[def.id] = { tickCount: r.ticks, states: r.snaps };
  }
  return out;
}
module.exports = { id: ID, run };
