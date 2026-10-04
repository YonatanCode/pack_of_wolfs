# Engine notes (P1 foundation)

Short, factual notes for whoever builds P2 and the Battle Lab. Dev-only: this file is not shipped in the packaged build.

## 1. Development hooks (today)

The game is a classic script, so **every top-level function is also a `window` property**. "Internal" below means: not on `window.devTest`, not part of any documented API, used by fixtures only. Real encapsulation needs modules or a bundler and is deferred.

| Hook | Where | Purpose | Status |
|---|---|---|---|
| `devTest.reset / queue / queuePack / runTick / runTurn / runScenario / state / setEnemyMode / setArenaSize / world / openWorldMap / chooseCorner / exportHillLayout / loadHillLayout` | `window.devTest` | Pre-existing dev tools and dev-test scenarios | Existing |
| `devTest.loadScenario / restartBattle / getBattleSeeds / getBattleRecord / getRulesRecord / getActiveRules` | `window.devTest` | Scenario loading, seeds and rules record (P1b/P1c) | Keep; Lab-facing reads |
| `devTest.drainTurnCore`, `devTest.getTurnEventLog` | `window.devTest` | Run one full turn's rules headlessly on the live state, read the last turn's events (fixtures only) | **Separate** (see schedule) |
| `devTest.snapshotBattleState`, `devTest.dryRunTurn` | `window.devTest` | Plain-data copy of the battle; preview of the currently queued player orders on a copy | **Separate** (see schedule) |
| `withBattleState`, `loadBattleState`, `dryRunTurnInternal` | global functions only | Swap seam, logical state load (renders nothing), dry run with unvalidated queue overrides. Fixtures only. | **Separate**, keep internal |

**Separation schedule:** during Battle Lab work (P4), gate every hook marked "Separate" so it is attached only in a dev context and is absent from the packaged build. No broader tooling refactor before then.

## 2. Hypothetical orders (P2 requirement)

`dryRunTurn()` previews **only the player orders currently queued**; passing `options.queues` is refused. The unvalidated override exists only as `dryRunTurnInternal` for fixtures. Before any hypothetical-order entry point is exposed to the Battle Lab, **P2 must validate such orders against the same hand, card consumption and action budgets as real play** (`activeRules.playerActionBudget`, hand contents, first-match removal).

## 3. Partial-turn error behaviour (existing; follow-up)

`executePlayerActionQueue` runs the turn end in a `finally`. If the rules core throws mid-turn, the already-applied part of the turn is **kept (no rollback)**, and recovery, hand refill, the next-turn preview, idle animations and the outcome check still run. This matches the behaviour before X2; the fixtures pin it. **Deferred follow-up:** atomic live execution. No automatic dry run before Play is added. Committing from a copy conflicts with the step-by-step replay, so a different design is needed.

## 4. Testing boundary

Permitted: bounded, hand-authored regression fixtures (`node tests/run-all.cjs`, at most 3 turns each, scripted terminal outcomes allowed).
Not permitted without explicit approval: randomized comparisons, bots, full synthetic battles, tuning sweeps. Synthetic testing needs the user's manual playcheck of the exact candidate build, then a separate explicit authorization of its bounded manifest.

**Record of the reviewer's 40 randomized comparisons (P1e review):**
- The independent reviewer (Sonnet 5.5) wrote a throwaway script, `fuzz.cjs`, in the session scratch directory. It is not in the repo and was not saved. The coordinator did not ask for randomized runs; the reviewer chose to run them, and the coordinator included the result in a report without flagging that it went beyond the hand-authored boundary.
- **Scope:** headless Node harness with a virtual clock, no browser, no LLM calls. A fixed pseudo-random generator (seed 12345) built 40 boards from the intro scenario: random positions, facing and health (1-7) for up to six units (some optional units absent), 0-5 random hill tiles and 0-2 random trees, and every fourth board (10 of 40) in stag mode. Player wolves got 0-2 random actions each, with a fallback of one Attack for the lead wolf.
- **Per board:** one `dryRunTurn`, then one real turn through `executePlayerActionQueue`, comparing events and final state. If no player orders remained and both sides were alive, a second turn with fixed scripted orders (lead Move, support Attack) was compared the same way.
- **Turn limits:** at most 2 turns per board (80 maximum). No board was played to a natural end. No bot or strategy chose orders.
- **Result as reported by the reviewer:** 0 mismatches. It is not reproducible from the repo, it is not part of the regression suite, and no gate relies on it. It must not be rerun without the user's approval.

## 5. Follow-ups (not done)

1. **Fault coverage during state-swap setup:** r16 injects faults only inside the core body. Add faults in the swap setup, the final snapshot, and `loadBattleState`.
2. **Reject previews outside supported battle modes** (world map open, no active scenario, guided tutorial) before any preview UI is exposed. Today a preview there reads whatever stale battle state exists (read-only, harmless).
3. Carried from reviews: delete the hand-view compatibility shim once fixtures stop editing the DOM list directly; the enemy queue cap still follows the player budget (`isUnitActionQueueFull`); `activeRules.hash` must be recomputed if P2 adds overrides (done in P2a, see section 6); the hand grid CSS hard-codes five slots; swing-completion order in same-tick multi-attacks is modelled by a stable sort and should be eyeballed in a real browser.

## 6. Per-battle settings (P2a)

Presets `current` (the default) and, since the follow-up step, the limited experimental `commander` preset (section 8). **Changing any setting intentionally changes gameplay and balance; the UI notice says so.** Default settings are byte-identical to before (the whole existing fixture suite is the regression for them).

**Settings and bounds (`SETTINGS_BOUNDS`).** All values must be finite integers (no coercion: `"5"`, `"5abc"`, `1.5`, `NaN`, `Infinity`, `null`, `undefined`, booleans are rejected). The player budget is shared by the whole pack; the enemy budget is independent.

| Key (panel / state) | Link | Default | Bounds |
|---|---|---|---|
| `playerActionBudget` | `pab` | 5 | 1..8 |
| `handSize` | `hs` | 5 | 1..8 |
| `reshuffleCharges` | `rc` | 2 | 0..9 |
| `maxSameAction` | `cap` | 3 | 1..8 |
| `weightMove` / `weightAttack` / `weightDefend` | `wm` / `wa` / `wd` | 1 / 1 / 1 | 0..20 each |
| `enemyActionBudget` | `eab` | 5 | 0..10 (0 = the enemy passes, supported) |
| `poolMove` / `poolDefend` / `poolAttack` | `epm` / `epd` / `epa` | 2 / 1 / 2 | 0..10 each |

The enemy pool is stored as counts and expanded to `RULES.perBattle.enemyActionPool` in the canonical order Move, Defend, Attack (defaults give exactly `[Move, Move, Defend, Attack, Attack]`). `RULES` itself is unchanged.

**Cross-field rules** (all problems are reported together, never just the first). Errors block Apply: at least one weight > 0 ("at least one draw weight must be greater than 0"); the hand must be fillable: (actions with weight > 0) x `maxSameAction` >= `handSize`. Warnings are shown but allowed: `playerActionBudget` > `handSize` ("at most N cards can be queued per turn; the budget is not resized"); `enemyActionBudget` > pool size ("the enemy can plan at most N actions (pool size); neither budget nor pool is resized"); budget > 0 with an empty pool ("the enemy has nothing to plan"). Nothing is ever silently resized. The usable enemy budget is min(budget, pool size); the planner may use fewer (recording unassigned actions is P2b).

**Pending vs active.** The panel edits `pending`; `activeSettings` (frozen) drives `takeActiveRulesSnapshot()`. Active changes only through `applyPendingSettings()` = refuse while busy (throws `DryRunRejected`: turn executing, swap active, tutorial, world mode; nothing changes) -> validate pending (invalid: refused, nothing changes) -> set active -> `restartBattle()` (terrain, units, hand size, budget, charges, pool and RNG reset together). The Restart button, the R key and Play Again restart with the ACTIVE settings; pending is not applied by them. "Reset pending" sets pending to the defaults without applying.

**Record and hash.** `activeRules.hash` is recomputed with `computeRulesHash` from the full effective rules (RULES with `perBattle` replaced); default settings give `0d3ce2ec6fa6de`. `devTest.getEffectiveRulesRecord()` returns `{ preset, customized, version, hash, settings, values }`. `getRulesRecord`, `getBattleSeeds` and `getBattleRecord` are unchanged.

**Link.** `?scenario=<id>&seed=<n>&preset=current&rules=<k>:<v>,<k>:<v>`: only non-default keys, in the key order of the table; default settings emit neither `preset` nor `rules`. Parsing is strict: an unknown or duplicate key, a malformed pair, a non-integer or out-of-bounds value, a settings combination that fails validation, a duplicate `preset`/`rules` parameter, or an unknown `preset` rejects the WHOLE `rules` parameter (no partial application, no console output): the battle boots with the defaults and the reason is shown in the panel and in `getRulesLinkStatus()`. `?mode=world` ignores custom settings (world mode always plays the defaults; the panel is locked). "Copy link" builds the link for the ACTIVE settings.

**Tutorial, dev scenarios, world mode.** Starting the guided tutorial with custom active settings switches the ACTIVE settings to the defaults and restarts the battle under them (with default settings active nothing restarts, as before); if a turn is running the tutorial is not started. Apply is disabled during the tutorial. When it ends the active settings STAY the defaults; the pending (custom) values stay in the panel, marked "not applied (the tutorial reset the active settings)". `runDevTestScenario` runs under the default settings and restores the previous active settings and rules afterwards (the scenario itself still exits the scenario battle, as before). `startArena` / the legacy reset always use the defaults.

**Weighted drawing.** `randomAction` picks among actions under the duplicate cap AND with weight > 0, proportionally to the integer weights, consuming exactly one `handRandom()` value: `floor(r * totalWeight)` walked through the cumulative weights. Equal weights give the same index as the old `floor(r * eligible.length)`, so equal-weight hands are unchanged. (Exact for weight 1, where the arithmetic is identical. For other equal weights such as 2/2/2 the identity is verified empirically by r20 on specific seeds, not proven: `floor(r*n*w)/w` could in theory differ by one ulp at an integer boundary.) The enemy intent tags are sliced by the enemy budget and the player tags by the player budget; the enemy branch of `isUnitActionQueueFull` still follows the player budget under `current` (commander: the enemy budget). If no action is eligible (impossible under valid settings; reachable only via dev tools such as "fill Move") it falls back to one value among the actions with weight > 0 (or all actions), ignoring the cap. The hand, carry-over, reshuffle, prepend order and first-match removal are unchanged.

**Layout notes.** `--hand-slots` / `--queue-slots` on `<html>` follow the active hand size / player budget whenever a battle loads. The constant tables (`SETTINGS_BOUNDS`, `SETTINGS_LINK_KEYS`, `RULESET_PRESETS`) are `window` properties and the mutable settings state hangs off `getRulesState()` because r19 pins the top-level declaration inventory of `script.js`. The enemy branch of `isUnitActionQueueFull` still follows the player budget (the planners use `enemyActionBudget` directly). Fixtures: r20 to r24; the P2a fixtures draw at most 500 seeded hands in total (golden-recorded counts).

## 7. P2a gap checks (follow-up)

- **`loadBattleState` refuses foreign rules.** A BattleState whose rules (version, hash and values) differ from the live battle's effective rules is refused with `BattleStateError` before anything is written (it used to adopt them silently). A state recorded under the same settings still loads and reproduces the identical snapshot and dry run.
- **Fixtures r25 to r27** (bounded, hand-authored): previews and snapshot / restore under custom settings (r25), the settings store (`getRulesState()`: value, identity and pinned key set) untouched by previews, failed previews and refused Apply (r26), failed-Apply rollback, intent tags by team budget and `-0` / `0` panel input (r27).
- **Hand ledger.** The P2a total now also counts r20's inline old-formula reference hands (60 + 30): **488** (limit 500). The follow-up fixtures keep a separate ledger (`reportStepHands`, limit 100; r25 to r27 use 23, r25 to r31 use 72).
- **Known partial state on a failed Apply** (not changed): if the restart throws after the rules snapshot, settings, `activeRules` and the CSS variables roll back, but whatever `loadScenario` already reset before the fault (for example the reshuffle charges) is not restored; a successful Apply or restart resets everything.

## 8. Commander preset (experimental: enemy-action rules only)

A LIMITED EXPERIMENT. Its only differences from `current` are the enemy-action rules below; budgets, hand and draw settings apply to both presets. Presets are the only switch: the rule switches (`COMMANDER_RULES.enemyRules`) are fixed by the preset, not editable. Under `current` nothing changes (all P1/P2a fixtures pass unchanged; the default hash stays `0d3ce2ec6fa6de`).

- **Plumbing.** Panel option "Commander ruleset (experimental: enemy-action rules only)". The preset lives in `getRulesPresetState()` (`active` / `pending`, beside the settings store so the settings record keeps its shape); it is applied together with the settings on Apply (and rolled back with them if the restart fails), and Restart / R / Play Again keep the ACTIVE preset. Link: `preset=commander` alone or with `rules=`; Copy link emits it; `preset=bogus` is still rejected. Tutorial, world mode and dev scenarios force `current` + default settings exactly as P2a does (the tutorial also resets the preset; dev scenarios restore it). Scenario label: `... · commander (experimental)`. `activeRules` gets `preset: "commander"` only under commander, version `0.2.0-commander-enemy-actions`, and a hash over the effective rules plus the preset and its rule switches (`computeRulesHash(getEffectiveRulesRecord().values) === hash` for both presets).
- **Frozen plan.** The enemy plan is computed once per planning phase (battle load / restart / any reset, and the end of each turn) and frozen: queue edits, reshuffles, preview refreshes and Play only re-render it; the turn start uses it. Flag: `getEnemyPlanState().frozen` (off the top level), set by the pack planner under commander and cleared by `clearEnemyPackActionQueue()` (every reset) and at the turn end. It is BattleState under commander (`enemyPack.planFrozen`, swapped by `withBattleState`, loaded by `loadBattleState`), so `dryRunTurn` equals the real turn.
- **Forfeit, no refund.** A dead enemy's remaining planned actions are forfeited (`forfeited` event: unit, tick, actions); survivors keep their queues; no mid-turn replan (`current` keeps its fresh-pool replan, which can spend more than the budget).
- **Budget ceiling.** Enemy actions spent in a turn never exceed `enemyActionBudget` (asserted in the core); the next turn's plan is fresh from the configured budget and pool. The enemy branch of `isUnitActionQueueFull` uses the enemy budget.
- **Accounting** (events `enemyBudget` + `unassigned` at turn start, `forfeited` at a death, `enemyAccounting` at turn end; an "Enemy actions" block appended to the battle note; all commander-only, wolves mode only: stag mode has no pack plan and no accounting). Assigned = spent + forfeited + unplayed; budget = assigned + unassigned (both asserted). Unassigned reasons: `budget-zero`, `pool-limit` ("the pool has only P actions"), `no-valid-assignment` ("the planner could place no valid use for N pool action(s): ..."). Unplayed = still queued because the battle ended first.
- **Fixtures** r28 (freeze, out-of-band control, dry run = play, BattleState flag, store audit), r29 (forfeit vs current's replan), r30 (accounting cases and note text), r31 (queue limit by team, tags, preset plumbing). Follow-up ledger: r25 to r31 use 72 hands (limit 100). Deferred: target commitment, richer previews, any commander / event-panel UI, `validateOrders`.

**Known limits of the commander experiment (not fixed).** (1) If an enemy is killed out of band during planning through a dev setter (`setUnitHealth`), its actions stay in the frozen plan; they are skipped at execution and shown as "unplayed" in the accounting, with the note's "battle ended first" wording, which is inaccurate for that case only. (2) When a core error unwinds a turn, the strict accounting check is skipped so it cannot mask the original error; the turn end then runs as before.
