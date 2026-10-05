// Gameplay build ID: sha256 over sorted (path, bytes) of the WORKING-TREE files that define gameplay.
// Committed and uncommitted content both count. Prints JSON { buildId, headSha, gameplayPathsDirty, fileCount }.
// computeGameplayBuildId(root) is the same hash without git (no git command runs): vite.config.mjs uses it to emit
// dist/build-id.json and tools/check-dist.mjs to verify that file.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, lstatSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const GAMEPLAY_PATHS = [
  "index.html", "script.js", "styles.css", "engine", "scenarios", "wolf", "stag",
  "isometric tileset", "assets/icons", "assets/pack-of-wolves-logo.svg",
];
const PATHS = GAMEPLAY_PATHS;

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

/** The gameplay build ID of the working tree under `base` (pure file hashing, no git). */
export function computeGameplayBuildId(base = root) {
  const files = [];
  const includedPaths = [];
  const missingPaths = [];
  for (const p of PATHS) {
    const abs = join(base, p);
    if (existsSync(abs)) { includedPaths.push(p); walk(abs, files); } else missingPaths.push(p);
  }
  const rel = files.map((f) => relative(base, f).split(sep).join("/")).sort();

  const hash = createHash("sha256");
  for (const r of rel) {
    const bytes = readFileSync(join(base, r));
    hash.update(`${r.length}:${r}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return { buildId: hash.digest("hex"), fileCount: rel.length, includedPaths, missingPaths };
}

function main() {
  const { buildId, fileCount, includedPaths, missingPaths } = computeGameplayBuildId(root);
  // engine/ and scenarios/ are optional (may not exist yet); anything else missing is worth a loud warning.
  for (const p of missingPaths) {
    console.error(`build-id: warning: configured path not found: ${p}${["engine", "scenarios"].includes(p) ? " (optional)" : ""}`);
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

  console.log(JSON.stringify({ buildId, headSha, gameplayPathsDirty: dirty, fileCount, includedPaths, missingPaths }, null, 2));
}

// CLI only when run directly (`node tools/build-id.mjs`), never on import.
function isMain() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isMain()) main();
