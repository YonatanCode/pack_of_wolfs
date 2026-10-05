# Checkpoint L3a: reshuffle as a player order

- Branch `battle-foundation` @ `ad8812e` (+ this file). Not merged, not pushed. Tree clean except unrelated `gui-pack/`; `stash@{0}` untouched.
- Full gameplay build ID: `ab80e901d64eab8d615680cad6cc44d9c1b513bbaeb95df3bf9afc4c4f8ec3a7` (was `c82d07fef15add9e182bc0dd7e3c50bda1c28ed72b89161f62e3599c030d3874`; only `script.js` changed).
- Playable: http://localhost:4173/?scenario=intro&seed=1 (vite preview of `dist/`, serves `script.js` byte-identical to source).
- Playcheck status: NONE recorded for this build. The draft `tools/lab/manifests/smoke-1.json` still names the old build ID. No synthetic testing authorized or run.

## Player-visible changes
None expected. The Reshuffle button now validates its click through `validatePlayerOrders` (refusal stays silent). Its data and rendering steps are the same as before: same draws, same slide-in, same button state. The button's enabled state is still `canReshuffle()`.

## What changed (script.js)
- `reshufflePlayerHandData()`: the rules half of the button (spend a charge, clear queues, clear the hand, `drawPlayerHandToSize`). The button and the headless door both use it.
- New order `{ reshuffle: true }` in `validatePlayerOrders` / `applyPlayerOrders` / `runHeadlessTurn`. The door applies it as `reshufflePlayerHandData()` + `updateEnemyIntentPreview()` inside `runInTurnCore`.
- Refusal reasons:
  - `malformed-order`: the order is not exactly `{ reshuffle: true }`.
  - `no-reshuffle-charges`: no charge left. Charges are counted in sequence.
  - `hand-not-observed`: a card order after a reshuffle in the same list. It is refused whatever the new hand holds, so a refusal cannot reveal cards that have not been drawn.
  - The existing list-level reasons still apply: `turn-executing`, busy, `tutorial-active`, `battle-over`, `no-player-orders`.
- Observation: no new key. The hand, charges and per-wolf queues were already exposed. The rules-panel total `reshuffleCharges` is not exposed, because adding it would change r44's pins and golden.

## Verification
- `node tests/run-all.cjs`: all match goldens, exit 0. Two more runs were byte-identical, one of them on the committed tree. No existing golden or recording changed (r1-r45, Lab).
- `pnpm build` OK, `pnpm check:dist` OK, and `dist/script.js` is identical to the source. The preview already running on 4173 serves the new `script.js` and `index.html` byte-identically.
- New fixture r46: hand-authored, at most one turn per context, no generated orders or boards. It uses 18 hands from the L1 ledger (total 58 of 60).

## Known limits
- A bot must reshuffle in one call, then observe, then order in a later call. This is by design (see `hand-not-observed`).
- The door is refused in the guided tutorial, where the UI button still works (unchanged).
- After a headless reshuffle nothing re-renders. The button's charge count and the hand view show the old state until the UI re-renders.
- Lab bots still do not reshuffle. `tools/lab` is unchanged.
