"use strict";
// REQUIREMENT — L3 visual replay (hard assertions; evidence in the golden)
// The ?replay=1#r=<payload> page replays a recorded battle through the Play button's own presentation driver.
// Battle: the hand-authored 3-turn script of _replay.cjs (turn 1 = reshuffle-only step, then a card step), recorded ONCE
// headlessly (record()). Payload: hand-written from that record, build identity served by a fetch stub.
// R47a hashTurnEvents: deterministic, canonical (a key-reordered copy and a JSON round trip hash alike), 14 hex, equals
//      hashString53(canonicalizeRules(events)), refuses a non-array (TypeError).
// R47b REPLAY (Play / autoplay): ready state and panel; all 3 turns replay through executePlayerActionQueue (the Play
//      driver: its animations run, the virtual clock advances) with every eventHash matching; the final BattleState, the last
//      turn's events, observation and battle note equal the headless recording.
// R47c RESTART: Restart replay reloads the setup from the payload: the BattleState (incl. hand-stream position) equals the
//      first ready state; replaying with Next turn x3 gives the identical results and final state.
// R47d INPUT LOCKED: with cards queued (through the dev door, not player input), Play, card clicks, the Reshuffle button,
//      target clicks, the arena click / key handlers, removing a queued card, Restart / R, Play Again, rules Apply and the
//      tutorial change nothing (BattleState, hand view, last turn log identity); the capture-phase blocker stops events
//      outside the replay panel only. CONTROL: the same Play click in a normal boot runs the turn.
// R47e NORMAL BOOT unchanged: no replay state, class, listener or route key without ?replay=1 (also ?replay=0); the whole
//      existing suite (r1..r46, Lab) passing byte-identical is the regression for everything else.
const X = require("./_replay.cjs");
const { check, same, J } = X;

const ID = "r47-visual-replay";
// The real Play button listener (executeQueueButton is a querySelector element; its listener list is the real one).
const PLAY_CLICK = `(() => { let out; executeQueueButton.listeners.filter((l) => l.type === "click").forEach((l) => { out = l.fn(); }); return out; })()`;

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- recording (the driver's way: headless, once) --------------------------------------------------------------
  const rec = X.record();
  track(rec.g);
  const payload = X.payloadOf(rec);

  // ---- R47a hashTurnEvents -------------------------------------------------------------------------------------------
  const g0 = rec.g;
  const events1 = rec.turns[0].events;
  const reordered = events1.map((e) => Object.fromEntries(Object.keys(e).reverse().map((k) => [k, e[k]])));
  const hashA = {
    hash: g0.ev(`hashTurnEvents(${JSON.stringify(events1)})`),
    again: g0.ev(`hashTurnEvents(${JSON.stringify(events1)})`),
    reorderedKeys: g0.ev(`hashTurnEvents(${JSON.stringify(reordered)})`),
    viaDevTest: g0.ev(`window.devTest.hashTurnEvents(${JSON.stringify(events1)})`),
    formula: g0.ev(`hashString53(canonicalizeRules(${JSON.stringify(events1)}))`),
    empty: g0.ev("hashTurnEvents([])"),
    nonArray: g0.ev(`(() => { try { hashTurnEvents({}); return "no error"; } catch (e) { return e.name + ": " + e.message; } })()`),
    undefinedMember: g0.ev(`hashTurnEvents([{ type: "x", a: undefined }]) === hashTurnEvents([{ type: "x" }])`),
  };
  check(hashA.hash === rec.turns[0].eventHash && hashA.again === hashA.hash && hashA.viaDevTest === hashA.hash, "R47a: deterministic, same as recorded, devTest exposes it");
  check(hashA.reorderedKeys === hashA.hash && hashA.formula === hashA.hash, "R47a: canonical (key order does not matter) = hashString53(canonicalizeRules(events))");
  check(/^[0-9a-f]{14}$/.test(hashA.hash) && hashA.undefinedMember === true, "R47a: 14 hex digits; JSON normalisation drops undefined members");
  same(hashA.nonArray, "TypeError: hashTurnEvents: events must be an array of turn events", "R47a: a non-array is refused");

  // ---- R47b replay with Play ---------------------------------------------------------------------------------------
  const a = track(X.bootReplay({ hash: X.encode(payload), fetch: X.serveBuildId(X.FIXTURE_BUILD_ID) }));
  same(X.state(a).status, "checking", "R47b: the page checks the build identity before anything plays");
  same(await X.waitBuildCheck(a), "ready", "R47b: build identity matches -> ready");
  same(a.fetchCalls, ["./build-id.json"], "R47b: the page asked for ./build-id.json once");
  const readyState = X.snapshot(a);
  same(readyState, rec.initialState, "R47b: the replay setup equals a normal boot of the recorded scenario / seed / preset / rules");
  same(J(a, "observeBattle().rules"), rec.rules, "R47b: the loaded effective rules are the recorded ones");
  const readyPanel = X.panel(a);
  const stepsBefore = a.usage().steps;
  same(await a.runLimited(() => X.click(a, "replay-play"), 60000), "done", "R47b: Play replays every recorded turn");
  const playedSteps = a.usage().steps - stepsBefore;
  check(playedSteps > 100, `R47b: the animations ran on the virtual clock (${playedSteps} steps)`);
  const b = X.state(a);
  same(b.results.map((r) => r.match), [true, true, true], "R47b: every turn's event hash matches");
  same(b.results.map((r) => r.replayed), rec.turns.map((t) => t.eventHash), "R47b: replayed hashes = recorded hashes");
  same(X.snapshot(a), rec.finalState, "R47b: final BattleState (incl. hand stream) = the headless recording");
  same(J(a, "getTurnEventLog()"), rec.turns[2].events, "R47b: the last turn's events = the recording");
  same(J(a, "observeBattle()"), rec.finalObservation, "R47b: final observation = the recording");
  same(a.ev("lastBattleDebugReport"), rec.finalNote, "R47b: battle note = the recording");
  check(b.error === "" && b.status === "done" && b.playing === false && b.busy === false, "R47b: finished cleanly");
  const donePanel = X.panel(a);

  // ---- R47c Restart replay, then Next turn x3 -------------------------------------------------------------------------
  same(X.click(a, "replay-restart"), true, "R47c: Restart replay accepted");
  same(X.state(a).status, "ready", "R47c: ready again");
  same(X.snapshot(a), readyState, "R47c: the setup is fully reset (BattleState incl. hand-stream position)");
  const nextResults = [];
  for (const turn of [1, 2, 3]) nextResults.push(`turn ${turn}: ${await a.runLimited(() => X.click(a, "replay-next"), 60000)}`);
  same(nextResults, ["turn 1: true", "turn 2: true", "turn 3: true"], "R47c: Next turn plays one recorded turn each");
  same(X.state(a).results, b.results, "R47c: identical per-turn results after Restart");
  same(X.snapshot(a), rec.finalState, "R47c: identical final BattleState after Restart");
  same(await a.runLimited(() => X.click(a, "replay-next")), false, "R47c: Next after the last turn does nothing");

  // ---- R47d input locked during replay ------------------------------------------------------------------------------
  const d = track(X.bootReplay({ hash: X.encode(payload), fetch: X.serveBuildId(X.FIXTURE_BUILD_ID) }));
  await X.waitBuildCheck(d);
  const queued = J(d, `window.devTest.applyPlayerOrders(${JSON.stringify([{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Attack" }])})`);
  same(queued.ok, true, "R47d: cards queued through the dev door (not player input) so Play would have a turn to run");
  d.ev("rebuildPlayerHandView(); globalThis.__logBefore = lastTurnEventLog;");
  const fp = () => JSON.stringify({ state: X.snapshot(d), view: J(d, "Array.from(actionsList.children).map((i) => i.dataset.action)"),
    sameLog: d.ev("lastTurnEventLog === __logBefore"), executing: d.ev("isExecutingActionQueue"), overlayHidden: d.ev("gameResultOverlay.hidden") });
  const before = fp();
  const attempts = {};
  const attempt = async (name, fn) => { const out = await fn(); same(fp(), before, `R47d: ${name} changed nothing`); attempts[name] = out === undefined ? "ignored" : out; };
  await attempt("Play button", () => d.runLimited(() => d.ev(PLAY_CLICK)));
  await attempt("card click", () => d.ev(`setPlayerSelected(player); applyPlayerAction("Move"); setPlayerSelected(null)`));
  await attempt("Reshuffle button", () => d.ev(`reshuffleButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`));
  await attempt("target click (tile)", () => d.ev(`setPlayerSelected(player); const r = handleTileIntent(tileElements.find((t) => +t.dataset.row === enemySupport.row && +t.dataset.col === enemySupport.col) ?? null); setPlayerSelected(null); r`));
  await attempt("target click (sprite)", () => d.ev("handleEnemyTargetIntent(enemySupport)"));
  await attempt("arena click handler", () => d.ev(`arena.listeners.filter((l) => l.type === "click").forEach((l) => l.fn({ target: { closest: () => null }, stopPropagation() {} }))`));
  await attempt("arena key handler", () => d.ev(`arena.listeners.filter((l) => l.type === "keydown").forEach((l) => l.fn({ key: "Enter", target: { closest: () => null }, preventDefault() {} }))`));
  await attempt("remove a queued card", () => d.ev(`removeUnitActionAt(player, 0)`));
  await attempt("queue row click", () => d.ev(`actionQueueList.listeners.filter((l) => l.type === "click").forEach((l) => l.fn({ target: { closest: () => null }, stopPropagation() {} }))`));
  await attempt("Restart button / R key", () => d.ev(`restartBattle()`));
  await attempt("Play Again", () => d.ev(`restartButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`));
  await attempt("rules Apply", () => { X.click(d, "rules-apply"); return J(d, "getRulesState().notice"); });
  await attempt("tutorial settings switch", () => d.ev("enterTutorialDefaultSettings()"));
  const blocker = J(d, `(() => {
    const ev = (inside) => { const e = { stopped: 0, target: { closest: (sel) => (inside && sel === "#replay-panel" ? {} : null) }, stopPropagation() { this.stopped += 1; } }; blockReplayInput(e); return e.stopped; };
    return { outsidePanel: ev(false), insidePanel: ev(true) };
  })()`);
  same(blocker, { outsidePanel: 1, insidePanel: 0 }, "R47d: the capture-phase blocker stops events outside the replay panel only");
  // CONTROL: the same Play click in a normal boot runs a turn (the lock is what stopped it above).
  const ctl = track(X.bootNormal());
  J(ctl, `window.devTest.applyPlayerOrders(${JSON.stringify([{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Attack" }])})`);
  ctl.ev("globalThis.__logBefore = lastTurnEventLog;");
  await ctl.runLimited(() => ctl.ev(PLAY_CLICK));
  same(ctl.ev("lastTurnEventLog !== __logBefore && lastTurnEventLog.length > 0"), true, "R47d control: in a normal boot the Play click runs the turn");

  // ---- R47e normal boot unchanged -------------------------------------------------------------------------------------
  const normal = (g) => ({ store: g.ev("typeof getReplayState.store"), locked: g.ev("isReplayInputLocked()"), route: J(g, "bootRoute"),
    bodyClasses: g.ev("document.body.className"), panelListeners: g.ev(`["replay-play", "replay-next", "replay-restart"].map((id) => document.getElementById(id).listeners.length).join(",")`),
    scenario: g.ev("activeScenario ? activeScenario.id : null") });
  const e1 = normal(ctl);
  const e2 = normal(track(X.bootNormal("?scenario=intro&seed=1&replay=0")));
  [e1, e2].forEach((e, i) => {
    same({ store: e.store, locked: e.locked, bodyClasses: e.bodyClasses, panelListeners: e.panelListeners, scenario: e.scenario },
      { store: "undefined", locked: false, bodyClasses: "", panelListeners: "0,0,0", scenario: "intro" }, `R47e: normal boot ${i + 1} has no replay state, class or listener`);
    check(!("replay" in e.route), `R47e: normal boot ${i + 1} route has no replay key`);
  });

  return {
    header: X.REQ_HEADER,
    battle: { query: X.QUERY, turns: X.TURNS, rules: rec.rules, recordedEventHashes: rec.turns.map((t) => t.eventHash),
      finalStateHash: X.sha256(rec.finalState) },
    payloadKeys: Object.keys(payload),
    hashTurnEvents: hashA,
    replay: { readyPanel, playedSteps, results: b.results, donePanel },
    restart: { nextResults, sameResults: true, sameFinalState: true },
    inputLocked: { queuedByDevDoor: queued, attempts, blocker },
    normalBoot: [e1, e2],
    hands: X.reportReplayHands(ID, ctxs),
  };
}
module.exports = { id: ID, run };
