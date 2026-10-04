"use strict";
// REQUIREMENT — target selection UX (hard assertions; evidence in the golden)
// Hit resolution through the REAL arena click listener with stubbed sprite rects (the stub DOM's rects are all zero;
// the arena rect is stubbed to the board size, scale 1, so pointer pixels are arena pixels). Hand-placed board:
// P1 5,5  P2 10,5  E1 5,7  E2 8,8 (E3 absent). Rects are 64x64 boxes centred where each case says; a unit with no
// stubbed rect has a zero rect (never hit: every pointer below is far from the origin).
// R40a COMMANDER, closest centre wins: P1 and E1 rects overlap. A pointer inside both but nearer E1's centre targets
//      E1 (the old rule would have deselected the selected wolf); nearer P1's centre deselects P1; an exact tie goes
//      to the enemy while a wolf is selected, to the wolf while none is.
// R40b PADDING: a pointer 4 px outside an enemy rect (inside the 8 px band) hits it; 10 px outside hits nothing.
// R40c FALL-THROUGH: a pointer inside no rect runs the tile logic unchanged (tile handler targets E2 / selects P2).
// R40d NO SELECTION: an enemy click says "select a wolf first" (nothing changes); a defeated unit's rect is ignored.
// R40e CURRENT CONTROL: the same pointer (inside the selected wolf's rect and nearer an enemy centre) keeps the legacy
//      precedence: the wolf is deselected, no target field, label unchanged.
// UX ONLY: only the selection / target fields move; the rest of the snapshot and the turn event log are untouched.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r40-target-ux-hit-resolution";
const SETUP = [{ row: 5, col: 5, direction: "bottomRight" }, { row: 10, col: 5, direction: "topRight" }, null,
  { row: 5, col: 7, direction: "bottomLeft" }, { row: 8, col: 8, direction: "topLeft" }, null];
const stripTargets = (snap) => ({ ...snap, units: snap.units.map(({ target, targetSource, ...u }) => u) });

/** Stub sprite rects: { P1: [cx, cy], ... } as 64x64 boxes. Others keep a zero rect. */
function setRects(g, centres) {
  Object.entries(centres).forEach(([id, [cx, cy]]) => {
    g.ev(`${TG.VARS[id]}.element.getBoundingClientRect = () => ({ left: ${cx - 32}, right: ${cx + 32}, top: ${cy - 32}, bottom: ${cy + 32}, width: 64, height: 64 })`);
  });
}
/** The real arena click listener at pixel (x, y). Returns { stopped }. */
function clickPx(g, x, y) {
  g.ev("arena.getBoundingClientRect = () => ({ left: 0, top: 0, right: boardWidth, bottom: boardHeight, width: boardWidth, height: boardHeight })");
  return S.J(g, `(function () {
    const e = { clientX: ${x}, clientY: ${y}, target: { closest: () => null }, stopped: false, stopPropagation() { this.stopped = true; } };
    arena.listeners.filter((l) => l.type === "click").forEach((l) => l.fn(e));
    return { stopped: e.stopped };
  })()`);
}
const events = (g) => S.J(g, "window.devTest.getTurnEventLog().length");
const fresh = (g, track) => { const x = track(g); TG.board(x, SETUP); return x; };

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const evidence = {};

  // ---- R40a closest centre wins (P1 selected)
  const g = fresh(C.bootCommander(), track);
  setRects(g, { P1: [300, 300], E1: [330, 300] }); // overlapping boxes, centres 30 px apart
  TG.clickTile(g, "P1");
  const base = PV.snapshot(g);
  const r1 = clickPx(g, 318, 300); // inside both: E1's centre 12 px away, P1's 18 px
  check(r1.stopped && TG.selected(g) === "P1" && TG.targets(g).startsWith("P1:E1/chosen"), "inside both rects, nearer E1: targets E1, P1 stays selected (no deselect)");
  evidence.nearerEnemy = { status: TG.status(g), targets: TG.targets(g) };
  check(TG.markers(g).E1.ring === true, "E1's marker is ringed");
  const r2 = clickPx(g, 305, 300); // P1 centre 5 px, E1 centre 25 px
  check(r2.stopped && TG.selected(g) === null && TG.targets(g).startsWith("P1:E1/chosen"), "inside both rects, nearer the selected wolf: deselects it; the target is untouched");
  TG.clickTile(g, "P1");
  const r3 = clickPx(g, 315, 300); // exact tie (15 / 15), wolf selected -> the enemy
  check(r3.stopped && TG.selected(g) === "P1" && TG.status(g).endsWith("target P1 cleared"), "exact tie with a wolf selected: the enemy wins (E1 was the target: cleared)");
  TG.clickTile(g, "P1"); // deselect
  check(TG.selected(g) === null, "no selection");
  const r4 = clickPx(g, 315, 300); // exact tie, none selected -> the wolf
  check(r4.stopped && TG.selected(g) === "P1" && TG.status(g).endsWith(" selected: click an enemy to target it, click it again to clear"), "exact tie with none selected: the wolf is selected (hint shown)");
  same(stripTargets(PV.snapshot(g)), stripTargets(base), "the rules state is untouched (targets aside)");
  check(events(g) === 0, "no turn events");

  // ---- R40b padding
  const p = fresh(C.bootCommander(), track);
  setRects(p, { P1: [300, 300], E1: [500, 300] });
  TG.clickTile(p, "P1");
  const far = clickPx(p, 542, 300); // 10 px outside the rect: beyond the 8 px band, no unit is hit
  check(TG.targets(p) === "P1:- P2:- P3:-", "10 px outside E1's rect: E1 not hit (no target set)");
  evidence.outsideFar = { stopped: far.stopped, selected: TG.selected(p) };
  const band = clickPx(p, 536, 300); // 4 px outside the rect (inside the 8 px padding)
  check(band.stopped && TG.targets(p).startsWith("P1:E1/chosen") && TG.selected(p) === "P1", "4 px outside E1's rect (padding band): E1 is hit and targeted");
  const corner = clickPx(p, 539, 331); // 7 px / 1 px outside the corner region: still within the band on both axes
  check(corner.stopped && TG.selected(p) === "P1", "inside the band on both axes: handled as a unit click");
  evidence.padding = { bandStatus: TG.status(p) };

  // ---- R40c fall-through to the tile logic
  const t = fresh(C.bootCommander(), track);
  setRects(t, { P1: [300, 300] });
  TG.clickTile(t, "P1");
  const fall = TG.arenaClick(t, ...TG.tileOf(t, "E2")); // no rect holds the pointer: the tile logic targets E2
  check(fall.tileResolved && fall.stopped && TG.targets(t).startsWith("P1:E2/chosen"), "inside no rect: the tile logic runs (E2 targeted through its tile)");
  const fall2 = TG.arenaClick(t, ...TG.tileOf(t, "P2"));
  check(fall2.stopped && TG.selected(t) === "P2", "inside no rect: a wolf's tile selects it (tile logic)");

  // ---- R40d no selection; defeated rects ignored
  const n = fresh(C.bootCommander(), track);
  setRects(n, { P1: [300, 300], E1: [500, 300] });
  const snapN = JSON.stringify(PV.snapshot(n));
  const none = clickPx(n, 500, 300);
  check(none.stopped && TG.selected(n) === null && JSON.stringify(PV.snapshot(n)) === snapN, "no wolf selected: the enemy click changes nothing");
  check(TG.status(n).endsWith("select a wolf first, then click an enemy to target it"), "status: select a wolf first");
  TG.clickTile(n, "P1");
  n.ev("enemy.health = 0; enemy.isDefeated = true;"); // hand-authored: E1 down; its stale rect must not capture clicks
  setRects(n, { P1: [800, 800] });
  const dead = clickPx(n, 500, 300);
  check(TG.targets(n) === "P1:- P2:- P3:-", "a defeated enemy's rect is ignored (no target set)");
  evidence.deadRect = { stopped: dead.stopped, selected: TG.selected(n) };

  // ---- R40e current control (legacy precedence)
  const cur = fresh(C.bootCurrent(), track);
  const ctl = fresh(C.bootCurrent(), track);
  setRects(cur, { P1: [300, 300], E1: [330, 300] });
  TG.clickTile(cur, "P1"); TG.clickTile(ctl, "P1");
  const label = TG.status(cur);
  const legacy = clickPx(cur, 318, 300);
  check(legacy.stopped && TG.selected(cur) === null, "current: the pointer inside the selected wolf's rect deselects it (old precedence)");
  check(cur.ev("units.every((u) => !('targetId' in u) && !('targetMarker' in u))") && TG.status(cur) === label && label === "intro · seed 1", "current: no target field / marker, label unchanged");
  TG.clickTile(ctl, "P1"); // the control deselects through the tile handler
  same(PV.snapshot(cur), PV.snapshot(ctl), "current: the battle state equals the control");

  return { header: "REQUIREMENT — target selection UX", hands: TG.reportTargetHands(ID, ctxs), evidence,
    pointers: { nearerEnemy: r1, nearerWolf: r2, tieSelected: r3, tieNone: r4, band, none, legacy } };
}
module.exports = { id: ID, run };
