"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour.
// C10: PRESENTATION-CALL trace (Trace B) for the same 8 hand-authored cases as c9. The unmodified script.js's calls to
// moveUnitToTile / playUnitAnimation(Cycles) / playUnitHitReaction / playUnitDeath / show*Popup / renderEnemyPackIntentTags /
// renderActionQueue / renderPlayerTimeline / updateUnitHealthBar / refillAvailableActions (with the hand before -> after) /
// shakeArenaSoon / concludeBattle / showGameResult are listed in CALL-START order, arguments reduced to stable ids
// (P1..E3, numbers, animation names, popup amounts) and stamped with the harness' virtual clock (t=). Rule-ordering markers
// (planEnemyPackTurn, applyTurnEndRecovery, updateEnemyIntentPreview) are included so a refactor can be checked for
// "rules ran at the same point relative to presentation". "----" lines are driver/tick markers, not game calls.
// COMPLETION order is not recorded: completion is a pure function of (start time, deterministic animation duration), so call
// start order + virtual start timestamps already determine it (see _trace.cjs). Interception is proven on every run: each case
// runs twice (state-only vs. with wrappers) and the run FAILS unless the state traces, virtual clock and step usage are
// identical (wrappers are pass-through) and every wrapped function was hit at least once across the 8 cases.
const { HEADER, PRESENTATION_NAMES, ORDER_MARKER_NAMES } = require("./_trace.cjs");
const { CASES, runCase, caseList } = require("./_cases.cjs");

const ID = "c10-turn-trace-presentation";

async function run() {
  const out = { header: HEADER, caseIndex: caseList(), coverage: {}, cases: {} };
  const hits = Object.fromEntries([...PRESENTATION_NAMES, ...ORDER_MARKER_NAMES].map((n) => [n, 0]));
  for (const def of CASES) {
    const plain = await runCase(def, { wrap: false });
    const traced = await runCase(def, { wrap: true });
    const same = JSON.stringify([plain.snaps, plain.clock, plain.usage]) === JSON.stringify([traced.snaps, traced.clock, traced.usage]);
    if (!same) throw new Error(`wrappers changed behaviour in case ${def.id} (state/clock/steps differ)`);
    traced.events.forEach((e) => {
      const name = e.split(" ")[1];
      if (name in hits) hits[name] += 1;
    });
    out.cases[def.id] = { tickCount: traced.ticks, callCount: traced.events.filter((e) => !e.includes(" ---- ")).length, calls: traced.events };
  }
  const missing = Object.entries(hits).filter(([, n]) => n === 0).map(([n]) => n);
  if (missing.length) throw new Error(`interception check failed: never called/intercepted: ${missing.join(", ")}`);
  out.coverage = hits;
  out.wrappersAreCallThrough = "verified: state trace, virtual clock and step usage identical with and without wrappers, every case";
  return out;
}
module.exports = { id: ID, run };
