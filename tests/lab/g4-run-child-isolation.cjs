"use strict";
// G4: per-battle child process isolation in run.cjs. The "child entry" is a hand-written tiny script (hang / crash / garbage / ok);
// no real driver, bot or game is loaded. Temp dirs, fake approvals. Wall clock ~1s (maxRuntimeSeconds is an integer >= 1).
const fs = require("node:fs");
const path = require("node:path");
const { main } = require("../../tools/lab/run.cjs");
const report = require("../../tools/lab/report.cjs");
const { manifestHash } = require("../../tools/lab/manifest.cjs");
const { BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g4-run-child-isolation";
const LAB = "e".repeat(64);

// Reads the job from stdin, then behaves according to G4_MODES[seed - 1].
const SCRIPT = `
let t = ""; process.stdin.on("data", (c) => t += c); process.stdin.on("end", () => {
  const job = JSON.parse(t);
  const mode = process.env.G4_MODES.split(",")[job.seed - 1];
  if (mode === "hang") { setInterval(() => {}, 1000); return; }
  if (mode === "crash") process.exit(3);
  if (mode === "garbage") { process.stdout.write("not json at all"); return; }
  process.stdout.write(JSON.stringify({ scenarioId: job.scenarioId, seed: job.seed, preset: job.preset, rulesVersion: null, rulesHash: null, strategy: job.strategy,
    botSeed: job.botSeed, fixtureOnly: false, result: "win", stopReason: "battle-end", error: null, turns: 2, perTurn: [], orders: [], replay: { query: "?q", orders: [] } }));
});`;

async function scenario(modes) {
  const dir = tmpDir();
  try {
    const m = baseManifest();
    m.scenarios = [{ id: "intro", seeds: [1, 2, 3] }];
    m.strategies = ["random-legal"];
    m.limits = { maxBattles: 5, maxTurnsPerBattle: 20, maxTotalTurns: 100, maxRuntimeSeconds: 1 };
    const mf = path.join(dir, "m.json"); writeJson(mf, m);
    const entry = path.join(dir, "child.cjs"); fs.writeFileSync(entry, SCRIPT);
    const ap = path.join(dir, "approvals.json");
    writeJson(ap, { playchecks: [{ buildId: BUILD, quote: "fake", recordedAt: "2000-01-01T00:00:00Z" }],
      authorizations: [{ buildId: BUILD, manifestHash: manifestHash(m), labVersion: LAB, quote: "fake", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null }] });
    process.env.G4_MODES = modes;
    const pids = []; const lines = []; const errs = [];
    const t0 = Date.now();
    const code = await main(["--manifest", mf, "--run"], {
      approvalsFile: ap, labVersion: () => LAB, botIds: BOT_IDS, currentBuild: () => ({ buildId: BUILD, dirty: false }),
      isolation: "child", childEntry: [entry], onSpawn: (pid) => pids.push(pid),
      loadModules: () => ({ driver: null, bots: { BOTS: {} }, report, loadGame: null }),
      out: (s) => lines.push(s), err: (s) => errs.push(s),
    });
    const elapsed = Date.now() - t0;
    const alive = pids.filter((pid) => { try { process.kill(pid, 0); return true; } catch { return false; } });
    const rep = JSON.parse(lines[lines.length - 1]);
    return { code, errs, children: pids.length, orphanChildren: alive.length, elapsedUnder3s: elapsed < 3000,
      battles: rep.battles.map((b) => ({ seed: b.seed, strategy: b.strategy, scenarioId: b.scenarioId, result: b.result, stopReason: b.stopReason, turns: b.turns, error: b.error })),
      notes: rep.notes };
  } finally { delete process.env.G4_MODES; cleanup(dir); }
}

async function run() {
  return { id: ID, hangKilled: await scenario("ok,hang,ok"), crashAndGarbage: await scenario("crash,garbage,ok"), allOk: await scenario("ok,ok,ok") };
}
module.exports = { id: ID, run };
