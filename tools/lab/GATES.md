# Battle Lab gates: every refusal

Process control, not a security boundary. `--check-only` never runs anything. `--run` refuses (exit 2, message on stderr) unless ALL gates pass. Exit codes: 0 ok, 2 refused/invalid/usage error. `--check-only` exits 0 when the manifest is valid (gate FAIL lines are informational) and 2 when it is invalid.

Approvals live in `lab/approvals.json` (gitignored). No tool in this repo creates playcheck or authorization records; they are written only by the coordinator after your explicit chat messages. The only write the code makes is stamping `consumedAt` on an authorization.

## Usage errors (exit 2)
- [ ] exactly one of `--check-only` / `--run` is required
- [ ] `--manifest <file>` is required; unknown arguments and flags without a value are rejected

## Gate 1: manifest valid
- [ ] unreadable file / not JSON: `cannot read manifest: ...`
- [ ] not an object; unknown key (top level, `limits.*`, `scenarios[i].*`); missing required key
- [ ] `schemaVersion` must be 1; `buildId` 64 lowercase hex; non-empty `label` (max 200), `preset`; `botSeed` an unsigned 32-bit integer
- [ ] scenarios: non-empty, unique ids, seeds non-empty unique integers (max 200 per scenario)
- [ ] strategies: non-empty, unique, each must exist in `bots.cjs` BOTS (no registry = refused)
- [ ] every limit required, positive integer, at or under its hard cap: maxBattles 200, maxTurnsPerBattle 60, maxTotalTurns 5000, maxRuntimeSeconds 1800
- [ ] scenario ids and preset must be supported by the game (`unknown scenario: X (supported: ...)`, `unknown preset: X (supported: ...)`); read statically from scenarios/*.js and script.js; unreadable sources = refused. This happens before the authorization is consumed.
- [ ] battle count (sum of seeds x strategies) must be <= `limits.maxBattles`

## Gate 2: build ID
- [ ] `stale build: manifest.buildId X != current Y`
- [ ] cannot compute the current build ID

## Gate 3: clean tree
- [ ] `gameplay tree is dirty (uncommitted changes in gameplay paths)`
- [ ] `gameplay tree state unknown (not a git checkout?)` (unknown counts as not clean)

## Gate 4: playcheck
- [ ] `no playcheck for build X` (also notes when playchecks exist only for other builds)
- [ ] approvals file not valid JSON / wrong shape / bad record / unknown key: `approvals file malformed: ...`

## Gate 5: authorization (single-use)
- [ ] `no authorization for build X and manifest hash H`
- [ ] `no authorization for manifest hash H (authorizations exist only for other manifests)`
- [ ] `authorization for this build and manifest hash was already consumed (single-use)`
- [ ] malformed approvals file (same message as above)
- [ ] `authorization has no labVersion ...` / `authorization is bound to a different Lab version (current labVersion L)`: authorizations carry `labVersion` = sha256 of tools/lab/{driver,bots,manifest,approvals,run,report,metrics}.cjs; any edit to those files voids existing authorizations. Playchecks stay bound to the gameplay build only. `--check-only` prints the current labVersion.
- Approvals are matched to the CURRENT build and the manifest hash, never to a build the manifest merely claims.

## After the gates (still exit 2)
- [ ] `cannot load driver/bots/report` (checked BEFORE consuming, so the authorization is not burned)
- [ ] `could not write consumption record` / `consumption could not be verified after writing` (write to temp file, rename, re-read)
- [ ] `run failed after authorization was consumed` (the authorization stays consumed; a new one is needed)

## Runtime limits during a run
- Authorization is consumed before the first battle starts.
- Before each battle the runner stops (and notes it in the report) when `maxRuntimeSeconds` wall clock or `maxTotalTurns` is reached; each battle is also capped by `maxTurnsPerBattle`. The driver also receives the deadline and the remaining total turns, so both are enforced per turn inside a battle (the battle ends as `timeout`).

## Runtime isolation
- Each battle runs in a child process (`node run.cjs --worker`), SIGKILLed at the remaining `maxRuntimeSeconds`. The killed battle is kept as a `timeout` record with stopReason `runtime-deadline-killed`, completed records are kept, no further battles start, the report note is `stopped early: runtime deadline; N of M battles completed`, and the report is still emitted.
- Child crash, non-zero exit or unparseable output becomes an `error` record (stopReason `child-crash` / `child-bad-output`); the run continues.

## Known limits (PoC)
- The gates are a process control, not a security boundary: anyone with disk access can edit `lab/approvals.json`.
- `--approvals <path>` is refused with `--run` (always `lab/approvals.json`); the gameplay build ID and clean tree are re-verified before EACH battle, and a change stops the run with the note "aborted: gameplay build changed after authorization".
- Consuming takes `lab/approvals.json.lock`; a held or stale lock is refused with a message and never auto-broken.
- A hung bot/engine call is killed with its child process at the runtime limit, but the authorization is already burned by then.
- Bots are isolated by convention and a source grep, not a sandbox.
