"use strict";
// REQUIREMENT — L2 report (hand-written BattleRecords only; no game is loaded, no battle is run)
// D3a DETERMINISM: the same input built twice -> byte-identical serializeReport text and the same reportHash; the same
//     records written with a different key insertion order -> the same bytes and hash; changing one value changes the hash.
// D3b CONTENT: schemaVersion 1, the shared rulesHash, fixtureOnly true, the leading FIXTURE note, a small-sample note per
//     strategy (n and interval), caller notes after them; no wall-clock time anywhere (no ISO date-like string).
// D3c REFUSALS (TypeError): mixed fixture / real battles, battles under different rules hashes, a real report without
//     64-hex manifestHash / buildId, fixtureOnly disagreeing with the battles, non-data values (NaN, undefined).
// D3d CANONICAL JSON: sorted keys at every depth, arrays keep their order.
// D3e PAYLOAD NOTE (L3): a battle whose replay.payload is null is counted in a deterministic note; the L2-shaped records
//     above (no payload key) are not counted.
const { buildReport, serializeReport, reportHash, canonicalJson, FIXTURE_NOTE } = require("../../tools/lab/report.cjs");

const ID = "d3-report-determinism";
function check(cond, msg) { if (!cond) throw new Error(`d3 check failed: ${msg}`); }

const turnA = { turn: 1, status: "ran", budget: 5, planned: 2, executed: 2, wasted: 0, orders: [{ unit: "P1", action: "Attack" }, { unit: "P1", action: "Move" }],
  byUnit: { P1: { planned: 2, executed: 2 } }, enemy: { budget: 5, executed: 3 }, refusal: null, error: null, eventHash: "e1", observationHash: "o1" };
const recordA = { scenarioId: "intro", seed: 1, preset: "commander", rulesVersion: "v", rulesHash: "rh", strategy: "scripted", botSeed: 7, fixtureOnly: true,
  result: "win", stopReason: "battle-end", error: null, turns: 1, perTurn: [turnA], orders: [turnA.orders], replay: { query: "?scenario=intro&seed=1&preset=commander", orders: [turnA.orders] } };
const recordB = { scenarioId: "intro", seed: 2, preset: "commander", rulesVersion: "v", rulesHash: "rh", strategy: "scripted", botSeed: 7, fixtureOnly: true,
  result: "timeout", stopReason: "max-turns-per-battle", error: null, turns: 0, perTurn: [], orders: [], replay: { query: "?scenario=intro&seed=2&preset=commander", orders: [] } };

/** The same data with every object's keys inserted in reverse order (hand-written transform of fixed data). */
function reversedKeys(v) {
  if (Array.isArray(v)) return v.map(reversedKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reversedKeys(v[k])]));
  return v;
}
const input = (battles, extra = {}) => ({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles, notes: ["caller note"], ...extra });

function run() {
  // D3a
  const r1 = buildReport(input([recordA, recordB]));
  const r2 = buildReport(input(JSON.parse(JSON.stringify([recordA, recordB]))));
  const r3 = buildReport(reversedKeys(input([recordA, recordB])));
  const text = serializeReport(r1);
  check(text === serializeReport(r2) && text === serializeReport(r3), "D3a: byte-identical serialisation");
  const hash = reportHash(r1);
  check(hash === reportHash(r2) && hash === reportHash(r3) && /^[0-9a-f]{64}$/.test(hash), "D3a: same hash");
  const changed = reportHash(buildReport(input([{ ...recordA, seed: 3 }, recordB])));
  check(changed !== hash, "D3a: one changed value changes the hash");

  // D3b
  check(r1.schemaVersion === 1 && r1.rulesHash === "rh" && r1.fixtureOnly === true, "D3b: header fields");
  check(r1.notes[0] === FIXTURE_NOTE && r1.notes[r1.notes.length - 1] === "caller note", "D3b: FIXTURE note first, caller notes last");
  check(r1.notes.some((n) => n.startsWith("small sample: scripted n=2")), "D3b: small-sample note with n and the interval");
  check(!/\d{4}-\d{2}-\d{2}T/.test(text), "D3b: no timestamp in the report");
  check(Object.keys(r1).join(",") === "schemaVersion,manifestHash,buildId,rulesHash,fixtureOnly,battles,summary,notes", "D3b: contract keys");

  // D3c
  const refusals = [
    ["mixed", () => buildReport(input([recordA, { ...recordB, fixtureOnly: false }]))],
    ["rules hashes", () => buildReport(input([recordA, { ...recordB, rulesHash: "other" }]))],
    ["real without hex", () => buildReport(input([{ ...recordA, fixtureOnly: false }]))],
    ["flag disagrees", () => buildReport(input([recordA], { fixtureOnly: false }))],
    ["NaN", () => buildReport(input([{ ...recordA, seed: NaN }]))],
    ["undefined", () => buildReport(input([{ ...recordA, error: undefined }]))],
  ].map(([name, fn]) => {
    try { fn(); } catch (e) { check(e instanceof TypeError, `D3c: ${name} -> TypeError`); return `${name}: ${e.message}`; }
    throw new Error(`D3c: ${name} was accepted`);
  });
  const real = buildReport({ manifestHash: "a".repeat(64), buildId: "b".repeat(64), battles: [{ ...recordA, fixtureOnly: false }] });
  check(real.fixtureOnly === false && !real.notes.includes(FIXTURE_NOTE), "D3c: a real report is accepted with hex ids and has no FIXTURE note");

  // D3d
  const canon = canonicalJson({ b: [3, 1, { d: 1, c: 2 }], a: null });
  check(canon === '{"a":null,"b":[3,1,{"c":2,"d":1}]}', `D3d: canonical JSON ${canon}`);

  // D3e
  const noPayload = { ...recordB, replay: { ...recordB.replay, steps: [], payload: null, payloadNote: "no turn was played" } };
  const r5 = buildReport(input([recordA, noPayload]));
  check(r5.notes.includes("visual replay: 1 of 2 battle(s) have no replay payload (see replay.payloadNote)"), "D3e: payload note");
  check(!r1.notes.some((n) => n.startsWith("visual replay:")), "D3e: no note for L2-shaped records");
  check(serializeReport(r5) === serializeReport(buildReport(input([recordA, noPayload]))), "D3e: deterministic");

  return { header: "REQUIREMENT — L2 report", payloadNotes: r5.notes, fixtureOnly: true, reportHash: hash, changedHash: changed, report: r1, refusals, canonical: canon };
}

module.exports = { id: ID, run };
