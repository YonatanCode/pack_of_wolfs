"use strict";
// G7: manifest `rulesVariants` (one battle per scenario seed x strategy x rules link) and the report's per-variant split.
// Hand-authored manifests and hand-written BattleRecords; validateManifest, buildReport and run.cjs --check-only only.
// Nothing is run: no battle, no driver, no bot (--run is not called). The default rules-variant checker boots the game once
// in the headless loader only to call its strict link parser (parseRulesParams); no turn runs.
// - accepted: commanderdraw with the 4v4 / 5v5 / 6v6 equal-budget variants (real game parser); battles = seeds x
//   strategies x variants; manifestHash covers the list (order included); a manifest without rulesVariants never loads
//   the checker and keeps its plain hash.
// - refused: not an array / empty / more than 8 / non-string / malformed shape / duplicates; links the GAME rejects
//   (out-of-bounds value, unknown key, unfillable hand); battle count over maxBattles names the variants.
// - the checker gets (preset, rulesQuery) for every variant.
// - report: battles of different variants may differ in rules hash (top-level rulesHash null, rulesVariants rows with
//   per-variant summary, a note); a variant whose battles differ in hash, or a battle matching no variant, is refused;
//   without rulesVariants the old single-hash refusal is unchanged.
// - --check-only prints the rulesVariants line and the battle count.
const path = require("node:path");
const { validateManifest, manifestHash, MAX_RULES_VARIANTS } = require("../../tools/lab/manifest.cjs");
const { buildReport } = require("../../tools/lab/report.cjs");
const { main } = require("../../tools/lab/run.cjs");
const { BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g7-rules-variants";
const V = ["rules=pab:4,hs:4,rc:2,cap:3,eab:4", "rules=pab:5,hs:5,rc:2,cap:3,eab:5", "rules=pab:6,hs:6,rc:2,cap:3,eab:6"];
const variantManifest = () => ({ ...baseManifest(), preset: "commanderdraw", scenarios: [{ id: "intro", seeds: [1] }], strategies: ["random-legal"], rulesVariants: [...V] });
const OK = () => null;
const check = (m, opts = { botIds: BOT_IDS, checkRulesQuery: OK }) => { const r = validateManifest(m, opts); return { valid: r.valid, battles: r.battles, errors: r.errors, hasHash: !!r.manifestHash }; };
const mut = (f) => { const m = variantManifest(); f(m); return m; };
function fail(msg) { throw new Error(`g7 check failed: ${msg}`); }

async function run() {
  const cases = {};
  cases.validRealParser = check(variantManifest(), { botIds: BOT_IDS });
  if (!cases.validRealParser.valid || cases.validRealParser.battles !== 3) fail("the equal-budget variants are valid with 3 battles");
  cases.battlesMultiply = check(mut((m) => { m.scenarios[0].seeds = [1, 2]; m.strategies = ["random-legal", "aggressive-pursuit"]; }));
  cases.emptyStringVariant = check(mut((m) => { m.rulesVariants = ["", V[0]]; }), { botIds: BOT_IDS });
  cases.notArray = check(mut((m) => { m.rulesVariants = V[0]; }));
  cases.empty = check(mut((m) => { m.rulesVariants = []; }));
  cases.tooMany = check(mut((m) => { m.rulesVariants = Array.from({ length: MAX_RULES_VARIANTS + 1 }, (_, i) => `rules=rc:${i}`); }));
  cases.nonString = check(mut((m) => { m.rulesVariants = [4]; }));
  cases.noPrefix = check(mut((m) => { m.rulesVariants = ["pab:4"]; }));
  cases.secondParam = check(mut((m) => { m.rulesVariants = ["rules=pab:4&preset=current"]; }));
  cases.upperCase = check(mut((m) => { m.rulesVariants = ["rules=PAB:4"]; }));
  cases.duplicate = check(mut((m) => { m.rulesVariants = [V[0], V[0]]; }));
  const real = { botIds: BOT_IDS };
  cases.gameOutOfBounds = check(mut((m) => { m.rulesVariants = ["rules=pab:9"]; }), real);
  cases.gameUnknownKey = check(mut((m) => { m.rulesVariants = ["rules=zz:1"]; }), real);
  cases.gameUnfillableHand = check(mut((m) => { m.rulesVariants = ["rules=hs:8,cap:2"]; }), real);
  cases.overMaxBattles = check(mut((m) => { m.limits.maxBattles = 2; }));
  const calls = [];
  validateManifest(variantManifest(), { botIds: BOT_IDS, checkRulesQuery: (p, q) => { calls.push(`${p} ${q}`); return null; } });
  cases.checkerCalls = calls;
  const noVariants = { ...baseManifest() };
  cases.withoutVariantsNeverLoadsChecker = check(noVariants, { botIds: BOT_IDS, checkRulesQuery: () => fail("checker called without rulesVariants") });
  const h = manifestHash(variantManifest());
  cases.hash = {
    coversVariants: h !== manifestHash({ ...variantManifest(), rulesVariants: V.slice(0, 2) }),
    coversOrder: h !== manifestHash({ ...variantManifest(), rulesVariants: [V[1], V[0], V[2]] }),
    oldManifestPlain: manifestHash(noVariants) === validateManifest(noVariants, { botIds: BOT_IDS }).manifestHash,
  };

  // ---- report ----------------------------------------------------------------------------------------------------------
  const rec = (q, hash, result) => ({ scenarioId: "intro", seed: 1, preset: "commanderdraw", rulesVersion: "v-draw", rulesHash: hash, strategy: "scripted", botSeed: 7,
    fixtureOnly: true, result, stopReason: "battle-end", error: null, turns: 0, perTurn: [], orders: [],
    replay: { query: `?scenario=intro&seed=1&preset=commanderdraw&${q}`, orders: [] } });
  const battles = [rec(V[0], "h4", "win"), rec(V[1], "h5", "loss"), rec(V[2], "h6", "win")];
  const input = (b, extra = {}) => ({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles: b, ...extra });
  const r = buildReport(input(battles, { rulesVariants: [...V] }));
  cases.report = { rulesHash: r.rulesHash, rulesVariants: r.rulesVariants.map((x) => ({ ...x, summary: { n: x.summary.scripted.n, wins: x.summary.scripted.wins } })),
    note: r.notes.find((n) => n.startsWith("rules variants:")), keys: Object.keys(r) };
  const refused = (fn) => { try { fn(); return "no error"; } catch (e) { return `${e.name}: ${e.message}`; } };
  cases.reportRefusals = {
    hashesWithinVariant: refused(() => buildReport(input([...battles, rec(V[0], "hX", "win")], { rulesVariants: [...V] }))),
    strayBattle: refused(() => buildReport(input([...battles, rec("rules=rc:3", "h4", "win")], { rulesVariants: [...V] }))),
    withoutVariants: refused(() => buildReport(input(battles))),
    badVariantsArg: refused(() => buildReport(input(battles, { rulesVariants: [] }))),
  };

  // ---- --check-only -----------------------------------------------------------------------------------------------------
  const dir = tmpDir();
  try {
    const mf = path.join(dir, "m.json");
    writeJson(mf, variantManifest());
    const lines = [];
    const code = await main(["--manifest", mf, "--check-only"], { approvalsFile: path.join(dir, "none.json"), labVersion: () => "e".repeat(64), botIds: BOT_IDS,
      currentBuild: () => ({ buildId: BUILD, dirty: false }), loadModules: () => { throw new Error("must not load"); }, out: (s) => lines.push(s), err: () => {} });
    cases.checkOnly = { code, lines: lines.filter((l) => /^(validation|rulesVariants|battles|check-only)/.test(l)) };
  } finally { cleanup(dir); }
  return { id: ID, maxRulesVariants: MAX_RULES_VARIANTS, cases };
}
module.exports = { id: ID, run };
