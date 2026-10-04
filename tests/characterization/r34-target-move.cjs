"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// Board (hand-authored, enemy budget 0 so the pack passes and only P1 acts): P1 at 6,6; E1 at 6,3 (distance 3, the
// NEAREST); E2 at 2,9 (distance 7); no other unit. P1 is selected and E2 is chosen through the tile handler; the
// approach is set through the real selector call (setPlayerMovementMode) and P1 gets one Move.
// R34a COMMANDER, for Hunt, Flank and Dodge (one context, three turns, the board reset before each): the played Move
//      equals the existing planner's plan toward E2 (getPlayerMovePlanFromSnapshot with E2, computed before Play from
//      the same positions: destination and path), and differs from its plan toward the nearest enemy E1; the move
//      event's planner note names E2; the battle note says "toward E2"; the single-tile move preview
//      (getPlayerMovePreviewTarget) shows the same destination before Play.
// R34b PREVIEW WITHOUT A TARGET: a wolf whose target is unset previews toward the enemy Play would auto-pick.
// R34c CURRENT CONTROL (same board, Hunt and Dodge; the E2 click is no target choice under current): the Move heads
//      for the NEAREST enemy (destination = the planner's plan toward E1; note names E1), as before.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r34-target-move";
const BOARD = [{ row: 6, col: 6, direction: "topRight" }, null, null,
  { row: 6, col: 3, direction: "bottomRight" }, { row: 2, col: 9, direction: "bottomLeft" }, null];

const PLAN = (target) => `(function () { const st = new Map(units.map((u) => [u, { row: u.row, col: u.col, direction: u.direction }]));
  const p = getPlayerMovePlanFromSnapshot(player, ${target}, st, { actionQueue: [] });
  return { to: { row: p.target.row, col: p.target.col }, path: p.path.map(({ row, col }) => ({ row, col })) }; })()`;

async function oneMove(g, mode, { chooseE2 }) {
  TG.board(g, BOARD);
  check(TG.clickTile(g, "P1") === null && TG.selected(g) === "P1", `${mode}: P1 selected`);
  g.ev(`setPlayerMovementMode(${JSON.stringify(mode)})`);
  check(g.ev("player.movementMode") === mode, `${mode}: approach set through the selector`);
  if (chooseE2) TG.clickTile(g, "E2");
  PV.L.pushOrders(g, "player", ["Move"]);
  const towardE2 = S.J(g, PLAN("enemySupport"));
  const towardE1 = S.J(g, PLAN("enemy"));
  check(JSON.stringify(towardE2.to) !== JSON.stringify(towardE1.to), `${mode}: the plans toward E2 and E1 differ (board discriminates)`);
  const preview = S.J(g, "(({ row, col }) => ({ row, col }))(getPlayerMovePreviewTarget(player))");
  const events = await PV.L.playTurn(g);
  const move = events.find((e) => e.type === "move" && e.unit === "P1");
  const note = g.ev("lastBattleDebugReport");
  const line = TG.noteLines(note, /^Tick 1:/)[0].replace(/^Tick 1: /, "").split(" | ").find((l) => l.startsWith("P1 "));
  return { towardE2, towardE1, preview, move: { to: move.to, path: move.path, debug: move.debug }, line, events };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R34a commander: three approaches
  const g = track(C.bootCommander("eab:0"));
  const commander = {};
  for (const mode of ["Hunt", "Flank", "Dodge"]) {
    const r = await oneMove(g, mode, { chooseE2: true });
    same(r.move.to, r.towardE2.to, `commander ${mode}: destination = the planner's plan toward the committed target E2`);
    same(r.move.path, r.towardE2.path, `commander ${mode}: path = the planner's path toward E2`);
    check(r.move.debug.startsWith("target E2 at 2,9;"), `commander ${mode}: planner note names E2 (${r.move.debug})`);
    check(r.line.includes(" toward E2 "), `commander ${mode}: battle note "toward E2"`);
    same(r.preview, r.towardE2.to, `commander ${mode}: the move preview shows the same destination before Play`);
    same(C.one(r.events, "targetsCommitted").targets.find((x) => x.unit === "P1"), { unit: "P1", target: "E2", source: "chosen", targetAlive: true }, `commander ${mode}: E2 committed`);
    commander[mode] = { to: r.move.to, path: r.move.path, nearestPlanWouldBe: r.towardE1.to, noteLine: r.line };
  }

  // ---- R34b preview without a target = Play's auto-pick
  TG.board(g, BOARD);
  g.ev("setPlayerSelected(player)");
  PV.L.pushOrders(g, "player", ["Move"]);
  check(TG.targets(g).startsWith("P1:-"), "no target yet");
  const previewNoTarget = S.J(g, "(({ row, col }) => ({ row, col }))(getPlayerMovePreviewTarget(player))");
  same(previewNoTarget, S.J(g, PLAN("enemy")).to, "unset target: the preview heads for the enemy Play would auto-pick (nearest E1)");
  check(g.ev("getBattleDebugUnitId(pickNearestTargetFor(player))") === "E1", "Play's auto-pick would be E1");

  // ---- R34c current control
  const cur = track(C.bootCurrent("eab:0"));
  const current = {};
  for (const mode of ["Hunt", "Dodge"]) {
    const r = await oneMove(cur, mode, { chooseE2: true });
    same(r.move.to, r.towardE1.to, `current ${mode}: destination = the plan toward the nearest enemy E1`);
    check(r.move.debug.startsWith("target E1 at 6,3;") && !r.line.includes("toward"), `current ${mode}: note names E1, no "toward" wording`);
    same(r.preview, r.towardE1.to, `current ${mode}: preview toward the nearest`);
    check(r.events.every((e) => !TG.TARGET_EVENT_TYPES.includes(e.type)), `current ${mode}: no target events`);
    current[mode] = { to: r.move.to, path: r.move.path, noteLine: r.line };
  }

  return { header: TG.REQ_HEADER_TARGETS, hands: TG.reportTargetHands(ID, ctxs), board: "P1 6,6; E1 6,3 (nearest); E2 2,9 (chosen)", commander, previewNoTarget, current };
}
module.exports = { id: ID, run };
