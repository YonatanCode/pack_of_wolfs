# # Vision.md
## Core Fantasy
Outsmart an enemy commander by predicting and disrupting their battle plan before it unfolds.

The player should feel like a battlefield tactician setting traps, orchestrating units, and causing enemy strategies to collapse through precise interruptions.

---

## Elevator Pitch
A deterministic tactical strategy game where players assign commands to units, predict enemy behavior, and interrupt critical actions to break the opponent’s entire plan.

Every action matters because one cancelled movement or attack can create a chain reaction across the battlefield.

---

## Core Gameplay Pillars

### Predictive Strategy
Success comes from thinking multiple steps ahead rather than reacting moment-to-moment.

### Tactical Interruption
Players can interrupt enemy actions, causing formations and plans to fail unexpectedly.

### Deterministic Outcomes
Combat is readable and mostly deterministic. Players should understand why they won or lost.

### Chain Reactions
Small tactical decisions can create large battlefield consequences.

### Controlled Chaos
The battlefield feels alive and dynamic, but outcomes are still understandable.

---

## Core Loop

1. Player assigns commands to units
2. Enemy executes their own hidden strategy
3. Actions resolve on the battlefield
4. Interruptions and collisions alter planned outcomes
5. Players adapt strategy for the next turn
6. Destroy the enemy castle

---

## MVP Scope

### Battlefield
- Small symmetrical grid battlefield
- Minimal obstacles
- One castle per side

### Units
- 2–3 unit types maximum
- Shared movement rules
- Different attack behaviors only

### Commands
- Move
- Attack
- Defend
- Interrupt

### Gameplay
- Hidden enemy intentions
- Deterministic resolution
- Turn-based structure with live interruption moments
- Watch simulation resolve automatically

---

## Platform
- Web-first
- Desktop prioritized
- Mobile-compatible later
- No backend initially
- Single-player versus AI

---

## Visual Direction
Inspired by early Warcraft-style readability and charm.

### Visual Goals
- Readable silhouettes
- Chunky unit feedback
- Tactical clarity over realism
- Slight humor mixed with military fantasy
- Minimal but expressive animation

---

## Non-Goals (MVP)
- Multiplayer
- Resource harvesting
- Large maps
- Tech trees
- Complex terrain systems
- Procedural generation
- Deep RPG progression
- Large unit counts

---

## Success Criteria

The prototype succeeds if:
- Players immediately retry after losing
- Players feel smart when disrupting enemy plans
- Players understand why plans succeeded or failed
- Small interruptions create memorable chain reactions
- Watching the simulation resolve feels tense and satisfying