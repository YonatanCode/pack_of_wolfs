# Handoff: Health Recovery ("safe-turn regen")

Context primer for implementing the health-recovery mechanic in a fresh chat.
Read this + the linked backlog row, then implement — no need to re-explore.

## Goal

> A unit that has **not been hit for two turns** gains **+1 health**.

This is the [Combat / Recovery row in Backlog.md](Backlog.md) (P1, was "Explore").
Note: the backlog row originally said **+2**; the decided value is **+1**.

## The turn model (read this first — it's the key fact)

There is **no turn counter and no last-hit tracking** in the codebase today. Both must be added.

A "turn" = one full run of `executePlayerActionQueue()` (`script.js:2527`). That function:
1. Plans the enemy turn, sets `isExecutingActionQueue = true`.
2. Loops `executeActionTick(combatants)` (`script.js:2589`) until all queues drain — each *tick* is one action per combatant, NOT a turn.
3. Cleans up in its `finally` block (`script.js:2567`).

**So recovery logic belongs at the end of `executePlayerActionQueue` (in/after the `finally`), once per turn — NOT in the per-tick loop.**

## Where damage happens

- `resolveTickDamage(damageIntents)` (`script.js:3933`) aggregates per-target damage and calls
  `damageUnit(target, damage)` (`script.js:1312`).
- `damageUnit` returns `{ damaged, defeated, damageTaken }` and only mutates health when `damageTaken > 0`.
- This is the single chokepoint to mark "this unit was hit this turn."

## Unit data structure

`createUnit({...})` (`script.js:418`) returns the unit object. Relevant fields:
- `health` (starts at `UNIT_MAX_HEALTH`)
- `maxHealth` (= `UNIT_MAX_HEALTH = 10`, `script.js:19`)
- `isDefeated`, `team` (`"player"` | `"enemy"`), `type` (`"wolf"` | `"stag"`)

You'll add new field(s) here, e.g. `turnsSinceHit: 0` (and/or a transient `tookDamageThisTurn: false`).

## Helpers you'll reuse

- `updateUnitHealthBar(unit)` (`script.js:1295`) — call after changing `health` so the bar re-renders.
- `getAliveUnitsByTeam("player")` / `getAliveUnitsByTeam("enemy")` — iterate live units (used in the `finally` block already).
- `isUnitAlive(unit)` (`script.js:1651`).
- `showUnitDamagePopup(unit, amount)` (`script.js:1337`) — pattern to copy if you want a "+1" heal popup (would need a green-tinted variant in styles.css).

## Reset points (must reset the new field too)

- `createUnit` (`script.js:418`) — initial value.
- `resetUnitForDev(unit, setup)` (`script.js:4174`) and `resetDevTest(...)` (`script.js:4233`) — dev/test reset paths.
- `resetGame()` (`script.js:2527`-ish, just above the execute fn) — Play Again. Grep `function resetGame`.

## Suggested implementation (3 hooks)

1. **Track field**: add `turnsSinceHit: 0` and `tookDamageThisTurn: false` to `createUnit` + all reset paths.
2. **Mark hits**: in `resolveTickDamage` (or inside `damageUnit`), when `damageTaken > 0`, set `target.tookDamageThisTurn = true`.
3. **Apply at turn end**: in `executePlayerActionQueue`'s `finally`, after the tick loop, for each alive unit:
   - if `tookDamageThisTurn` → `turnsSinceHit = 0`, clear flag.
   - else → `turnsSinceHit++`; if `turnsSinceHit >= 2` and `health < maxHealth`:
     `health = Math.min(maxHealth, health + 1)`, `turnsSinceHit = 0`, `updateUnitHealthBar(unit)` (+ optional heal popup).

Note: `damageUnit` does NOT clamp upward, so the `Math.min(maxHealth, ...)` clamp is mandatory.

## Decisions already made
- Heal amount: **+1**.
- Trigger: **2 consecutive turns** without being hit.
- "Turn" = one `executePlayerActionQueue` cycle.

## Open questions to confirm before/while coding
1. **Who regenerates?** All units, or player wolves only? (In "wolves" enemy mode the enemies are also wolves; in "stag" mode there's the stag.) Backlog framing says "a unit" — leaning all, but confirm.
2. **Counter after healing**: reset to 0 (need another 2 safe turns for the next +1) — assumed yes.
3. **Visual feedback**: silent, or a "+1" green popup mirroring the damage popup? (nice-to-have, not required for v1.)
4. **Does a blocked/0-damage hit count as "being hit"?** Decided chokepoint uses `damageTaken > 0`, so a fully-absorbed hit would NOT reset the counter. Confirm that's desired.

## Verify when done
- Queue actions, let a unit go 2 turns untouched → health ticks up by 1 (capped at 10).
- A unit hit on turn 2 → counter resets, no heal.
- Play Again resets counters.
- Existing dev-test scenarios still pass (the headless suite is DOM/AI-focused; recovery may need its own scenario — optional).
