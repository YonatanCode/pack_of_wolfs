"use strict";
// Shared helpers for the enemy-action experiment fixtures (r28..r31, commander preset). Not a fixture itself.
// Read-only reuse of _preview (boards, dry runs, snapshots), _settings (boot with the hand counter, links, Apply) and
// _gaps (attempt / one-shot faults). Hands are reported to the SEPARATE follow-up ledger (_settings.reportStepHands).
const G = require("./_gaps.cjs");
const { PV, S } = G;

const REQ_HEADER_CMD = "REQUIREMENT — enemy-action experiment";
const CMD = "?scenario=intro&seed=1&preset=commander";
const CUR = "?scenario=intro&seed=1";
const COMMANDER_EVENT_TYPES = ["enemyBudget", "unassigned", "forfeited", "enemyAccounting"];

/** Booted with the hand counter: commander (default numbers unless `rules`), or current. */
const bootCommander = (rules = "") => S.boot(`${CMD}${rules ? `&rules=${rules}` : ""}`);
const bootCurrent = (rules = "") => S.boot(rules ? `${CUR}&preset=current&rules=${rules}` : CUR);

/** Counts every enemy pack planning (planEnemyPackTurnRules), tagged "live" or "copy" (inside a battle-state swap). */
function installPlannerSpy(g) {
  g.ev(`globalThis.__plans = []; (function () { const orig = planEnemyPackTurnRules;
    planEnemyPackTurnRules = function () { __plans.push(battleStateSwap !== null ? "copy" : "live"); return orig.apply(this, arguments); }; })()`);
}
const plannerCalls = (g) => S.J(g, "({ live: __plans.filter((p) => p === 'live').length, copy: __plans.filter((p) => p === 'copy').length })");

const packQueue = (g) => S.J(g, "getPackQueueData()");
const frozen = (g) => g.ev("getEnemyPlanState().frozen");
const ofType = (events, type) => events.filter((e) => e.type === type);
const one = (events, type) => { const list = ofType(events, type); S.check(list.length === 1, `exactly one ${type} event (got ${list.length})`); return list[0]; };
const turnStartPlan = (events) => events.find((e) => e.type === "enemyPlan" && e.reason === "turnStart");
const previewPlan = (events) => events.find((e) => e.type === "enemyPlan" && e.reason === "preview");

/** The "Enemy actions" block of a battle note ([] if absent). */
const enemyNoteBlock = (note) => { const i = note.split("\n").findIndex((l) => l.startsWith("Enemy actions")); return i < 0 ? [] : note.split("\n").slice(i); };

/** Assert the accounting invariants on an enemyAccounting event; returns its counts. */
function checkAccounting(acc, label) {
  S.check(acc.assigned === acc.spent + acc.forfeited + acc.unplayed, `${label}: assigned ${acc.assigned} = spent ${acc.spent} + forfeited ${acc.forfeited} + unplayed ${acc.unplayed}`);
  S.check(acc.budget === acc.assigned + acc.unassigned, `${label}: budget ${acc.budget} = assigned ${acc.assigned} + unassigned ${acc.unassigned}`);
  S.check(acc.spent <= acc.budget, `${label}: spent ${acc.spent} <= budget ${acc.budget}`);
  S.check(acc.spentActions.length === acc.spent && acc.unplayedActions.length === acc.unplayed && acc.assignedActions.length === acc.assigned, `${label}: action lists match the counts`);
  return { budget: acc.budget, assigned: acc.assigned, spent: acc.spent, forfeited: acc.forfeited, unplayed: acc.unplayed, unassigned: acc.unassigned,
    reasons: acc.reasons.map((r) => `${r.code} x${r.count}`) };
}

/** The current preset never emits commander-only events or fields, nor the note block. */
function checkCurrentUntouched(events, note, label) {
  S.check(events.every((e) => !COMMANDER_EVENT_TYPES.includes(e.type)), `${label}: no commander-only events under current`);
  S.check(ofType(events, "enemyPlan").every((e) => !("frozen" in e)), `${label}: enemyPlan events carry no "frozen" field under current`);
  S.check(!note.includes("Enemy actions"), `${label}: no "Enemy actions" block in the current battle note`);
}

/** Store fingerprint: the settings store, the preset store and the frozen-plan store (value + pinned key sets). */
const storesOf = (g) => g.ev(`JSON.stringify({ rules: getRulesState(), rulesKeys: Object.keys(getRulesState()).sort(), preset: getRulesPresetState(),
  presetKeys: Object.keys(getRulesPresetState()).sort(), plan: getEnemyPlanState(), planKeys: Object.keys(getEnemyPlanState()).sort() })`);

module.exports = { G, PV, S, REQ_HEADER_CMD, CMD, CUR, COMMANDER_EVENT_TYPES, bootCommander, bootCurrent, installPlannerSpy, plannerCalls, packQueue, frozen,
  ofType, one, turnStartPlan, previewPlan, enemyNoteBlock, checkAccounting, checkCurrentUntouched, storesOf };
