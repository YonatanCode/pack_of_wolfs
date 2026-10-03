// Build-only: the game loads script.js / scenarios/*.js as classic scripts (not bundled by Vite)
// and fetches sprites/tiles/icons by relative path at runtime, so the build must copy them verbatim.
// The logo (assets/pack-of-wolves-logo.svg) is referenced from index.html and emitted by Vite itself.
// Dev server (`vite`) is unaffected: the plugin is apply: 'build'.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

// ALLOWLIST: relative paths copied into the output dir. Nothing else is copied.
const COPY_ALLOWLIST = ["script.js", "scenarios", "wolf", "stag", "isometric tileset", "assets/icons"];

function copyRuntimeAssets() {
  let root = process.cwd();
  let outDir = resolve(root, "dist");
  return {
    name: "copy-runtime-assets",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(root, config.build.outDir);
    },
    closeBundle() {
      for (const rel of COPY_ALLOWLIST) {
        const from = resolve(root, rel);
        if (!existsSync(from)) throw new Error(`copy-runtime-assets: missing allowlisted path "${rel}"`);
        const to = resolve(outDir, rel);
        mkdirSync(dirname(to), { recursive: true });
        cpSync(from, to, { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });
      }
    },
  };
}

export default { plugins: [copyRuntimeAssets()] };
