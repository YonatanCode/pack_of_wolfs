"use strict";
// CHARACTERIZATION — records CURRENT behaviour, not desired behaviour
/*
 * BASELINE of the game's built-in DEV_TEST_SCENARIOS, measured headlessly (see harness/load-game.cjs).
 * Records CURRENT behaviour. One fresh vm context per scenario (no state leakage), Math.random seeded.
 * Usage: node tests/baseline/run-dev-scenarios.cjs   -> writes tests/baseline/dev-scenarios.json
 * Exported run() returns the same object without writing (used by tests/run-all.cjs).
 */
const fs = require("node:fs");
const path = require("node:path");
const { loadGame } = require("../harness/load-game.cjs");
const { plain, stableStringify } = require("../harness/util.cjs");

const OUT = path.join(__dirname, "dev-scenarios.json");
const LABEL = "CHARACTERIZATION — records CURRENT behaviour, not desired behaviour";

// Scenarios known to fail on the current game, each measured (not a harness limit). run-all fails if the
// set of failing ids differs from these keys. Cause common to all four: planEnemyPackTurn only plans an
// Attack when a wolf is ALREADY adjacent to a player at its planned position, so with the default
// grid 16 / 3-wolf spawns (enemies row 0, players row 15) the 2 Attack slots go unused and the queue
// stops at 3 entries; the scenarios were written for a tighter layout.
const KNOWN_FAILURES = {
  "pack-action-cap": { classification: "fails-measured", reason: "expects 5 queued entries; planner emits 3 (E3 Move, E1 Move, E2 Defend) because no wolf is adjacent on grid 16 so Attack is never planned." },
  "pack-attack-non-focus-adjacent": { classification: "fails-measured", reason: "hard-coded positions assume a small grid; on grid 16 the flank wolf is not adjacent to anyone so no Attack is planned (passes at grid 8 and 10)." },
  "pack-multi-tick": { classification: "fails-measured", reason: "expects enemy.row > 0 after the turn; E1 only gets Defend (stale 3-wolf default spacing), so it stays at row 0." },
  "pack-one-enemy": { classification: "fails-measured", reason: "expects every entry from the unit at (0,4); queue is M@0,4 M@0,4 D@0,7, so the unit at (0,7) appears (stale default spawn layout)." },
};

async function run() {
  const listing = loadGame();
  const scenarios = plain(listing.ev("window.devTest.scenarios"));
  const results = [];
  for (const { id, label } of scenarios) {
    const game = loadGame();
    const rec = { id, label, passed: false, error: null, timedOut: false, frameCapped: false, usage: null, state: null };
    try {
      const r = await game.runLimited(() => game.ev(`window.devTest.runScenario(${JSON.stringify(id)})`));
      rec.passed = r.passed === true;
      rec.state = plain(r.state);
    } catch (e) {
      rec.error = String(e && e.message ? e.message : e);
      rec.timedOut = rec.error === "timeout";
      rec.frameCapped = rec.error === "frame-cap";
      try { rec.state = plain(game.ev("window.devTest.state()")); } catch (_) { /* leave null */ }
    }
    rec.usage = game.usage();
    if (KNOWN_FAILURES[id]) rec.classification = KNOWN_FAILURES[id].classification;
    results.push(rec);
  }
  return { characterization: LABEL, generatedBy: "tests/baseline/run-dev-scenarios.cjs", seed: "0xC0FFEE", total: results.length,
    passedCount: results.filter((r) => r.passed).length,
    maxSteps: Math.max(...results.map((r) => r.usage.steps)), stepCap: results[0].usage.cap,
    knownFailures: KNOWN_FAILURES, scenarios: results };
}

module.exports = { run, OUT, KNOWN_FAILURES, LABEL };

if (require.main === module) {
  run().then((res) => {
    fs.writeFileSync(OUT, stableStringify(res));
    for (const r of res.scenarios) console.log((r.passed ? "PASS " : "FAIL ") + r.id + (r.error ? "  [" + r.error + "]" : ""));
    console.log(`${res.passedCount}/${res.total} passed -> ${path.relative(process.cwd(), OUT)}`);
  });
}
