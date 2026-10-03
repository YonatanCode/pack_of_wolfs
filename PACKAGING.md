# Packaging & Distribution

## Why a Custom Build Step

The game loads script.js and scenario definitions as classic `<script>` tags (not bundled by Vite) and fetches sprites, tiles, and icons by relative path at runtime. A Vite plugin (`copyRuntimeAssets` in vite.config.mjs) copies an allowlist of files verbatim into `dist/`: script.js, scenarios/, wolf/, stag/, isometric tileset/, and assets/icons/. The logo (assets/pack-of-wolves-logo.svg) and CSS are emitted by Vite itself.

## Build & Verification

```sh
pnpm build                 # Run Vite (emits CSS, logo, index.html; plugin copies runtime assets)
pnpm check:dist           # Validate dist/: byte-identical copies, no dev-only files, serve smoke test
pnpm preview              # Start a local server on http://localhost:4173
```

Open **http://localhost:4173/?scenario=intro&seed=1** in the browser (world mode: `?mode=world`).

## Manual Checklist

- [ ] Page loads without a blank screen
- [ ] Wolf, tile, rock, and icon sprites render
- [ ] Queue actions and press Play for one turn
- [ ] Restart / R works
- [ ] Seed 1 opening hand is Attack, Move, Attack, Defend, Defend (c8 fixture value)
- [ ] Browser console shows no errors or 404s

## Excluded from dist (Dev-Only)

Tests, tools, documentation (*.md), assets/sound (unused), gui-pack/, and future Battle Lab are not copied to dist.

## Known Limits

The build prints two warnings about `<script>` tags that cannot be bundled without `type="module"` (for scenarios/intro.js and script.js); these are expected and harmless—files are copied verbatim. Output is unminified with no content hashes. Vite-emitted CSS and logo links are absolute (`/assets/...`), so dist/ must be served from the domain root. Google Fonts "Jersey 10" loads from the network. Any change to script.js makes dist/ stale until `pnpm build` is rerun. This is a PoC packaging step, not production deployment (no CSP, no hosting config).
