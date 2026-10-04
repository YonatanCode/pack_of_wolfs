"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// R33a FIRST QUEUE (commander, seed-1 intro board, real UI path applyPlayerAction): the first card queued for a wolf
//      without a target picks the NEAREST living enemy by grid distance, source "auto", shown in the status line and as
//      a dashed "P1~" chip (P1 -> E1: 11 vs 13 / 14; P2 -> E3: 12 vs 13 / 15).
// R33b NO SILENT RETARGET: P1 is then moved out of band (hand-authored) next to E3, so a re-pick WOULD choose E3. Later
//      queue edits never change the target: add a second card, remove every card, re-add (queue empty -> non-empty
//      again), reshuffle (queues cleared, new hand) and re-add, an intent-preview refresh. Target stays E1 / auto.
// R33c CLICK OVERRIDES: a click sets E2 (chosen); further edits keep it.
// R33d EQUIDISTANT TIES (hand-authored board): P1 at 6,6 with E1 6,3 / E2 3,6 / E3 9,6 (all distance 3) -> E1 (lowest
//      id); then E1 is moved out of band to 1,1 and P2 at 6,9 has E2 / E3 tied at distance 6 -> E2 (the lower id).
// R33e DEAD TARGET: P1's target E1 is defeated out of band while P1's queue is empty: the target is NOT replaced on
//      its own (P1 -> E1, marker gone); the next first queue auto-picks the nearest LIVING enemy.
// R33f PLAY-TIME AUTO-PICK: queues filled directly (dev-tool style, no queueUnitAction): P1 Move, P2 Attack, P3 Defend.
//      Play auto-picks for P1 and P2 only (queued Move / Attack, no living target), records source "auto"
//      (targetsCommitted.autoPicked, note line), P3 stays "-"; the picks persist after the turn.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r33-target-auto-pick";

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R33a first queue
  const g = track(C.bootCommander());
  check(TG.targets(g) === "P1:- P2:- P3:-", "no targets at boot");
  PV.L.queueByIndex(g, "player", [0]);
  const firstQueue = { targets: TG.targets(g), status: TG.status(g), markers: TG.markers(g) };
  check(TG.targets(g) === "P1:E1/auto P2:- P3:-", "P1's first card auto-picks E1 (nearest)");
  same(TG.markers(g), { E1: { chips: ["P1~"], autoChips: ["P1~"], ring: true } }, "E1 shows P1~ (auto, dashed) ringed for the selected P1");
  PV.L.queueByIndex(g, "playerSupport", [0]);
  check(TG.targets(g) === "P1:E1/auto P2:E3/auto P3:-", "P2's first card auto-picks E3 (nearest to P2)");

  // ---- R33b no silent retarget
  g.ev("player.row = 2; player.col = 2;"); // out of band: next to E3 (0,2), so a fresh pick would be E3
  check(g.ev("getBattleDebugUnitId(pickNearestTargetFor(player))") === "E3", "a fresh pick would now choose E3");
  const edits = [];
  const after = (label) => { edits.push(`${label}: ${TG.targets(g)}`); check(TG.targets(g).startsWith("P1:E1/auto"), `${label}: P1 keeps E1 (auto)`); };
  g.ev("setPlayerSelected(player)");
  PV.L.queueByIndex(g, "player", [0]); after("add a second card");
  g.ev("removeUnitActionAt(player, 1); removeUnitActionAt(player, 0)");
  check(g.ev("getUnitActionQueue(player).length") === 0, "P1's queue is empty");
  after("remove every card");
  PV.L.queueByIndex(g, "player", [0]); after("re-add (queue empty -> non-empty)");
  g.ev("reshuffleActions()");
  check(g.ev("getUnitActionQueue(player).length") === 0, "reshuffle cleared the queues");
  after("reshuffle");
  PV.L.queueByIndex(g, "player", [0]); after("re-add after the reshuffle");
  g.ev("updateEnemyIntentPreview()"); after("intent preview refresh");

  // ---- R33c click overrides
  g.ev("setPlayerSelected(player)");
  check(TG.clickTile(g, "E2") === true, "click E2");
  check(TG.targets(g).startsWith("P1:E2/chosen"), "the click overrides the auto pick");
  PV.L.queueByIndex(g, "player", [0]);
  g.ev("removeUnitActionAt(player, 0); removeUnitActionAt(player, 0)");
  PV.L.queueByIndex(g, "player", [0]);
  check(TG.targets(g).startsWith("P1:E2/chosen"), "later edits keep the chosen target");

  // ---- R33e dead target (out of band, P1's queue emptied first)
  g.ev("player.row = 11; player.col = 5; while (getUnitActionQueue(player).length) removeUnitActionAt(player, 0);");
  check(TG.clickTile(g, "E1") === true && TG.targets(g).startsWith("P1:E1/chosen"), "P1 -> E1 (chosen)");
  g.ev("enemy.health = 0; enemy.isDefeated = true; renderTargetMarkers();");
  const deadBefore = { targets: TG.targets(g), markers: TG.markers(g), snapshotP1: PV.snapshot(g).units[0].target };
  check(deadBefore.targets.startsWith("P1:E1/chosen") && !("E1" in deadBefore.markers) && deadBefore.snapshotP1 === "E1", "E1 dead: P1 still records E1 (no silent replacement); no marker on the dead enemy");
  PV.L.queueByIndex(g, "player", [0]);
  const deadAfter = TG.targets(g);
  check(deadAfter.startsWith("P1:E2/auto"), `the next first queue replaces the dead target with the nearest living enemy (${deadAfter})`);

  // ---- R33d equidistant ties (hand-authored)
  const t = track(C.bootCommander());
  TG.board(t, [{ row: 6, col: 6, direction: "topLeft" }, { row: 6, col: 9, direction: "topLeft" }, null,
    { row: 6, col: 3, direction: "bottomRight" }, { row: 3, col: 6, direction: "bottomRight" }, { row: 9, col: 6, direction: "topLeft" }]);
  const distP1 = S.J(t, "[enemy, enemySupport, enemyFlank].map((e) => getGridDistance(player.row, player.col, e.row, e.col))");
  same(distP1, [3, 3, 3], "P1: E1 / E2 / E3 all at distance 3");
  PV.L.queueByIndex(t, "player", [0]);
  check(TG.targets(t).startsWith("P1:E1/auto"), "three-way tie -> E1 (lowest id)");
  t.ev("enemy.row = 1; enemy.col = 1;"); // out of band: E1 out of P2's tie
  const distP2 = S.J(t, "[enemy, enemySupport, enemyFlank].map((e) => getGridDistance(playerSupport.row, playerSupport.col, e.row, e.col))");
  same(distP2, [13, 6, 6], "P2: E2 / E3 tied at distance 6");
  PV.L.queueByIndex(t, "playerSupport", [0]);
  check(TG.targets(t) === "P1:E1/auto P2:E2/auto P3:-", "two-way tie -> E2 (lower id); P1 keeps E1");

  // ---- R33f Play-time auto-pick (queues filled directly)
  const p = track(C.bootCommander());
  PV.L.pushOrders(p, "player", ["Move"]);
  PV.L.pushOrders(p, "playerSupport", ["Attack"]);
  PV.L.pushOrders(p, "playerFlank", ["Defend"]);
  check(TG.targets(p) === "P1:- P2:- P3:-", "direct queue edits pick nothing");
  const events = await PV.L.playTurn(p);
  const committed = C.one(events, "targetsCommitted");
  same(committed.autoPicked, ["P1", "P2"], "Play auto-picks for the wolves with a queued Move / Attack");
  same(committed.targets.map((x) => `${x.unit}:${x.target}/${x.source}`), ["P1:E1/auto", "P2:E3/auto", "P3:null/null"], "committed with source auto; P3 (Defend only) has none");
  const note = p.ev("lastBattleDebugReport");
  same(TG.noteLines(note, /^Targets:/), ["Targets: P1 -> E1 (auto), P2 -> E3 (auto), P3 -> -"], "note: Targets line with the sources");
  check(TG.targets(p) === "P1:E1/auto P2:E3/auto P3:-", "the Play-time picks persist after the turn");
  same(TG.markers(p), { E1: { chips: ["P1~"], autoChips: ["P1~"], ring: false }, E3: { chips: ["P2~"], autoChips: ["P2~"], ring: false } }, "markers after the turn (auto chips)");

  return {
    header: TG.REQ_HEADER_TARGETS,
    hands: TG.reportTargetHands(ID, ctxs),
    firstQueue,
    noSilentRetarget: edits,
    deadTarget: { before: deadBefore.targets, afterNextFirstQueue: deadAfter },
    tie: { distancesP1: distP1, distancesP2: distP2, picks: TG.targets(t) },
    playTime: { targetsCommitted: committed, noteLine: TG.noteLines(note, /^Targets:/)[0], summary: TG.turnSummary(events) },
  };
}
module.exports = { id: ID, run };
