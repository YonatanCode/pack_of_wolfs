"use strict";
const crypto = require("node:crypto");

/** JSON-safe deep copy: drops functions/DOM-ish objects, breaks cycles, rounds floats, sorts nothing. */
function normalise(value, seen = new Set(), depth = 0) {
  if (value === null || value === undefined) return value === undefined ? null : null;
  const t = typeof value;
  if (t === "number") return Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : String(value);
  if (t === "string" || t === "boolean") return value;
  if (t === "function" || t === "symbol") return undefined;
  if (t === "bigint") return String(value);
  if (depth > 8) return "[depth]";
  if (seen.has(value)) return "[cycle]";
  if (value.tagName !== undefined || value.nodeType !== undefined) return "[dom]";
  seen.add(value);
  let out;
  if (value instanceof Map || (value && value.constructor && value.constructor.name === "Map")) {
    out = Array.from(value.entries()).map(([k, v]) => [normalise(k, seen, depth + 1), normalise(v, seen, depth + 1)]);
  } else if (value instanceof Set || (value && value.constructor && value.constructor.name === "Set")) {
    out = Array.from(value.values()).map((v) => normalise(v, seen, depth + 1));
  } else if (Array.isArray(value)) {
    out = value.map((v) => { const n = normalise(v, seen, depth + 1); return n === undefined ? null : n; });
  } else {
    out = {};
    for (const k of Object.keys(value)) {
      const n = normalise(value[k], seen, depth + 1);
      if (n !== undefined) out[k] = n;
    }
  }
  seen.delete(value);
  return out;
}

function stableStringify(v) { return JSON.stringify(v, null, 2) + "\n"; }
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

/** Realm-independent copy (objects created inside vm have a different Object prototype). */
function plain(v) { return normalise(JSON.parse(JSON.stringify(v ?? null))); }

module.exports = { normalise, stableStringify, sha256, plain };
