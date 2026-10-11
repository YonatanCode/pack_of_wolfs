"use strict";
// G8: manifest `rulesVariants` with the commanderdraw enemy draw weights (dwm / dwa / dwd; ENGINE-NOTES section 13.1).
// Hand-authored manifests and one hand-written replay payload; validateManifest (the GAME's strict link parser, booted once in
// the headless loader; no turn) and the driver's payloadProblem only. Nothing is run: no battle, no driver run, no bot,
// no --run, no approvals.
// - accepted under preset commanderdraw: a player x enemy ratio grid (player wm/wa/wd and enemy dwm/dwa/dwd in one rules
//   link); battles = seeds x strategies x variants.
// - refused by the game (named in the error): the same keys under preset commander; an all-zero triple; a draw that cannot
//   be formed (budget 7 with Move excluded); an out-of-bounds weight.
// - the driver's payloadProblem accepts a payload whose rulesQuery carries the keys; the longest possible rules link with
//   every key stays far below the 512-character rulesQuery limit.
const { validateManifest } = require("../../tools/lab/manifest.cjs");
const { payloadProblem, PAYLOAD_LIMITS } = require("../../tools/lab/driver.cjs");
const { BUILD, BOT_IDS, baseManifest } = require("./_g.cjs");

const MAX_RULES_QUERY_LENGTH = PAYLOAD_LIMITS.maxRulesQueryLength; // 512, the replay payload limit (= manifest.cjs MAX_RULES_QUERY_LENGTH)

const ID = "g8-rules-variants-draw-weights";
const GRID = [
  "rules=pab:5,hs:5,eab:5",
  "rules=pab:5,hs:5,eab:5,dwm:1,dwa:3,dwd:1",
  "rules=pab:5,hs:5,eab:5,wm:1,wa:3,wd:1,dwm:1,dwa:3,dwd:1",
  "rules=pab:5,hs:5,eab:5,dwm:0,dwa:1,dwd:1",
];
const manifest = (preset, variants) => ({ ...baseManifest(), preset, scenarios: [{ id: "intro", seeds: [1] }], strategies: ["random-legal"], rulesVariants: variants });
const check = (m) => { const r = validateManifest(m, { botIds: BOT_IDS }); return { valid: r.valid, battles: r.battles, errors: r.errors, hasHash: !!r.manifestHash }; };
function fail(msg) { throw new Error(`g8 check failed: ${msg}`); }

async function run() {
  const cases = {};
  cases.gridCommanderdraw = check(manifest("commanderdraw", [...GRID]));
  if (!cases.gridCommanderdraw.valid || cases.gridCommanderdraw.battles !== 4) fail("the player x enemy weight grid is valid under commanderdraw with 4 battles");
  cases.gridCommander = check(manifest("commander", [...GRID]));
  if (cases.gridCommander.valid || cases.gridCommander.errors.length !== 3) fail("the three dw variants are refused under commander (the plain one is fine)");
  cases.allZero = check(manifest("commanderdraw", ["rules=dwm:0,dwa:0,dwd:0"]));
  cases.notFormable = check(manifest("commanderdraw", ["rules=eab:7,dwm:0"]));
  cases.outOfBounds = check(manifest("commanderdraw", ["rules=dwa:21"]));
  if ([cases.allZero, cases.notFormable, cases.outOfBounds].some((c) => c.valid)) fail("game-rejected weight variants are refused");

  const longest = "rules=pab:8,hs:8,rc:9,cap:8,wm:20,wa:20,wd:20,eab:10,epm:10,epd:10,epa:10,dwm:20,dwa:20,dwd:20";
  cases.longestRulesQuery = { length: longest.length, limit: MAX_RULES_QUERY_LENGTH };
  if (!(MAX_RULES_QUERY_LENGTH === 512 && longest.length <= MAX_RULES_QUERY_LENGTH)) fail("the longest rules link fits the rulesQuery limit");
  const payload = { v: 1, buildId: BUILD, scenarioId: "intro", seed: 1, preset: "commanderdraw", rulesQuery: GRID[2], rulesVersion: "0.1.0-commanderdraw-enemy-random-draw",
    rulesHash: "0".repeat(14), strategy: "random-legal", botSeed: 7, result: "win", turns: [{ turn: 1, steps: [[{ unit: "P1", action: "Attack" }]], eventHash: "1".repeat(14) }] };
  cases.payloadProblem = { withWeights: payloadProblem(payload), longest: payloadProblem({ ...payload, rulesQuery: longest }) };
  if (cases.payloadProblem.withWeights !== null || cases.payloadProblem.longest !== null) fail("payloadProblem accepts rulesQuery with the dw keys");
  return { id: ID, cases };
}
module.exports = { id: ID, run };
