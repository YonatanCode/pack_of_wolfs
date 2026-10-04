# Checkpoint: commander attack fallback

Branch `battle-foundation`, on top of 12833ec / fb97e16 (L1). Not merged, not pushed.

## Rule (commander preset only)
Committed target alive and adjacent: hit it. Target not adjacent or defeated and another living enemy adjacent: hit that one,
chosen by the no-target selection (snapshot adjacency, facing tiebreak; deterministic, no new randomness); the `hit` event
carries `fallbackFromTargetId`. Nobody adjacent: Miss `target-not-adjacent` as before. Move is unchanged (follows the
committed target; skipped with `target-defeated` when it died). An Attack on a defeated target is skipped only when no living
enemy is adjacent.

## Code (script.js)
`getAttackIntentTarget`, `getLiveAttackTarget`, `getTargetDefeatedSkips`, damage intents / `resolveTickDamageRules` hit event,
`recordBattleDebugTick` note line. Commander version `0.4.0-commander-enemy-actions-targets-fallback`, hash `1ee7c8d5a26ec1`
(was `1ef03d7c79476f`). Current default hash `0d3ce2ec6fa6de` unchanged. Preview / dry run and the L1 headless door share the core.

## Recordings changed (declared)
- r31 fixture + golden: version pin, commander hashes, custom label / panel summary hash.
- r35 fixture + golden: R35a asserted "Miss, no fallback"; now a fallback hit on E1 (fixture assertions rewritten).
- r36 fixture + golden: P2's tick-4 Attack on the defeated E1 now falls back to adjacent E2 (assertions rewritten).
- r43 golden: stateHash only (4 values; BattleState carries the rules version). Event hashes unchanged.
- r44 golden: rules version and hash only.
- New: r45 fixture + golden. No other golden changed (current-preset fixtures r1..r27, r28..r30, r32..r34, r37..r42 byte-identical).

## Testing
Bounded hand-authored boards only (r45: boards a to e, one turn each, plus one headless-vs-live turn and a current control).
No bots, batches, sweeps or generated boards.

## Known limits
- The dead-target skip decision uses adjacency at the start of the tick; the swing uses the live adjacency after the moves.
- Facing at the swing is computed toward the intended target from the start-of-tick snapshot, as for any swing.
- No in-game text claimed Attack only hits the target; nothing to update there. Browser rendering of the fallback hit is the
  existing hit animation / damage popup (not covered by the headless harness).
