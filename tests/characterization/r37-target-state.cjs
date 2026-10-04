"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// R37a SNAPSHOT SHAPE: under commander every PLAYER record carries target / targetSource (enemy records do not);
//      under current no record has them.
// R37b VALIDATION: validateBattleState accepts known enemy ids / null with a matching source and refuses an unknown id,
//      a player id, a bad source, an id without a source, target keys on an enemy record and target keys in a state
//      whose rules are not commander. loadBattleState refuses such a state before writing anything.
// R37c SWAP: withBattleState swaps a copy's targets in (a copy with P1 -> E3 reads E3 inside) and restores the live
//      ones afterwards, also when the function throws.
// R37d DRY RUN = PLAY with a chosen target (P1 -> E2, click), a first-queue auto target (P2) and a Play-time auto target
//      (P3, queue filled directly): events, final state (targets, hand, RNG position), outcome, event hash, and the
//      battle note (the note of a fixture-side drain of the same copy through withBattleState). Two previews agree and
//      leave the live battle (targets included) unchanged; a failed preview (injected fault) and a refused one
//      (turn-executing) change nothing.
// R37e LOAD: loadBattleState of the pre-Play state into a fresh commander context reproduces the snapshot (targets
//      included) and the identical preview.
// R37f RESETS clear every target and hide the markers: Restart, scenario load, Play Again.
// R37g FORCED-CURRENT MODES: tutorial (started from a commander battle with targets), world mode (link with
//      preset=commander) and a dev scenario (run from a commander battle) have no targets and no markers, and an enemy
//      click there is no target choice.
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same, J } = S;
const G = C.G;

const ID = "r37-target-state";
const DRAIN_NOTE = `withBattleState(snapshotBattleState(), () => { const ctx = createTurnContext("dryRun"); const core = guardTurnCore(runTurnCore(ctx));
  for (let r = core.next(); !r.done; r = core.next()) {} return lastBattleDebugReport; })`;
const noTargetsAnywhere = (g) => g.ev("units.every((u) => !u.targetId) && units.every((u) => !u.targetMarker || u.targetMarker.hidden)");

function setupTargets(g) {
  TG.clickTile(g, "P1");
  TG.clickTile(g, "E2"); // chosen
  PV.L.queueByIndex(g, "player", [0]);
  PV.L.queueByIndex(g, "playerSupport", [0]); // first queue: auto
  PV.L.pushOrders(g, "playerFlank", ["Move"]); // direct: Play-time auto
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  let tutorialHands = 0;

  // ---- R37a
  const g = track(C.bootCommander());
  setupTargets(g);
  const state0 = PV.snapshot(g);
  same(state0.units.map((u) => ("target" in u ? `${u.id}:${u.target}/${u.targetSource}` : `${u.id}:no-keys`)),
    ["P1:E2/chosen", "P2:E3/auto", "P3:null/null", "E1:no-keys", "E2:no-keys", "E3:no-keys"], "commander snapshot: player records carry target / targetSource");
  const cur = track(C.bootCurrent());
  check(PV.snapshot(cur).units.every((u) => !("target" in u) && !("targetSource" in u)), "current snapshot: no target keys");

  // ---- R37b
  const withUnit = (patch, id = "P1", base = state0) => ({ ...base, units: base.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  const validate = (state) => G.attempt(g, `validateBattleState(${JSON.stringify(state)})`);
  const cases = {
    "valid chosen": withUnit({ target: "E3", targetSource: "chosen" }),
    "valid none": withUnit({ target: null, targetSource: null }),
    "unknown id": withUnit({ target: "E9", targetSource: "chosen" }),
    "player id": withUnit({ target: "P2", targetSource: "chosen" }),
    "bad source": withUnit({ target: "E1", targetSource: "clicked" }),
    "id without source": withUnit({ target: "E1", targetSource: null }),
    "source without id": withUnit({ target: null, targetSource: "auto" }),
    "keys on an enemy record": withUnit({ target: null, targetSource: null }, "E1"),
    "keys under current rules": PV.snapshot(cur).units ? { ...PV.snapshot(cur), units: PV.snapshot(cur).units.map((u) => (u.id === "P1" ? { ...u, target: "E1", targetSource: "chosen" } : u)) } : null,
  };
  const validation = Object.fromEntries(Object.entries(cases).map(([label, state]) => {
    const r = validate(state);
    return [label, r.thrown ? `${r.name}: ${r.message}` : "ok"];
  }));
  check(validation["valid chosen"] === "ok" && validation["valid none"] === "ok", "valid target records accepted");
  check(Object.entries(validation).filter(([l]) => !l.startsWith("valid")).every(([, v]) => v === "BattleStateError: Invalid battle state: unit target"), "invalid target records refused");
  const liveBefore = JSON.stringify(PV.snapshot(g));
  const badLoad = G.attempt(g, `loadBattleState(${JSON.stringify(cases["unknown id"])})`);
  check(badLoad.thrown && badLoad.name === "BattleStateError" && JSON.stringify(PV.snapshot(g)) === liveBefore, "loadBattleState refuses a bad target before writing anything");

  // ---- R37c
  const inside = g.ev(`withBattleState(${JSON.stringify(cases["valid chosen"])}, () => player.targetId + "/" + player.targetSource + "/" + getBattleDebugUnitId(getLivingTargetUnit(player)))`);
  check(inside === "E3/chosen/E3", "a copy's target is swapped in");
  check(JSON.stringify(PV.snapshot(g)) === liveBefore, "the live targets are restored after the swap");
  const thrown = G.attempt(g, `withBattleState(${JSON.stringify(cases["valid chosen"])}, () => { throw new Error("injected fault inside the copy"); })`);
  check(thrown.thrown && JSON.stringify(PV.snapshot(g)) === liveBefore, "restored when the function throws");

  // ---- R37d dry run = play (+ note), repeated / failed / refused previews
  const previews = [PV.dryRun(g), PV.dryRun(g)];
  previews.forEach((p, i) => check(p.ok, `preview ${i + 1} ran: ${JSON.stringify(p.error)}`));
  same(previews[1].result, previews[0].result, "two previews agree");
  check(JSON.stringify(PV.snapshot(g)) === liveBefore, "previews leave the live battle (targets included) unchanged");
  G.injectOnce(g, "drawPlayerHandToSize", "throw new Error('injected fault: hand refill');");
  const failed = PV.dryRun(g);
  check(!failed.ok && failed.error.message === "injected fault: hand refill" && JSON.stringify(PV.snapshot(g)) === liveBefore, "a failed preview changes nothing (targets restored)");
  const refused = G.attempt(g, "isExecutingActionQueue = true; try { dryRunTurn(); } finally { isExecutingActionQueue = false; }");
  check(refused.thrown && refused.reason === "turn-executing" && JSON.stringify(PV.snapshot(g)) === liveBefore, "a refused preview changes nothing");
  const previewNote = g.ev(DRAIN_NOTE);
  check(JSON.stringify(PV.snapshot(g)) === liveBefore, "the fixture-side note drain changes nothing");
  const events = await PV.L.playTurn(g);
  const finalState = PV.snapshot(g);
  const note = g.ev("lastBattleDebugReport");
  const pr = previews[0].result;
  same(pr.events, events, "preview events = played events");
  same(pr.finalState, finalState, "preview final state = played final state (targets, hand, RNG position)");
  same(pr.outcome, (({ winner, doubleKO }) => ({ winner, doubleKO }))(C.one(events, "outcome")), "preview outcome = played outcome");
  check(pr.eventHash === g.ev(`hashString53(${JSON.stringify(JSON.stringify(events))})`), "preview event hash = played event hash");
  check(previewNote === note, "the copy's battle note = the played battle note");
  same(C.one(events, "targetsCommitted").targets.map((t) => `${t.unit}:${t.target}/${t.source}`), ["P1:E2/chosen", "P2:E3/auto", "P3:E2/auto"], "chosen, first-queue auto and Play-time auto committed");
  same(finalState.units.slice(0, 3).map((u) => `${u.id}:${u.target}/${u.targetSource}`), ["P1:E2/chosen", "P2:E3/auto", "P3:E2/auto"], "final state carries the targets");

  // ---- R37e load into a fresh commander context
  const d = track(C.bootCommander());
  d.ev(`loadBattleState(${JSON.stringify(state0)})`);
  same(PV.snapshot(d), state0, "loadBattleState reproduces the snapshot, targets included");
  check(TG.targets(d) === "P1:E2/chosen P2:E3/auto P3:-", "the loaded targets are live");
  const pd = PV.dryRun(d);
  check(pd.ok && pd.result.eventHash === pr.eventHash, "the loaded state previews the identical turn");

  // ---- R37f resets
  const resets = {};
  const r = track(C.bootCommander());
  const reset = (label, code) => {
    setupTargets(r);
    check(!noTargetsAnywhere(r), `${label}: targets set before`);
    r.ev(code);
    check(noTargetsAnywhere(r) && TG.targets(r) === "P1:- P2:- P3:-" && Object.keys(TG.markers(r)).length === 0, `${label}: targets and markers cleared`);
    resets[label] = TG.targets(r);
  };
  reset("Restart", "window.devTest.restartBattle()");
  reset("scenario load", 'loadScenario("intro", 1)');
  reset("Play Again", "resetGame()");

  // ---- R37g forced-current modes
  const t = track(C.bootCommander());
  setupTargets(t);
  t.ev("startGuidedTutorial()");
  tutorialHands += 1;
  check(t.ev("isGuidedTutorialActive") === true && t.ev("isCommanderRules()") === false, "tutorial: current preset");
  check(noTargetsAnywhere(t) && PV.snapshot(t).units.every((u) => !("target" in u)), "tutorial: no targets, no markers, no snapshot keys");
  t.ev("endGuidedTutorial()");
  const w = track(S.boot("?mode=world&preset=commander"));
  check(w.ev("isCommanderRules()") === false && noTargetsAnywhere(w) && w.ev("isTargetSelectionActive()") === false, "world mode: current, no targets");
  const s = track(C.bootCommander());
  setupTargets(s);
  s.ev("globalThis.__devSeen = []; (function () { const o = executeActionTick; executeActionTick = function () { __devSeen.push(isTargetSelectionActive() || units.some((u) => u.targetId)); return o.apply(this, arguments); }; })()");
  const dev = await s.runLimited(() => s.ev("window.devTest.runScenario('double-attack')"));
  const devSeen = J(s, "__devSeen");
  check(dev.passed === true && devSeen.length > 0 && devSeen.every((x) => x === false), "dev scenario: ran under current with no targets");
  check(noTargetsAnywhere(s), "after the dev scenario: no targets, no markers");
  const devClick = TG.clickTile(s, "E1");
  check(s.ev("isCommanderRules()") === true && s.ev("activeScenario") === null && devClick === true,
    "after the dev scenario the commander preset is restored on the exited (custom) board, where an enemy click is a target click again");

  return {
    header: TG.REQ_HEADER_TARGETS,
    hands: TG.reportTargetHands(ID, ctxs, tutorialHands),
    tutorialSeededHandsCounted: tutorialHands,
    snapshotPlayerTargets: state0.units.slice(0, 3).map((u) => `${u.id}:${u.target}/${u.targetSource}`),
    validation,
    dryRunEqualsPlay: { eventHash: pr.eventHash, summary: TG.turnSummary(events), noteTargets: TG.noteLines(note, /^Targets:/)[0],
      handAfter: finalState.hand.cards.join(","), rngAfter: `seed=${finalState.rng.handSeed} state=${finalState.rng.handState}` },
    resets,
    forcedCurrent: { tutorial: "no targets", world: "no targets", devScenarioTicks: devSeen.length },
  };
}
module.exports = { id: ID, run };
