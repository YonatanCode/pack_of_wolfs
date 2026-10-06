# Battle Lab L2 interface contract

Dev-only tooling. PoC-grade: the approval gate is a process control, not a security boundary (anyone with disk access can edit a local file). No gameplay file (index.html, script.js, styles.css, scenarios/, wolf/, stag/, tileset, icons, logo) may change in L2; if it must, STOP and report. Everything lives under `tools/lab/` and `tests/lab/`, CommonJS (`.cjs`), Node built-ins only, no new npm dependencies, no LLM calls, no network.

## Hard testing boundary
- Nothing in L2 may execute an autonomous battle, bot-vs-game loop, batch, sweep, generated board or fuzz during development. Fixtures are hand-authored, <=3 turns, with scripted orders/outcomes.
- The driver may be exercised only with a SCRIPTED bot (fixed returned orders) for <=2 turns on a hand-authored board, labelled `fixtureOnly: true`.
- Real bots (`bots.cjs`) are tested only by calling `decide()` on hand-authored observation objects, never by playing them against the game.
- `run.cjs --run` is tested only through its REFUSAL paths. No real approval records exist and none may be created by agents (approvals are written only by the coordinator after explicit user chat messages).

## Files and owners (one writer per file)
| File | Owner |
|---|---|
| `tools/lab/driver.cjs`, `report.cjs`, `metrics.cjs` | Agent D (Opus) |
| `tools/lab/manifest.cjs`, `approvals.cjs`, `run.cjs` | Agent G (Sonnet) |
| `tools/lab/bots.cjs` | Agent B (Sonnet) |
| `tools/lab/search.cjs` (search-benchmark) | search-benchmark agent |
| `tools/lab/viewer/` (later) | Haiku, after schema is final |

## Manifest (JSON, schemaVersion 1)
```
{ "schemaVersion": 1, "label": "string",
  "buildId": "<64-hex gameplay build id>",
  "preset": "commander",
  "scenarios": [ { "id": "intro", "seeds": [1,2,3] } ],
  "strategies": ["random-legal", "aggressive-pursuit"],
  "limits": { "maxBattles": n, "maxTurnsPerBattle": n, "maxTotalTurns": n, "maxRuntimeSeconds": n },
  "botSeed": n }
```
Every limit is REQUIRED (positive integers, with hard upper caps defined in manifest.cjs). Battles = scenarios x seeds x strategies must be <= maxBattles. Unknown keys rejected. `manifestHash` = sha256 of canonical (sorted-key) JSON.

## Approvals (`lab/approvals.json`, gitignored)
```
{ "playchecks": [ { "buildId", "quote", "recordedAt" } ],
  "authorizations": [ { "buildId", "manifestHash", "labVersion", "quote", "recordedAt", "consumedAt": null } ] }
```
`run.cjs --run` refuses unless: current gameplay build ID (tools/build-id.mjs logic) equals manifest.buildId; gameplay tree not dirty; a playcheck exists for that exact buildId; an unconsumed authorization exists for that exact buildId + manifestHash + labVersion (labVersion = sha256 over the contents of tools/lab/{driver,bots,manifest,approvals,run,report,metrics,search}.cjs, sorted (search.cjs since search-benchmark); playchecks stay bound to the gameplay build only). Scenario ids and preset names in the manifest must exist in the game (read statically from scenarios/*.js and script.js RULESET_PRESETS) or the manifest is invalid. Each battle runs in a child process that is SIGKILLed at the remaining maxRuntimeSeconds. It marks the authorization consumed (atomically, before starting) so it is single-use. `--check-only` validates the manifest, prints battle count/limits/hash and the gate status, and never runs anything. Refusal messages state the specific reason.

## Bot interface (`bots.cjs`)
`module.exports = { BOTS: { "<id>": { description, decide(observation, ctx) -> orders } } }`
- `observation` is exactly the return of `observeBattle()` (script.js). Bots may read nothing else.
- `ctx = { rng() }`: a bot-private seeded stream, never the game RNG.
- `orders` is the array accepted by `applyPlayerOrders`/`runHeadlessTurn`. Bots must emit only orders valid under the observation (hand, budgets); an illegal order is a bot bug, counted as `wastedOrders` by the driver, not hidden.
- First bots: `random-legal`, `aggressive-pursuit`. (An intent-reader is deferred: the observation deliberately omits enemy intent tags.)

## Driver (`driver.cjs`)
`runBattle({ load, bot, scenarioId, seed, preset, limits, botSeed, fixtureOnly }) -> BattleRecord`, built on `tests/harness/load-game.cjs` and `devTest.runHeadlessTurn` / `observeBattle` only. Stops at battle end, `maxTurnsPerBattle` (result `timeout`), or an engine error (result `error`, recorded, not thrown). BattleRecord:
```
{ scenarioId, seed, preset, rulesVersion, rulesHash, strategy, botSeed, fixtureOnly,
  result: "win"|"loss"|"draw"|"timeout"|"error", turns,
  perTurn: [ { turn, budget, planned, executed, wasted, orders } ],
  orders: [ [orders per turn...] ], replay: { query: "?scenario=..&seed=..&preset=..", orders } }
```
`budget/planned/executed` follow the plan's "budget / planned / executed actions" metric. Replaying `orders` through `runHeadlessTurn` on the same build must reproduce the record (checked by a hand-authored fixture).

## Report (`report.cjs`, `metrics.cjs`)
`{ schemaVersion:1, manifestHash, buildId, rulesHash, fixtureOnly, battles:[BattleRecord], summary: { <strategy>: { n, wins, losses, draws, timeouts, errors, winRate, winRateWilson95:[lo,hi], meanTurns, meanBudget, meanPlanned, meanExecuted, meanWasted } }, notes:[] }`. Deterministic (no wall-clock timestamps inside the hashed body). Reports with fixtureOnly true are labelled as fixtures; small-n results always show n and the interval.

`run.cjs --run` also writes the serialized report (report.serializeReport) to `lab/reports/<manifestHash first 12>-<UTC timestamp>.json` (gitignored) and prints the path; a write failure is noted but never loses the stdout report.

## L3 additions (reshuffle, bot rounds, visual replay)

### Bot protocol v2 (multi-call turns)
`decide(observation, ctx)` keeps its signature; `ctx = { rng, round, maxRounds: 2 }`. Reshuffle is the order `{ reshuffle: true }` (script.js, L3a). A reshuffle discards all queued cards and draws a new hand, and any card order placed after it in the same list is refused (`hand-not-observed`). So a reshuffle must be its OWN decision round:
- Round 0: a bot may return exactly `[{ reshuffle: true }]`. The driver then applies it WITHOUT running the turn (`applyPlayerOrders(orders)`, no turn), re-observes, and calls `decide` again with `round: 1`.
- Round 1 (or round 0 when not reshuffling): the returned list (target and card orders, never reshuffle in round 1) is applied and the turn runs.
- Everything is recorded: each turn has `steps: [ orders, ... ]` (all but the last applied without running; the last runs the turn).

### Per-turn metrics (BattleRecord.perTurn[i])
Keep existing fields and add: `unspentBudget` (budget - planned), `notExecuted` (planned - executed, with executed excluding misses), `attacksHit`, `attacksMissed` (Attack executed, outcome Miss, with reasons counted in `missReasons`), `reshuffles` (count), `reshuffleChargesAfter`. Existing `executed` meaning must be documented if it changes. Report summary adds per-strategy means of these plus total reshuffle use.

### Visual replay payload (built by the driver into `record.replay.payload`; the viewer base64url-encodes it into `http://localhost:4173/?replay=1#r=<base64url(JSON)>`)
```
{ "v": 1, "buildId": "<64 hex>", "scenarioId", "seed", "preset", "rulesQuery": "<rules= params or ''>",
  "rulesVersion", "rulesHash", "strategy", "botSeed", "result",
  "turns": [ { "turn": 1, "steps": [ [orders...], [orders...] ], "eventHash": "<hash of that turn's events>" } ] }
```
The game page (`?replay=1`) loads setup from scenario+seed+preset+rulesQuery, verifies compatibility, replays recorded `steps` through the existing turn flow and animations (Play/Pause, Next Turn, Restart; shows turn number and the recorded bot orders), compares each turn's `eventHash` to the recorded one and reports divergence loudly, and NEVER reruns a bot. `eventHash` is computed by one game-side function exposed as `window.devTest.hashTurnEvents(events)` that both the driver (via the game context) and the replay page use. Compatibility: the page compares `payload.buildId` with its own build identity (`./build-id.json`, emitted by the build); mismatch -> refuse; identity unavailable (dev server) -> clearly flagged warning, relying on rulesHash/rulesVersion and per-turn eventHash. Missing or malformed payload data -> refuse with a specific message; never substitute current settings silently.

### Ownership for L3
| Files | Owner |
|---|---|
| script.js, index.html, styles.css, vite.config.mjs, tools/check-dist.mjs, ENGINE-NOTES.md (replay mode, build-id.json, `hashTurnEvents`) | Agent A (Opus) |
| tools/lab/bots.cjs, BOTS.md | Agent C (Sonnet) |
| tools/lab/driver.cjs, report.cjs, metrics.cjs (steps, new metrics, payload) | Agent D (Opus), after A's hook lands |
| tools/lab/viewer/ (Replay button builds the URL) | Haiku, after D |

## Full-information strategies (search-benchmark)

A bot entry flagged `fullInformation: true` (today only `search-benchmark`, BOTS.md) is a FULL-INFORMATION BENCHMARK, not a player model: its win rate does not estimate human difficulty, and reports say so.
- **Seam:** for flagged bots only, the driver adds `ctx.search = { decide(observation) -> orders }`, bound to the battle's game through `tools/lab/search.cjs` (read-only: `snapshotBattleState`, `validatePlayerOrders`, `withBattleState` + the turn core on a copy; never the live battle, never the hand stream). Other bots get exactly `{ rng, round, maxRounds }` (byte-identical records). `script.js` is unchanged.
- **Manifest:** optional top-level `searchLimits: { maxCandidates, maxEvaluations, maxMsPerDecision }`; every key required, positive integer, hard caps 2000 / 1000 / 10000 (`SEARCH_LIMIT_CAPS`); REQUIRED when a full-information strategy is listed and refused otherwise; part of `manifestHash`. `runBattle` refuses a flagged bot without valid `searchLimits` (TypeError).
- **Records:** `fullInformation: true`, `perTurn[i].search` (summed per-decision counts) and `timing: { searchMs: { decisions, totalMs, maxMs } }` (wall clock). `replayBattle` copies these from the record.
- **Report:** `summary[strategy]` gains `fullInformation`, `label: "full-information benchmark"` and `search` (summed counts) for such strategies only; notes add the benchmark warning and the search cost. Each battle's `timing` is moved out of `battles` into the top-level `nonHashed: { about, searchMs: { <strategy>: { decisions, totalMs, maxMs } } }`; `reportHash` ignores `nonHashed` (the serialised file is not byte-identical across runs when it is present; the hash is).
- **labVersion** now also covers `search.cjs` (file set: driver, bots, manifest, approvals, run, report, metrics, search).
- **Testing boundary:** unchanged. The search is tested by calling it on hand-placed boards (tests/lab/s1..s5), with at most one scripted-driver style battle of one turn (s5); never a battle loop or batch.
