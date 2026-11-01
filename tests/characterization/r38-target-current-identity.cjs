"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// CURRENT PRESET IDENTITY. The two first turns that r15 already recorded (_preview boot, seed-1 intro: the "plain"
// board and the "lethal" board) are replayed under the default current preset WITH every new input path exercised
// in between: wolves selected through the tile handler, enemy clicks through the tile handler and through the real
// arena click listener (pointer resolution), and cards queued through applyPlayerAction (the first-queue path).
// R38a The played turn's event hash equals the value r15's golden recorded for the same turn (18b02e59b60d0f plain,
//      1495a8b0b3519f lethal), i.e. the event log is byte-identical to the existing recording.
// R38b Against a never-clicked control context with the same orders: identical events, battle note, final snapshot,
//      intent tags and hand view.
// R38c No commander artefact under current: no targetsCommitted / targetSkipped event, miss events carry exactly
//      { type, tick, attacker }, the note has no "Targets:" / "toward" / "skipped:" / "miss:" wording, no snapshot
//      record has target keys, no unit has a target field or marker, no element with the marker class exists, the
//      scenario label is unchanged, the enemy clicks returned nothing and did not stop propagation.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same, J } = S;
const G = C.G;

const ID = "r38-target-current-identity";
const RECORDED = { plain: "18b02e59b60d0f", lethal: "1495a8b0b3519f" }; // r15 golden, turn 1 of each case

function boot() {
  const g = PV.boot();
  G.installHandCounter(g);
  return g;
}

const observe = (g) => ({
  note: g.ev("lastBattleDebugReport"),
  state: JSON.stringify(PV.snapshot(g)),
  tags: J(g, "Object.fromEntries(units.map((u) => [getBattleDebugUnitId(u), u.intentTags ? Array.from(u.intentTags.querySelectorAll('.unit-intent-label')).map((t) => t.textContent) : null]))"),
  handView: J(g, "Array.from(actionsList.children).map((i) => i.dataset.action)"),
  label: TG.status(g),
});

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  for (const boardId of ["plain", "lethal"]) {
    const g = track(boot());
    const ctl = track(boot());
    const label0 = TG.status(g);
    // every new input path, under current
    const clicks = [];
    TG.clickTile(g, "P1");
    clicks.push(TG.clickTile(g, "E1"), TG.clickTile(g, "E2"));
    const arena = TG.arenaClick(g, ...TG.tileOf(g, "E3"));
    check(arena.tileResolved && arena.stopped === false, `${boardId}: arena listener resolved the enemy tile and did not stop propagation`);
    TG.clickTile(g, "P1"); // deselect again (toggle), as before the clicks
    PV.BOARDS[boardId].setup(g);
    PV.BOARDS[boardId].setup(ctl);
    TG.clickTile(g, "P2");
    clicks.push(TG.clickTile(g, "E3"));
    g.ev("setPlayerSelected(null)"); ctl.ev("setPlayerSelected(null)");
    check(clicks.every((c) => c === null), `${boardId}: enemy clicks return nothing under current`);
    const events = await PV.L.playTurn(g);
    const ctlEvents = await PV.L.playTurn(ctl);
    const hash = g.ev(`hashString53(${JSON.stringify(JSON.stringify(events))})`);
    // R38a
    check(hash === RECORDED[boardId], `${boardId}: event hash ${hash} = r15's recorded ${RECORDED[boardId]}`);
    // R38b
    same(events, ctlEvents, `${boardId}: events = the never-clicked control`);
    const a = observe(g); const b = observe(ctl);
    same(a, b, `${boardId}: note, snapshot, intent tags, hand view and label = the control`);
    // R38c
    check(events.every((e) => !TG.TARGET_EVENT_TYPES.includes(e.type)), `${boardId}: no target events`);
    check(C.ofType(events, "miss").every((e) => JSON.stringify(Object.keys(e)) === JSON.stringify(["type", "tick", "attacker"])), `${boardId}: miss events unchanged in shape`);
    check(!/^Targets:| toward | skipped: | miss: /m.test(a.note), `${boardId}: no commander wording in the note`);
    check(PV.snapshot(g).units.every((u) => !("target" in u) && !("targetSource" in u)), `${boardId}: no target keys in the snapshot`);
    check(g.ev("units.every((u) => !('targetId' in u) && !('targetSource' in u) && !('targetMarker' in u))"), `${boardId}: no target field or marker on any unit`);
    check(g.ev("(function walk(el) { return !el.classList.contains('unit-target-marker') && Array.from(el.children).every(walk); })(document.body)"), `${boardId}: no marker element in the DOM`);
    check(a.label === label0 && label0 === "intro · seed 1", `${boardId}: label unchanged`);
    out[boardId] = { eventHash: hash, recordedByR15: RECORDED[boardId], events: events.length, misses: C.ofType(events, "miss").length };
  }

  return { header: TG.REQ_HEADER_TARGETS, hands: TG.reportTargetHands(ID, ctxs), boards: out };
}
module.exports = { id: ID, run };
