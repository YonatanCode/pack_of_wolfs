"use strict";
/*
 * Battle Lab manifest: strict schema validation, battle-count arithmetic, canonical hash.
 * Pure functions, Node built-ins only. Never runs anything.
 */
const crypto = require("node:crypto");

// Hard upper caps. A manifest may ask for less, never more. Changing these is a code change that needs review.
const LIMIT_CAPS = Object.freeze({
  maxBattles: 200,
  maxTurnsPerBattle: 60,
  maxTotalTurns: 5000,
  maxRuntimeSeconds: 1800,
});
const TOP_KEYS = ["schemaVersion", "label", "buildId", "preset", "scenarios", "strategies", "limits", "botSeed"];
const SCENARIO_KEYS = ["id", "seeds"];
const MAX_LABEL = 200;
const MAX_SEEDS_PER_SCENARIO = 200;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (v) => typeof v === "number" && Number.isSafeInteger(v);
const isPosInt = (v) => isInt(v) && v > 0;
const isStr = (v) => typeof v === "string" && v.length > 0;

/** Strategy ids registered in bots.cjs, read lazily. Returns null when bots.cjs is not available yet. */
function loadBotIds() {
  try {
    const m = require("./bots.cjs");
    return m && m.BOTS ? Object.keys(m.BOTS).sort() : null;
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND" && /bots\.cjs/.test(e.message)) return null;
    throw e;
  }
}

const ROOT = require("node:path").resolve(__dirname, "..", "..");

/**
 * Supported scenario ids and preset ids, read STATICALLY from the game sources (single source of truth; the game is
 * never executed): scenarios/*.js assignments `window.BATTLE_SCENARIOS.<id> =` / `BATTLE_SCENARIOS["<id>"] =`, and the
 * entries of window.RULESET_PRESETS in script.js that are `available: true`.
 * -> { scenarioIds, presetIds } or throws if the sources cannot be read or yield nothing.
 */
function loadGameValues(root = ROOT) {
  const fs = require("node:fs");
  const path = require("node:path");
  const scenarioIds = new Set();
  const dir = path.join(root, "scenarios");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of text.matchAll(/BATTLE_SCENARIOS\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\])\s*=(?!=)/g)) scenarioIds.add(m[1] || m[2]);
  }
  const src = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const block = src.match(/window\.RULESET_PRESETS\s*=\s*deepFreeze\(\{([\s\S]*?)\n\}\);/);
  const presetIds = new Set();
  if (block) for (const m of block[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\{[^}]*available:\s*true/gm)) presetIds.add(m[1]);
  if (!scenarioIds.size) throw new Error("no scenario ids found in scenarios/*.js");
  if (!presetIds.size) throw new Error("no available presets found in script.js RULESET_PRESETS");
  return { scenarioIds: [...scenarioIds].sort(), presetIds: [...presetIds].sort() };
}

function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (isObj(v)) {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
}
function canonicalJson(v) { return JSON.stringify(canonicalize(v)); }
function manifestHash(m) { return crypto.createHash("sha256").update(canonicalJson(m)).digest("hex"); }

function battleCount(m) {
  if (!isObj(m) || !Array.isArray(m.scenarios) || !Array.isArray(m.strategies)) return 0;
  let seeds = 0;
  for (const s of m.scenarios) if (isObj(s) && Array.isArray(s.seeds)) seeds += s.seeds.length;
  return seeds * m.strategies.length;
}

/**
 * validateManifest(manifest, { botIds }) -> { valid, errors: [string], battles, limits, manifestHash }
 * botIds: list of known strategy ids; defaults to the ids in bots.cjs. If neither is available the manifest is INVALID
 * (strategies cannot be verified), never silently accepted.
 */
function validateManifest(m, opts = {}) {
  const errors = [];
  const botIds = opts.botIds !== undefined ? opts.botIds : loadBotIds();
  let gameValues = opts.gameValues;
  let gameValuesError = null;
  if (gameValues === undefined) { try { gameValues = loadGameValues(); } catch (e) { gameValues = null; gameValuesError = e.message; } }
  if (!isObj(m)) return { valid: false, errors: ["manifest must be a JSON object"], battles: 0, limits: null, manifestHash: null };

  for (const k of Object.keys(m)) if (!TOP_KEYS.includes(k)) errors.push(`unknown key: ${k}`);
  for (const k of TOP_KEYS) if (!(k in m)) errors.push(`missing required key: ${k}`);

  if ("schemaVersion" in m && m.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if ("label" in m && (!isStr(m.label) || m.label.length > MAX_LABEL)) errors.push(`label must be a non-empty string of at most ${MAX_LABEL} characters`);
  if ("buildId" in m && !(typeof m.buildId === "string" && /^[0-9a-f]{64}$/.test(m.buildId))) errors.push("buildId must be a 64-character lowercase hex string");
  if ("preset" in m) {
    if (!isStr(m.preset)) errors.push("preset must be a non-empty string");
    else if (!gameValues) errors.push(`cannot verify preset: ${gameValuesError || "no game values available"}`);
    else if (!gameValues.presetIds.includes(m.preset)) errors.push(`unknown preset: ${m.preset} (supported: ${gameValues.presetIds.join(", ")})`);
  }
  if ("botSeed" in m && !(isInt(m.botSeed) && m.botSeed >= 0 && m.botSeed <= 0xffffffff)) errors.push("botSeed must be an unsigned 32-bit integer");

  if ("scenarios" in m) {
    if (!Array.isArray(m.scenarios) || m.scenarios.length === 0) errors.push("scenarios must be a non-empty array");
    else {
      const ids = new Set();
      m.scenarios.forEach((s, i) => {
        const p = `scenarios[${i}]`;
        if (!isObj(s)) { errors.push(`${p} must be an object`); return; }
        for (const k of Object.keys(s)) if (!SCENARIO_KEYS.includes(k)) errors.push(`unknown key: ${p}.${k}`);
        if (!isStr(s.id)) errors.push(`${p}.id must be a non-empty string`);
        else if (ids.has(s.id)) errors.push(`${p}.id duplicates "${s.id}"`);
        else {
          ids.add(s.id);
          if (!gameValues) errors.push(`cannot verify scenario ids: ${gameValuesError || "no game values available"}`);
          else if (!gameValues.scenarioIds.includes(s.id)) errors.push(`unknown scenario: ${s.id} (supported: ${gameValues.scenarioIds.join(", ")})`);
        }
        if (!Array.isArray(s.seeds) || s.seeds.length === 0) errors.push(`${p}.seeds must be a non-empty array`);
        else if (s.seeds.length > MAX_SEEDS_PER_SCENARIO) errors.push(`${p}.seeds has more than ${MAX_SEEDS_PER_SCENARIO} entries`);
        else {
          if (!s.seeds.every(isInt)) errors.push(`${p}.seeds must contain only integers`);
          else if (new Set(s.seeds).size !== s.seeds.length) errors.push(`${p}.seeds must be unique`);
        }
      });
    }
  }

  if ("strategies" in m) {
    if (!Array.isArray(m.strategies) || m.strategies.length === 0) errors.push("strategies must be a non-empty array");
    else if (!m.strategies.every(isStr)) errors.push("strategies must contain only non-empty strings");
    else {
      if (new Set(m.strategies).size !== m.strategies.length) errors.push("strategies must be unique");
      if (!Array.isArray(botIds)) errors.push("cannot verify strategies: no bot registry available (bots.cjs missing)");
      else for (const s of m.strategies) if (!botIds.includes(s)) errors.push(`unknown strategy: ${s} (known: ${botIds.join(", ") || "none"})`);
    }
  }

  let limits = null;
  if ("limits" in m) {
    if (!isObj(m.limits)) errors.push("limits must be an object");
    else {
      limits = m.limits;
      for (const k of Object.keys(m.limits)) if (!(k in LIMIT_CAPS)) errors.push(`unknown key: limits.${k}`);
      for (const k of Object.keys(LIMIT_CAPS)) {
        if (!(k in m.limits)) errors.push(`missing required limit: limits.${k}`);
        else if (!isPosInt(m.limits[k])) errors.push(`limits.${k} must be a positive integer`);
        else if (m.limits[k] > LIMIT_CAPS[k]) errors.push(`limits.${k}=${m.limits[k]} exceeds hard cap ${LIMIT_CAPS[k]}`);
      }
    }
  }

  const battles = battleCount(m);
  if (limits && isPosInt(limits.maxBattles) && battles > limits.maxBattles) {
    errors.push(`battle count ${battles} (scenario seeds x strategies) exceeds limits.maxBattles ${limits.maxBattles}`);
  }
  return { valid: errors.length === 0, errors, battles, limits, manifestHash: errors.length === 0 ? manifestHash(m) : null };
}

module.exports = { LIMIT_CAPS, validateManifest, battleCount, canonicalJson, manifestHash, loadBotIds, loadGameValues };
