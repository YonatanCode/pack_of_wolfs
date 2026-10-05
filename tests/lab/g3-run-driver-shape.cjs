"use strict";
// G3: the options run.cjs passes to the driver and report. ONLY injected fakes (driver, bots, report, load) and a temp
// approvals file with fake records; no real game load, no real bot, no real approvals. Fake driver returns canned records.
const fs = require("node:fs");
const path = require("node:path");
const { main } = require("../../tools/lab/run.cjs");
const { manifestHash } = require("../../tools/lab/manifest.cjs");
const { BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g3-run-driver-shape";

async function exec() {
  const dir = tmpDir();
  try {
    const m = baseManifest();
    m.scenarios = [{ id: "intro", seeds: [1, 2] }];
    m.strategies = ["random-legal"];
    m.limits = { maxBattles: 5, maxTurnsPerBattle: 20, maxTotalTurns: 5, maxRuntimeSeconds: 60 };
    const mf = path.join(dir, "m.json"); writeJson(mf, m);
    const ap = path.join(dir, "approvals.json");
    writeJson(ap, { playchecks: [{ buildId: BUILD, quote: "fake", recordedAt: "2000-01-01T00:00:00Z" }],
      authorizations: [{ buildId: BUILD, manifestHash: manifestHash(m), quote: "fake", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null }] });

    const FAKE_LOAD = () => { throw new Error("fake load must not be called"); };
    const FAKE_BOT = { description: "fake", decide() { throw new Error("fake bot must not be called"); } };
    const calls = []; let reportArgs = null; let consumedAtCallTime = null;
    const driver = { runBattle(o) {
      if (consumedAtCallTime === null) consumedAtCallTime = JSON.parse(fs.readFileSync(ap, "utf8")).authorizations[0].consumedAt !== null;
      calls.push({ keys: Object.keys(o).sort(), loadIsFake: o.load === FAKE_LOAD, botIsFake: o.bot === FAKE_BOT, strategy: o.strategy, scenarioId: o.scenarioId, seed: o.seed,
        preset: o.preset, limits: o.limits, botSeed: o.botSeed, fixtureOnly: o.fixtureOnly, turnsRemaining: o.turnsRemaining, deadlineMs: o.deadlineMs, nowIsFn: typeof o.now === "function" });
      return { scenarioId: o.scenarioId, seed: o.seed, strategy: o.strategy, fixtureOnly: false, result: "timeout", turns: 3 };
    } };
    const report = { buildReport(a) { reportArgs = a; return { fakeReport: true }; } };
    const lines = []; const errs = [];
    const code = await main(["--manifest", mf, "--run"], {
      approvalsFile: ap, botIds: BOT_IDS, currentBuild: () => ({ buildId: BUILD, dirty: false }), now: () => 1000,
      loadModules: () => ({ driver, bots: { BOTS: { "random-legal": FAKE_BOT } }, report, loadGame: FAKE_LOAD }),
      out: (s) => lines.push(s.replace(/consumed at \S+/, "consumed at <ts>")), err: (s) => errs.push(s),
    });
    // build changes between battles: fake build-id fn flips after the first battle's check
    writeJson(ap, { playchecks: [{ buildId: BUILD, quote: "fake", recordedAt: "2000-01-01T00:00:00Z" }],
      authorizations: [{ buildId: BUILD, manifestHash: manifestHash(m), quote: "fake", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null }] });
    let buildCalls = 0; let ran = 0; let rep2 = null;
    const lines2 = [];
    const code2 = await main(["--manifest", mf, "--run"], {
      approvalsFile: ap, botIds: BOT_IDS, now: () => 1000,
      // call 1: gate evaluation, call 2: before battle 1, call 3: before battle 2 (now changed)
      currentBuild: () => { buildCalls++; return buildCalls >= 3 ? { buildId: "f".repeat(64), dirty: false } : { buildId: BUILD, dirty: false }; },
      loadModules: () => ({ driver: { runBattle(o) { ran++; return { fixtureOnly: false, turns: 1, seed: o.seed }; } }, bots: { BOTS: { "random-legal": FAKE_BOT } }, report: { buildReport(a) { rep2 = a; return { fake: true }; } }, loadGame: FAKE_LOAD }),
      out: (s) => lines2.push(s), err: () => {},
    });
    let buildCalls2 = 0; let ran2 = 0; let rep3 = null;
    writeJson(ap, { playchecks: [{ buildId: BUILD, quote: "fake", recordedAt: "2000-01-01T00:00:00Z" }],
      authorizations: [{ buildId: BUILD, manifestHash: manifestHash(m), quote: "fake", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null }] });
    await main(["--manifest", mf, "--run"], {
      approvalsFile: ap, botIds: BOT_IDS, now: () => 1000,
      currentBuild: () => { buildCalls2++; return { buildId: BUILD, dirty: buildCalls2 >= 3 }; }, // becomes dirty before battle 2
      loadModules: () => ({ driver: { runBattle(o) { ran2++; return { fixtureOnly: false, turns: 1, seed: o.seed }; } }, bots: { BOTS: { "random-legal": FAKE_BOT } }, report: { buildReport(a) { rep3 = a; return {}; } }, loadGame: FAKE_LOAD }),
      out: () => {}, err: () => {},
    });
    const buildChange = { code: code2, battlesRun: ran, notes: rep2.notes, reportBattles: rep2.battles.length, dirtyCase: { battlesRun: ran2, notes: rep3.notes } };
    return { buildChange, code, errs, calls, consumedBeforeFirstBattle: consumedAtCallTime,
      reportArgs: { ...reportArgs, battles: reportArgs && reportArgs.battles.length }, firstOut: lines[0], stdoutLast: lines[lines.length - 1],
      authorizationAfter: JSON.parse(fs.readFileSync(ap, "utf8")).authorizations[0].consumedAt !== null };
  } finally { cleanup(dir); }
}
async function run() { return { id: ID, case: await exec() }; }
module.exports = { id: ID, run };
