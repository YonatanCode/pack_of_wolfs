"use strict";
// REQUIREMENT — search-benchmark reshuffle, driver seam and report (hand-placed boards; hand-written hands; the search is
// called directly, plus ONE scripted-driver style battle of ONE turn, fixtureOnly)
// S5a RESHUFFLE FROM THE CURRENT HAND: enemies far and passive (empty plan), hand Defend x3, charges 2: in round 0 of 2 the
//     search returns exactly [{ reshuffle: true }] (its best current-hand plan is poor: no damage, no kill, no approach),
//     with NO hand draw and no reshuffle during the decision (spies 0, fingerprint unchanged: the new hand is never
//     previewed). Round 1 on the same board returns the Defend plan instead; so does round 0 with rc:0 (no charge) and
//     round 0 of a one-round protocol.
// S5b DRIVER SEAM: runBattle with BOTS["search-benchmark"] (fullInformation) on that board, maxTurnsPerBattle 1, a fake
//     clock (+1 per read): steps [[reshuffle], <round-1 plan>], reshuffles 1, the round-1 plan is legal (the turn ran),
//     perTurn[0].search sums both decisions (decisions 2, reshuffles 1), record.fullInformation true, record.timing.searchMs
//     from the fake clock. A scripted bot without the flag gets ctx keys rng,round,maxRounds only (no search).
//     Without searchLimits the options are refused (TypeError) before any context is created.
// S5c REPLAY: replayBattle reproduces the record (diffRecords []), copying search / timing from it (no search re-run).
// S5d REPORT: buildReport labels the strategy "full-information benchmark" (summary.label, fullInformation, summed search
//     counts), adds the benchmark note and the search-cost note, moves timing out of battles into nonHashed.searchMs;
//     reportHash ignores nonHashed (different timing -> same hash, different serialisation). A report without
//     full-information battles has neither nonHashed nor a label.
const T = require("./_s.cjs");
const { BOTS } = require("../../tools/lab/bots.cjs");
const { runBattle, replayBattle, diffRecords } = require("../../tools/lab/driver.cjs");
const { buildReport, reportHash, serializeReport } = require("../../tools/lab/report.cjs");

const ID = "s5-search-reshuffle-driver";
const { SR, check, same } = T;
const R = { reshuffle: true };
const FAR = [{ row: 10, col: 3 }, { row: 10, col: 5 }, { row: 10, col: 8 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 1, col: 8 }];
const DEFENDS = ["Defend", "Defend", "Defend"];
const LIMITS = { maxCandidates: 60, maxEvaluations: 60, maxMsPerDecision: 5000 };
const ZERO = { mathRandom: 0, liveHand: 0, randomAction: 0, draw: 0, reshuffle: 0 };
const stepClock = () => { let t = 0; return () => { t += 1; return t; }; };

function run() {
  const out = {};
  const contexts = [];
  // S5a
  const g = T.board(FAR, [], { hand: DEFENDS });
  contexts.push(g);
  T.installSpies(g);
  const before = T.fingerprint(g);
  const handle = SR.createGameSearchHandle(g);
  const decide = (h, round, maxRounds) => SR.searchDecide(null, { handle: h, limits: LIMITS, now: T.fixedClock(), round, maxRounds });
  const r0 = decide(handle, 0, 2);
  same(r0.orders, [R], "S5a: round 0 reshuffles a poor hand");
  check(r0.stats.reshuffles === 1 && r0.best && SR.isPoor(r0.best.score), "S5a: decided from the evaluated current-hand plan");
  same(T.spies(g), ZERO, "S5a: no draw and no reshuffle during the decision");
  check(T.fingerprint(g) === before, "S5a: live battle unchanged (hand, stream, charges)");
  const r1 = decide(handle, 1, 2);
  check(r1.orders.length > 0 && r1.orders.every((o) => o.action === "Defend" || "target" in o) && r1.stats.reshuffles === 0, "S5a: round 1 plays the hand");
  const legacy = decide(handle, 0, 1);
  check(!legacy.orders.some((o) => "reshuffle" in o), "S5a: a one-round protocol never reshuffles");
  const g0 = T.board(FAR, [], { hand: DEFENDS, query: `${T.COMMANDER}&rules=rc:0` });
  contexts.push(g0);
  const noCharge = decide(SR.createGameSearchHandle(g0), 0, 2);
  check(!noCharge.orders.some((o) => "reshuffle" in o), "S5a: no charge, no reshuffle");
  out.reshuffle = { round0: r0.orders, poorBest: r0.best.score, round1: r1.orders, noCharge: noCharge.orders };

  // S5b
  const load = (opts) => { const c = T.board(FAR, [], { hand: DEFENDS, query: opts.query }); contexts.push(c); return c; };
  const base = { scenarioId: "intro", seed: 1, preset: "commander", botSeed: 7, fixtureOnly: true, customSetup: "hand-placed board (resetDevTest), hand Defend x3", limits: { maxTurnsPerBattle: 1 } };
  const ctxBefore = contexts.length;
  let refused = null;
  try { runBattle({ ...base, load, bot: BOTS["search-benchmark"], strategy: "search-benchmark" }); } catch (e) { refused = e instanceof TypeError ? e.message : `not a TypeError: ${e}`; }
  check(refused && /searchLimits/.test(refused) && contexts.length === ctxBefore, "S5b: searchLimits required before any context");
  const record = runBattle({ ...base, load, bot: BOTS["search-benchmark"], strategy: "search-benchmark", searchLimits: LIMITS, now: stepClock() });
  const t1 = record.perTurn[0];
  check(t1.status === "ran" && t1.steps.length === 2 && JSON.stringify(t1.steps[0]) === JSON.stringify([R]) && t1.reshuffles === 1, `S5b: reshuffle round then the turn (${JSON.stringify(t1.steps)})`);
  check(t1.search.decisions === 2 && t1.search.reshuffles === 1 && t1.search.evaluated > 0, "S5b: slot search stats");
  check(record.fullInformation === true && record.timing.searchMs.decisions === 2, "S5b: record flags and timing");
  check(record.result === "timeout" && record.stopReason === "max-turns-per-battle", "S5b: one turn only");
  const keys = [];
  runBattle({ ...base, load, bot: { id: "scripted-no-flag", decide: (o, ctx) => { keys.push(Object.keys(ctx).join(",")); return [{ unit: "P1", action: "Defend" }]; } } });
  same(keys, ["rng,round,maxRounds"], "S5b: other bots get no search context");
  out.driver = { steps: t1.steps, search: t1.search, timing: record.timing, planned: t1.planned, executed: t1.executed, reshuffleChargesAfter: t1.reshuffleChargesAfter, refused };

  // S5c
  const again = replayBattle(record, load);
  same(diffRecords(record, again), [], "S5c: replay reproduces the record");
  out.replay = "identical";

  // S5d
  const rep = buildReport({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles: [record] });
  const s = rep.summary["search-benchmark"];
  check(s.label === "full-information benchmark" && s.fullInformation === true && s.search.decisions === 2, "S5d: summary label and search counts");
  check(rep.notes.some((n) => n.startsWith("full-information benchmark: search-benchmark") && /does NOT estimate human difficulty/.test(n)), "S5d: benchmark note");
  check(rep.notes.some((n) => n.startsWith("search cost: search-benchmark 2 decisions")), "S5d: search cost note");
  check(rep.battles.every((b) => !("timing" in b)) && rep.nonHashed.searchMs["search-benchmark"].decisions === 2, "S5d: timing moved to nonHashed");
  const slower = JSON.parse(JSON.stringify(record));
  slower.timing.searchMs.totalMs += 1000;
  slower.timing.searchMs.maxMs += 1000;
  const rep2 = buildReport({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles: [slower] });
  check(reportHash(rep2) === reportHash(rep) && serializeReport(rep2) !== serializeReport(rep), "S5d: reportHash ignores nonHashed timing");
  const plainRecord = { ...JSON.parse(JSON.stringify(record)), strategy: "scripted" };
  delete plainRecord.fullInformation; delete plainRecord.timing; plainRecord.perTurn.forEach((p) => { delete p.search; });
  const rep3 = buildReport({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles: [plainRecord] });
  check(!("nonHashed" in rep3) && !("label" in rep3.summary.scripted) && !("search" in rep3.summary.scripted), "S5d: no label without a full-information battle");
  out.report = { summary: s, notes: rep.notes, nonHashed: rep.nonHashed };
  out.hands = T.reportSearchHands(ID, contexts);
  return { header: "REQUIREMENT — search-benchmark reshuffle, driver seam and report", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
