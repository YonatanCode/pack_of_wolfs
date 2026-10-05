# Battle Lab bots

Dev-only players for the Battle Lab. Both are pure functions of the observation and a private random stream: they never touch the game, `window`, globals, the clock or `Math.random`, and never mutate the observation. Their output is an order list for `runHeadlessTurn`, always valid under the observation (hand contents, pack budget, same-action cap, living wolves, living enemies).

## What both bots see
Only `observeBattle()`: board and terrain, active units (position, facing, health, defeated, concealed; own wolves also queue and, under commander, target), own hand, reshuffle charges, a rules summary, outcome. They do NOT see enemy intent tags, the enemy plan, pack focus, RNG state or draw weights. A concealed enemy shows its position, but both bots ignore concealed enemies as targets.

## random-legal
- **Does:** under commander, gives each living wolf a random target among visible enemies (or none); then queues 1..(remaining budget, hand size) random hand cards on random living wolves.
- **Cannot:** plan, pursue or defend on purpose; read intents; reshuffle, change movement mode or unqueue.
- **Determinism:** uses only `ctx.rng()`. Same observation and same seed give identical orders.

## aggressive-pursuit
- **Does:** under commander, targets each living wolf at the nearest visible enemy (Manhattan distance, ties to the lowest id; skipped when already its target). Then spends the whole remaining budget round-robin over the wolves: Move first when not adjacent, Attack once adjacent (or after a first queued action), falling back to the other card, then Defend, using only cards actually in the hand. With no visible enemy it still advances with Move.
- **Cannot:** dodge, heal, read intents, track concealed enemies, predict that a Move will end adjacent, reshuffle, change movement mode or unqueue.
- **Determinism:** ignores `ctx.rng` entirely; same observation gives identical orders.

Both return `[]` when nothing useful is legal (empty hand, budget used up, no living wolves).

## `legalOrderCheck(observation, orders)`
Mirrors `validatePlayerOrders` over the observation alone (same reasons, same order, same sequence rules), so tests can assert legality without the game.

## Deferred
An intent-reader bot is deferred: the observation deliberately omits enemy intent tags.
