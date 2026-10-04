"use strict";
// REQUIREMENT — target selection
// Shared helpers for the commander target-selection fixtures (r32..r37). Not a fixture itself.
// Read-only reuse of _cmd (commander / current boots with the hand counter), _preview (dry runs, snapshots, played
// turns) and _lib (hand-placed boards through resetDevTest).
// HAND LEDGER (testing boundary): this step keeps its OWN ledger (reportTargetHands, asserted <= 100 in total),
// separate from the P2a (500) and follow-up (100) ledgers. Every context boots through C.bootCommander /
// C.bootCurrent, which count the boot hand and every dealt / refilled hand (dry runs included).
// INPUT PATHS (what the stub DOM can and cannot reach):
//   - clickTile: handleTileIntent(tile) = the real tile handler (shared by the arena click listener and the arena
//     keyboard handler);
//   - arenaClick: the real arena "click" listener (recorded by the stub DOM) with a synthetic pointer event. The
//     stub's rects are all zero, so arena.getBoundingClientRect is stubbed to the board size (scale 1) and the real
//     pointer -> tile resolution (getTileFromPointerEvent) runs; sprite hit tests read element rects (zero, i.e. no
//     sprite hit) unless a fixture stubs one sprite's rect;
//   - NOT reachable: the document-level click listener (deselect on an outside click) is not recorded by the stub
//     DOM, so only the arena handler's stopPropagation() call is observable; real layout, hover and CSS rendering.
const C = require("./_cmd.cjs");
const { PV, S } = C;
const { resetUnits } = require("./_lib.cjs");

const REQ_HEADER_TARGETS = "REQUIREMENT — target selection";
const TARGET_HAND_LIMIT = 100;
const ledger = {};
const VARS = { P1: "player", P2: "playerSupport", P3: "playerFlank", E1: "enemy", E2: "enemySupport", E3: "enemyFlank" };
const TARGET_EVENT_TYPES = ["targetsCommitted", "targetSkipped"];

/** This step's ledger: hands of every listed context (+ extra), asserted <= 100 over all target fixtures run so far.
 *  Returns only this fixture's count (the running total depends on which fixtures ran, so it is not recorded). */
function reportTargetHands(id, contexts, extra = 0) {
  ledger[id] = contexts.reduce((n, g) => n + S.handsOf(g), 0) + extra;
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  S.check(total <= TARGET_HAND_LIMIT, `target-selection hand budget: ${total} hands so far (limit ${TARGET_HAND_LIMIT})`);
  return ledger[id];
}

/** Hand-placed board: setups [P1,P2,P3,E1,E2,E3] (null = absent). Optional scripted enemy orders [{ unitId, action }]
 *  become the frozen commander plan (the turn start uses it as it is). */
function board(g, setups, enemyOrders = null) {
  resetUnits(g, setups);
  if (enemyOrders) {
    g.ev(`queueDevTestPackActions(${JSON.stringify(enemyOrders)})`);
    if (g.ev("isCommanderRules()")) g.ev("getEnemyPlanState().frozen = true");
  }
}

const tileOf = (g, id) => S.J(g, `[${VARS[id]}.row, ${VARS[id]}.col]`);
/** The real tile handler on a unit's tile (selects a wolf; under commander targets an enemy). Returns its result. */
const clickTile = (g, id) => { const [r, c] = tileOf(g, id); return g.ev(`handleTileIntent(getTileElementAt(${r}, ${c}))`) ?? null; };
const clickAt = (g, r, c) => g.ev(`handleTileIntent(getTileElementAt(${r}, ${c}))`) ?? null;

/** The real arena click listener with a pointer event at the centre of tile (r, c). Returns { tileResolved, stopped }. */
function arenaClick(g, r, c) {
  g.ev("arena.getBoundingClientRect = () => ({ left: 0, top: 0, right: boardWidth, bottom: boardHeight, width: boardWidth, height: boardHeight })");
  return S.J(g, `(function () {
    const p = projectTile(${r}, ${c});
    const e = { clientX: p.x, clientY: p.y + (TILE_OPAQUE_TOP + TILE_HEIGHT) / 2, target: { closest: () => null }, stopped: false,
      stopPropagation() { this.stopped = true; } };
    const tileResolved = getTileFromPointerEvent(e) === getTileElementAt(${r}, ${c});
    arena.listeners.filter((l) => l.type === "click").forEach((l) => l.fn(e));
    return { tileResolved, stopped: e.stopped };
  })()`);
}

const selected = (g) => g.ev("getSelectedPlayerUnit() ? getBattleDebugUnitId(getSelectedPlayerUnit()) : null");
/** Every player wolf's target as "P1:E2/chosen" (none: "P1:-"). */
const targets = (g) => S.J(g, `units.filter((u) => u.team === "player").map((u) => getBattleDebugUnitId(u) + ":" + (u.targetId ? u.targetId + "/" + u.targetSource : "-")).join(" ")`);
const status = (g) => g.ev("scenarioLabelElement.textContent");
/** The visible target markers per enemy: { E2: { chips: ["P1", "P3~"], autoChips: [...], ring: bool } }. */
const markers = (g) => S.J(g, `Object.fromEntries(units.filter((u) => u.team === "enemy" && u.targetMarker && !u.targetMarker.hidden).map((u) => [getBattleDebugUnitId(u), {
  chips: u.targetMarker.children.map((c) => c.textContent),
  autoChips: u.targetMarker.children.filter((c) => c.classList.contains("is-auto")).map((c) => c.textContent),
  ring: u.targetMarker.classList.contains("is-selected-target") }]))`);
/** Marker placement contract (AGENTS.md): a sibling of the sprite in the unit layer, never on / inside the sprite. */
const markerPlacement = (g, id) => S.J(g, `(function (u) { const m = u.targetMarker; return !m ? null : {
  siblingOfSprite: m.parentElement === u.element.parentElement && m !== u.element && !u.element.contains(m),
  className: m.className, left: m.style.left === u.x + "px", top: m.style.top === u.y + "px" }; })(${VARS[id]})`);
const noteLines = (note, re) => note.split("\n").filter((l) => re.test(l));
const ofTypes = (events, types) => events.filter((e) => types.includes(e.type));

/** Plain one-turn summary for goldens (moves, swings, misses, hits, skips, deaths). */
function turnSummary(events) {
  return events.filter((e) => ["targetsCommitted", "targetSkipped", "move", "attackSwing", "miss", "hit", "death"].includes(e.type)).map((e) => {
    const { type, debug, shortened, ...rest } = e;
    return PV.L.fmtEvent({ type, ...rest });
  });
}

module.exports = { C, PV, S, REQ_HEADER_TARGETS, VARS, TARGET_EVENT_TYPES, reportTargetHands, board, tileOf, clickTile, clickAt, arenaClick, selected,
  targets, status, markers, markerPlacement, noteLines, ofTypes, turnSummary };
