"use strict";
/*
 * Runs the dev-scenario baseline + every characterization fixture, compares with stored goldens,
 * prints a PASS/DIFF table, exits non-zero on any diff.
 *   node tests/run-all.cjs            compare
 *   node tests/run-all.cjs --update   rewrite goldens (baseline/dev-scenarios.json + characterization/goldens/*.json)
 * Output contains no timings, so repeated runs are byte-identical.
 */
const fs = require("node:fs");
const path = require("node:path");
const { stableStringify } = require("./harness/util.cjs");
const baseline = require("./baseline/run-dev-scenarios.cjs");
const { drainUsage } = require("./harness/load-game.cjs");

const UPDATE = process.argv.includes("--update");
const CHAR_DIR = path.join(__dirname, "characterization");
const GOLDEN_DIR = path.join(CHAR_DIR, "goldens");

function firstDiffs(a, b, p = "$", out = [], limit = 5) {
  if (out.length >= limit) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) firstDiffs(a[k], b[k], `${p}.${k}`, out, limit);
  } else {
    out.push(`${p}: golden=${JSON.stringify(a)?.slice(0, 80)} actual=${JSON.stringify(b)?.slice(0, 80)}`);
  }
  return out;
}

function baselineProblems(result) {
  const problems = [];
  const capped = result.scenarios.filter((r) => r.timedOut || r.frameCapped).map((r) => `${r.id}(${r.error})`);
  if (capped.length) problems.push(`cap/timeout hit: ${capped.join(", ")}`);
  const failing = result.scenarios.filter((r) => !r.passed).map((r) => r.id).sort();
  const known = Object.keys(baseline.KNOWN_FAILURES).sort();
  const unexpected = failing.filter((id) => !known.includes(id));
  const fixed = known.filter((id) => !failing.includes(id));
  if (unexpected.length) problems.push(`NEW failing scenarios not in knownFailures: ${unexpected.join(", ")}`);
  if (fixed.length) problems.push(`knownFailures now PASS (update knownFailures in run-dev-scenarios.cjs): ${fixed.join(", ")}`);
  return problems;
}

async function main() {
  const jobs = [{ id: "baseline-dev-scenarios", file: baseline.OUT, run: baseline.run, check: baselineProblems }];
  const fixtureFiles = fs.readdirSync(CHAR_DIR).filter((f) => /^c\d.*\.cjs$/.test(f)).sort();
  const fixtureIds = new Set();
  fixtureFiles.forEach((f) => {
    const m = require(path.join(CHAR_DIR, f));
    fixtureIds.add(m.id);
    jobs.push({ id: m.id, file: path.join(GOLDEN_DIR, `${m.id}.json`), run: m.run, withUsage: true, fixtureFile: f });
  });
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });

  const rows = [];
  let failed = false;
  const orphans = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json") && !fixtureIds.has(f.slice(0, -5)));
  orphans.forEach((f) => {
    failed = true;
    rows.push({ id: `goldens/${f}`, status: "DIFF", detail: "orphan golden: no fixture file declares this id (delete the golden or add the fixture)" });
  });

  for (const job of jobs) {
    let status; let detail = "";
    try {
      drainUsage();
      const result = await job.run();
      if (job.withUsage) result.usage = drainUsage();
      const problems = job.check ? job.check(result) : [];
      const text = stableStringify(result);
      if (problems.length) {
        status = "DIFF"; detail = problems.join("\n      ");
      } else if (UPDATE) {
        fs.writeFileSync(job.file, text);
        status = "UPDATED";
      } else if (!fs.existsSync(job.file)) {
        status = "DIFF"; detail = job.fixtureFile ? `fixture ${job.fixtureFile} has no golden (run with --update)` : "missing golden";
      } else {
        const golden = fs.readFileSync(job.file, "utf8");
        if (golden === text) status = "PASS";
        else { status = "DIFF"; detail = firstDiffs(JSON.parse(golden), JSON.parse(text)).join("\n      "); }
      }
      job.usage = result.usage ?? { maxSteps: result.maxSteps, cap: result.stepCap };
    } catch (e) {
      status = "DIFF";
      const msg = e && e.message ? e.message : String(e);
      detail = (msg === "frame-cap" || msg === "timeout" || /timed out/.test(msg) ? `CAP/TIMEOUT HIT (${msg})` : "ERROR " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
    }
    if (status === "DIFF") failed = true;
    rows.push({ id: job.id, status, detail, usage: job.usage });
  }
  const w = Math.max(...rows.map((r) => r.id.length));
  console.log(`${"FIXTURE".padEnd(w)}  RESULT   MAX-STEPS/CAP`);
  rows.forEach((r) => {
    const u = r.usage ? `${r.usage.maxSteps}/${r.usage.cap}` : "-";
    console.log(`${r.id.padEnd(w)}  ${r.status.padEnd(7)}  ${u}`);
    if (r.detail) console.log("      " + r.detail);
  });
  console.log(failed ? "\nRESULT: DIFF" : UPDATE ? "\nRESULT: goldens updated" : "\nRESULT: all match goldens");
  process.exit(failed ? 1 : 0);
}
main();
