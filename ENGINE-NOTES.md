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
3. Carried from reviews: delete the hand-view compatibility shim once fixtures stop editing the DOM list directly; the enemy queue cap still follows the player budget (`isUnitActionQueueFull`); `activeRules.hash` must be recomputed if P2 adds overrides; the hand grid CSS hard-codes five slots; swing-completion order in same-tick multi-attacks is modelled by a stable sort and should be eyeballed in a real browser.
