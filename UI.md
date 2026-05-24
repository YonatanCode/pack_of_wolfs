# UI
# UI / Interaction Spec

## 1. Core Layout

The screen is split into 3 zones:

### Left: Battlefield
- Grid-based battlefield view
- Player units (bottom side)
- Enemy units (top side)
- Castle on each end

### Right: Command Panel
- Randomized action pool per turn
- Available actions displayed as draggable cards

### Bottom: Unit Queue Panel
- Shows all player units
- Each unit displays queued actions visually

---

## 2. Battlefield Visual Rules

Each unit shows:

- Unit sprite/icon
- HP bar
- Small action tags above unit:
  - Move
  - Attack
  - Defend

### Key rule:
> Player must always understand “what this unit will do next”

---

## 3. Command Interaction (Drag System)

### Flow:

1. Player receives action cards in right panel
2. Player drags action onto a unit
3. Action is added to that unit’s queue
4. Action appears immediately on unit as visual tag

### Feedback rules:
- Valid drop → snap + highlight
- Invalid drop → bounce back
- Overfilled queue → reject action

---