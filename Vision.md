# Vision.md
## Core Fantasy
Outsmart an opponent by predicting and disrupting their plan before it unfolds.

The player should feel clever — like someone who reads the situation a step ahead, sets up the perfect counter, and watches the other side's strategy fall apart through precise, well-timed actions. The thrill is in the "I saw that coming" moment.

---

## Elevator Pitch
A deterministic tactical game where players assign commands to their pieces, predict the opponent's behavior, and interrupt critical actions to break their entire plan.

Every action matters because one cancelled move or attack can trigger a chain reaction that cascades across the board. The fun comes from those surprising, satisfying turns where a single well-placed interruption changes everything.

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
The board feels alive and dynamic, but outcomes are still understandable.

### Fun First
Above all, the game should be fun to play and fun to watch. Mechanics exist to create memorable moments, satisfying payoffs, and the urge to immediately try again — not to be realistic or complex for its own sake.

---

## Core Loop

1. Player assigns commands to their units
2. Opponent executes their own hidden strategy
3. Actions resolve on the board
4. Interruptions and collisions alter planned outcomes
5. Players adapt strategy for the next turn
6. Achieve the win condition (e.g. eliminate the opponent or capture their objective)

---

## MVP Scope

### Board
- Small symmetrical grid board
- Minimal obstacles
- One objective per side to attack or defend

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
A clean, charming, readable style where it's always obvious what's happening and why. Theme is flexible — the priority is clarity and personality, not a specific setting or art reference.

### Visual Goals
- Readable silhouettes
- Chunky, satisfying feedback on every action
- Tactical clarity over realism
- Personality and playful humor
- Minimal but expressive animation that makes outcomes feel good to watch

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