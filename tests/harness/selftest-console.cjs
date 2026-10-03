"use strict";
/*
 * Negative self-test of the console capture: a scratch context provokes console.error, console.warn,
 * a throw inside a timer and an unhandled promise rejection; the harness MUST record all four.
 * The provoked events are drained here, so they never reach run-all's per-fixture check and nothing
 * is added to the allowlist. run-all treats any failure here as a failed check.
 */
const { loadGame, drainConsole, setFixtureLabel } = require("./load-game.cjs");

async function run() {
  setFixtureLabel("selftest-console");
  drainConsole();
  const g = loadGame({ label: "selftest-console" });
  drainConsole(); // anything the boot itself emitted is not part of this test
  g.ev("console.error('selftest error', 42)");
  g.ev("console.warn('selftest warn')");
  g.ev("setTimeout(() => { throw new Error('selftest timer throw'); }, 5)");
  g.ev("Promise.reject(new Error('selftest rejection'))");
  await g.runLimited(() => new Promise((r) => setTimeout(r, 0)));
  await new Promise((r) => setImmediate(r));
  const events = drainConsole();
  const want = [
    ["console.error", "selftest error 42"],
    ["console.warn", "selftest warn"],
    ["uncaughtException", "selftest timer throw"],
    ["unhandledRejection", "selftest rejection"],
  ];
  const problems = want.filter(([kind, message]) => !events.some((e) => e.kind === kind && e.message === message && e.fixture === "selftest-console"))
    .map(([kind, message]) => `harness failed to record ${kind}: "${message}"`);
  return { problems, recorded: events.map((e) => e.kind) };
}
module.exports = { run };
