"use strict";
// REQUIREMENT — P1e acceptance
// R19: a dry run leaves EVERY module-level binding of script.js as it was, and no new module-level state can
// appear unclassified.
// PARSER (documented, bounded): script.js is a formatted classic script whose top-level statements start at
// column 0 and whose nested code is indented. A top-level binding is a line matching
//     ^(let|const|var|class) <identifier>
// Destructuring or multiple declarators on such a line are rejected (the fixture fails loudly), and every
// parsed name must resolve in the vm context (typeof via vm.runInContext), so the parser cannot silently
// invent or skip a shape it does not understand. Function declarations are code, not state, and are skipped.
// CLASSIFICATION: by declaration + runtime value:
//   immutable  const primitive, const frozen object, const/class function, const DOM element (DOM is r14's job);
//   constant   const mutable object with an UPPER_CASE name (constant tables): fingerprinted, no table row needed;
//   mutable    every `let`, and every const mutable object with a non-UPPER_CASE name: MUST be listed in exactly
//              one row of the classification table in script.js ("MODULE-LEVEL MUTABLE STATE"), and the table
//              must not list a name that is not such a binding. A new mutable binding that is not classified
//              there FAILS this fixture (so future state cannot be forgotten by snapshot/swap code).
// FINGERPRINT: each binding's value serialised deeply (Sets / Maps by entries, DOM -> "dom", functions -> "fn"
// plus getState() for seeded streams, one of the six live units met inside another value -> "@P1" etc., so
// identity of nested unit references counts; WeakMap unitActionQueues -> the six live units' queues), plus
// object IDENTITY of every binding. Taken before and after three dry runs (plain, lethal, double-KO boards)
// in the vm context; also compared against a never-previewed control context. Allowlist of bindings allowed
// to differ: EMPTY.
const fs = require("node:fs");
const path = require("node:path");
const P = require("./_preview.cjs");

const ID = "r19-global-state-audit";
const ALLOWLIST = {}; // name -> reason. Must stay empty unless a reviewed reason exists.

function parseTopLevel() {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "script.js"), "utf8");
  const decls = [];
  src.split("\n").forEach((line, i) => {
    const m = /^(let|const|var|class)\s+(.*)$/.exec(line);
    if (!m) return;
    const nm = /^([A-Za-z_$][\w$]*)/.exec(m[2]);
    if (!nm) throw new Error(`r19 parser: unsupported top-level declaration at script.js:${i + 1}: ${line}`);
    const rest = m[2].slice(nm[1].length);
    if (m[1] !== "class" && !/^\s*(=|;|$)/.test(rest)) throw new Error(`r19 parser: unsupported declarator at script.js:${i + 1}: ${line}`);
    if (m[1] !== "class" && /^\s*=\s*[^;]*;\s*$/.test(rest) && /,\s*[A-Za-z_$][\w$]*\s*=/.test(rest.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|"[^"]*"|`[^`]*`/g, ""))) {
      throw new Error(`r19 parser: multiple declarators at script.js:${i + 1}: ${line}`);
    }
    decls.push({ kind: m[1], name: nm[1], line: i + 1 });
  });
  // classification table rows: "//   (x) name, name: note"
  const table = new Map();
  src.split("\n").forEach((line) => {
    const m = /^\/\/\s+\(([a-d])\)\s+([\w$]+(?:,\s*[\w$]+)*):/.exec(line);
    if (!m) return;
    m[2].split(/,\s*/).forEach((n) => {
      if (table.has(n)) throw new Error(`r19: ${n} is classified twice in the script.js table`);
      table.set(n, m[1]);
    });
  });
  return { decls, table };
}

const KIND_EXPR = (name) => `(function (v) {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) return "primitive";
  if (typeof v === "function") return "function";
  if (v.nodeType !== undefined || v.tagName !== undefined) return "dom";
  if (Object.isFrozen(v)) return "frozen";
  return "mutable";
})(${name})`;

const INSTALL_FP = `(function () {
  const ids = new Map([[player, "@P1"], [playerSupport, "@P2"], [playerFlank, "@P3"], [enemy, "@E1"], [enemySupport, "@E2"], [enemyFlank, "@E3"]]);
  const ser = (v, depth, top) => {
    if (v === undefined) return "undef";
    if (v === null || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "function") return typeof v.getState === "function" ? { fn: true, state: v.getState() } : "fn";
    if (v.nodeType !== undefined || v.tagName !== undefined) return "dom";
    if (!top && ids.has(v)) return ids.get(v);
    if (depth > 14) return "[depth]";
    if (v instanceof WeakMap) return { weakmap: [...ids].map(([u, id]) => [id, v.has(u) ? ser(v.get(u), depth + 1) : "absent"]) };
    if (v instanceof Set) return { set: [...v].map((x) => ser(x, depth + 1)) };
    if (v instanceof Map) return { map: [...v].map(([k, x]) => [ser(k, depth + 1), ser(x, depth + 1)]) };
    if (typeof v.then === "function") return "promise";
    if (Array.isArray(v)) return v.map((x) => ser(x, depth + 1));
    return Object.fromEntries(Object.keys(v).map((k) => [k, ser(v[k], depth + 1)]));
  };
  globalThis.__r19ser = (v) => JSON.stringify(ser(v, 0, true));
})()`;

function fingerprintAll(g, names) {
  const fp = {};
  names.forEach((n) => { fp[n] = g.ev(`__r19ser(${n})`); });
  return fp;
}
const captureIdentity = (g, names) => g.ev(`globalThis.__r19ids = { ${names.map((n) => `${JSON.stringify(n)}: ${n}`).join(", ")} };`);
const changedIdentity = (g, names) => JSON.parse(g.ev(`JSON.stringify([${names.map((n) => `__r19ids[${JSON.stringify(n)}] === ${n} ? null : ${JSON.stringify(n)}`).join(", ")}].filter(Boolean))`));

async function run() {
  const { decls, table } = parseTopLevel();
  const g0 = P.boot();
  const classified = { immutable: [], constant: [], mutable: [] };
  const unclassified = [];
  decls.forEach((d) => {
    const exists = g0.ev(`typeof ${d.name} !== "undefined" || ${d.name} === undefined`);
    P.L.check(exists === true, `parsed binding ${d.name} resolves in the context`);
    const kind = d.kind === "class" ? "function" : g0.ev(KIND_EXPR(d.name));
    let cls;
    if (d.kind === "let" || d.kind === "var") cls = "mutable";
    else if (kind === "mutable") cls = /^[A-Z][A-Z0-9_]*$/.test(d.name) ? "constant" : "mutable";
    else cls = "immutable";
    classified[cls].push(d.name);
    if (cls === "mutable" && !table.has(d.name)) unclassified.push(`${d.kind} ${d.name} (script.js:${d.line})`);
  });
  P.L.same(unclassified, [], "every mutable top-level binding is classified in the script.js table (add a row there)");
  const stale = [...table.keys()].filter((n) => !classified.mutable.includes(n));
  P.L.same(stale, [], "the script.js table lists only existing mutable top-level bindings");
  const watched = [...classified.mutable, ...classified.constant];

  const boards = ["plain", "lethal", "doubleKO"];
  const perBoard = {};
  for (const boardId of boards) {
    const a = P.boot();
    P.BOARDS[boardId].setup(a);
    a.ev(INSTALL_FP);
    const before = fingerprintAll(a, watched);
    captureIdentity(a, watched);
    for (let i = 0; i < 3; i += 1) P.L.check(P.dryRun(a).ok, `${boardId}: dry run ${i + 1} ran`);
    const after = fingerprintAll(a, watched);
    const changed = watched.filter((n) => before[n] !== after[n] && !(n in ALLOWLIST));
    P.L.same(changed, [], `${boardId}: no module-level binding changed value`);
    const moved = changedIdentity(a, watched).filter((n) => !(n in ALLOWLIST));
    P.L.same(moved, [], `${boardId}: no module-level binding changed identity`);
    const b = P.boot();
    P.BOARDS[boardId].setup(b);
    b.ev(INSTALL_FP);
    const control = fingerprintAll(b, watched);
    const vsControl = watched.filter((n) => control[n] !== after[n] && !(n in ALLOWLIST));
    P.L.same(vsControl, [], `${boardId}: every module-level binding equals a never-previewed control`);
    perBoard[boardId] = { dryRuns: 3, changedValue: changed, changedIdentity: moved, differsFromControl: vsControl };
  }

  const byClass = { a: [], b: [], c: [], d: [] };
  table.forEach((c, n) => byClass[c].push(n));
  return {
    header: P.REQ_HEADER,
    parser: { topLevelDeclarations: decls.length, immutable: classified.immutable.length, constantTables: classified.constant.length, mutable: classified.mutable.length },
    classificationTable: Object.fromEntries(Object.entries(byClass).map(([c, l]) => [c, l.sort().join(" ")])),
    unclassifiedMutableBindings: unclassified,
    allowlist: ALLOWLIST,
    boards: perBoard,
  };
}
module.exports = { id: ID, run };
