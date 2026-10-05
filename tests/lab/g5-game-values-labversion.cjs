"use strict";
// G5: scenario/preset validation against static game values, and labVersion computation. Hand-authored; nothing is run.
const fs = require("node:fs");
const path = require("node:path");
const { main, computeLabVersion } = require("../../tools/lab/run.cjs");
const { loadGameValues, validateManifest, manifestHash } = require("../../tools/lab/manifest.cjs");
const { BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g5-game-values-labversion";
const LAB = "e".repeat(64);

async function refused(mutate) {
  const dir = tmpDir();
  try {
    const m = baseManifest(); mutate(m);
    const mf = path.join(dir, "m.json"); writeJson(mf, m);
    const ap = path.join(dir, "a.json");
    writeJson(ap, { playchecks: [{ buildId: BUILD, quote: "fake", recordedAt: "2000-01-01T00:00:00Z" }],
      authorizations: [{ buildId: BUILD, manifestHash: manifestHash(baseManifest()), labVersion: LAB, quote: "fake", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null }] });
    const before = fs.readFileSync(ap, "utf8");
    const errs = []; const lines = []; let loads = 0;
    const deps = { approvalsFile: ap, labVersion: () => LAB, botIds: BOT_IDS, currentBuild: () => ({ buildId: BUILD, dirty: false }), loadModules: () => { loads++; throw new Error("no"); } };
    const code = await main(["--manifest", mf, "--run"], { ...deps, out: () => {}, err: (s) => errs.push(s) });
    const chk = await main(["--manifest", mf, "--check-only"], { ...deps, out: (s) => lines.push(s), err: () => {} });
    return { code, errs: errs.slice(0, 1), moduleLoads: loads, authorizationUntouched: fs.readFileSync(ap, "utf8") === before, checkOnlyCode: chk, checkOnlyValidation: lines.filter((l) => /^(validation|  error)/.test(l)) };
  } finally { cleanup(dir); }
}

async function run() {
  const out = {};
  // Fails (diff) if the game's supported lists change: review the manifest validation when that happens.
  out.gameValues = loadGameValues();
  out.typoScenario = await refused((m) => { m.scenarios[0].id = "intr0"; });
  out.typoPreset = await refused((m) => { m.preset = "comander"; });
  out.both = await refused((m) => { m.scenarios[0].id = "intr0"; m.preset = "comander"; });
  out.realValuesAccepted = validateManifest(baseManifest(), { botIds: BOT_IDS }).valid;

  // labVersion over a temp copy of the file set
  const dir = tmpDir();
  try {
    const names = ["driver", "bots", "manifest", "approvals", "run", "report", "metrics"].map((n) => `${n}.cjs`);
    names.forEach((n, i) => fs.writeFileSync(path.join(dir, n), `// file ${i}\n`));
    const v1 = computeLabVersion(dir);
    const v1b = computeLabVersion(dir);
    fs.appendFileSync(path.join(dir, "bots.cjs"), "x");
    const v2 = computeLabVersion(dir);
    fs.rmSync(path.join(dir, "metrics.cjs"));
    const v3 = computeLabVersion(dir);
    out.labVersion = { hex64: /^[0-9a-f]{64}$/.test(v1), stable: v1 === v1b, changesWithContent: v1 !== v2, changesWhenFileMissing: v2 !== v3 };
  } finally { cleanup(dir); }
  out.realLabVersionIsHex64 = /^[0-9a-f]{64}$/.test(computeLabVersion());
  return { id: ID, ...out };
}
module.exports = { id: ID, run };
