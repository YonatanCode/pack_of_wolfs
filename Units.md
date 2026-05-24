# Units.md
# Units Spec

## 1. Core Principle

Units are intentionally simple.

The depth of the game does NOT come from unit complexity, but from:
- action sequencing
- interruptions
- positioning
- prediction

Units define constraints, not combos.

---

## 2. Shared Base Rules

All units share:

- Grid-based movement
- 1 tile movement per Move action per tick
- Action queue system (from gameplay spec)
- Can be interrupted (next action cancelled only)
- Deterministic combat resolution

---

## 3. Unit Categories (MVP Set)

Keep to 3 core archetypes:

### 1. Soldier (Balanced Unit)

- Purpose: frontline control
- HP: medium
- Attack: medium
- Move capacity: medium (2–3 queued actions typical)

**Role:**
- holds position
- creates predictable pressure
- easy to read in enemy plans

---

### 2. Runner (Fast Unit)

- Purpose: disruption / positioning / flanking
- HP: low
- Attack: low-medium
- Move capacity: high (4–5 actions possible)

**Role:**
- fast plan execution
- highly sensitive to interrupts
- used for strategic timing plays

---

### 3. Brute (Heavy Unit)

- Purpose: breakthrough / tank / anchor
- HP: high
- Attack: high
- Move capacity: low (1–2 actions max)

**Role:**
- slow but powerful
- difficult to fully neutralize
- creates pressure lanes

---

## 4. Unit Design Constraint (VERY IMPORTANT)

Units DO NOT have:
- abilities
- cooldown skills
- inventories
- leveling systems
- resource costs (MVP)

Only:
- HP
- attack strength
- action capacity (implicit via type)

---

## 5. Action Capacity Rule

Each unit type has different “planning flexibility”:

- Brute → low action capacity, high impact actions
- Runner → high action capacity, low impact actions
- Soldier → balanced

### Design intent:
> Power is traded for flexibility

This directly supports the core gameplay:
prediction vs disruption.

---

## 6. Combat Interaction Rules

When units collide:

### Resolution:
- Attack is immediate
- Damage is deterministic
- No dodge / crit / randomness (MVP)

### Outcome:
- Higher attack wins exchanges faster
- HP determines survivability under repeated ticks

---

## 7. Positioning Role Identity

### Soldiers:
- hold center lanes
- create predictable frontlines

### Runners:
- exploit gaps
- reach enemy backline or interrupt key units

### Brutes:
- break formations
- absorb interruptions and still progress

---

## 8. Strategic Layer Intent

Units are not “power scaling objects”.

They are:
- different planning constraints
- different interruption sensitivity
- different tempo profiles

The game is about:
> how unit types interact under disrupted timelines

---

## 9. Interaction with Interrupt System

Interrupt impact varies indirectly:

- Runner: highly vulnerable (loses tempo easily)
- Soldier: moderate impact
- Brute: least disrupted (fewer actions = fewer cancel points)

This creates strategic targeting decisions:
> which unit do I break to collapse the plan?

---

## 10. AI Usage Rules

AI uses units as:

- Brutes → push lanes
- Soldiers → stabilize front
- Runners → create timing disruptions or pressure points

AI does NOT optimize perfectly (intentional):
- allows readable prediction opportunities
- creates exploitable patterns

---

## 11. Core Design Outcome

Units exist to create:

- readable enemy intentions
- predictable planning patterns
- meaningful interruption targets
- tradeoffs between speed, strength, and flexibility

---

## 12. MVP Validation Rule

The system is correct if:

> Players can look at enemy units and guess their plan before execution begins