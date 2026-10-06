"use strict";
// REQUIREMENT — search-benchmark limits (one hand-placed board; fixed limits; injected fake clocks; the search is called
// directly, no turn is played)
// S3a CANDIDATE CAP: maxCandidates 7 -> 7 kept, 7 evaluated, limitHits.candidates 1.
// S3b EVALUATION CAP: maxEvaluations 3 -> 3 evaluated, limitHits.evaluations 1; the plan is the best of those 3.
// S3c TIME: a fake clock advancing 10 per read with maxMsPerDecision 25 -> 2 evaluations, limitHits.time 1, ms 40
//     (start read, 3 limit checks, end read); the same twice.
// S3d FALLBACK (nothing evaluated): a clock past the limit at the first check -> 0 evaluated, fallbacks 1, the
//     highest-ranked candidate the real validator accepts; identical on a second call; legal.
// S3e FAILED EVALUATIONS count against maxEvaluations: a handle whose evaluate() always fails (engine) with
//     maxEvaluations 4 -> 4 attempts (engineErrors 4), limitHits.evaluations 1, fallback.
// S3f NOTHING LEGAL: an empty hand -> [] with 0 candidates and no fallback.
// S3g LIMIT REFUSALS: checkLimits throws TypeError for a missing key, 0, 1.5, an unknown key, a non-object.
// Every call leaves the live battle unchanged (fingerprint).
const T = require("./_s.cjs");

const ID = "s3-search-limits";
const { SR, check, same } = T;
const BOARD = [{ row: 6, col: 6 }, { row: 9, col: 2 }, { row: 9, col: 9 }, { row: 5, col: 5, health: 4 }, { row: 3, col: 7 }, null];
const PLAN = [{ unitId: "enemy", action: "Attack" }, { unitId: "enemySupport", action: "Move" }];

const stepClock = (step) => { let t = 0; return () => { t += step; return t; }; };
const seqClock = (values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
const brief = (d) => ({ orders: d.orders, stats: d.stats, ms: d.ms });

function run() {
  const out = {};
  const g = T.board(BOARD, PLAN);
  const before = T.fingerprint(g);
  const handle = SR.createGameSearchHandle(g);
  const decide = (limits, now, h = handle) => SR.searchDecide(null, { handle: h, limits, now, round: 1, maxRounds: 2 });

  // S3a
  const a = decide({ maxCandidates: 7, maxEvaluations: 100, maxMsPerDecision: 1000 }, T.fixedClock());
  check(a.stats.candidatesKept === 7 && a.stats.evaluated === 7 && a.stats.limitHits.candidates === 1 && a.stats.limitHits.evaluations === 0, "S3a: candidate cap");
  out.candidateCap = brief(a);

  // S3b
  const b = decide({ maxCandidates: 100, maxEvaluations: 3, maxMsPerDecision: 1000 }, T.fixedClock());
  check(b.stats.evaluated === 3 && b.stats.limitHits.evaluations === 1, "S3b: evaluation cap");
  const firstThree = SR.generateCandidates(handle.state(), { maxCandidates: 3 }).kept.map((k) => k.orders);
  check(firstThree.some((o) => JSON.stringify(o) === JSON.stringify(b.orders)), "S3b: the plan is one of the 3 evaluated");
  out.evaluationCap = brief(b);

  // S3c
  const timed = () => decide({ maxCandidates: 100, maxEvaluations: 100, maxMsPerDecision: 25 }, stepClock(10));
  const c = timed();
  check(c.stats.evaluated === 2 && c.stats.limitHits.time === 1 && c.ms === 40, `S3c: time limit (${JSON.stringify(c.stats)}, ms ${c.ms})`);
  same(brief(timed()), brief(c), "S3c: deterministic with the same clock");
  out.timeLimit = brief(c);

  // S3d
  const late = () => decide({ maxCandidates: 100, maxEvaluations: 100, maxMsPerDecision: 25 }, seqClock([0, 1e9]));
  const d = late();
  check(d.stats.evaluated === 0 && d.stats.fallbacks === 1 && d.stats.limitHits.time === 1, "S3d: fallback after the time limit");
  same(d.orders, SR.generateCandidates(handle.state(), { maxCandidates: 1 }).kept[0].orders, "S3d: fallback = highest-ranked candidate");
  same(brief(late()), brief(d), "S3d: deterministic fallback");
  check(handle.validate(d.orders).ok === true, "S3d: the fallback is legal");
  out.fallback = brief(d);

  // S3e
  const broken = { state: handle.state, validate: handle.validate, evaluate: () => ({ ok: false, stage: "engine", reason: "engine-error" }) };
  const e = decide({ maxCandidates: 100, maxEvaluations: 4, maxMsPerDecision: 1000 }, T.fixedClock(), broken);
  check(e.stats.engineErrors === 4 && e.stats.evaluated === 0 && e.stats.limitHits.evaluations === 1 && e.stats.fallbacks === 1, "S3e: failed evaluations count against the cap");
  same(e.orders, d.orders, "S3e: same deterministic fallback");
  out.failedEvaluations = brief(e);

  check(T.fingerprint(g) === before, "S3a-e: the live battle is unchanged");

  // S3f
  const ge = T.board(BOARD, PLAN, { hand: [] });
  const f = SR.searchDecide(null, { handle: SR.createGameSearchHandle(ge), limits: T.LIMITS, now: T.fixedClock(), round: 0, maxRounds: 2 });
  check(f.orders.length === 0 && f.stats.candidatesGenerated === 0 && f.stats.fallbacks === 0, "S3f: nothing legal");
  out.nothingLegal = brief(f);

  // S3g
  const bad = [
    { maxCandidates: 1, maxEvaluations: 1 },
    { maxCandidates: 0, maxEvaluations: 1, maxMsPerDecision: 1 },
    { maxCandidates: 1.5, maxEvaluations: 1, maxMsPerDecision: 1 },
    { maxCandidates: 1, maxEvaluations: 1, maxMsPerDecision: 1, maxDepth: 2 },
    null,
  ];
  out.limitRefusals = bad.map((l) => {
    try { SR.checkLimits(l); } catch (err) { check(err instanceof TypeError, "S3g: TypeError"); return err.message; }
    throw new Error(`S3g: ${JSON.stringify(l)} accepted`);
  });
  out.hands = T.reportSearchHands(ID, [g, ge]);
  return { header: "REQUIREMENT — search-benchmark limits", fixtureOnly: true, result: out };
}

module.exports = { id: ID, run };
