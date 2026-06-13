# UI
# UI / Interaction Spec

> **Note:** Sections marked *[current]* describe the implemented UI. Sections marked *[future]* describe planned UX direction not yet built.

---

## 1. Core Layout [current]

The screen is split into 3 zones:

### Left/Center: Battlefield
- Isometric grid battlefield (default 10×10, resizable in dev tools)
- Player units (bottom side), enemy units (top side)
- Castle on each end
- Units show HP bars and intent tags (action previews above sprite)

### Right: Action Panel
- Lists available actions (Move, Attack, Defend) as clickable items
- Player clicks an action in the panel to add it to the selected unit's queue

### Bottom: Action Queue Panel
- Shared action timeline across all player units
- Shows queued actions per unit as a row of icon slots
- Play button executes the full queue

---

## 2. Unit Selection & Action Menu [current]

### Flow:
1. Player clicks a unit on the battlefield to select it
2. A floating action menu appears next to the unit
3. Menu shows Move / Attack / Defend buttons + a movement mode selector
4. Clicking an action adds it to that unit's queue
5. The queue panel and intent tags above the unit update immediately

### Movement Mode Selector:
- Per-unit setting: Sneak / Dodge / Flank / Hunt (default)
- Cycles through modes via arrows in the floating menu
- Affects how the unit pathfinds during Move actions

### Feedback rules:
- Selected unit is visually highlighted
- Queue full → action is rejected
- Intent tags above unit reflect queued actions

---

## 3. Execution Phase [current]

- Player hits the Play button to execute the queue
- Tick loop runs — units animate and resolve actions in order
- **Interrupt:** player can click a unit during execution to flag it; execution pauses before that unit's next action
- After execution, planning phase resumes automatically

---

## 4. Win / Lose [current]

- Full-screen overlay appears when a unit is defeated
- Shows result message + "Play Again" button
- Restart resets all four units to start positions and full health

---

## 5. Dev Tools [current]

- Toggle button in top-left corner
- Reveals: edge case test scenarios, animation controls, tile number toggle, arena size input, action fill shortcuts, unit direction controls

---

## 6. Battlefield Visual Rules [current]

Each unit shows:
- Unit sprite (wolf, directional + animated)
- HP bar (hidden at full health unless selected)
- Small intent tags above unit showing queued actions

### Key rule:
> Player must always understand "what this unit will do next"

---

## 7. Command Interaction — Drag System [future]

> This section describes a planned UX improvement, not the current implementation.

### Planned flow:
1. Player receives action cards in right panel
2. Player drags action onto a unit on the battlefield
3. Action snaps into that unit's queue
4. Action appears immediately on unit as visual tag

### Feedback rules:
- Valid drop → snap + highlight
- Invalid drop → bounce back
- Overfilled queue → reject action
