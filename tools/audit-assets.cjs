"use strict";
// Records every image path the game assigns, by booting script.js headlessly (tests/harness, read-only).
// Method: OBSERVATION FROM OUTSIDE the harness. Before loadGame() we install temporary setters on
// Object.prototype for `src`, `_src` and `backgroundImage`; the harness's stub elements/Image/style
// are plain objects without own such properties, so assignments hit the setter, which records the
// value and then defines it as an own property (behaviour preserved). Setters are removed afterwards.
// No battles, no turns: boot + a few event-loop ticks only.
const { loadGame } = require("../tests/harness/load-game.cjs");

const NAMES = ["src", "_src", "backgroundImage"];
const ROUTES = [
  { name: "intro", opts: { query: "?scenario=intro&seed=1", scenarios: true } },
  { name: "wilds", opts: { query: "?scenario=wilds&seed=1", scenarios: true } },
  { name: "world", opts: { query: "?mode=world", scenarios: true } },
  { name: "stag", opts: {}, after: (g) => g.ev("window.devTest.setEnemyMode('stag')") },
];

function extract(value) {
  const s = String(value);
  const m = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(s);
  return m ? m[2] : s;
}

async function auditRoute(route) {
  const seen = new Set();
  const record = (v) => { if (v !== undefined && v !== null && String(v) !== "") seen.add(extract(v)); };
  for (const n of NAMES) {
    Object.defineProperty(Object.prototype, n, {
      configurable: true,
      set(v) { record(v); Object.defineProperty(this, n, { value: v, writable: true, enumerable: true, configurable: true }); },
      get() { return undefined; },
    });
  }
  try {
    const g = loadGame({ label: "audit-" + route.name, ...route.opts });
    if (route.after) route.after(g);
    await g.runLimited(async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); }, 10000);
  } finally {
    for (const n of NAMES) delete Object.prototype[n];
  }
  return [...seen].sort();
}

async function auditAssets() {
  const perRoute = {};
  const all = new Set();
  for (const r of ROUTES) {
    perRoute[r.name] = await auditRoute(r);
    perRoute[r.name].forEach((p) => all.add(p));
  }
  return { method: "dynamic: boot script.js in the headless harness and record src/Image.src/backgroundImage assignments", perRoute, paths: [...all].sort() };
}

module.exports = { auditAssets };
