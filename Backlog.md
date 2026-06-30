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
| P1 | Units / Pack Building | Mechanic | Explore | Different wolf types to build your pack from — each moves, attacks, and defends differently, and each grants a different perk when it's the alpha. | Defines distinct archetypes (ties into the Soldier/Runner/Brute intent in Units.md). Per-type differences across all three action verbs (move range/mode, attack range/damage, defend behavior), plus a unique alpha perk per type so *which* wolf you make alpha is a real choice. Open: roster size, how the player picks/composes the pack, whether alpha is assigned pre-battle or swappable in-battle, and how perks read on the battlefield. Pairs with the existing Alpha health-action idea. |
| P2 | Audio | Polish | Idea | Sound effects and background music. | SFX for core actions (move, attack, defend, hit, death, win/lose) plus ambient/background music. Keep audio readable as feedback, not just decoration; needs a mute/volume control and lightweight, dependency-minimal playback. |
| P1 | Actions / Combos | Mechanic | Idea | Expand combos beyond same-action stacking into multi-action sequences. | Not just "two of the same action in a row = stronger/longer" — recognize patterns across different verbs. Examples: Move → Attack → Move auto-resolves as a hit-and-run (close in, strike, retreat); three Defends in a row restore 6 health to that unit. Brainstorm a small, readable combo table (which sequences, what bonus). Open: do combos fire automatically when the pattern is queued, or need to be discovered/unlocked? Need clear feedback so the player knows a combo triggered. Pairs with the double-move / combined-attack powerup idea. |
| P1 | Enemy AI | Mechanic | Explore | Make enemy actions more randomized but still predictable. | Keep the current telegraphed enemy plan, but each turn pick one of the enemy's chosen actions and swap it for a different random one. Goal: break repetitive/degenerate patterns and force re-reading without making the enemy unreadable (the rest of the plan stays visible and committed). Open: when does the swap reveal — before or after the player plans? Tune how many actions can swap per turn. Pairs with "Prevent repetitive wolf behavior". |
| TBD | Economy / Progression | Mechanic | Idea | Meat as a single currency that ties the meta-game together. | Earn meat from battles/hunts; spend it to recruit new wolves, upgrade existing ones, and unlock new areas of the map. One legible resource for the whole economy. Open: do wolves also *consume* meat (upkeep/feeding) so pack size has a cost? Sources vs. sinks need balancing. Pairs with recruitment, stat upgrades, and area-unlock ideas. |
| TBD | Progression / Recruitment | Mechanic | Idea | Recruit new wolves between battles. | Candidate models: (a) after each win, choose 1 of 3 offered wolf types; (b) buy them with meat; (c) find/recruit them in the world while exploring. Likely pick one primary path plus maybe a secondary. Open: roster cap, how type/rarity is rolled. Pairs with meat currency, wolf types, and exploration-map ideas. |
| P1 | Progression / Upgrades | Mechanic | Explore | Upgrade an individual wolf's attack, defense, or movement. | Per-stat investment so each wolf grows along a chosen axis. Ties into an alpha/beta/omega rank that could grant or gate upgrades/perks. Open: spend meat or XP? per-stat caps? respec allowed? Pairs with wolf types/pack building and the alpha health-action idea. |
| TBD | Progression / Start | Mechanic | Idea | Choose a starting wolf archetype. | Begin the game by picking tank / balanced / runner — sets early playstyle and changes the opening. A lightweight, first-choice slice of the wolf-types system. Pairs with wolf types/pack building. |
| P2 | Units / Flavor | Polish | Idea | Give each wolf a name. | Names build attachment and readability ("send Ash to flank"). Auto-assigned from a pool or player-chosen. Cheap; pairs with recruitment and the pup→adult lifecycle. |
| P1 | Stealth / Terrain | Mechanic | Explore | Shadows and hiding — a stealth layer combining cover, sneaking, and height. | Wolves hide in shadows/cover to break line of sight, sneak unseen, and combine that with height advantage for ambushes. Builds on the existing Sneak mode and the hill/height idea. Open: what reveals a hidden wolf (proximity, attacking, line of sight)? does the enemy get the same tool? Pairs with "small hill obstacle" and Standoff/Pull (stalk-then-pounce). |
| TBD | Units / Scouting | Mechanic | Explore | A scout unit to reveal parts of the map. | Two flavors: a raven you send ahead, or a dedicated scout wolf (stays inside the pack fantasy — likely better). Reveals terrain/enemy positions before committing the pack. Open: separate unit, an action, or consumable? risk if caught? Pairs with the exploration/overworld maps. |
| TBD | Units / Lifecycle | Mechanic | Idea | Pack lifecycle units — pup, adult, elder. | A baby wolf you must protect; survive/protect it long enough and it matures into a full wolf. An old wolf that's slower/weaker but carries unique perks (experience/leadership). Adds care-and-investment stakes. Open: how protection is measured, what perk each life stage grants. Pairs with names and recruitment. |
| TBD | Levels / Boss | Content | Idea | Boss level — a bear. | A large, powerful single enemy as a milestone fight; size telegraphs the threat. Open: unique mechanics (multi-tile body, high health, area attacks?) and where it sits in progression. Pairs with the Stag level and level-structure ideas. |
| TBD | World / Progression | Feature | Explore | Unlockable areas with visible cost and reward. | Map shows locked areas with their entry cost (meat to feed the pack for the journey) and potential gains (meat, a recruitable wolf, etc.) for risk/reward route planning. One of four competing overworld structures — see grouping. Pairs with meat currency and recruitment. |
| TBD | World / Open World | Feature | Explore | Zoomed-out open world with territories and habitats. | Free roam; encountering another animal or wolf pack drops into fight mode. Map surfaces rival pack *territories* (entering risks attack) and *habitats* where specific prey live — easier prey gives less meat, harder prey more. Richest but heaviest option. Competing overworld structure. Pairs with meat currency, hunting, and scouting. |
| TBD | World / Overworld Travel | Feature | Idea | Fallout 1/2-style overworld travel with random encounters. | A zoomed-out map where you pick a spot/direction to travel; encounters may or may not happen en route. Player flagged the downside: with no fixed destination it can feel aimless — would need objectives/hooks. Competing overworld structure. |
| TBD | World / Level Structure | Feature | Idea | Linear levels with optional sidetracks. | Levels 1→2→3→4 with optional detours (e.g. between 2 and 3, fight a bigger animal for extra perks). Variant: an "islands/bridges" version where you choose which island to start from. Simplest, most authorable structure. Competing overworld structure. Pairs with the boss/bear and Stag levels. |

## Candidate Groupings

### Core Mechanics

- Health recovery after two safe turns (done)
- Obstacles
- Small hill obstacle
- More tile types
- Double-move / combined attack powerups
- Action combos — multi-verb sequences (hit-and-run, triple-defend heal)
- Alpha health action
- Wolf types / pack building (per-type move/attack/defend + alpha perk)
- Reshuffle action redraw (done)
- Move-before-attack resolution (done)

### Fun And Balance

- Prevent repetitive wolf behavior
- Randomized-but-predictable enemy actions (swap one telegraphed action per turn)
- Make wolves visually and tactically easier to distinguish
- The Standoff — pressure (clock that forces action)
- The Standoff — pull (charge-in vs. wait-and-read timing triangle)

### Pack & Progression

- Meat currency (recruit / upgrade / unlock areas)
- Recruit wolves (choose-1-of-3 after win / buy with meat / find in world)
- Per-stat upgrades (attack / defense / movement) + alpha-beta-omega rank
- Choose a starting wolf archetype (tank / balanced / runner)
- Wolf names
- Pack lifecycle units (pup → adult → elder)
- Scout unit (raven vs. dedicated scout wolf)

### Stealth & Terrain

- Shadows / hiding / sneak + height advantage
- Small hill obstacle (height) — see Core Mechanics

### World Structure & Levels

These four are competing meta-structures for how the game progresses between
battles — likely pick one (or a hybrid), not all:

- Unlockable areas with cost/reward
- Open world with rival territories + prey habitats
- Fallout-style overworld travel with random encounters
- Linear levels with optional sidetracks / island choice

Milestone content: boss level (bear); Stag tutorial/level.

### Player Experience

- Onboarding
- Menu
- Stag tutorial or level structure

### World And Tone

- Background story
- Sound effects and background music
