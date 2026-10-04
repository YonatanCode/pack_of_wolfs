"use strict";
// REQUIREMENT — enemy-action experiment (hard assertions; evidence in the golden)
// R28a: FROZEN PLAN. Commander preset (link boot, default numbers), seed-1 intro board. A planner-call spy counts
//       every planEnemyPackTurnRules call, live vs inside a battle-state copy. Across several player queue edits
//       (queue cards, remove + requeue a card, reshuffle + requeue, an explicit intent-preview refresh and a
//       concealment refresh) there are 0 live plannings after the load's plan and the pack plan stays identical;
//       pressing Play does NOT replan (turn-start enemyPlan: frozen true, planned false, queue = the frozen plan); the
//       turn end plans ONCE (a new planning phase); further edits in the new phase do not replan. Control (current):
//       the same edits replan every time (characterization count).
// R28b: OUT-OF-BAND CHANGE. Orders queued, then P1 is moved directly (hand-authored: next to E1). The turn-start plan
//       of the preview is the frozen plan under commander, and a different, recomputed plan under current (control).
// R28c: DRY RUN = REAL TURN under commander: the preview's events, final state (hand data and RNG position included),
//       outcome and event hash equal what Play then produces.
// R28d: BATTLE STATE. Under commander the snapshot carries enemyPack.planFrozen (current: no such key); withBattleState
//       swaps it in (a copy with planFrozen false reads false inside) and restores it; loadBattleState into a fresh
//       commander context reproduces the identical snapshot (flag included) and the identical dry run.
// R28e: STORE AUDIT (commander): the settings store, the preset store (keys pinned: active, pending) and the
//       frozen-plan store (keys pinned: frozen) are unchanged by value through two dry runs, a failed dry run and a
//       refused Apply.
const C = require("./_cmd.cjs");
const { G, PV, S } = C;
const { check, same, J } = S;

const ID = "r28-commander-plan-freeze";

function edits(g, after) {
  PV.L.queueByIndex(g, "player", [0]); after("queue P1");
  PV.L.queueByIndex(g, "playerSupport", [0]); after("queue P2");
  PV.L.queueByIndex(g, "playerFlank", [0]); after("queue P3");
  g.ev("removeUnitActionAt(playerSupport, 0)"); after("remove P2's card");
  PV.L.queueByIndex(g, "playerSupport", [0]); after("requeue P2");
  g.ev("reshuffleActions()"); after("reshuffle (queues cleared, new hand)");
  PV.L.queueByIndex(g, "player", [0]); PV.L.queueByIndex(g, "playerSupport", [0]); PV.L.queueByIndex(g, "playerFlank", [0]); after("requeue P1, P2, P3");
  g.ev("updateEnemyIntentPreview()"); after("intent preview refresh");
  g.ev("refreshHiddenStates()"); after("concealment refresh");
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R28a (+ R28c, R28e on the same battle)
  const a = track(C.bootCommander());
  check(J(a, "window.devTest.getEffectiveRulesRecord()").preset === "commander" && a.ev("isCommanderRules()") === true, "commander active");
  C.installPlannerSpy(a);
  const plan0 = C.packQueue(a);
  check(C.frozen(a) === true && plan0.length > 0, "the load planned and froze the plan");
  const editLog = [];
  edits(a, (label) => {
    same(C.packQueue(a), plan0, `commander, ${label}: the frozen plan is unchanged`);
    check(C.plannerCalls(a).live === 0, `commander, ${label}: no replanning`);
    editLog.push(label);
  });
  same(J(a, "Object.fromEntries(units.filter((u) => u.team === 'enemy').map((u) => [getBattleDebugUnitId(u), Array.from(u.intentTags.querySelectorAll('.unit-intent-label')).map((t) => t.textContent)]))"),
    Object.fromEntries(["E1", "E2", "E3"].map((id) => [id, plan0.filter((e) => e.unit === id).map((e) => e.action)])), "intent tags re-render the frozen plan");

  // R28d (flag in the copy) and R28e (stores) before Play
  const stateA = PV.snapshot(a);
  check(stateA.enemyPack.planFrozen === true, "commander snapshot carries enemyPack.planFrozen = true");
  check(a.ev(`withBattleState(${JSON.stringify({ ...stateA, enemyPack: { ...stateA.enemyPack, planFrozen: false } })}, () => getEnemyPlanState().frozen)`) === false, "a copy with planFrozen false is swapped in as false");
  check(C.frozen(a) === true, "the live flag is restored after the swap");
  same(JSON.parse(C.storesOf(a)).presetKeys, ["active", "pending"], "preset store keys pinned");
  same(JSON.parse(C.storesOf(a)).planKeys, ["frozen"], "frozen-plan store keys pinned");
  const stores = C.storesOf(a);
  const previews = [PV.dryRun(a), PV.dryRun(a)];
  previews.forEach((p, i) => check(p.ok, `commander preview ${i + 1} ran: ${JSON.stringify(p.error)}`));
  same(previews[1].result, previews[0].result, "the two previews agree");
  check(C.storesOf(a) === stores, "stores unchanged by two dry runs");
  G.injectOnce(a, "drawPlayerHandToSize", "throw new Error('injected fault: hand refill');");
  check(PV.dryRun(a).ok === false && C.storesOf(a) === stores && C.frozen(a) === true, "a failed dry run leaves the stores (and the frozen flag) unchanged");
  const refused = G.attempt(a, "isExecutingActionQueue = true; try { applyPendingSettings(); } finally { isExecutingActionQueue = false; }");
  check(refused.thrown && refused.reason === "turn-executing" && C.storesOf(a) === stores, "a refused Apply leaves the stores unchanged");
  same(PV.snapshot(a), stateA, "the live battle is unchanged by the previews");
  check(C.plannerCalls(a).live === 0 && C.plannerCalls(a).copy === 2, "previews planned only inside the copies (their turn ends), never live");

  const events = await PV.L.playTurn(a);
  const finalState = PV.snapshot(a);
  const startPlan = C.turnStartPlan(events);
  check(startPlan.frozen === true && startPlan.planned === false, "Play used the frozen plan (frozen true, planned false)");
  same(startPlan.queue, plan0, "the turn started with the frozen plan");
  check(C.plannerCalls(a).live === 1 && C.previewPlan(events).planned === true, "the turn end planned once (new planning phase)");
  const plan1 = C.packQueue(a);
  same(C.previewPlan(events).queue, plan1, "the new phase's plan is the turn end's plan");
  // R28c
  const pr = previews[0].result;
  same(pr.events, events, "commander: preview events = the real turn's events");
  same(pr.finalState, finalState, "commander: preview final state = the real one (hand data, RNG position, planFrozen)");
  same(pr.outcome, (({ winner, doubleKO }) => ({ winner, doubleKO }))(C.one(events, "outcome")), "commander: preview outcome = the real outcome");
  check(pr.eventHash === a.ev(`hashString53(${JSON.stringify(JSON.stringify(events))})`), "commander: preview event hash = the real one");
  // new phase: edits do not replan
  PV.L.queueByIndex(a, "playerSupport", [0]);
  a.ev("updateEnemyIntentPreview()");
  check(C.plannerCalls(a).live === 1, "new phase: edits do not replan");
  same(C.packQueue(a), plan1, "new phase: the plan stays frozen");

  // control: the same edits under current
  const ac = track(C.bootCurrent());
  C.installPlannerSpy(ac);
  const currentCounts = [];
  edits(ac, (label) => currentCounts.push(`${label}: ${C.plannerCalls(ac).live}`));
  check(C.plannerCalls(ac).live >= 7, `current replans on the edits (${C.plannerCalls(ac).live} live plannings)`);
  check(!("planFrozen" in PV.snapshot(ac).enemyPack) && C.frozen(ac) === false, "current: no planFrozen key in the snapshot, flag false");

  // ---- R28b: out-of-band change (P1 moved directly next to E1)
  const outOfBand = {};
  [["commander", C.bootCommander()], ["current", C.bootCurrent()]].forEach(([preset, g]) => {
    track(g);
    PV.BOARDS.plain.setup(g);
    const before = C.packQueue(g);
    check(g.ev("!isBlockedTile(1, 5) && !units.some((u) => u.row === 1 && u.col === 5)"), "tile 1,5 is free");
    g.ev("player.row = 1; player.col = 5; player.direction = 'topLeft';");
    same(C.packQueue(g), before, `${preset}: the live plan is untouched by the direct move`);
    const p = PV.dryRun(g);
    check(p.ok, `${preset}: preview ran`);
    const start = C.turnStartPlan(p.result.events);
    outOfBand[preset] = { before, turnStart: start.queue, frozen: start.frozen ?? null, planned: start.planned };
  });
  same(outOfBand.commander.turnStart, outOfBand.commander.before, "commander: Play keeps the frozen plan after an out-of-band change");
  check(outOfBand.commander.frozen === true, "commander: turn start used the frozen plan");
  check(JSON.stringify(outOfBand.current.turnStart) !== JSON.stringify(outOfBand.current.before) && outOfBand.current.planned === true, "current (control): Play recomputes a different plan");

  // ---- R28d: load into a fresh commander context
  const d = track(C.bootCommander());
  d.ev(`loadBattleState(${JSON.stringify(stateA)})`);
  same(PV.snapshot(d), stateA, "loadBattleState reproduces the commander snapshot (planFrozen included)");
  check(C.frozen(d) === true, "the loaded flag is live");
  const pd = PV.dryRun(d);
  check(pd.ok && pd.result.eventHash === pr.eventHash, "the loaded copy previews the identical turn");

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, c) => n + S.handsOf(c), 0));
  return {
    header: C.REQ_HEADER_CMD,
    handsGenerated,
    freeze: { plan0, edits: editLog, livePlanningsBeforePlay: 0, previewPlannings: { live: 0, copy: 2 }, turnStartFrozen: true, livePlanningsAfterPlay: 1, plan1 },
    currentControlCounts: currentCounts,
    outOfBand,
    dryRunEqualsPlay: { eventHash: pr.eventHash, outcome: pr.outcome, events: PV.summarizeEvents(events), handAfter: finalState.hand.cards.join(","),
      rngAfter: `seed=${finalState.rng.handSeed} state=${finalState.rng.handState}`, planFrozenAfter: finalState.enemyPack.planFrozen },
    battleState: { planFrozenInSnapshot: true, swapRestoresFlag: true, loadReproduces: true },
    storeAudit: { presetKeys: ["active", "pending"], planKeys: ["frozen"], unchangedAfter: ["dry run x2", "failed dry run", "refused Apply (turn-executing)"] },
  };
}
module.exports = { id: ID, run };
