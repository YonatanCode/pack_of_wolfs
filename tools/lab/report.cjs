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
 *   - summary: metrics.summarize(battles). A note is added for every strategy with n < 30 (the interval is wide), and
 *     one counting battles whose replay.payload is null (L3; a missing payload key, as in L2 records, is not counted),
 *     and one counting turns that carry an accountingNote (driver accounting imbalance, never hidden).
 *   - Deterministic: no wall-clock time, host or path inside the report; battles keep their given order.
 *   - Full-information strategies (summary label "full-information benchmark"): one note per such strategy saying its
 *     win rate does NOT estimate human difficulty, and one with its search cost counts. Their records' wall-clock
 *     `timing` is moved OUT of battles into the top-level `nonHashed` key ({ about, searchMs: { <strategy>: { decisions,
 *     totalMs, maxMs } } }), present only when some battle carried timing. reportHash ignores `nonHashed`; serializeReport
 *     writes it (so a report file with search timing is not byte-identical across runs; its reportHash is).
 *   - rulesVariants (optional, the manifest's list of rulesQuery strings): battles may then differ in rules hash BETWEEN
 *     variants (each variant must still share one hash). The report adds `rulesVariants: [{ rulesQuery, rulesVersion,
 *     rulesHash, n, summary }]` (a battle's variant = the rules= parameter of its replay.query; summary =
 *     metrics.summarize of that variant's battles) and a note; top-level rulesHash is null when the variants differ.
 *     Without rulesVariants nothing changes (one hash for all battles, no extra key).
 *   Any other key passed in (e.g. the manifest itself) is ignored.
 * canonicalJson(value): sorted-key compact JSON; refuses undefined, functions, symbols, bigints and non-finite numbers.
 * serializeReport(report): sorted-key JSON, 2-space indent, trailing newline (byte-identical for equal reports).
 * reportHash(report): sha256 hex of canonicalJson(report without its nonHashed key).
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
const NON_HASHED_ABOUT = "wall-clock search timing (not deterministic); excluded from reportHash";
const hashedBody = (report) => {
  if (!report || typeof report !== "object" || !("nonHashed" in report)) return report;
  const { nonHashed, ...rest } = report;
  return rest;
};
const reportHash = (report) => crypto.createHash("sha256").update(canonicalJson(hashedBody(report))).digest("hex");

const rulesQueryOfBattle = (b) => { const m = /[?&](rules=[^&]*)/.exec(b && b.replay && typeof b.replay.query === "string" ? b.replay.query : ""); return m ? m[1] : ""; };

function buildReport({ manifestHash, buildId, battles, notes = [], fixtureOnly, rulesVariants } = {}) {
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

  if (rulesVariants !== undefined && (!Array.isArray(rulesVariants) || !rulesVariants.length || rulesVariants.some((q) => typeof q !== "string"))) {
    throw new TypeError("buildReport: rulesVariants must be a non-empty array of rulesQuery strings");
  }
  const hashOf = (list) => [...new Set(list.map((b) => b.rulesHash).filter((h) => h !== null && h !== undefined))];
  const hashes = hashOf(battles);
  const variantRows = rulesVariants ? rulesVariants.map((rulesQuery) => {
    const own = battles.filter((b) => rulesQueryOfBattle(b) === rulesQuery);
    const h = hashOf(own);
    if (h.length > 1) throw new TypeError(`buildReport: battles of rules variant "${rulesQuery}" ran under different rules hashes (${h.sort().join(", ")})`);
    const versions = [...new Set(own.map((b) => b.rulesVersion).filter((x) => x !== null && x !== undefined))];
    return { rulesQuery, rulesVersion: versions.length === 1 ? versions[0] : null, rulesHash: h.length ? h[0] : null, n: own.length, summary: summarize(own) };
  }) : null;
  if (variantRows) {
    const stray = battles.filter((b) => !rulesVariants.includes(rulesQueryOfBattle(b))).length;
    if (stray) throw new TypeError(`buildReport: ${stray} battle(s) match no rules variant`);
  } else if (hashes.length > 1) throw new TypeError(`buildReport: battles ran under different rules hashes (${hashes.sort().join(", ")})`);

  const summary = summarize(battles);
  const derived = [];
  if (fixture) derived.push(FIXTURE_NOTE);
  Object.entries(summary).forEach(([strategy, s]) => {
    if (s.fullInformation === true) {
      derived.push(`${s.label}: ${strategy} reads hidden enemy plans and simulates candidate turns with the game's rules; its win rate does NOT estimate human difficulty`);
      const c = s.search;
      derived.push(`search cost: ${strategy} ${c.decisions} decisions, ${c.candidatesGenerated} candidates generated, ${c.candidatesKept} kept, ${c.evaluated} evaluated; limit hits generation ${c.limitHits.generation}, candidates ${c.limitHits.candidates}, evaluations ${c.limitHits.evaluations}, time ${c.limitHits.time}; fallbacks ${c.fallbacks}`);
    }
  });
  Object.entries(summary).forEach(([strategy, s]) => {
    if (s.n < SMALL_N) derived.push(`small sample: ${strategy} n=${s.n}, win rate 95% interval [${s.winRateWilson95[0]}, ${s.winRateWilson95[1]}]`);
  });
  const noPayload = battles.filter((b) => b.replay && b.replay.payload === null).length;
  const unbalanced = battles.reduce((n, b) => n + (Array.isArray(b.perTurn) ? b.perTurn.filter((t) => t && typeof t.accountingNote === "string").length : 0), 0);
  if (unbalanced) derived.push(`accounting: ${unbalanced} turn(s) do not balance planned = executed + attacksMissed + wasted (see perTurn[].accountingNote)`);
  if (noPayload) derived.push(`visual replay: ${noPayload} of ${battles.length} battle(s) have no replay payload (see replay.payloadNote)`);
  if (variantRows) derived.push(`rules variants: ${variantRows.length} (${variantRows.map((r) => `"${r.rulesQuery}" n=${r.n}`).join(", ")}); summary pools every variant, rulesVariants[].summary splits them`);

  const searchMs = {};
  battles.forEach((b) => {
    const t = b && b.timing && b.timing.searchMs;
    if (!t) return;
    const acc = (searchMs[b.strategy] ??= { decisions: 0, totalMs: 0, maxMs: 0 });
    acc.decisions += Number(t.decisions) || 0;
    acc.totalMs += Number(t.totalMs) || 0;
    acc.maxMs = Math.max(acc.maxMs, Number(t.maxMs) || 0);
  });
  const report = {
    schemaVersion: 1,
    manifestHash,
    buildId,
    rulesHash: hashes.length === 1 ? hashes[0] : null,
    fixtureOnly: fixture,
    battles: JSON.parse(canonicalJson(battles.map((b) => {
      if (!b || typeof b !== "object" || !("timing" in b)) return b;
      const { timing, ...rest } = b; // wall clock: moved to nonHashed
      return rest;
    }))),
    summary,
    ...(variantRows ? { rulesVariants: variantRows } : {}),
    notes: [...derived, ...notes],
  };
  if (Object.keys(searchMs).length) report.nonHashed = { about: NON_HASHED_ABOUT, searchMs };
  canonicalJson(report); // refuses anything that is not plain data
  return report;
}

module.exports = { buildReport, assembleReport: buildReport, canonicalJson, serializeReport, reportHash, FIXTURE_NOTE, SMALL_N, NON_HASHED_ABOUT };
