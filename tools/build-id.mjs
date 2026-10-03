// Gameplay build ID: sha256 over sorted (path, bytes) of the WORKING-TREE files that define gameplay.
// Committed and uncommitted content both count. Prints JSON { buildId, headSha, gameplayPathsDirty, fileCount }.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, lstatSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATHS = [
  "index.html", "script.js", "styles.css", "engine", "scenarios", "wolf", "stag",
  "isometric tileset", "assets/icons", "assets/pack-of-wolves-logo.svg",
];

// Policy: symlinks (files or directories) are NEVER followed or hashed; they are skipped (lstat).
function walk(abs, out) {
  const st = lstatSync(abs);
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (name === ".DS_Store") continue;
      walk(join(abs, name), out);
    }
  } else if (st.isFile()) {
    out.push(abs);
  }
}

const files = [];
const includedPaths = [];
const missingPaths = [];
for (const p of PATHS) {
  const abs = join(root, p);
  if (existsSync(abs)) { includedPaths.push(p); walk(abs, files); } else missingPaths.push(p);
}
// engine/ and scenarios/ are optional (may not exist yet); anything else missing is worth a loud warning.
for (const p of missingPaths) {
  console.error(`build-id: warning: configured path not found: ${p}${["engine", "scenarios"].includes(p) ? " (optional)" : ""}`);
}
const rel = files.map((f) => relative(root, f).split(sep).join("/")).sort();

const hash = createHash("sha256");
for (const r of rel) {
  const bytes = readFileSync(join(root, r));
  hash.update(`${r.length}:${r}\0${bytes.length}\0`);
  hash.update(bytes);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
let headSha = null;
let dirty = null;
try {
  headSha = git("rev-parse", "HEAD").trim();
  dirty = git("status", "--porcelain", "--", ...PATHS.filter((p) => existsSync(join(root, p)))).trim().length > 0;
} catch {
  // not a git checkout: leave null
}

console.log(JSON.stringify({ buildId: hash.digest("hex"), headSha, gameplayPathsDirty: dirty, fileCount: rel.length, includedPaths, missingPaths }, null, 2));
