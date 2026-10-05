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
- Approvals are matched to the CURRENT build and the manifest hash, never to a build the manifest merely claims.

## After the gates (still exit 2)
- [ ] `cannot load driver/bots/report` (checked BEFORE consuming, so the authorization is not burned)
- [ ] `could not write consumption record` / `consumption could not be verified after writing` (write to temp file, rename, re-read)
- [ ] `run failed after authorization was consumed` (the authorization stays consumed; a new one is needed)

## Runtime limits during a run
- Authorization is consumed before the first battle starts.
- Before each battle the runner stops (and notes it in the report) when `maxRuntimeSeconds` wall clock or `maxTotalTurns` is reached; each battle is also capped by `maxTurnsPerBattle`. The driver also receives the deadline and the remaining total turns, so both are enforced per turn inside a battle (the battle ends as `timeout`).
