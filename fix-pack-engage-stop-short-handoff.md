# Handoff: fix enemy pack-engage "stop short of slot" bug

**Branch:** `fix-pack-engage-stop-short` (off `main`, clean tree).
**Goal:** an engaging wolf should end its move *on* its surround slot (adjacent to
the player, in attack range) instead of stopping one tile short — so its
pre-queued Attack actually connects.

## The bug (confirmed, pre-existing — NOT caused by the obstacle-pathfinding work)

Reproduced from a real battle note: 18×18 board, P1 (player) at (3,8) in Dodge,
E1 (enemy wolf) at (7,7), pond rows 4-7 / cols 8-11 between them. E1's plan came
out `Move, Attack, Attack, Defend`, but after the single Move E1 sat at (5,7) —
two tiles from P1 — and both Attacks whiffed.

Repro harness `/tmp/e1-repro.cjs` (ephemeral — recreate; clock-advancing vm/DOM
stub, same recipe as `headless-ai-testing` memory) prints:
```
E1 packObjective: engage slotDelta {1,-1} => goal (4,7)
E1 planned queue: Move, Attack, Attack, Defend
E1 execution move plan target: (5,7)  path: (7,7)->(6,7)->(5,7)
field@goal: (7,7)=3 (6,7)=2 (5,7)=1 (4,7)=0
After tick 1: E1 @ (5,7)   [planner expected goal (4,7)]
```
Ran the identical repro against `git show main:script.js` (no distance-field
change) → byte-identical result. So this predates `pathfinding-around-obstacles`
and is independent of the Manhattan→field swap (the E1→slot approach is a
pond-free column, so field == Manhattan here anyway).

## Root cause — planner / executor mismatch

The pond removes the cardinal slot directly below P1 ((4,8) is water), so the
surround slot assigned to E1 is the diagonal **(4,7)**. (The mismatch is general,
though — even with no pond the nearest slot to a wolf approaching head-on is a
diagonal one.) Two code paths then disagree about where a "move toward the slot"
ends:

- **Planner** `getEnemyPackMoveAssignment` [script.js ~2343] rays the full move
  with `getTileInDirectionForPackPlan` and scores candidates by
  `getGridDistance(target, goal)` — greedily maximizing closeness — so it lands
  E1 **on the slot (4,7)**. (4,7) is adjacent to P1, so the next planning pass
  queues `Attack` instead of a 2nd `Move`. Hence `Move, Attack, …`.
- **Executor** `getEnemyPackMovePlanFromSnapshot` → `getModeMovePlanFromTargetState`
  (mode `"Hunt"`, target = the slot) → `getHuntMoveCandidate` /
  `compareHuntMoveCandidates` [script.js ~3931/3953]. That comparator ranks
  `isAdjacent` **first**. The slot tile (4,7) scores `isAdjacent=false` (a tile
  isn't adjacent to itself); a neighbour like (5,7) scores `isAdjacent=true`, so
  it is preferred — E1 stops **one tile short** of its own slot.

`isAdjacent`-first is *correct* when Hunting an enemy UNIT (you want to stand next
to it, not on it). It is *wrong* when Hunting toward a goal TILE you intend to
occupy. The engage path reuses the unit-targeting Hunt scorer for a tile goal.

## Fix options

1. **(Recommended) Occupy-the-goal semantics for tile goals.** Distinguish
   "Hunt to attack a unit" (adjacency = win) from "steer onto a goal tile"
   (distance 0 = win). For the engage move, select the candidate with the lowest
   field distance to the slot (ties: turnCost, then steps) and drop the
   `isAdjacent`-to-goal bonus. The distance field already routes around the pond
   and gives the slot itself distance 0, so the wolf lands on it — matching the
   planner. Smallest behavioural change; player Hunt-toward-enemy untouched.
   - Likely shape: a dedicated candidate picker (e.g. `getOccupyMoveCandidate`)
     selected when `getModeMovePlanFromTargetState` is steering to a position
     rather than a unit — thread an `isPositionalGoal`/mode flag from
     `getEnemyPackMovePlanFromSnapshot`'s engage branch.
2. **Make the planner expect the stop-short.** Have the planner model the
   executor's adjacency stop so it queues another Move instead of an early Attack.
   Rejected: bakes the buggy stop-short into the contract and wastes a wolf action.
3. **Engage toward the player, slot only as tiebreak.** Hunt the focus target
   (adjacency = win) and use the slot just to choose *which* adjacent tile. Most
   "correct" long-term but a bigger refactor of the surround system.

## Verify

- Recreate `/tmp/e1-repro.cjs`; after the fix assert E1 ends adjacent to P1 (on
  or beside the slot, in attack range) and the queued Attack lands.
- Add a focused headless test (the canonical (7,7)→slot(4,7) case) asserting the
  engaging wolf reaches an attack-range tile.
- Re-run the full dev-test suite (`/tmp/game-suite-harness.cjs`): baseline
  **27 pass / 4 pre-existing fails** (`corpse-layer`, `pack-action-cap`,
  `pack-multi-tick`, `pack-one-enemy`) — no regressions; ideally one of the
  `pack-*` scenarios now passes.
- Player Hunt-toward-enemy must be unchanged (re-run pond/demo harnesses if the
  shared Hunt scorer is touched).
- User verifies live (per AGENTS.md — no UI automation).

## Commits (small, per CLAUDE.md)

Likely: (1) the occupy-goal candidate selection + threading the positional flag;
(2) test. Split further if needed. When done: merge → delete branch → delete this
handoff file.
