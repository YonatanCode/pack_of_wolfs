"use strict";
// G6: manifest `searchLimits` (per-decision search limits of full-information strategies). Hand-authored manifests;
// validateManifest and run.cjs --check-only only; nothing is run.
// - accepted: search-benchmark with all three limits (also with the bots.cjs registry as the default source of ids);
//   manifestHash covers searchLimits (a changed limit changes the hash).
// - refused: search-benchmark without searchLimits; searchLimits without a full-information strategy; unknown / missing
//   key; 0, 1.5, a string; each hard cap + 1; a non-object.
// - the pre-existing two-bot manifest (no searchLimits) stays valid; its manifestHash is the plain canonical hash.
// - --check-only prints the searchLimits line (and exits 0) for a valid search manifest.
const path = require("node:path");
const { validateManifest, manifestHash, SEARCH_LIMIT_CAPS } = require("../../tools/lab/manifest.cjs");
const { main } = require("../../tools/lab/run.cjs");
const { BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g6-search-limits";
const IDS = { botIds: [...BOT_IDS, "search-benchmark"], fullInformationIds: ["search-benchmark"] };
const SL = { maxCandidates: 200, maxEvaluations: 200, maxMsPerDecision: 500 };
const searchManifest = () => ({ ...baseManifest(), strategies: ["search-benchmark"], searchLimits: { ...SL } });
const check = (m, opts = IDS) => { const r = validateManifest(m, opts); return { valid: r.valid, errors: r.errors, hasHash: !!r.manifestHash }; };
const mut = (f) => { const m = searchManifest(); f(m); return m; };

async function run() {
  const cases = {};
  cases.valid = check(searchManifest());
  cases["valid-default-registry"] = check(searchManifest(), {});
  cases["missing-searchLimits"] = check(mut((m) => { delete m.searchLimits; }));
  cases["searchLimits-without-search-strategy"] = check({ ...baseManifest(), searchLimits: { ...SL } });
  cases["mixed-strategies"] = check(mut((m) => { m.strategies = ["random-legal", "search-benchmark"]; }));
  cases["unknown-key"] = check(mut((m) => { m.searchLimits.maxDepth = 2; }));
  for (const k of Object.keys(SEARCH_LIMIT_CAPS)) cases[`missing-${k}`] = check(mut((m) => { delete m.searchLimits[k]; }));
  for (const k of Object.keys(SEARCH_LIMIT_CAPS)) cases[`cap-exceeded-${k}`] = check(mut((m) => { m.searchLimits[k] = SEARCH_LIMIT_CAPS[k] + 1; }));
  for (const k of Object.keys(SEARCH_LIMIT_CAPS)) cases[`at-cap-${k}`] = check(mut((m) => { m.searchLimits[k] = SEARCH_LIMIT_CAPS[k]; }));
  cases.zero = check(mut((m) => { m.searchLimits.maxEvaluations = 0; }));
  cases.fractional = check(mut((m) => { m.searchLimits.maxCandidates = 1.5; }));
  cases.string = check(mut((m) => { m.searchLimits.maxMsPerDecision = "500"; }));
  cases["not-an-object"] = check(mut((m) => { m.searchLimits = [1, 2, 3]; }));
  cases["old-manifest"] = check(baseManifest());
  const h = manifestHash(searchManifest());
  cases.hash = {
    coversSearchLimits: h !== manifestHash(mut((m) => { m.searchLimits.maxEvaluations = 199; })),
    keyOrderIndependent: h === manifestHash(mut((m) => { m.searchLimits = { maxMsPerDecision: 500, maxEvaluations: 200, maxCandidates: 200 }; })),
    oldManifestHashIsPlainHash: manifestHash(baseManifest()) === validateManifest(baseManifest(), IDS).manifestHash,
  };

  const dir = tmpDir();
  try {
    const mf = path.join(dir, "m.json");
    writeJson(mf, searchManifest());
    const lines = [];
    const code = await main(["--manifest", mf, "--check-only"], { approvalsFile: path.join(dir, "none.json"), labVersion: () => "e".repeat(64), botIds: IDS.botIds,
      currentBuild: () => ({ buildId: BUILD, dirty: false }), loadModules: () => { throw new Error("must not load"); }, out: (s) => lines.push(s), err: () => {} });
    cases.checkOnly = { code, lines: lines.filter((l) => /^(validation|searchLimits|battles|check-only)/.test(l)) };
  } finally { cleanup(dir); }
  return { id: ID, caps: SEARCH_LIMIT_CAPS, cases };
}
module.exports = { id: ID, run };
