"use strict";
// REQUIREMENT — target selection UX (hard assertions; evidence in the golden)
// R39a EMPTY HAND (commander): with every card queued (empty hand) the selected wolf stays selected, its menu stays
//      visible (action buttons hidden, nothing to play) and an enemy click (tile handler and arena listener) sets the
//      target. Control: under current the old auto-clear still deselects and hides the menu.
// R39b UNASSIGN: clicking the selected wolf's CURRENT target clears it (source none): status "target P1 cleared" (no
//      queued Move / Attack) or "... (Play will auto-pick the nearest)" (queued Move / Attack), markers gone, the
//      snapshot carries target null; the wolf stays selected. A later first-queue auto-picks (source auto); a cleared
//      target with a queued Move is auto-picked at Play start (existing rule); clicking a DIFFERENT enemy still
//      retargets; a click on the current target while a turn executes is refused (target kept).
// R39c HINT: selecting a wolf under commander shows "P1 selected: click an enemy to target it, click it again to
//      clear" in the scenario label (also via the real arena listener); current: label unchanged.
// UX ONLY: the selection / hint paths change no rules state (snapshot with targets stripped is identical, no turn
// events); only the target fields move on a target click / clear.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r39-target-ux-unassign";
const HINT = (id) => `${id} selected: click an enemy to target it, click it again to clear`;
const BASE = "intro · seed 1 · commander (experimental) · ";

const stripTargets = (snap) => ({ ...snap, units: snap.units.map(({ target, targetSource, ...u }) => u) });
const events = (g) => S.J(g, "window.devTest.getTurnEventLog().map((e) => e.type)");

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R39a empty hand
  const g = track(C.bootCommander());
  const hint = {};
  TG.clickTile(g, "P1");
  hint.afterSelect = TG.status(g);
  check(hint.afterSelect === BASE + HINT("P1"), "R39c: tile-handler select shows the hint");
  const snapSelected = PV.snapshot(g);
  while (g.ev("playerHand.length") > 0) g.ev("applyPlayerAction(playerHand[0])"); // every card queued (real UI path)
  const empty = { hand: g.ev("playerHand.length"), selected: TG.selected(g), menuHidden: g.ev("playerActionMenu.hidden"),
    buttonsHidden: g.ev("Array.from(playerActionMenu.querySelectorAll('[data-player-action]')).every((b) => b.hidden)") };
  same(empty, { hand: 0, selected: "P1", menuHidden: false, buttonsHidden: true }, "commander: empty hand keeps P1 selected, menu visible, action buttons hidden");
  check(TG.clickTile(g, "E2") === true, "empty hand: the enemy click is a target choice");
  same(S.J(g, "[player.targetId, player.targetSource]"), ["E2", "chosen"], "empty hand: P1 -> E2 (chosen)");
  const viaArena = TG.arenaClick(g, ...TG.tileOf(g, "E3"));
  check(viaArena.stopped && TG.selected(g) === "P1" && TG.targets(g).startsWith("P1:E3/chosen"), "empty hand: the arena listener retargets E3 and keeps the selection");
  const emptyHandStatus = TG.status(g);

  const cur = track(C.bootCurrent());
  TG.clickTile(cur, "P1");
  while (cur.ev("playerHand.length") > 0) cur.ev("applyPlayerAction(playerHand[0])");
  same({ selected: TG.selected(cur), menuHidden: cur.ev("playerActionMenu.hidden") }, { selected: null, menuHidden: true }, "current: the old auto-clear still deselects and hides the menu");
  check(TG.status(cur) === "intro · seed 1", "current: no hint, label unchanged");

  // ---- R39b unassign
  const u = track(C.bootCommander());
  const log = [];
  const rec = (label) => log.push({ step: label, targets: TG.targets(u), selected: TG.selected(u), markers: TG.markers(u), status: TG.status(u) });
  TG.clickTile(u, "P1");
  check(events(u).length === 0, "selecting emits no turn event");
  same(stripTargets(PV.snapshot(u)), stripTargets(snapSelected), "selection leaves the rules state as it was (targets aside)");
  TG.clickTile(u, "E2");
  rec("E2 chosen");
  const selectedState = JSON.stringify(PV.snapshot(u));
  check(TG.clickTile(u, "E2") === true, "second click on the current target is handled");
  rec("E2 clicked again: cleared (no queued Move / Attack)");
  check(TG.status(u) === BASE + "target P1 cleared", "status: target P1 cleared");
  check(u.ev("player.targetId") === null && u.ev("player.targetSource") === null && TG.selected(u) === "P1", "cleared: target none, wolf still selected");
  same(TG.markers(u), {}, "cleared: no marker left");
  same(PV.snapshot(u).units.filter((x) => x.team === "player").map((x) => [x.id, x.target, x.targetSource]), [["P1", null, null], ["P2", null, null], ["P3", null, null]], "snapshot: target null");
  check(events(u).length === 0, "clearing emits no turn event");
  same(stripTargets(JSON.parse(selectedState)), stripTargets(PV.snapshot(u)), "clearing changes only the target fields");

  TG.clickTile(u, "E2"); TG.clickTile(u, "E1");
  check(TG.targets(u).startsWith("P1:E1/chosen"), "clicking a DIFFERENT enemy retargets (E2 -> E1)");
  rec("E1 chosen (retarget from E2)");
  PV.L.pushOrders(u, "player", ["Move"]);
  TG.clickTile(u, "E1");
  rec("E1 clicked again with a queued Move: cleared");
  check(TG.status(u) === BASE + "target P1 cleared (Play will auto-pick the nearest)", "status: cleared, Play will auto-pick");
  check(TG.targets(u) === "P1:- P2:- P3:-", "cleared with a queued Move: nothing picks it silently");
  const executing = PV.evJ(u, `(function () { player.targetId = "E2"; player.targetSource = "chosen"; isExecutingActionQueue = true;
    try { return handleTileIntent(getTileElementAt(enemySupport.row, enemySupport.col)); } finally { isExecutingActionQueue = false; } })()`);
  check(executing === true && TG.targets(u).startsWith("P1:E2/chosen") && TG.status(u).endsWith("targets are locked while the turn plays"), "while executing: the click on the current target is refused (target kept)");
  TG.clickTile(u, "E2");
  check(TG.targets(u) === "P1:- P2:- P3:-", "cleared again (E2) for the Play-time auto-pick");
  const turn = await PV.L.playTurn(u);
  const committed = C.one(turn, "targetsCommitted");
  same(committed.autoPicked, ["P1"], "Play auto-picks the cleared target of the wolf with a queued Move");
  same(committed.targets.map((t) => `${t.unit}:${t.target}/${t.source}`), ["P1:E1/auto", "P2:null/null", "P3:null/null"], "committed: P1 -> E1 (auto)");

  // first-queue after a clear
  const f = track(C.bootCommander());
  TG.clickTile(f, "P1"); TG.clickTile(f, "E2"); TG.clickTile(f, "E2");
  check(TG.targets(f) === "P1:- P2:- P3:-", "cleared before any card");
  PV.L.queueByIndex(f, "player", [0]);
  check(TG.targets(f).startsWith("P1:E1/auto") && TG.status(f).endsWith("target P1 -> E1 (auto: nearest)"), "the next first queue auto-picks the nearest (source auto)");
  TG.clickTile(f, "E1");
  check(TG.status(f) === BASE + "target P1 cleared (Play will auto-pick the nearest)" && f.ev("getUnitActionQueue(player).join()") === "Attack", "an auto target is cleared by the same click (queued Attack: Play will auto-pick)");
  check(TG.targets(f) === "P1:- P2:- P3:-", "an auto target is cleared by the same click");

  // ---- R39c hint via the real arena listener
  const a = track(C.bootCommander());
  const arenaSel = TG.arenaClick(a, ...TG.tileOf(a, "P2"));
  check(arenaSel.stopped && TG.selected(a) === "P2" && TG.status(a) === BASE + HINT("P2"), "arena listener: selecting P2 shows the hint");
  const labelBefore = TG.status(a);
  TG.arenaClick(a, ...TG.tileOf(a, "P2"));
  check(TG.selected(a) === null && TG.status(a) === labelBefore, "clicking the selected wolf deselects (label left as it was)");

  return {
    header: "REQUIREMENT — target selection UX",
    hands: TG.reportTargetHands(ID, ctxs),
    emptyHand: { ...empty, status: emptyHandStatus },
    hint,
    unassign: log,
    playTime: { targetsCommitted: committed, summary: TG.turnSummary(turn) },
    refusedWhileExecuting: TG.status(u),
  };
}
module.exports = { id: ID, run };
