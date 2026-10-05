# Checkpoint L3: visual replay page (Agent A)

- Branch `battle-foundation` (see `git log` for the commits after `18d5eb4`; this file is the last one). Not merged, not pushed. Tree clean except the unrelated `gui-pack/`; `stash@{0}` untouched; no `pnpm install`.
- Full gameplay build ID: `7df983674acac7a2db5461a7164acf2f704108f0467fdae96cbb0f61a2a78d03` (was `ab80e901d64eab8d615680cad6cc44d9c1b513bbaeb95df3bf9afc4c4f8ec3a7`; `script.js`, `index.html` and `styles.css` changed). `dist/build-id.json` holds the same value.
- Playcheck status: NONE recorded for this build. No synthetic testing authorized or run. No bot was run.

## What changed
- `window.devTest.hashTurnEvents(events) -> string`: THE turn-event hash for the Lab driver and the replay page. It normalises the events with a JSON round trip, writes them in canonical form (sorted keys) and hashes them with cyrb53: 14 lowercase hex digits. A non-array throws `TypeError`. This is a separate function from `dryRunTurn().eventHash`, which is unchanged. Committed first, on its own (`8d3ff19`).
- Replay page `?replay=1#r=<base64url(JSON)>` (payload v1 as in tools/lab/CONTRACT.md). The flow:
  1. Strict validation.
  2. Build identity check against `./build-id.json`.
  3. Setup only from the payload, through the normal strict rules-link path and `loadScenario`.
  4. Check `rulesVersion` and `rulesHash`.
  5. Play each turn. Every step except the last goes through `applyPlayerOrders`. The last step goes through `applyPlayerOrders(.., { turn: true })` and then `executePlayerActionQueue`, which is the Play button's own driver and animations.
  6. After each turn, `hashTurnEvents` is compared with the recorded `eventHash`.

  The panel has Play/Pause, Next turn, Restart replay, `Turn k / N`, and the recorded orders as text (e.g. `Step 1: reshuffle` / `Step 2: P1: Move, Attack -> target E2; P2: Defend`). Player input is locked in two ways: guards on the input paths, and a capture-phase blocker outside the panel. Details are in ENGINE-NOTES.md section 11.
- `pnpm build` writes `dist/build-id.json` (`{"buildId": ...}`) using `computeGameplayBuildId`, which is now exported from `tools/build-id.mjs`. No git command runs, and the CLI output is byte-identical. `pnpm check:dist` expects the file, serves it, and checks it against the source tree (check (e)). The deny-list is unchanged.
- No new top-level declaration. The r19 inventory and golden are unchanged.

## Messages (r48 pins all of them)
- Payload: `Replay refused: payload field "<path>" is missing | is not a v1 replay payload field | must be ...`. Paths look like `turns[1].steps[0][2]`. There are also `?replay`, `#r` and `payload` (not an object) refusals: missing, empty, too long, not base64url UTF-8, not JSON, extra query parameters.
- Build: `Replay refused: build mismatch: the payload was recorded on build <12 hex>, this page is build <12 hex>`. When the build cannot be determined: `build identity unavailable; relying on rules hash and per-turn event hashes (<reason>)`, and the replay continues.
- Rules: `Replay refused: the recorded rules differ from the rules this page loaded: rulesVersion: recorded "..." vs loaded "..."; rulesHash: recorded ... vs loaded ...`. Only the differing fields are listed. The link parser can refuse with `the recorded preset / rulesQuery do not load: rules link rejected (...)`. An unknown scenario gives `scenarioId "x" is not a scenario of this build`.
- Playback: `Divergence at turn N: recorded <h1> vs replayed <h2>` (the board stays visible). A refused order list gives `Playback stopped at turn N, step S: the game refused the recorded orders (<reason>: <message>).`

## Verification
- `node tests/run-all.cjs`: all match goldens, exit 0. Two runs were byte-identical. No existing golden or recording changed.
- New fixtures:
  - r47: replay = headless recording for 3 turns, covering hashes, final BattleState including the hand stream, last events, observation and note. Also covers Restart (identical results), the input lock with a normal-boot control, and a normal boot being unchanged.
  - r48: divergence at turn 2, build mismatch, 7 rules and link refusals, 41 malformed cases, 3 on-page refusals, and 4 cases where the build is unavailable.
  - Both use one hand-authored 3-turn battle whose hashes are recorded once headlessly. Hand ledger: 58 of 60.
- `pnpm build` OK. `pnpm check:dist` OK, (a) to (e). `dist/build-id.json` equals `node tools/build-id.mjs`.
- The preview already running on :4173 serves `script.js`, `index.html` and the CSS byte-identical to `dist`. It serves `build-id.json` as `application/json`.
- The vite dev server answers `/build-id.json` with HTML, so the replay page shows the "unavailable" warning there (by design).

## Manual playcheck (browser not tested by the harness)
To try the replay, open `http://localhost:4173/?replay=1#r=<payload>` with the fixture battle's payload. The payload has `buildId` = this build. You can generate the link with:
`node -e 'const X=require("./tests/characterization/_replay.cjs");const r=X.record();console.log("http://localhost:4173/?replay=1"+X.encode(X.payloadOf(r,(p)=>{p.buildId="7df983674acac7a2db5461a7164acf2f704108f0467fdae96cbb0f61a2a78d03"})))'`

Check the following:
- Panel layout, including phone width.
- The reshuffle slide-in.
- The animations of each turn.
- Pause and Next.
- Restart.
- That clicks on the board, cards, Play and Reshuffle do nothing.

## Known limits
- The harness does not cover any of these:
  - real rendering
  - the window blocker on real events
  - CSS hiding
  - timing feel
- Pause cannot cut a turn mid-animation.
- A refused page builds a hidden placeholder arena.
- One file outside Agent A's list was edited: `tools/build-id.mjs` gained an export (`computeGameplayBuildId`, `GAMEPLAY_PATHS`); its CLI output is byte-identical, so `tools/lab/run.cjs` is unaffected. Inside script.js, `resolveBootRules` gained an optional `search` argument (the boot call is unchanged).
