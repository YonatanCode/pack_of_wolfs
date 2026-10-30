// Validates an EXISTING dist/ (does NOT run the build: run `pnpm build` first).
// Usage: node tools/check-dist.mjs [--dist <path>]   (exit 0 = ok, 1 = failures, 2 = bad usage)
// Checks: (a) copy integrity vs source, (b) asset audit (dynamic headless boot + static literal scan),
// (c) dev-only exclusion + expected top level, (d) serve smoke over a throwaway http server,
// (e) build identity: dist/build-id.json is exactly { "buildId": <tools/build-id.mjs hash of the source tree> }.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { computeGameplayBuildId } from "./build-id.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argIdx = process.argv.indexOf("--dist");
if (argIdx >= 0 && !process.argv[argIdx + 1]) { console.error("--dist needs a path"); process.exit(2); }
const DIST = resolve(argIdx >= 0 ? process.argv[argIdx + 1] : join(ROOT, "dist"));

// ---- visible constants ------------------------------------------------------------------------
const COPIED_FILES = ["script.js"];
const COPIED_DIRS = ["scenarios", "wolf", "stag", "isometric tileset", "assets/icons"];
const EXPECTED_TOP_LEVEL = ["index.html", "assets", "script.js", "scenarios", "wolf", "stag", "isometric tileset", "build-id.json"];
// Denylist: any path segment (case-insensitive) equal to one of these names, or matching a pattern, fails.
const DENY_NAMES = ["tests", "tools", "lab", "gui-pack", ".claude", "node_modules", "package.json"];
const DENY_PATHS = ["assets/sound"];
const DENY_PATTERNS = [/\.md$/i, /-handoff\.md$/i, /^pnpm-/, /^vite\.config\./, /^\.DS_Store$/, /^scenarios\/.*\.test.*$/];

const failures = [];
const fail = (m) => failures.push(m);
const rel = (p) => relative(DIST, p).split(sep).join("/");
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".DS_Store") continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
function walkAll(dir, out = []) { // includes dotfiles/dirs for the denylist scan
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    out.push(p);
    if (statSync(p).isDirectory()) walkAll(p, out);
  }
  return out;
}

if (!existsSync(DIST) || !existsSync(join(DIST, "index.html"))) {
  console.error(`FAIL: ${DIST} missing or has no index.html. Run \`pnpm build\` first.`);
  process.exit(1);
}
const lines = [`check-dist: ${DIST}`];

// ---- (a) copy integrity -----------------------------------------------------------------------
{
  let n = 0;
  const compare = (srcFile, distFile, label) => {
    n++;
    if (!existsSync(distFile)) return fail(`[integrity] missing in dist: ${label}`);
    if (sha(srcFile) !== sha(distFile)) fail(`[integrity] content differs from source: ${label}`);
  };
  for (const f of COPIED_FILES) compare(join(ROOT, f), join(DIST, f), f);
  const counts = [];
  for (const d of COPIED_DIRS) {
    const before = n;
    for (const f of walk(join(ROOT, d))) compare(f, join(DIST, relative(ROOT, f)), relative(ROOT, f));
    for (const f of existsSync(join(DIST, d)) ? walk(join(DIST, d)) : []) { // extras in dist not in source
      if (!existsSync(join(ROOT, relative(DIST, f)))) fail(`[integrity] in dist but not in source: ${rel(f)}`);
    }
    counts.push(`${d}: ${n - before}`);
  }
  lines.push(`(a) integrity: ${n} files sha256-identical to source [script.js: 1, ${counts.join(", ")}]`);
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  for (const needle of ['<script src="scenarios/intro.js"></script>', '<script src="scenarios/wilds.js"></script>', '<script src="script.js"></script>', 'id="restart-battle"']) {
    if (!html.includes(needle)) fail(`[integrity] dist/index.html lacks ${needle}`);
  }
  const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(?!https?:)([^"]+)"/g)].map((m) => m[1]);
  lines.push(`    index.html + ${css.join(", ") || "(no local css)"}: transformed by Vite (expected); script tags + restart-battle present`);
  if (!css.length) fail("[integrity] no local stylesheet link in dist/index.html");
}

// ---- (b) asset audit --------------------------------------------------------------------------
{
  const distHas = (p) => {
    let d; try { d = decodeURIComponent(p); } catch { return false; }
    const abs = resolve(DIST, d.replace(/^\.?\//, ""));
    return (abs === DIST || abs.startsWith(DIST + sep)) && existsSync(abs) && statSync(abs).isFile();
  };
  const paths = new Set();
  const require = createRequire(import.meta.url);
  let method = "dynamic";
  try {
    const { auditAssets } = require("./audit-assets.cjs");
    const r = await auditAssets();
    r.paths.forEach((p) => paths.add(p));
    lines.push(`(b) audit method: ${r.method}; routes: ${Object.entries(r.perRoute).map(([k, v]) => `${k}=${v.length}`).join(", ")}`);
    if (!r.paths.length) fail("[assets] dynamic audit recorded no image paths (harness change?)");
  } catch (e) {
    method = "static only";
    fail(`[assets] dynamic audit failed: ${e.message}`);
  }
  // Static supplement: literal paths in script.js (icons, trees, wolf animation files, tiles dir, stag files).
  const js = readFileSync(join(ROOT, "script.js"), "utf8");
  for (const m of js.matchAll(/"((?:assets\/icons|isometric tileset)\/[^"]+\.(?:svg|png))"/g)) paths.add(m[1]);
  for (const m of js.matchAll(/file:\s*"(wolf-[\w-]+\.png)"/g)) paths.add(`wolf/no effects/${m[1]}`);
  for (const dir of ["NE", "NW", "SE", "SW"]) for (const a of ["idle", "walk", "run"]) paths.add(`stag/critter_stag_${dir}_${a}.png`);
  // CSS/HTML references (source styles.css and built html/css).
  const refs = [];
  const scan = (text, from) => {
    for (const m of text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) refs.push([m[2], from]);
    for (const m of text.matchAll(/\b(?:src|href)="([^"]+)"/g)) refs.push([m[1], from]);
  };
  scan(readFileSync(join(ROOT, "styles.css"), "utf8"), "styles.css");
  scan(readFileSync(join(DIST, "index.html"), "utf8"), "dist/index.html");
  for (const f of walk(join(DIST, "assets")).filter((f) => f.endsWith(".css"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) refs.push([m[2], rel(f)]);
  }
  let refOk = 0;
  const cssDir = (from) => (from.startsWith("assets/") ? "assets/" : "");
  for (const [r, from] of refs) {
    if (/^(?:https?:|data:|#|\/\/)/.test(r)) continue;
    const target = r.replace(/[?#].*$/, "");
    if (from === "dist/index.html" && /\.js$/.test(target)) { /* scripts checked below as files */ }
    if (distHas(target) || distHas(cssDir(from) + target)) refOk++;
    else if (from === "styles.css") continue; // source css is replaced by the hashed css; checked via built css instead
    else fail(`[assets] unresolved reference "${r}" in ${from}`);
  }
  let ok = 0;
  for (const p of [...paths].sort()) {
    if (distHas(p)) ok++; else fail(`[assets] image path requested by the game is missing from dist: ${p}`);
  }
  lines.push(`    ${ok}/${paths.size} distinct game asset paths resolve in dist (${method}; + static literal scan); ${refOk} html/css references resolve`);
}

// ---- (c) dev-only exclusion -------------------------------------------------------------------
{
  const top = readdirSync(DIST).filter((n) => n !== ".DS_Store");
  for (const n of top) if (!EXPECTED_TOP_LEVEL.includes(n)) fail(`[exclusion] unexpected top-level entry in dist: ${n}`);
  for (const n of EXPECTED_TOP_LEVEL) if (!top.includes(n)) fail(`[exclusion] expected top-level entry missing: ${n}`);
  const all = walkAll(DIST);
  for (const p of all) {
    const r = rel(p);
    const segs = r.split("/");
    if (segs.some((s) => DENY_NAMES.includes(s.toLowerCase()))) fail(`[exclusion] forbidden path in dist: ${r}`);
    else if (DENY_PATHS.some((d) => r === d || r.startsWith(d + "/"))) fail(`[exclusion] forbidden path in dist: ${r}`);
    else if (DENY_PATTERNS.some((re) => re.test(basename(r)) || re.test(r))) fail(`[exclusion] forbidden file in dist: ${r}`);
  }
  lines.push(`(c) exclusion: top level = [${top.sort().join(", ")}]; ${all.length} entries scanned against denylist`);
}

// ---- (d) serve smoke --------------------------------------------------------------------------
{
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
  const server = createServer((req, res) => {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    const abs = resolve(DIST, "." + (u.endsWith("/") ? u + "index.html" : u));
    if (!(abs === DIST || abs.startsWith(DIST + sep)) || !existsSync(abs) || !statSync(abs).isFile()) { res.writeHead(404); return res.end(); }
    const ext = abs.slice(abs.lastIndexOf("."));
    res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream" });
    res.end(readFileSync(abs));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const cssHref = /<link[^>]*rel="stylesheet"[^>]*href="(?!https?:)([^"]+)"/.exec(html)?.[1];
  const reqs = [
    ["/", "text/html"], ["/script.js", "javascript"], ["/scenarios/intro.js", "javascript"], ["/scenarios/wilds.js", "javascript"],
    ["/wolf/no effects/wolf-idle.png", "image/png"], ["/isometric tileset/separated images/tile_000.png", "image/png"],
    ["/assets/icons/move.svg", "image/svg+xml"], ["/build-id.json", "application/json"], ...(cssHref ? [["/" + cssHref.replace(/^\//, ""), "text/css"]] : []),
  ];
  let ok = 0;
  try {
    for (const [p, type] of reqs) {
      const res = await fetch(`http://127.0.0.1:${port}${encodeURI(p)}`);
      const buf = await res.arrayBuffer();
      const ct = res.headers.get("content-type") || "";
      if (res.status !== 200) fail(`[serve] ${p}: HTTP ${res.status}`);
      else if (!buf.byteLength) fail(`[serve] ${p}: empty body`);
      else if (!ct.includes(type)) fail(`[serve] ${p}: content-type ${ct}, expected ${type}`);
      else ok++;
    }
  } finally { await new Promise((r) => server.close(r)); }
  lines.push(`(d) serve smoke: ${ok}/${reqs.length} requests 200 + non-empty + content-type ok (ephemeral port ${port}, closed)`);
}

// ---- (e) build identity -----------------------------------------------------------------------
{
  const file = join(DIST, "build-id.json");
  const expected = computeGameplayBuildId(ROOT).buildId;
  let ok = false;
  if (!existsSync(file)) fail("[build-id] dist/build-id.json is missing (the replay page needs it)");
  else {
    let data = null;
    try { data = JSON.parse(readFileSync(file, "utf8")); } catch { fail("[build-id] dist/build-id.json is not JSON"); }
    if (data !== null) {
      if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).join(",") !== "buildId") fail('[build-id] dist/build-id.json must be exactly { "buildId": "<64 hex>" }');
      else if (data.buildId !== expected) fail(`[build-id] dist/build-id.json ${String(data.buildId).slice(0, 12)} != source build ${expected.slice(0, 12)} (rebuild: pnpm build)`);
      else ok = true;
    }
  }
  lines.push(`(e) build identity: dist/build-id.json ${ok ? `= source gameplay build ${expected}` : "INVALID"}`);
}

console.log(lines.join("\n"));
if (failures.length) {
  console.error(`\nFAIL: ${failures.length} problem(s)`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nOK: dist is complete, faithful, clean and servable");
