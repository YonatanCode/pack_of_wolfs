"use strict";
// REQUIREMENT — commanderdraw enemy draw
// Shared helpers for the commanderdraw fixtures (r49..r51; preset "commanderdraw", ENGINE-NOTES section 13). Not a fixture
// itself. Read-only reuse of _settings (boot with the hand counter), _preview (probes, dry runs, boards, played turns) and
// _cmd (accounting checks).
// TESTING BOUNDARY: hand-authored boards and orders only, at most 3 turns per context, scripted outcomes. The enemy draw is
// checked DETERMINISTICALLY: exact pinned lists for seeds 1..3 and structural properties; no distribution sampling.
// HAND LEDGER: this step keeps its OWN ledger (reportDrawHands, asserted <= 60 over r49..r51), separate from every other
// ledger. Every context boots through boot(), which counts the boot hand and every dealt / refilled hand.
const S = require("./_settings.cjs");
const PV = require("./_preview.cjs");
const C = require("./_cmd.cjs");

const REQ_HEADER_DRAW = "REQUIREMENT — commanderdraw enemy draw";
const DRAW = "?scenario=intro&seed=1&preset=commanderdraw";
const CMD = "?scenario=intro&seed=1&preset=commander";
const CUR = "?scenario=intro&seed=1";
const DRAW_HAND_LIMIT = 60;
const ledger = {};
const STEP = 0x6d2b79f5; // createSeededRandom's per-value state increment

/** Real boot route with the hand counter and the _preview probes (PV.liveFingerprint works). */
function boot(query = DRAW) {
  const g = S.boot(query);
  PV.L.T.installResultMessageProbe(g);
  PV.installProbes(g);
  return g;
}

function reportDrawHands(id, contexts) {
  ledger[id] = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  S.check(total <= DRAW_HAND_LIMIT, `commanderdraw hand budget: ${total} hands so far (limit ${DRAW_HAND_LIMIT})`);
  return ledger[id];
}

const J = (g, expr) => S.J(g, expr);
/** The enemy draw store (stream position + drawn pool). */
const drawStore = (g) => J(g, "getEnemyDrawState()");

/** Counts every drawEnemyPlanPool call, tagged "live" or "copy" (inside a battle-state swap). */
function installDrawSpy(g) {
  g.ev(`globalThis.__draws = []; (function () { const orig = drawEnemyPlanPool;
    drawEnemyPlanPool = function () { const r = orig.apply(this, arguments); __draws.push((battleStateSwap !== null ? "copy:" : "live:") + r.join(",")); return r; }; })()`);
}
const drawCalls = (g) => J(g, "__draws");
const takeDrawCalls = (g) => { const list = drawCalls(g); g.ev("__draws.length = 0"); return list; };

/** Pure draws in the game: `count` lists of `budget` actions from the stream derived from `seed` (draw order). */
const pureLists = (g, seed, count, budget) => J(g, `(function () { const s = createSeededRandom(deriveEnemyDrawSeed(${seed}));
  return Array.from({ length: ${count} }, () => drawEnemyActionList(s, ${budget})); })()`);

/** Position of a stream seeded with `seed` after `values` draws (mulberry32 state = seed + values x STEP mod 2^32). */
const advanced = (seed, values) => Number((BigInt(seed) + BigInt(values) * BigInt(STEP)) % 4294967296n);
const counts = (list) => list.reduce((m, a) => ({ ...m, [a]: (m[a] ?? 0) + 1 }), {});
const canonical = (list) => ["Move", "Defend", "Attack"].flatMap((a) => list.filter((x) => x === a));

module.exports = { S, PV, C, REQ_HEADER_DRAW, DRAW, CMD, CUR, STEP, boot, reportDrawHands, J, drawStore, installDrawSpy, drawCalls, takeDrawCalls,
  pureLists, advanced, counts, canonical };
