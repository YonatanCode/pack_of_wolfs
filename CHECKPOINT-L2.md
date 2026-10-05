# Checkpoint L2: Battle Lab tooling (no battles run)

- Branch `battle-foundation` (not merged, not pushed). Tree clean except unrelated `gui-pack/`; `stash@{0}` untouched.
- Gameplay build ID unchanged from L1+fallback: `c82d07fef15add9e182bc0dd7e3c50bda1c28ed72b89161f62e3599c030d3874` (no gameplay file changed; manual playcheck on this build is already recorded).
- `lab/approvals.json` does not exist: no playcheck or run authorization is recorded for any Lab run. No bot, battle, batch or generated input was executed.

## Review these three pages (everything else is optional)
1. `tools/lab/GATES.md`: every refusal and its message, plus known PoC limits.
2. `tools/lab/CONTRACT.md` (Manifest section) + caps in `tools/lab/manifest.cjs`: maxBattles 200, maxTurnsPerBattle 60, maxTotalTurns 5000, maxRuntimeSeconds 1800.
3. `tools/lab/BOTS.md`: what each bot sees and does.

## What exists
- `manifest.cjs`, `approvals.cjs`, `run.cjs` (`--check-only` | `--run`): strict manifest; `--run` needs valid manifest, build == current, clean gameplay tree, playcheck for exact build, unconsumed authorization for exact build + manifest hash; single-use (lock + temp/rename, consumed before first battle); build re-verified before each battle; `--approvals` refused with `--run`.
- `driver.cjs`, `metrics.cjs`, `report.cjs`: headless driver on `runHeadlessTurn`/`observeBattle` only; per-turn budget/planned/executed/wasted (also per wolf and enemy); win/loss/draw/timeout/error; replay reproduces record; deterministic report; Wilson 95% intervals; fixture labelling.
- `bots.cjs`: `random-legal`, `aggressive-pursuit` (intent-reader deferred: observation omits enemy intent tags).
- `viewer/index.html` + `sample-report.json`: static, no network, shows notes/fixture banner/small-n and error warnings, replay links.

## Verification
- `node tests/run-all.cjs`: all match goldens (coordinator re-ran; agents confirmed byte-identical reruns). `pnpm check:dist` OK; tools/lab not in dist.
- Fixtures b1, d1-d3, g1-g3: hand-authored only (scripted bots, <=2 turns, injected fakes). Real `--run` success path never executed.
- Sonnet review (read-only): no blocker. Fixed: `--approvals` bypass, mid-run build change, consume race (lock), viewer hid notes, gitignore for temp/lock files.

## Open / known limits
- Hung synchronous bot or engine call cannot be interrupted by the runtime limit (authorization already consumed); child-process kill is later hardening.
- Manifest scenario/preset names are not validated against the game; a typo burns the authorization on setup-error records.
- Bots are isolated by convention and a source grep, not a sandbox. Gates are a process control, not a security boundary.
- Errors/timeouts count as non-wins inside n (viewer warns when errors > 0).
- Dev hooks still ship in the packaged build until gating.
- Fixture boards' hand-placed setups are not carried in `replay.query`.
