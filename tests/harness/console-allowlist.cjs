"use strict";
/*
 * THE ONLY place where console output / exceptions from game code may be tolerated by run-all.
 * Each entry: { fixture, kind, message, reason }
 *   fixture  exact fixture id ("baseline-dev-scenarios", "c3-...", "r2-...") 
 *   kind     "console.error" | "console.warn" | "uncaughtException" | "unhandledRejection"
 *   message  EXACT message text (as recorded, whitespace collapsed, max 200 chars)
 *   reason   REQUIRED one-line justification. Only "stub-DOM limitation" entries are acceptable;
 *            a message that looks like a real game error must be fixed/reported, never listed here.
 * Unused entries fail run-all (so the list cannot rot).
 */
const ALLOWLIST = [
];

for (const e of ALLOWLIST) {
  if (!e.fixture || !e.kind || !e.message || !e.reason || !String(e.reason).trim()) {
    throw new Error("console-allowlist: every entry needs fixture, kind, message and a one-line reason: " + JSON.stringify(e));
  }
}
module.exports = { ALLOWLIST };
