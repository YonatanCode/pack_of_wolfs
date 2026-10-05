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
  "authorizations": [ { "buildId", "manifestHash", "quote", "recordedAt", "consumedAt": null } ] }
```
`run.cjs --run` refuses unless: current gameplay build ID (tools/build-id.mjs logic) equals manifest.buildId; gameplay tree not dirty; a playcheck exists for that exact buildId; an unconsumed authorization exists for that exact buildId + manifestHash. It marks the authorization consumed (atomically, before starting) so it is single-use. `--check-only` validates the manifest, prints battle count/limits/hash and the gate status, and never runs anything. Refusal messages state the specific reason.

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
