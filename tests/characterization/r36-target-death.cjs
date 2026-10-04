"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// Hand-authored board (commander, default numbers; the enemy plan is scripted and frozen, covered by the pool):
//   P1 at 6,6 (one Attack) and P2 at 9,9 (Defend, Move, Defend, Attack) both target E1 (chosen by clicks);
//   E1 at 6,5 with 1 HP (adjacent to P1); E2 at 9,10 (adjacent to P2 only) plans Defend, Attack, Attack; P3 / E3 absent.
// R36a TARGET KILLED IN TICK 1 by P1. P2's remaining Move (tick 2) is CONSUMED without effect: a "targetSkipped"
//      event (reason target-defeated), no move event (no run animation), battle note line "Move skipped: E1
//      defeated"; P2 does NOT retarget its Move. P2's Attack (tick 4) used to be skipped too; since the attack
//      fallback (r45) a dead target no longer skips an Attack while another enemy is adjacent: E2 (adjacent) is hit
//      with fallbackFromTargetId E1 (this fixture's assertions changed accordingly).
// R36b DEFEND STILL WORKS in the same queue: E2 hits P2 for the full 3 in tick 2 (P2's Move skipped, not defending)
//      and for the defended 1 in tick 3 (P2 Defend).
// R36c AFTER THE TURN: both wolves still record E1 (defeated); no marker on the dead E1. The next first queue
//      replaces P2's dead target with the nearest living enemy (auto); P1 (nothing queued) keeps E1.
// R36d DRY RUN = PLAY (events, final state, outcome).
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r36-target-death";

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const g = track(C.bootCommander());
  TG.board(g, [{ row: 6, col: 6, direction: "topLeft" }, { row: 9, col: 9, direction: "bottomRight" }, null,
    { row: 6, col: 5, direction: "bottomRight", health: 1 }, { row: 9, col: 10, direction: "topLeft" }, null],
  [{ unitId: "enemySupport", action: "Defend" }, { unitId: "enemySupport", action: "Attack" }, { unitId: "enemySupport", action: "Attack" }]);
  check(g.ev("isAdjacentTile(9, 9, 9, 10) && !isAdjacentTile(6, 6, 9, 10) && isAdjacentTile(6, 6, 6, 5)"), "adjacency as designed");
  TG.clickTile(g, "P1"); TG.clickTile(g, "E1");
  TG.clickTile(g, "P2"); TG.clickTile(g, "E1");
  check(TG.targets(g) === "P1:E1/chosen P2:E1/chosen P3:-", "both wolves target E1");
  PV.L.pushOrders(g, "player", ["Attack"]);
  PV.L.pushOrders(g, "playerSupport", ["Defend", "Move", "Defend", "Attack"]);
  const preview = PV.dryRun(g);
  const events = await PV.L.playTurn(g);
  const note = g.ev("lastBattleDebugReport");

  // R36a
  same(C.ofType(events, "death").map((e) => `${e.unit}@${e.tick}`), ["E1@1"], "E1 dies in tick 1");
  same(C.ofType(events, "targetSkipped"), [
    { type: "targetSkipped", tick: 2, unit: "P2", action: "Move", target: "E1", reason: "target-defeated" },
  ], "P2's Move is skipped (target-defeated); its Attack is not (E2 adjacent)");
  same(C.ofType(events, "consumed").map((e) => e.actions.filter((x) => x.unit === "P2").map((x) => x.action).join()), ["Defend", "Move", "Defend", "Attack"], "all four P2 actions are consumed");
  check(!events.some((e) => e.type === "move" && e.unit === "P2"), "no move for P2 (no run animation)");
  same(C.ofType(events, "attackSwing").filter((e) => e.unit === "P2").map((e) => `${e.tick}:${e.target}`), ["4:E2"], "P2's tick-4 Attack swings at the adjacent E2");
  same(C.ofType(events, "hit").filter((e) => e.attacker === "P2"), [{ type: "hit", tick: 4, attacker: "P2", target: "E2", damage: 3, defended: false, fallbackFromTargetId: "E1" }], "P2's Attack falls back to E2");
  const ticks = TG.noteLines(note, /^Tick \d:/);
  check(ticks[1].includes("P2 support wolf Move skipped: E1 defeated") && ticks[3].includes("P2 support wolf Attack 9,9 -> 9,9 hit E2 enemy support wolf for 3 (fallback: E1 not adjacent or defeated)"), `note: skipped Move line, fallback Attack line (${ticks[3]})`);
  // R36b
  same(C.ofType(events, "hit").filter((h) => h.target === "P2").map((h) => `tick ${h.tick}: ${h.damage}${h.defended ? " defended" : ""}`),
    ["tick 2: 3", "tick 3: 1 defended"], "E2 hits P2 for 3 (P2 not defending) then 1 (P2 Defend)");
  // R36c
  check(TG.targets(g) === "P1:E1/chosen P2:E1/chosen P3:-", "after the turn both wolves still record the dead E1");
  same(TG.markers(g), {}, "no marker on the dead E1");
  PV.L.queueByIndex(g, "playerSupport", [0]);
  check(TG.targets(g) === "P1:E1/chosen P2:E2/auto P3:-", "the next first queue replaces P2's dead target (auto: nearest living E2); P1 keeps E1");
  same(TG.markers(g), { E2: { chips: ["P2~"], autoChips: ["P2~"], ring: true } }, "E2 marker: P2~ (auto), ringed (P2 selected)");
  // R36d
  check(preview.ok, "preview ran");
  same(preview.result.events, events, "preview events = played events");
  same(preview.result.outcome, { winner: C.one(events, "outcome").winner, doubleKO: C.one(events, "outcome").doubleKO }, "preview outcome = played outcome");

  return {
    header: TG.REQ_HEADER_TARGETS,
    hands: TG.reportTargetHands(ID, ctxs),
    summary: TG.turnSummary(events),
    noteTargets: TG.noteLines(note, /^Targets:/)[0],
    noteTicks: ticks,
    afterTurn: "P1:E1/chosen P2:E1/chosen P3:-",
    afterNextFirstQueue: TG.targets(g),
  };
}
module.exports = { id: ID, run };
