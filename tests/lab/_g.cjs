"use strict";
// Shared helpers for gate fixtures (hand-authored data only; temp dirs; never real approvals; never a battle).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BUILD = "a".repeat(64);
const OTHER_BUILD = "b".repeat(64);
const BOT_IDS = ["random-legal", "aggressive-pursuit"];

const baseManifest = () => ({
  schemaVersion: 1, label: "gate fixture", buildId: BUILD, preset: "commander",
  scenarios: [{ id: "intro", seeds: [1, 2, 3] }], strategies: ["random-legal", "aggressive-pursuit"],
  limits: { maxBattles: 10, maxTurnsPerBattle: 20, maxTotalTurns: 200, maxRuntimeSeconds: 60 }, botSeed: 7,
});

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "lab-gates-")); }
function writeJson(file, v) { fs.writeFileSync(file, typeof v === "string" ? v : JSON.stringify(v, null, 2)); }
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

module.exports = { BUILD, OTHER_BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup };
