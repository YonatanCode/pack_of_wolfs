"use strict";
/*
 * Battle Lab report (L2, dev-only). tools/lab/CONTRACT.md "Report".
 *
 * buildReport({ manifestHash, buildId, battles, notes?, fixtureOnly? }) -> report (also exported as assembleReport):
 *   { schemaVersion: 1, manifestHash, buildId, rulesHash, fixtureOnly, battles, summary, notes }
 *   - rulesHash: the one rulesHash shared by every battle (null with no battles or when no battle got as far as booting);
 *     battles under different rules hashes are refused (TypeError).
 *   - fixtureOnly: every battle must agree with it (default: taken from the battles; mixed fixture / real battles are
 *     refused). A fixture report gets a leading FIXTURE note, and manifestHash / buildId may be any label string;
 *     a real report needs 64-hex values.
 *   - summary: metrics.summarize(battles). A note is added for every strategy with n < 30 (the interval is wide).
 *   - Deterministic: no wall-clock time, host or path inside the report; battles keep their given order.
 *   Any other key passed in (e.g. the manifest itself) is ignored.
 * canonicalJson(value): sorted-key compact JSON; refuses undefined, functions, symbols, bigints and non-finite numbers.
 * serializeReport(report): sorted-key JSON, 2-space indent, trailing newline (byte-identical for equal reports).
 * reportHash(report): sha256 hex of canonicalJson(report).
 */
const crypto = require("node:crypto");
const { summarize } = require("./metrics.cjs");

const SMALL_N = 30;
const HEX64 = /^[0-9a-f]{64}$/;
const FIXTURE_NOTE = "FIXTURE ONLY: hand-authored scripted battles; these numbers say nothing about the game or any strategy.";

function sortKeys(value, path = "$") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number at ${path}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => sortKeys(v, `${path}[${i}]`));
  if (typeof value === "object") {
    const out = {};
    Object.keys(value).sort().forEach((k) => { out[k] = sortKeys(value[k], `${path}.${k}`); });
    return out;
  }
  throw new TypeError(`canonicalJson: ${typeof value} at ${path} is not plain data`);
}

const canonicalJson = (value) => JSON.stringify(sortKeys(value));
const serializeReport = (report) => `${JSON.stringify(sortKeys(report), null, 2)}\n`;
const reportHash = (report) => crypto.createHash("sha256").update(canonicalJson(report)).digest("hex");

function buildReport({ manifestHash, buildId, battles, notes = [], fixtureOnly } = {}) {
  if (!Array.isArray(battles)) throw new TypeError("buildReport: battles must be an array");
  if (!Array.isArray(notes) || notes.some((n) => typeof n !== "string")) throw new TypeError("buildReport: notes must be an array of strings");
  const flags = [...new Set(battles.map((b) => b && b.fixtureOnly))];
  if (flags.some((f) => typeof f !== "boolean")) throw new TypeError("buildReport: every battle needs a boolean fixtureOnly");
  if (flags.length > 1) throw new TypeError("buildReport: fixture and real battles cannot share a report");
  const fixture = fixtureOnly ?? (flags.length ? flags[0] : false);
  if (typeof fixture !== "boolean") throw new TypeError("buildReport: fixtureOnly must be a boolean");
  if (flags.length && flags[0] !== fixture) throw new TypeError(`buildReport: fixtureOnly ${fixture} disagrees with the battles (${flags[0]})`);
  const label = (name, v) => {
    if (fixture ? typeof v !== "string" || !v : !HEX64.test(String(v))) {
      throw new TypeError(`buildReport: ${name} must be ${fixture ? "a non-empty string" : "64 lowercase hex characters"}`);
    }
  };
  label("manifestHash", manifestHash);
  label("buildId", buildId);

  const hashes = [...new Set(battles.map((b) => b.rulesHash).filter((h) => h !== null && h !== undefined))];
  if (hashes.length > 1) throw new TypeError(`buildReport: battles ran under different rules hashes (${hashes.sort().join(", ")})`);

  const summary = summarize(battles);
  const derived = [];
  if (fixture) derived.push(FIXTURE_NOTE);
  Object.entries(summary).forEach(([strategy, s]) => {
    if (s.n < SMALL_N) derived.push(`small sample: ${strategy} n=${s.n}, win rate 95% interval [${s.winRateWilson95[0]}, ${s.winRateWilson95[1]}]`);
  });

  const report = {
    schemaVersion: 1,
    manifestHash,
    buildId,
    rulesHash: hashes.length ? hashes[0] : null,
    fixtureOnly: fixture,
    battles: JSON.parse(canonicalJson(battles)),
    summary,
    notes: [...derived, ...notes],
  };
  canonicalJson(report); // refuses anything that is not plain data
  return report;
}

module.exports = { buildReport, assembleReport: buildReport, canonicalJson, serializeReport, reportHash, FIXTURE_NOTE, SMALL_N };
