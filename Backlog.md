# Feature Backlog

This file tracks possible mechanics, UX improvements, content ideas, and design questions for future work.

## Priority Scale

- P0: Core gameplay issue or important blocker
- P1: Strong improvement to fun, clarity, or replayability
- P2: Nice-to-have polish or expansion
- TBD: Needs more design discussion before prioritizing

## Status Scale

- Idea: Rough idea worth keeping
- Explore: Needs design or technical investigation
- Ready: Clear enough to implement
- In Progress: Currently being worked on
- Done: Implemented

## Ideas

| Priority | Topic | Type | Status | Idea | Design note / open question |
| --- | --- | --- | --- | --- | --- |
| P1 | Combat / Recovery | Mechanic | Done | A unit not hit for two turns gains +1 health (capped at max). | Shipped: +1 heal after 2 consecutive un-hit turns ("turn" = one executePlayerActionQueue cycle), applies to all units, green "+1" popup. Counter resets after each heal and on any damage; fully-absorbed (0-damage) hits do not reset (chokepoint uses damageTaken > 0). Hooks: createUnit + resetUnitForDev (turnsSinceHit/tookDamageThisTurn), resolveTickDamage (mark hit), applyTurnEndRecovery() in executePlayerActionQueue finally. |
| P1 | Map / Positioning | Feature | Explore | Add obstacles to the map. | Obstacles could improve tactical lanes, movement planning, and prediction. Need to decide if they block movement, attacks, vision, or all three. |
| TBD | Fun Factor / AI | Design Problem | Explore | Prevent all wolves from just getting into the same repetitive or degenerate behavior. | Original note was incomplete: "prevent all wolfs just getting..." Clarify the exact bad pattern, then solve with AI goals, spacing rules, obstacles, or incentives. |
| P1 | UX / Learning | Feature | Idea | Add onboarding. | Could be a short guided first turn, contextual tips, or a dedicated tutorial flow. |
| P2 | Narrative | Content | Idea | Add background story. | Keep story light and useful: motivation, tone, and stakes without slowing down the tactical loop. |
| P2 | Visual Identity | Polish | Explore | Make each wolf look more distinct using the same asset, with code altering its look slightly. | Possible variations: tint, scale, markings, accessories, idle timing, shadow, or outline. Must remain readable on the battlefield. |
| P0 | Turn Resolution | Design Problem | Done | Resolve whether move-before-attack logic is cool, confusing, or unfair. | Verdict: keep it. Attacks resolve against POST-move positions, so it's symmetric & readable — stepping into adjacency connects (move-into-range HITS), stepping out dodges (move-away MISSES). The old confusing "walked up, nothing happened" case was already removed by the interaction-resolver rewrite (aa53498); getLiveAttackTarget falls back to live adjacency. Only real gap was legibility: a whiffed attack was silent. Shipped a "Miss" popup (resolveTickDamage flags intents that fail isAttackDamageStillValid → showUnitMissPopup over the attacker). Updated two stale dev-test scenarios that still encoded pre-rewrite behavior: move-away-miss→move-away-dodge (Dodge-mode flee, no damage), move-into-range-miss→move-into-range-hit (steps in, takes UNIT_ATTACK_DAMAGE). Both pass headless. |
| P1 | UI / Navigation | Feature | Idea | Add a menu. | Define scope: pause menu, start menu, settings menu, level select, restart/options, or all of these. |
| TBD | Levels / Tutorial | Content / Design | Explore | Work on the Stag level. Decide whether it should be part of the tutorial or a standalone level. | If the Stag teaches a core mechanic, it may belong in onboarding. If it introduces a new strategic twist, it may work better as level 2. |
| P1 | Powerups / Combat | Mechanic | Explore | Add logic for double-move powerups where 2 attacks become one strong attack. | Clarify trigger: collecting a powerup, queuing two attacks, or spending two move actions. Need readable feedback so the player understands the combined attack. |
| P1 | Actions / Planning | Feature | Done | Reshuffle: planning-phase action redraw. | Shipped instead of "skip turn". Spends 1 of 2 per-battle charges to discard the whole pack's hand (every wolf's queue + the shared pool) and draw a fresh 5; no turn lost, no enemy movement. "Replace a queued action" already existed (per-action remove button). Tunable: charge count and full-vs-partial reset. |
| P1 | Powerups / Units | Mechanic | Explore | Add an alpha action that gives a wolf more health when applied. | Clarify whether Alpha is a player action, enemy buff, unit role, or powerup. Need to define health amount, duration, and whether it can exceed max health. |
| P2 | Map / Terrain | Feature | Idea | Add more tile types to the map. | Tile types could affect movement, attack range, visibility, or just visual variety. Start with readable, low-complexity differences. |
| P1 | Map / Obstacles | Feature | Explore | Add a small hill to the game as an obstacle. | Decide if the hill blocks movement, changes pathing, grants height advantage, blocks attacks, or acts as a tutorial-friendly obstacle. |
| TBD | The Standoff / Pressure | Design Problem | Explore | **The Standoff** — what creates the pressure that forces it to break. | In a tick game the unit that moves *second* knows more (it sees where the enemy committed), so both sides are tempted to wait and read — discovered in play: stall with filler actions, let the enemy reveal its destination, then move in clean. That only stays fun if pure waiting *loses*. This entry = the clock: something that punishes inaction so the standoff must resolve. Candidates: tick/turn limit, an objective tile, castle taking damage over time, advancing reinforcements. Pairs with "The Standoff / Pull". |
| TBD | The Standoff / Pull | Design Problem | Explore | **The Standoff** — the incentives that make you charge in vs. wait for them to come to you. | The choice layer on top of the pressure clock. Want a rock-paper-scissors of timing, no option strictly dominant: **commit early** (claim ground / charge bonus, beats stallers, loses to readers) vs. **read & intercept** (wait, then pounce on the revealed position, beats early committers, loses to bait) vs. **bait/feint** (show one intent then re-commit, beats readers, loses to early committers). Levers to tune it: objectives/chokepoints reward moving first; a "charge/momentum" bonus for move-into-attack vs. a "cold" reactive hit; held units are observable so the AI can refuse to commit; intercept knobs (reaction range, resolve during vs. after the enemy move, commitment lock). Thematic fit: wolves stalk then pounce — maps onto Sneak/Flank vs. a charging Brute. Open: symmetric (AI can also stall-read, harder to write) or player-only first. Pairs with "The Standoff / Pressure". |

## Candidate Groupings

### Core Mechanics

- Health recovery after two safe turns (done)
- Obstacles
- Small hill obstacle
- More tile types
- Double-move / combined attack powerups
- Alpha health action
- Reshuffle action redraw (done)
- Move-before-attack resolution (done)

### Fun And Balance

- Prevent repetitive wolf behavior
- Make wolves visually and tactically easier to distinguish
- The Standoff — pressure (clock that forces action)
- The Standoff — pull (charge-in vs. wait-and-read timing triangle)

### Player Experience

- Onboarding
- Menu
- Stag tutorial or level structure

### World And Tone

- Background story
