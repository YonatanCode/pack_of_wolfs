"use strict";
// G1: manifest schema validation. Pure functions on hand-authored manifests; nothing is run.
const { validateManifest, manifestHash, LIMIT_CAPS } = require("../../tools/lab/manifest.cjs");
const { BOT_IDS, baseManifest } = require("./_g.cjs");

const ID = "g1-manifest";
const check = (m) => { const r = validateManifest(m, { botIds: BOT_IDS }); return { valid: r.valid, battles: r.battles, errors: r.errors, hasHash: !!r.manifestHash }; };
const mut = (f) => { const m = baseManifest(); f(m); return m; };

async function run() {
  const cases = {};
  cases.valid = check(baseManifest());
  for (const k of Object.keys(LIMIT_CAPS)) cases[`missing-${k}`] = check(mut((m) => { delete m.limits[k]; }));
  for (const k of Object.keys(LIMIT_CAPS)) cases[`cap-exceeded-${k}`] = check(mut((m) => { m.limits[k] = LIMIT_CAPS[k] + 1; }));
  cases["at-cap-maxTurnsPerBattle"] = check(mut((m) => { m.limits.maxTurnsPerBattle = LIMIT_CAPS.maxTurnsPerBattle; }));
  cases["zero-limit"] = check(mut((m) => { m.limits.maxTotalTurns = 0; }));
  cases["fractional-limit"] = check(mut((m) => { m.limits.maxTotalTurns = 1.5; }));
  cases["unknown-top-key"] = check(mut((m) => { m.extra = 1; }));
  cases["unknown-limit-key"] = check(mut((m) => { m.limits.maxFoo = 1; }));
  cases["unknown-scenario-key"] = check(mut((m) => { m.scenarios[0].extra = 1; }));
  cases["missing-limits-object"] = check(mut((m) => { delete m.limits; }));
  cases["battles-over-maxBattles"] = check(mut((m) => { m.limits.maxBattles = 5; })); // 3 seeds x 2 strategies = 6
  cases["battles-exactly-maxBattles"] = check(mut((m) => { m.limits.maxBattles = 6; }));
  cases["unknown-strategy"] = check(mut((m) => { m.strategies.push("nope"); }));
  cases["duplicate-strategy"] = check(mut((m) => { m.strategies = ["random-legal", "random-legal"]; }));
  cases["empty-seeds"] = check(mut((m) => { m.scenarios[0].seeds = []; }));
  cases["bad-buildId"] = check(mut((m) => { m.buildId = "xyz"; }));
  cases["bad-schemaVersion"] = check(mut((m) => { m.schemaVersion = 2; }));
  cases["not-an-object"] = check([]);
  cases["no-bot-registry"] = (() => { const r = validateManifest(baseManifest(), { botIds: null }); return { valid: r.valid, errors: r.errors }; })();
  const a = baseManifest();
  const b = { botSeed: 7, limits: { maxRuntimeSeconds: 60, maxTotalTurns: 200, maxTurnsPerBattle: 20, maxBattles: 10 }, strategies: a.strategies, scenarios: a.scenarios, preset: "commander", buildId: a.buildId, label: a.label, schemaVersion: 1 };
  cases.hash = { keyOrderIndependent: manifestHash(a) === manifestHash(b), changesWithContent: manifestHash(a) !== manifestHash(mut((m) => { m.botSeed = 8; })), length: manifestHash(a).length };
  return { id: ID, caps: LIMIT_CAPS, cases };
}
module.exports = { id: ID, run };
