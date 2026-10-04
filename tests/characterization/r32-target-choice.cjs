"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// R32a CLICK PATH + CHANGES (commander, seed-1 intro board): P1 is selected through the real tile handler
//      (handleTileIntent on its tile), then its target is changed several times during planning: E2 by the tile
//      handler, E3 by the real arena click listener (pointer -> tile resolution; stopPropagation keeps the
//      selection), E1 by the arena listener's SPRITE path (E1's sprite rect stubbed over an empty tile), back to E2.
//      After every change: the unit data (targetId / source "chosen"), the snapshot keys, the status line and the
//      markers (badge on the targeted enemy, ring = the selected wolf's target, old badge gone) agree. Selecting P2
//      moves the ring off; P2's own click adds "P2" to the shared badge.
// R32b REFUSALS (nothing changes, one status line explains): no wolf selected; a defeated enemy (E3, killed out of
//      band); while a turn executes (flag raised around the click).
// R32c COMMIT AT PLAY: the LAST choices are committed (targetsCommitted, note "Targets:" line); a click attempted
//      DURING the real played turn (hooked into the first executeActionTick) is refused and changes nothing.
// R32d MARKER CONTRACT (AGENTS.md): the badge is a sibling of the sprite in the unit layer (never on the sprite),
//      positioned at the unit's x / y; styles.css scales it with var(--arena-scale-inverse) and sizes / offsets it with
//      CSS variables (static read: the browser rendering is not tested by the current harness).
// R32e CURRENT CONTROL: the same clicks under current are not target choices (handleTileIntent returns nothing, no
//      unit field, no marker, label unchanged, the arena listener does not stop propagation) and the battle state
//      equals a never-clicked control.
const fs = require("node:fs");
const path = require("node:path");
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r32-target-choice";

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R32a
  const g = track(C.bootCommander());
  const steps = [];
  const record = (label) => steps.push({ step: label, targets: TG.targets(g), selected: TG.selected(g), markers: TG.markers(g), status: TG.status(g) });
  check(TG.clickTile(g, "P1") === null && TG.selected(g) === "P1", "P1 selected through the tile handler");
  check(TG.clickTile(g, "E2") === true, "tile handler: a click on E2 is a target choice");
  check(TG.selected(g) === "P1", "the selection is kept");
  same(S.J(g, "[player.targetId, player.targetSource]"), ["E2", "chosen"], "P1 -> E2 (chosen)");
  record("P1 selected, E2 clicked (tile handler)");
  const viaArena = TG.arenaClick(g, ...TG.tileOf(g, "E3"));
  check(viaArena.tileResolved && viaArena.stopped, "arena listener: the pointer resolves to E3's tile and the click stops propagation (selection kept)");
  same(S.J(g, "[player.targetId, player.targetSource]"), ["E3", "chosen"], "changed: P1 -> E3");
  record("E3 clicked (arena listener)");
  check(g.ev("!units.some((u) => u.row === 1 && u.col === 5) && !isBlockedTile(1, 5)"), "tile 1,5 is empty");
  g.ev("globalThis.__rect = enemy.element.getBoundingClientRect; enemy.element.getBoundingClientRect = () => { const p = projectTile(1, 5); const y = p.y + (TILE_OPAQUE_TOP + TILE_HEIGHT) / 2; return { left: p.x - 1, right: p.x + 1, top: y - 1, bottom: y + 1, width: 2, height: 2 }; }");
  const viaSprite = TG.arenaClick(g, 1, 5);
  g.ev("enemy.element.getBoundingClientRect = __rect");
  check(viaSprite.tileResolved && viaSprite.stopped && TG.selected(g) === "P1", "arena listener: a click on E1's sprite over the empty tile 1,5 is a target choice");
  same(S.J(g, "[player.targetId, player.targetSource]"), ["E1", "chosen"], "changed: P1 -> E1 (sprite path)");
  record("E1 sprite clicked over tile 1,5 (arena listener)");
  TG.clickTile(g, "E2");
  record("E2 clicked again");
  same(PV.snapshot(g).units.filter((u) => u.team === "player").map((u) => [u.id, u.target, u.targetSource]), [["P1", "E2", "chosen"], ["P2", null, null], ["P3", null, null]], "snapshot carries the last choice");
  check(PV.snapshot(g).units.filter((u) => u.team === "enemy").every((u) => !("target" in u) && !("targetSource" in u)), "enemy records carry no target keys");
  TG.clickTile(g, "P2");
  record("P2 selected (ring moves off E2)");
  TG.clickTile(g, "E2");
  record("P2 clicks E2 (shared badge)");
  same(TG.markers(g), { E2: { chips: ["P1", "P2"], autoChips: [], ring: true } }, "E2's badge lists P1 and P2; ringed for the selected P2");
  const placement = TG.markerPlacement(g, "E2");
  same(placement, { siblingOfSprite: true, className: "unit-target-marker is-selected-target", left: true, top: true }, "marker: separate overlay beside the sprite, at the unit's position");
  check(TG.markerPlacement(g, "E1") !== null && S.J(g, "enemy.targetMarker.hidden") === true, "E1's old badge is hidden (no wolf targets E1)");

  // ---- R32b refusals
  const refusals = {};
  const before = JSON.stringify(PV.snapshot(g));
  TG.clickTile(g, "P2"); // toggle: deselect
  check(TG.selected(g) === null, "no wolf selected");
  check(TG.clickTile(g, "E3") === true && JSON.stringify(PV.snapshot(g)) === before, "no selection: the click changes nothing");
  refusals.noSelection = TG.status(g);
  TG.clickTile(g, "P1");
  g.ev("enemyFlank.health = 0; enemyFlank.isDefeated = true;"); // out of band (hand-authored): E3 defeated
  const deadBefore = TG.targets(g);
  check(TG.clickTile(g, "E3") === true && TG.targets(g) === deadBefore && TG.selected(g) === "P1", "a defeated enemy: refused, nothing changes, selection kept");
  refusals.defeatedEnemy = TG.status(g);
  g.ev("enemyFlank.health = 10; enemyFlank.isDefeated = false;");
  check(JSON.stringify(PV.snapshot(g)) === before, "E3 restored: state as before the refusals");
  const executing = PV.evJ(g, `(function () { isExecutingActionQueue = true; try { return handleTileIntent(getTileElementAt(enemy.row, enemy.col)); } finally { isExecutingActionQueue = false; } })()`);
  check(executing === true && JSON.stringify(PV.snapshot(g)) === before, "while a turn executes: refused, nothing changes");
  refusals.executing = TG.status(g);

  // ---- R32c commit at Play (the last choices; a click during the real turn is refused)
  PV.L.queueByIndex(g, "player", [0]);
  PV.L.queueByIndex(g, "playerSupport", [0]);
  check(TG.targets(g) === "P1:E2/chosen P2:E2/chosen P3:-", "queueing keeps the chosen targets");
  g.ev(`globalThis.__midTurn = null; (function () { const orig = executeActionTick; executeActionTick = function () {
    if (__midTurn === null) { const t = getTileElementAt(enemy.row, enemy.col); __midTurn = { result: handleTileIntent(t), targets: player.targetId + "," + playerSupport.targetId, executing: isExecutingActionQueue, status: scenarioLabelElement.textContent }; }
    return orig.apply(this, arguments); }; })()`);
  const events = await PV.L.playTurn(g);
  const midTurn = S.J(g, "__midTurn");
  check(midTurn.executing === true && midTurn.result === true && midTurn.targets === "E2,E2", "a click during the played turn is refused (targets unchanged)");
  const committed = C.one(events, "targetsCommitted");
  same(committed.targets.map((t) => `${t.unit}:${t.target}/${t.source}`), ["P1:E2/chosen", "P2:E2/chosen", "P3:null/null"], "the last choices are committed at Play");
  same(committed.autoPicked, [], "no auto-pick at Play (both queued wolves had living targets)");
  check(events.findIndex((e) => e.type === "targetsCommitted") === 1, "committed right after turnStart, before anything moves");
  const note = g.ev("lastBattleDebugReport");
  same(TG.noteLines(note, /^Targets:/), ["Targets: P1 -> E2 (chosen), P2 -> E2 (chosen), P3 -> -"], "note: Targets line");
  check(TG.targets(g) === "P1:E2/chosen P2:E2/chosen P3:-", "targets persist after the turn");

  // ---- R32d CSS contract (static read)
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "styles.css"), "utf8");
  const rule = /\.unit-target-marker \{[^}]*\}/.exec(css)?.[0] ?? "";
  check(/scale\(var\(--arena-scale-inverse\)\)/.test(rule) && /var\(--unit-target-marker-offset-x\)/.test(rule) && /var\(--unit-target-marker-offset-y\)/.test(rule), "styles.css: the marker uses the inverse arena scale and offset variables");
  const cssVars = ["--unit-target-marker-offset-x", "--unit-target-marker-offset-y", "--unit-target-marker-font-size", "--unit-target-marker-ring"].filter((v) => css.includes(`${v}:`));
  check(cssVars.length === 4 && /\.unit-target-chip\.is-auto \{[^}]*dashed/.test(css), "styles.css: tunable variables on :root; auto chips dashed");

  // ---- R32e current control
  const cur = track(C.bootCurrent());
  const ctl = track(C.bootCurrent());
  TG.clickTile(cur, "P1");
  TG.clickTile(ctl, "P1");
  const curLabel = TG.status(cur);
  const curTile = TG.clickTile(cur, "E2");
  const curArena = TG.arenaClick(cur, ...TG.tileOf(cur, "E3"));
  check(curTile === null && curArena.tileResolved && curArena.stopped === false, "current: an enemy click is no target choice (no return value, propagation not stopped: the old deselect path)");
  check(cur.ev("units.every((u) => !('targetId' in u) && !('targetSource' in u) && !('targetMarker' in u))"), "current: no target field and no marker on any unit");
  check(TG.status(cur) === curLabel && curLabel === "intro · seed 1", "current: the label is unchanged");
  same(PV.snapshot(cur), PV.snapshot(ctl), "current: the battle state equals a never-clicked control");
  check(PV.snapshot(cur).units.every((u) => !("target" in u)), "current: the snapshot has no target keys");

  return {
    header: TG.REQ_HEADER_TARGETS,
    hands: TG.reportTargetHands(ID, ctxs),
    changes: steps,
    refusals,
    commit: { targetsCommitted: committed, midTurnClick: midTurn, noteTargetsLine: TG.noteLines(note, /^Targets:/)[0] },
    markerPlacement: placement,
    cssVariables: cssVars,
    currentControl: { tileHandlerResult: curTile, arenaStopped: curArena.stopped, label: curLabel },
  };
}
module.exports = { id: ID, run };
