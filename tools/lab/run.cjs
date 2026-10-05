"use strict";
/*
 * Battle Lab runner CLI.
 *   node tools/lab/run.cjs --manifest <file> --check-only [--approvals <path>]
 *   node tools/lab/run.cjs --manifest <file> --run        [--approvals <path>]
 * --check-only validates and reports gate status; it never loads or runs the driver/bots.
 * --run refuses (exit 2, specific reason) unless every gate passes, consumes the single-use authorization BEFORE
 * starting, and enforces maxRuntimeSeconds on the wall clock. Exit codes: 0 ok, 2 refused/invalid.
 * Gates, in order: manifest valid; build ID equals manifest.buildId; gameplay tree clean; playcheck for the exact build;
 * unconsumed authorization for exact build + manifestHash.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync, spawn } = require("node:child_process");
const { validateManifest } = require("./manifest.cjs");
const { loadApprovals, checkApprovals, consumeAuthorization } = require("./approvals.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_APPROVALS = path.join(ROOT, "lab", "approvals.json");

/** Current gameplay build via tools/build-id.mjs (same logic as the recorded build IDs). -> { buildId, dirty } */
function defaultCurrentBuild() {
  const text = execFileSync(process.execPath, [path.join(ROOT, "tools", "build-id.mjs")], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const j = JSON.parse(text);
  return { buildId: j.buildId, dirty: j.gameplayPathsDirty };
}

const LAB_FILES = ["driver", "bots", "manifest", "approvals", "run", "report", "metrics"].map((n) => `${n}.cjs`);

/** labVersion: sha256 over (name, bytes) of the Lab tooling files, sorted. A missing file hashes as "missing" (so adding it changes the version). */
function computeLabVersion(dir = __dirname) {
  const h = crypto.createHash("sha256");
  for (const name of [...LAB_FILES].sort()) {
    let bytes = null;
    try { bytes = fs.readFileSync(path.join(dir, name)); } catch (e) { if (!e || e.code !== "ENOENT") throw e; }
    h.update(`${name.length}:${name}\0${bytes ? bytes.length : "missing"}\0`);
    if (bytes) h.update(bytes);
  }
  return h.digest("hex");
}

/** Lazy: only called on the --run path after every gate passed. */
function defaultLoadModules() {
  return {
    driver: require("./driver.cjs"),
    bots: require("./bots.cjs"),
    report: require("./report.cjs"),
    loadGame: require("../../tests/harness/load-game.cjs").loadGame,
  };
}

function parseArgs(argv) {
  const a = { manifest: null, checkOnly: false, run: false, approvals: null, errors: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--check-only") a.checkOnly = true;
    else if (t === "--run") a.run = true;
    else if (t === "--manifest" || t === "--approvals") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) a.errors.push(`${t} needs a value`);
      else a[t.slice(2)] = v;
    } else a.errors.push(`unknown argument: ${t}`);
  }
  if (a.checkOnly === a.run) a.errors.push("exactly one of --check-only or --run is required");
  if (!a.manifest) a.errors.push("--manifest <file> is required");
  return a;
}

/** Evaluate every gate. Pure with respect to the game: reads files and asks currentBuild(). -> { manifest, v, gates } */
function evaluateGates(args, deps) {
  const gates = [];
  const add = (name, ok, reason) => gates.push({ name, ok, reason });
  let manifest = null;
  let v = { valid: false, errors: [], battles: 0, limits: null, manifestHash: null };
  try {
    manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
    const vo = {};
    if (deps.botIds !== undefined) vo.botIds = deps.botIds;
    if (deps.gameValues !== undefined) vo.gameValues = deps.gameValues;
    v = validateManifest(manifest, vo);
  } catch (e) {
    v.errors = [`cannot read manifest: ${e.message}`];
  }
  add("manifest", v.valid, v.valid ? "manifest valid" : `manifest invalid: ${v.errors.join("; ")}`);

  let build = null;
  try { build = deps.currentBuild(); } catch (e) { add("build-id", false, `cannot compute current build ID: ${e.message}`); }
  if (build) {
    if (!v.valid) add("build-id", false, "not evaluated (manifest invalid)");
    else if (build.buildId !== manifest.buildId) add("build-id", false, `stale build: manifest.buildId ${manifest.buildId} != current ${build.buildId}`);
    else add("build-id", true, "manifest.buildId equals current gameplay build ID");
    if (build.dirty === true) add("clean-tree", false, "gameplay tree is dirty (uncommitted changes in gameplay paths)");
    else if (build.dirty === null || build.dirty === undefined) add("clean-tree", false, "gameplay tree state unknown (not a git checkout?)");
    else add("clean-tree", true, "gameplay tree clean");
  } else {
    add("clean-tree", false, "not evaluated (build ID unavailable)");
  }

  let labVersion = null;
  try { labVersion = deps.labVersion(); } catch (e) { labVersion = null; }
  const file = args.approvals || DEFAULT_APPROVALS;
  const loaded = loadApprovals(file);
  if (!loaded.ok) {
    add("playcheck", false, loaded.error);
    add("authorization", false, loaded.error);
  } else if (!v.valid || !build) {
    add("playcheck", false, "not evaluated (manifest or build ID unavailable)");
    add("authorization", false, "not evaluated (manifest or build ID unavailable)");
  } else {
    // Approvals are matched against the CURRENT build and the manifest hash, never against a build the manifest merely claims.
    const st = checkApprovals(loaded.data, build.buildId, v.manifestHash, labVersion);
    add("playcheck", st.playcheck.ok, st.playcheck.reason);
    add("authorization", st.authorization.ok, st.authorization.reason);
  }
  return { manifest, v, gates, build, labVersion, approvalsFile: file };
}

const MAX_CHILD_OUTPUT = 64 * 1024 * 1024;
const DEFAULT_CHILD_ENTRY = [__filename, "--worker"];

/** A BattleRecord-shaped record for a battle the runner could not complete (killed child, crash, bad output). */
function syntheticRecord(job, result, stopReason, error) {
  return {
    scenarioId: job.scenarioId, seed: job.seed, preset: job.preset, rulesVersion: null, rulesHash: null,
    strategy: job.strategy, botSeed: job.botSeed, fixtureOnly: false,
    result, stopReason, error, turns: 0, perTurn: [], orders: [],
    replay: { query: `?scenario=${encodeURIComponent(job.scenarioId)}&seed=${job.seed}&preset=${encodeURIComponent(job.preset)}`, orders: [] },
  };
}

/**
 * Run one battle in a child process (node built-ins only). Job JSON goes in on stdin, the BattleRecord JSON comes out on stdout.
 * The child is SIGKILLed at `remainingMs`. Never throws. -> { record, killed }
 */
function runInChild(job, { childEntry, remainingMs, onSpawn }) {
  return new Promise((resolve) => {
    let done = false;
    let killed = false;
    const chunks = []; let size = 0; let stderrText = "";
    const finish = (record) => { if (!done) { done = true; clearTimeout(timer); resolve({ record, killed }); } };
    let child;
    try {
      child = spawn(process.execPath, childEntry, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) { resolve({ record: syntheticRecord(job, "error", "child-spawn-failed", String(e && e.message || e)), killed: false }); return; }
    if (onSpawn) onSpawn(child.pid);
    const timer = setTimeout(() => { killed = true; try { child.kill("SIGKILL"); } catch { /* already gone */ } }, Math.max(0, remainingMs));
    child.stdout.on("data", (c) => { size += c.length; if (size <= MAX_CHILD_OUTPUT) chunks.push(c); else { try { child.kill("SIGKILL"); } catch { /* gone */ } } });
    child.stderr.on("data", (c) => { if (stderrText.length < 2000) stderrText += c.toString("utf8"); });
    child.on("error", (e) => finish(syntheticRecord(job, "error", "child-spawn-failed", String(e && e.message || e))));
    child.stdin.on("error", () => { /* child died before reading the job */ });
    child.on("close", (code, signal) => {
      if (killed) return finish(syntheticRecord(job, "timeout", "runtime-deadline-killed", null));
      if (code !== 0) return finish(syntheticRecord(job, "error", "child-crash", `child exited with ${signal ? `signal ${signal}` : `code ${code}`}${stderrText ? `: ${stderrText.trim().split("\n")[0].slice(0, 200)}` : ""}`));
      let rec;
      try { rec = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { rec = null; }
      if (!rec || typeof rec !== "object" || Array.isArray(rec) || typeof rec.result !== "string") return finish(syntheticRecord(job, "error", "child-bad-output", "child produced no valid BattleRecord JSON"));
      finish(rec);
    });
    child.stdin.end(JSON.stringify(job));
  });
}

/** Child entry for real runs: `node run.cjs --worker`. Reads the job from stdin, runs the driver, prints the record. */
async function workerMain() {
  let text = "";
  for await (const c of process.stdin) text += c;
  const job = JSON.parse(text);
  const driver = require("./driver.cjs");
  const { BOTS } = require("./bots.cjs");
  const { loadGame } = require("../../tests/harness/load-game.cjs");
  const rec = driver.runBattle({
    load: loadGame, bot: BOTS[job.strategy], strategy: job.strategy, scenarioId: job.scenarioId, seed: job.seed, preset: job.preset,
    limits: job.limits, botSeed: job.botSeed, fixtureOnly: false, turnsRemaining: job.turnsRemaining, deadlineMs: Date.now() + job.remainingMs, now: Date.now,
  });
  process.stdout.write(JSON.stringify(rec));
}

async function execute(manifest, v, mods, startedMs, now, currentBuild, iso) {
  const { driver, bots, report, loadGame } = mods;
  const L = manifest.limits;
  const deadline = startedMs + L.maxRuntimeSeconds * 1000;
  const records = [];
  const notes = [];
  let totalTurns = 0;
  let stopped = null;
  let killedCount = 0;
  outer:
  for (const sc of manifest.scenarios) {
    for (const seed of sc.seeds) {
      for (const strategy of manifest.strategies) {
        let b = null;
        try { b = currentBuild(); } catch { /* treated as changed */ }
        if (!b || b.buildId !== manifest.buildId || b.dirty !== false) { stopped = "aborted: gameplay build changed after authorization"; break outer; }
        if (now() >= deadline) { stopped = "runtime deadline"; break outer; }
        if (totalTurns >= L.maxTotalTurns) { stopped = `maxTotalTurns ${L.maxTotalTurns} reached`; break outer; }
        let rec;
        if (iso.mode === "child") {
          const job = { scenarioId: sc.id, seed, preset: manifest.preset, strategy, limits: { ...L }, botSeed: manifest.botSeed,
            turnsRemaining: L.maxTotalTurns - totalTurns, remainingMs: deadline - now() };
          const r = await runInChild(job, { childEntry: iso.childEntry, remainingMs: job.remainingMs, onSpawn: iso.onSpawn });
          rec = r.record;
          if (r.killed) { records.push(rec); killedCount++; stopped = "runtime deadline"; break outer; }
        } else {
          rec = await driver.runBattle({
            load: loadGame, bot: bots.BOTS[strategy], strategy, scenarioId: sc.id, seed, preset: manifest.preset,
            limits: { ...L }, botSeed: manifest.botSeed, fixtureOnly: false,
            turnsRemaining: L.maxTotalTurns - totalTurns, deadlineMs: deadline, now,
          });
        }
        records.push(rec);
        totalTurns += rec.turns || 0;
      }
    }
  }
  if (stopped) notes.push(`${stopped.startsWith("aborted:") ? stopped : `stopped early: ${stopped}`}; ${records.length - killedCount} of ${v.battles} battles completed`);
  return report.buildReport({ manifestHash: v.manifestHash, buildId: manifest.buildId, battles: records, notes, fixtureOnly: false });
}

/** main(argv, deps) -> exit code. deps (all optional, for tests): currentBuild, loadModules, botIds, out, err, now. */
async function main(argv, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s + "\n"));
  const err = deps.err || ((s) => process.stderr.write(s + "\n"));
  const d = { labVersion: deps.labVersion || (() => computeLabVersion()), currentBuild: deps.currentBuild || defaultCurrentBuild, loadModules: deps.loadModules || defaultLoadModules, botIds: deps.botIds, now: deps.now || Date.now };
  const args = parseArgs(argv);
  if (args.errors.length) { err(`usage error: ${args.errors.join("; ")}`); return 2; }

  if (args.run && args.approvals && !deps.approvalsFile) {
    err("REFUSED (approvals path): --approvals is not honoured with --run; --run always uses lab/approvals.json (the flag is for --check-only only)");
    return 2;
  }
  if (deps.approvalsFile) args.approvals = deps.approvalsFile;
  const ev = evaluateGates(args, d);
  const failed = ev.gates.filter((g) => !g.ok);

  if (args.checkOnly) {
    out(`manifest: ${args.manifest}`);
    out(`validation: ${ev.v.valid ? "VALID" : "INVALID"}`);
    ev.v.errors.forEach((e) => out(`  error: ${e}`));
    out(`battles: ${ev.v.battles}`);
    out(`limits: ${ev.v.limits ? JSON.stringify(ev.v.limits) : "n/a"}`);
    out(`manifestHash: ${ev.v.manifestHash || "n/a"}`);
    out(`labVersion: ${ev.labVersion || "unavailable"}`);
    out(`current build ID: ${ev.build ? ev.build.buildId : "unavailable"}`);
    ev.gates.forEach((g) => out(`gate ${g.name}: ${g.ok ? "PASS" : "FAIL"} - ${g.reason}`));
    out("check-only: nothing was run");
    return ev.v.valid ? 0 : 2;
  }

  if (failed.length) {
    failed.forEach((g) => err(`REFUSED (${g.name}): ${g.reason}`));
    return 2;
  }

  // Load driver/bots/report BEFORE consuming so a missing module does not burn the authorization.
  let mods;
  try { mods = d.loadModules(); } catch (e) { err(`REFUSED (runner modules): cannot load driver/bots/report: ${e.message}`); return 2; }

  const consumed = consumeAuthorization(ev.approvalsFile, ev.build.buildId, ev.v.manifestHash, ev.labVersion);
  if (!consumed.ok) { err(`REFUSED (authorization): ${consumed.reason}`); return 2; }
  out(`authorization consumed at ${consumed.consumedAt}; starting ${ev.v.battles} battles (maxRuntimeSeconds ${ev.manifest.limits.maxRuntimeSeconds})`);

  try {
    const iso = { mode: deps.isolation || (deps.loadModules ? "inprocess" : "child"), childEntry: deps.childEntry || DEFAULT_CHILD_ENTRY, onSpawn: deps.onSpawn };
    const result = await execute(ev.manifest, ev.v, mods, d.now(), d.now, d.currentBuild, iso);
    out(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    err(`run failed after authorization was consumed: ${e && e.stack ? e.stack : e}`);
    return 2;
  }
}

module.exports = { main, evaluateGates, parseArgs, DEFAULT_APPROVALS, computeLabVersion, runInChild, workerMain };

if (require.main === module) {
  if (process.argv[2] === "--worker") workerMain().then(() => process.exit(0), (e) => { process.stderr.write(String(e && e.stack || e) + "\n"); process.exit(1); });
  else main(process.argv.slice(2)).then((c) => process.exit(c));
}
