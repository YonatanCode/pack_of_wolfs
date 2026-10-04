# Checkpoint L1: shared order validation, observation, headless turn

- Branch `battle-foundation` @ `12833ec` (not merged, not pushed). Tree clean except unrelated `gui-pack/`; `stash@{0}` untouched.
- Full gameplay build ID: `dfa2df16d5a27293deaf12fb444e797ec0f9f2473c075b3cc4f1f81c4f74692e`
- Playable: http://localhost:4173/?scenario=intro&seed=1&preset=commander (vite preview of `dist/`).
- Playcheck status: NONE recorded for this build. No synthetic testing authorized.

## Player-visible changes
None expected. The UI click paths now validate through the shared function; refusal reasons and status lines are meant to be unchanged. The only text drift found by review: in commander target selection, an absent/inactive enemy shows the existing "is defeated: pick a living enemy" text (the old `!isUnitAlive` branch did the same).

## What was added (script.js, dev hooks on `window.devTest`)
- `validatePlayerOrders(orders)`: sequential validation (unit, card in hand, shared pack budget, same-action cap, targets, turn running). Used by `applyPlayerAction` and `handleEnemyTargetIntent`.
- `applyPlayerOrders(orders, { turn })`: validate whole list, then apply via the UI's own `consumeAvailableAction`, `queueUnitAction`, `setUnitTarget`. Refusal changes nothing, including a pending DOM hand edit (restored).
- `runHeadlessTurn(orders, { includeEvents })`: apply, then `drainTurnCore`. Default result `{ ok, outcome, observation }`; `events` only with `includeEvents: true` (dev/fixtures; contains next-turn enemy plan, NOT bot-safe).
- `observeBattle()`: plain-data copy of what a player sees. No enemy plans, AI internals, RNG/seed.
- ENGINE-NOTES.md section 10 and hooks table updated.

## Verification
- `node tests/run-all.cjs`: all match goldens, exit 0 (agent: byte-identical rerun; coordinator: re-run once, pass).
- `pnpm build` OK, `pnpm check:dist` OK, preview serves `dist/script.js` and `index.html` byte-identical to dist; `dist/script.js` identical to source.
- No existing recording changed (r1-r40). New fixtures r41-r44 + `_orders.cjs` helper; hand ledger 39 of limit 60.
- Fixtures are hand-authored, at most 2-3 turns, no generated orders/boards. No bots, batches or autonomous battles were run.

## Review (Sonnet, read-only, no randomized checks) and resolution
1. Events leak enemy plan: FIXED (opt-in).
2. Hand mutated before validation: FIXED (restore on refusal; r41 cases).
3. No rollback if an "impossible" mid-apply failure occurs: OPEN, low (unreachable today; validate and queue share the budget).
4. UI validates before adopting a pending DOM hand edit: OPEN, low (no double charge; reasons corrected by fallthrough).
5. Equivalence proven only for default-mode Move/Attack/Defend (no movement-mode, reshuffle or remove-card order types): OPEN, known gap.
6. RNG-leak assertion: FIXED (key and value walk).
7. Spy proves call not gating: accepted (separate refusal-changes-nothing checks cover gating).
8. Default UI behaviour: no live-play change found.

## Known limits
- No turn counter in the engine; caller counts turns.
- Observation omits enemy intent tags entirely, even visible ones.
- Headless entry renders nothing; the on-page UI goes stale until the next click.
- An engine error during a headless turn behaves like `drainTurnCore` (no Play end-of-turn cleanup).
- Defeated-wolf order: UI refuses `unknown-unit`, headless `unit-defeated`.
- Dev hooks still ship in the packaged build until Battle Lab gating (P4).
