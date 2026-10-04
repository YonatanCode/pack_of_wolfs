"use strict";
// REQUIREMENT — P2a gap checks (hard assertions; evidence in the golden)
// R25a: PREVIEW UNDER CUSTOM SETTINGS. Custom budgets and draw settings active through the real Apply (player budget
//       3, hand 6, weights Move 5 / Attack 1 / Defend 1, enemy budget 3, restricted pool Move 1 / Defend 0 / Attack 2),
//       the plain seed-1 intro board (first hand card to P1, P2, P3 = the whole budget). dryRunTurn() twice leaves the
//       live battle unchanged (_preview.liveFingerprint: state, DOM, views, debug, flags, hand data), the future draws
//       unchanged (hand data, hand-stream position, next 3 stream values, peeked without consuming), and the two
//       previews agree. The preview reflects the custom budgets (turnStart budget 3 / enemyBudget 3, at most 3 enemy
//       actions consumed, a refilled hand of 6) and its events / final state / outcome / subsequent hand equal what the
//       real played turn (executePlayerActionQueue) then produces; a never-previewed control plays the same turn.
// R25b: SNAPSHOT / RESTORE UNDER CUSTOM SETTINGS. snapshotBattleState() carries the EFFECTIVE rules (version, hash,
//       perBattle values = getEffectiveRulesRecord(), not the defaults). While a dry run is swapped in, activeRules
//       is the copy's frozen rules with the custom hash and budgets (spy on beginBattleDebugLog, a core step); after a
//       dry run and after a failed dry run (hand refill fault) the live activeRules object and hash are restored.
//       loadBattleState(snapshot) into a fresh context booted (via the link) with the SAME settings reproduces the
//       identical snapshot, rules record and hash, and the same dry run; loading it into a context with DIFFERENT
//       effective rules (defaults; another custom set) is refused with BattleStateError and changes nothing.
const G = require("./_gaps.cjs");
const { PV, S } = G;
const { check, same, J, DEFAULT_HASH } = S;

const ID = "r25-preview-under-custom-settings";
const PATCH = { playerActionBudget: 3, handSize: 6, weightMove: 5, enemyActionBudget: 3, poolMove: 1, poolDefend: 0 };
const rulesOf = (g) => J(g, "activeRules");
const enemyConsumed = (events) => events.filter((e) => e.type === "consumed").reduce((n, e) => n + e.actions.filter((a) => /^E/.test(a.unit)).length, 0);

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R25a
  const g = track(G.bootPreviewCustom(PATCH));
  const rec = S.record(g);
  check(rec.customized === true && rec.hash !== DEFAULT_HASH && rec.preset === "current", "custom effective record active");
  check(J(g, "playerHand").length === 6, "custom hand size 6 dealt");
  const orders = PV.BOARDS.plain.setup(g);
  check(g.ev("getQueuedPlayerActionTotal()") === 3 && g.ev("isUnitActionQueueFull(player)") === true, "player budget 3 is full");
  const before = PV.liveFingerprint(g);
  const peekBefore = G.peekStream(g);
  const previews = [PV.dryRun(g), PV.dryRun(g)];
  previews.forEach((p, i) => check(p.ok, `preview ${i + 1} ran: ${JSON.stringify(p.error)}`));
  same(PV.liveFingerprint(g), before, "two previews left the live battle unchanged (state, DOM, views, debug, flags, hand data)");
  same(G.peekStream(g), peekBefore, "next 3 hand-stream values unchanged");
  same(previews[1].result, previews[0].result, "the two previews agree");
  const pr = previews[0].result;
  const ts = pr.events.find((e) => e.type === "turnStart");
  check(ts.budget === 3 && ts.enemyBudget === 3, `preview runs under the custom budgets (turnStart ${ts.budget}/${ts.enemyBudget})`);
  check(enemyConsumed(pr.events) <= 3, "at most 3 enemy actions consumed in the preview");
  check(pr.finalState.hand.cards.length === 6, "the preview refills the hand to the custom size 6");
  same(pr.finalState.rules, before.state && JSON.parse(before.state).rules, "the preview's final state carries the same effective rules");

  const h = track(G.bootPreviewCustom(PATCH));
  same(PV.BOARDS.plain.setup(h), orders, "control: same orders");
  same(PV.liveFingerprint(h), before, "control (never previewed) equals the previewed battle before Play");
  const events = await PV.L.playTurn(g);
  const finalState = PV.snapshot(g);
  same(pr.events, events, "preview events = the real turn's events");
  same(pr.finalState, finalState, "preview final state = the real final state (hand data and RNG position included)");
  const outcomeEvent = events.find((e) => e.type === "outcome");
  same(pr.outcome, { winner: outcomeEvent.winner, doubleKO: outcomeEvent.doubleKO }, "preview outcome = the real outcome");
  same(pr.finalState.hand.cards, J(g, "playerHand"), "preview's subsequent hand = the real subsequent hand");
  check(pr.eventHash === g.ev(`hashString53(${JSON.stringify(JSON.stringify(events))})`), "preview event hash = the real one");
  const controlEvents = await PV.L.playTurn(h);
  same(controlEvents, events, "control: the never-previewed turn produced the same events");
  same(PV.snapshot(h), finalState, "control: same final state");

  // ---- R25b
  const k = track(G.bootPreviewCustom(PATCH));
  PV.BOARDS.plain.setup(k);
  const recK = S.record(k);
  const state = PV.snapshot(k);
  check(state.rules.hash === recK.hash && state.rules.hash !== DEFAULT_HASH, "snapshot carries the effective (custom) hash, not the default");
  check(state.rules.version === recK.version, "snapshot carries the effective version");
  same(state.rules.values, recK.values.perBattle, "snapshot rules values = the effective perBattle values");
  same(state.rules.values, (({ version, hash, ...v }) => v)(rulesOf(k)), "snapshot rules values = the live activeRules values");
  k.ev(`globalThis.__live = activeRules; globalThis.__seen = []; (function () { const orig = beginBattleDebugLog;
    beginBattleDebugLog = function () { __seen.push({ swapped: battleStateSwap !== null, liveObject: activeRules === __live, frozen: Object.isFrozen(activeRules),
      hash: activeRules.hash, playerActionBudget: activeRules.playerActionBudget, enemyActionBudget: activeRules.enemyActionBudget,
      handSize: activeRules.handSize, enemyActionPool: [...activeRules.enemyActionPool] }); return orig.apply(this, arguments); }; })()`);
  const fpK = PV.liveFingerprint(k);
  const dryK = PV.dryRun(k);
  check(dryK.ok, "dry run ran");
  check(k.ev("activeRules === __live") === true && k.ev("activeRules.hash") === recK.hash, "after the dry run: the live activeRules object and hash are restored");
  G.injectOnce(k, "drawPlayerHandToSize", "throw new Error('injected fault: hand refill');");
  const failed = PV.dryRun(k);
  check(!failed.ok && failed.error.message === "injected fault: hand refill", `failed dry run threw the injected fault: ${JSON.stringify(failed)}`);
  check(k.ev("activeRules === __live") === true && k.ev("activeRules.hash") === recK.hash, "after the failed dry run: the live activeRules object and hash are restored");
  same(PV.liveFingerprint(k), fpK, "after both: the live battle is unchanged");
  const seen = J(k, "__seen");
  check(seen.length === 2, "the core ran under the swap twice");
  seen.forEach((s, i) => {
    same(s, { swapped: true, liveObject: false, frozen: true, hash: recK.hash, playerActionBudget: 3, enemyActionBudget: 3, handSize: 6, enemyActionPool: ["Move", "Attack", "Attack"] },
      `dry run ${i + 1}: swapped-in activeRules is the copy's frozen custom rules`);
  });
  const tsK = dryK.result.events.find((e) => e.type === "turnStart");
  check(tsK.budget === 3 && tsK.enemyBudget === 3, "the dry run's events reflect the custom budgets");

  const b = track(S.boot(S.linkOf(PATCH)));
  same(S.record(b), recK, "a link boot with the same settings has the identical effective record (hash included)");
  b.ev(`loadBattleState(${JSON.stringify(state)})`);
  same(PV.snapshot(b), state, "loadBattleState into a same-settings context reproduces the identical snapshot");
  same(rulesOf(b), rulesOf(k), "same activeRules (version, hash, values)");
  const dryB = PV.dryRun(b);
  check(dryB.ok && dryB.result.eventHash === dryK.result.eventHash, "the loaded copy previews the identical turn");

  const refusals = {};
  [["defaults", S.boot()], ["other custom", S.boot(S.linkOf({ ...PATCH, reshuffleCharges: 3 }))]].forEach(([label, c]) => {
    track(c);
    c.ev("globalThis.__liveRules = activeRules");
    const snapBefore = JSON.stringify(PV.snapshot(c));
    const r = G.attempt(c, `loadBattleState(${JSON.stringify(state)})`);
    check(r.thrown && r.name === "BattleStateError", `${label}: loading a state with different effective rules is refused (${JSON.stringify(r)})`);
    check(JSON.stringify(PV.snapshot(c)) === snapBefore && c.ev("activeRules === __liveRules") === true, `${label}: nothing changed`);
    refusals[label] = `${r.name}: ${r.message}`;
  });

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, c) => n + S.handsOf(c), 0));
  return {
    header: G.REQ_HEADER_GAPS,
    handsGenerated,
    settings: PATCH,
    effective: { version: rec.version, hash: rec.hash, defaultHash: DEFAULT_HASH },
    preview: {
      orders,
      turnStartBudgets: { player: ts.budget, enemy: ts.enemyBudget },
      enemyActionsConsumed: enemyConsumed(pr.events),
      events: PV.summarizeEvents(pr.events),
      eventHash: pr.eventHash,
      outcome: pr.outcome,
      handAfter: pr.finalState.hand.cards.join(","),
      rngAfter: `seed=${pr.finalState.rng.handSeed} state=${pr.finalState.rng.handState}`,
      nextStreamValuesBeforePlay: peekBefore,
      liveUnchanged: true, previewEqualsPlay: true, controlEqualsPlay: true,
    },
    snapshotRestore: {
      snapshotRules: { version: state.rules.version, hash: state.rules.hash },
      swappedIn: seen[0],
      failedDryRun: failed.error.message,
      liveRulesRestored: true,
      sameSettingsLoad: { identicalSnapshot: true, identicalRules: true, dryRunEventHash: dryB.result.eventHash },
      differentRulesRefused: refusals,
    },
  };
}
module.exports = { id: ID, run };
