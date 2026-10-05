# Battle Lab bots

Dev-only players for the Battle Lab. Both are pure functions of the observation and a private random stream: they never touch the game, `window`, globals, the clock or `Math.random`, and never mutate the observation. Their output is an order list for `runHeadlessTurn`, always valid under the observation (hand contents, pack budget, same-action cap, living wolves, living enemies).

## What both bots see
Only `observeBattle()` (never the game): board and terrain, active units (position, facing, health, defeated, concealed; own wolves also queue and, under commander, target), own hand, reshuffle charges, a rules summary, outcome. They do NOT see enemy intent tags, the enemy plan, pack focus, RNG state or draw weights. A concealed enemy shows its position, but both bots ignore concealed enemies as targets.

## random-legal
- **Does:** under commander, gives each living wolf a random target among visible enemies (or none); then queues 1..(remaining budget, hand size) random hand cards on random living wolves.
- **Cannot:** plan, pursue or defend on purpose; read intents; reshuffle, change movement mode or unqueue. Unchanged in L3 (same outputs for the same seed; pinned to the L2 golden by test b2).
- **Determinism:** uses only `ctx.rng()`. Same observation and same seed give identical orders.

## aggressive-pursuit
- **Targets (commander):** each living wolf targets the nearest visible enemy (Manhattan distance, ties to the lowest id; skipped when already its target). Concealed enemies are ignored.
- **Actions:** spends the remaining budget round-robin over the wolves, using only cards in the hand. Per wolf and slot: if an Attack can plausibly land (below) it takes Attack, else Defend, else Move; otherwise it takes Move (closing in), else Defend. It never queues an Attack that cannot plausibly land; budget may stay unspent. With no visible enemy it never attacks (Move, then Defend).
- **Reachability (replaces "an earlier action makes a later Attack useful"):** `movesNeeded` = the fewest Move actions for the wolf to stand adjacent (8 neighbours) to its target, searched over the observation's terrain (pond, hill, tree blocked) and every unit's current tile (blockers), with a Move covering 1 to 3 tiles in one straight line of the 8 directions (the engine's `moveActionTileCount`). 0 means adjacent now; no route means never plausible. A wolf's action in queue slot `s` resolves in tick `s`, after the Moves in its slots before `s` (cards already queued count). An Attack is plausible when: slot 0 and the target is adjacent now; or slot > 0 and `movesBefore >= movesNeeded + 1`.
- **Uncertainty (simultaneous movement):** all units move in the same tick from start-of-tick positions and the bot cannot see enemy intent, so the target may step away (or toward) while the wolf moves; collisions can also shorten a Move. The bot never predicts enemy motion. Instead it is conservative: the route is computed on current positions, and every Attack after slot 0 needs one SPARE Move beyond the route, so the wolf can follow a target that retreats about one step. A second Attack on an adjacent target with no Move in between is therefore not queued; it queues Move/Defend. This is a heuristic, not a guarantee; a fast target can still escape.
- **Reshuffle (own round):** in round 0 of a two-round turn (`ctx.round === 0`, `ctx.maxRounds >= 2`) it returns exactly `[{ reshuffle: true }]` when charges remain (`hand.reshuffleChargesRemaining > 0`), nothing is queued yet (a reshuffle discards queued cards, so queued carry-over is never thrown away), the hand is not empty, and the hand is poor. Poor means the plan this hand would produce (Moves and Attacks are "useful", Defend is filler) fails any of: an enemy is within reach (some wolf needs at most 1 Move) but the plan has no Attack; no enemy is within reach (or none is visible) and the plan has fewer than 2 Moves; fewer than min(2, budget) useful actions. Round 1 never reshuffles and plans from the new observation. A caller that passes no `ctx.round` (legacy) never gets a reshuffle.
- **Cannot:** dodge, heal, read intents, track concealed enemies, predict enemy motion, change movement mode or unqueue.
- **Determinism:** ignores `ctx.rng`; the same observation and ctx give identical orders. No mutation of the observation.

Both bots return `[]` when nothing useful is legal (empty hand, budget used up, no living wolves, nothing worth queuing).

## `legalOrderCheck(observation, orders)`
Mirrors `validatePlayerOrders` over the observation alone (same reasons, same order, same sequence rules), including `{ reshuffle: true }`: `malformed-order`, `no-reshuffle-charges` (charges counted in sequence), and `hand-not-observed` for any card order after a reshuffle in the same list; a reshuffle also empties the hand and queues for later checks in the list.

## Deferred
An intent-reader bot is deferred: the observation deliberately omits enemy intent tags.
