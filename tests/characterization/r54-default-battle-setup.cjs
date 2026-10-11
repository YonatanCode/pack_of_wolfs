"use strict";
// REQUIREMENT — default battle setup (hard assertions; evidence in the golden; ENGINE-NOTES section 14)
// R54a DEFAULT BOOT: ?scenario=intro&seed=1 (no preset, no rules) plays window.DEFAULT_BATTLE_SETUP: preset commanderdraw,
//      player / enemy budget 5 / 5, hand 5, reshuffle charges 2, cap 3, player draw weights 1/2/1, enemy draw weights 1/2/1;
//      pinned rules version / hash (= the explicit link preset=commanderdraw&rules=wa:2,dwa:2); no link status; the per-setting
//      defaults (getDefaultSettings, COMMANDER_DRAW_RULES.weights) are unchanged; Copy link names the setup explicitly.
// R54b DRAW STREAM (seed 1, 2 planning moments, NO turn played): the enemy lists of turns 1 and 2 (pure draws of the separate
//      enemy stream with weights 1/2/1) are pinned; the boot plan is the canonical first list (one list drawn); the turn-2
//      planning draw (drawEnemyPlanPool, called directly) gives the canonical second list. The boot hand is pinned.
// R54c RESTART KEEPS IT: Restart (button), Play Again (button) and devTest.restartBattle reboot the same setup, hash, boot
//      plan and hand.
// R54d EXPLICIT LINKS KEEP THEIR MEANING: ?preset=current = the old default (0d3ce2ec6fa6de), ?preset=commander
//      (1ee7c8d5a26ec1), ?preset=commanderdraw = old 1/1/1 weights (197edd95522f77); a rejected link and ?mode=world stay on
//      current + plain defaults.
// R54e TUTORIAL: from the default boot the tutorial forces current + plain defaults (0d3ce2ec6fa6de, weights 1/1/1) and
//      restarts; a restart during the tutorial keeps them; after it ends the battle stays on them (as before) and the next
//      Restart returns to the default setup.
// R54f RESET PENDING / DEV SCENARIO: "Reset pending" + Apply from preset=current and from preset=commanderdraw&rules=dwa:3
//      gives exactly the default setup (incl. the enemy weights); a dev scenario under the default setup runs under current +
//      plain defaults and restores the default setup.
// No battle is simulated: no turn is played. Own hand ledger (limit 20).
const S = require("./_settings.cjs");
const D = require("./_draw.cjs");
const { check, same, J } = S;

const ID = "r54-default-battle-setup";
const HAND_LIMIT = 20;
const DEFAULT_SETUP_HASH = "0e098f37a86413";
const DRAW_VERSION = "0.1.0-commanderdraw-enemy-random-draw";
const W121 = { Move: 1, Attack: 2, Defend: 1 };
const W111 = { Move: 1, Attack: 1, Defend: 1 };
const SETUP_SETTINGS = { ...S.DEFAULTS, weightAttack: 2 };

/** RAW boot (no _scn.pinCurrent: this fixture needs the query exactly as given), with S.boot's hand counter. */
function rawBoot(query) {
  const g = S.loadGame({ query, scenarios: true });
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  return g;
}

const setupOf = (g) => ({
  preset: g.ev("getActivePreset()"),
  version: g.ev("activeRules.version"),
  hash: g.ev("activeRules.hash"),
  budgets: { player: g.ev("activeRules.playerActionBudget"), enemy: g.ev("activeRules.enemyActionBudget") },
  handSize: g.ev("activeRules.handSize"),
  reshuffleCharges: g.ev("activeRules.reshuffleCharges"),
  maxSameAction: g.ev("activeRules.maxSameAction"),
  playerWeights: J(g, "activeRules.drawWeights"),
  enemyWeights: J(g, "getEnemyDrawWeightsState().active"),
});
const EXPECTED_DEFAULT = { preset: "commanderdraw", version: DRAW_VERSION, hash: DEFAULT_SETUP_HASH, budgets: { player: 5, enemy: 5 }, handSize: 5,
  reshuffleCharges: 2, maxSameAction: 3, playerWeights: W121, enemyWeights: W121 };
const EXPECTED_CURRENT = { preset: "current", version: "0.1.0-current", hash: "0d3ce2ec6fa6de", budgets: { player: 5, enemy: 5 }, handSize: 5,
  reshuffleCharges: 2, maxSameAction: 3, playerWeights: W111, enemyWeights: W111 };
const hand = (g) => J(g, "playerHand");
const pool = (g) => J(g, "getEnemyDrawState().pool");
const click = (g, variable) => g.ev(`${variable}.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`);

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  // ---- R54a ---------------------------------------------------------------------------------------------------------
  const g = track(rawBoot("?scenario=intro&seed=1"));
  same(J(g, "window.DEFAULT_BATTLE_SETUP"), { preset: "commanderdraw", settings: { weightMove: 1, weightAttack: 2, weightDefend: 1 }, enemyDrawWeights: W121 },
    "R54a: the one default-setup definition");
  check(g.ev("Object.isFrozen(window.DEFAULT_BATTLE_SETUP) && Object.isFrozen(window.DEFAULT_BATTLE_SETUP.enemyDrawWeights)"), "R54a: the definition is frozen");
  same(setupOf(g), EXPECTED_DEFAULT, "R54a: default boot = commanderdraw, 5/5, hand 5, charges 2, cap 3, weights 1/2/1 both sides, pinned hash");
  same(S.activeSettings(g), SETUP_SETTINGS, "R54a: active settings");
  same(S.pendingSettings(g), SETUP_SETTINGS, "R54a: pending settings = active");
  check(g.ev("getPendingPreset()") === "commanderdraw" && S.text(g, "rules-pending-state") === "pending matches active", "R54a: pending preset = active, panel: pending matches active");
  check(g.ev("isDefaultBattleSetupActive() && isCommanderRules() && isEnemyDrawRules() && isTargetSelectionActive()") === true, "R54a: every commanderdraw rule applies");
  check(g.ev("computeRulesHash(getEffectiveRulesRecord().values) === activeRules.hash"), "R54a: hash = computeRulesHash(effective record)");
  same(J(g, "getRulesLinkStatus()"), { status: "none", message: "" }, "R54a: no link, no link status");
  same(J(g, "getDefaultSettings()"), S.DEFAULTS, "R54a: the per-setting defaults are unchanged");
  same(J(g, "window.COMMANDER_DRAW_RULES.weights"), W111, "R54a: the commanderdraw constants are unchanged");
  check(hand(g).length === 5 && g.ev("reshuffleChargesRemaining") === 2, "R54a: hand 5, two reshuffle charges");
  check(/changes gameplay/.test(S.text(g, "rules-notice")), "R54a: the panel notice that settings change gameplay stays");
  const copy = await g.runLimited(() => g.ev("copyRulesLink()"));
  same(copy, { copied: true, link: "?scenario=intro&seed=1&preset=commanderdraw&rules=wa:2,dwa:2" }, "R54a: Copy link names the setup explicitly");
  const viaLink = track(rawBoot(copy.link));
  same(setupOf(viaLink), EXPECTED_DEFAULT, "R54a: the explicit link gives the same setup and hash");
  out.defaultSetup = setupOf(g);
  out.copyLink = copy.link;
  out.label = g.ev("getScenarioLabelText()");

  // ---- R54b ---------------------------------------------------------------------------------------------------------
  const lists = D.pureLists(g, 1, 2, 5, W121);
  same(D.pureLists(g, 1, 2, 5, W121), lists, "R54b: same seed -> same lists");
  // Seed 1's first two lists happen to be the same under 1/1/1 (every stream value falls where both weightings agree);
  // recorded, and the weights are shown to matter on seed 2.
  const seed1SameAsOldWeights = JSON.stringify(lists) === JSON.stringify(D.pureLists(g, 1, 2, 5, W111));
  check(JSON.stringify(D.pureLists(g, 2, 2, 5, W121)) !== JSON.stringify(D.pureLists(g, 2, 2, 5, W111)), "R54b: weights 1/2/1 change the seed-2 lists");
  same(pool(g), D.canonical(lists[0]), "R54b: the boot plan (turn 1) = the canonical first list");
  check(g.ev("getEnemyDrawState().state") === D.advanced(g.ev("deriveEnemyDrawSeed(1)"), 5), "R54b: exactly one list (5 values) drawn at boot");
  out.bootHand = hand(g);
  out.pinnedLists = { seed: 1, turn1: lists[0].join(","), turn2: lists[1].join(","), seed1SameAsOldWeights };
  out.bootPlan = pool(g);

  // ---- R54c ---------------------------------------------------------------------------------------------------------
  click(g, "restartBattleButton");
  same(setupOf(g), EXPECTED_DEFAULT, "R54c: Restart keeps the default setup");
  same([hand(g), pool(g)], [out.bootHand, out.bootPlan], "R54c: Restart: same boot hand and plan (streams reseeded)");
  click(g, "restartButton");
  same(setupOf(g), EXPECTED_DEFAULT, "R54c: Play Again keeps the default setup");
  check(g.ev("window.devTest.restartBattle()") === true, "R54c: devTest.restartBattle restarts");
  same(setupOf(g), EXPECTED_DEFAULT, "R54c: restartBattle keeps the default setup");
  same([hand(g), pool(g)], [out.bootHand, out.bootPlan], "R54c: same boot hand and plan after every restart");
  same(J(g, "drawEnemyPlanPool()"), D.canonical(lists[1]), "R54b: the turn-2 planning draw = the canonical second list");

  // ---- R54d ---------------------------------------------------------------------------------------------------------
  const cur = track(rawBoot("?scenario=intro&seed=1&preset=current"));
  same(setupOf(cur), EXPECTED_CURRENT, "R54d: ?preset=current = the old default");
  check(cur.ev("isDefaultBattleSetupActive()") === false && cur.ev("getPendingPreset()") === "current", "R54d: not the default setup; pending preset current");
  const cmd = track(rawBoot("?scenario=intro&seed=1&preset=commander"));
  check(cmd.ev("activeRules.hash") === "1ee7c8d5a26ec1" && cmd.ev("getActivePreset()") === "commander", "R54d: ?preset=commander unchanged");
  const drw = track(rawBoot("?scenario=intro&seed=1&preset=commanderdraw"));
  same(setupOf(drw), { ...EXPECTED_DEFAULT, hash: "197edd95522f77", playerWeights: W111, enemyWeights: W111 }, "R54d: explicit ?preset=commanderdraw keeps 1/1/1 and its hash");
  const bad = track(rawBoot("?scenario=intro&seed=1&preset=bogus"));
  same(setupOf(bad), EXPECTED_CURRENT, "R54d: a rejected link boots current + plain defaults (as before)");
  check(J(bad, "getRulesLinkStatus()").status === "rejected", "R54d: rejected link status");
  const world = track(rawBoot("?mode=world"));
  check(world.ev("getActivePreset()") === "current" && world.ev("activeRules.hash") === "0d3ce2ec6fa6de", "R54d: ?mode=world stays current + plain defaults");
  out.explicitHashes = { current: cur.ev("activeRules.hash"), commander: cmd.ev("activeRules.hash"), commanderdraw: drw.ev("activeRules.hash") };

  // ---- R54e ---------------------------------------------------------------------------------------------------------
  const t = track(rawBoot("?scenario=intro&seed=1"));
  t.ev("player.row = 7; setPlayerSelected(player); applyPlayerAction(playerHand[0]);"); // disturb it
  t.ev("startGuidedTutorial()");
  check(t.ev("isGuidedTutorialActive") === true, "R54e: tutorial active");
  same(setupOf(t), EXPECTED_CURRENT, "R54e: the tutorial forces current + plain defaults");
  check(t.ev("player.row") === 11 && t.ev("getQueuedPlayerActionTotal()") === 0, "R54e: the battle was restarted for the tutorial");
  const tutorialHand = hand(t);
  check(tutorialHand.length === 5 && ["Move", "Attack", "Defend"].every((a) => tutorialHand.includes(a)), "R54e: the tutorial hand has one of every action");
  check(t.ev("window.devTest.restartBattle()") === true, "R54e: restart during the tutorial");
  same(setupOf(t), EXPECTED_CURRENT, "R54e: a restart during the tutorial keeps current + plain defaults");
  t.ev("endGuidedTutorial()");
  same(setupOf(t), EXPECTED_CURRENT, "R54e: after the tutorial the battle stays on current + plain defaults (as before)");
  check(t.ev("getDefaultSetupState().restoreAfterTutorial") === true, "R54e: the return to the default setup is pending");
  check(S.text(t, "rules-pending-state") === "pending differs from active: not applied (the tutorial reset the active settings)", "R54e: panel flag as before");
  click(t, "restartBattleButton");
  same(setupOf(t), EXPECTED_DEFAULT, "R54e: the next Restart returns to the default setup");
  check(t.ev("getDefaultSetupState().restoreAfterTutorial") === false && S.text(t, "rules-pending-state") === "pending matches active", "R54e: restored once, panel matches");
  same([hand(t), pool(t)], [out.bootHand, out.bootPlan], "R54e: same boot hand and plan as a fresh default boot");

  // ---- R54f ---------------------------------------------------------------------------------------------------------
  for (const [name, query] of [["current", "?scenario=intro&seed=1&preset=current"], ["commanderdraw dwa:3", "?scenario=intro&seed=1&preset=commanderdraw&rules=dwa:3"]]) {
    const r = track(rawBoot(query));
    S.click(r, "rules-reset");
    same(S.pendingSettings(r), SETUP_SETTINGS, `R54f: ${name}: Reset pending := the default setup's settings`);
    check(r.ev("getPendingPreset()") === "commanderdraw" && S.text(r, "rules-pending-state") === "pending differs from active: not applied yet", `R54f: ${name}: pending preset commanderdraw, not applied`);
    check(S.apply(r).ok === true, `R54f: ${name}: Apply`);
    same(setupOf(r), EXPECTED_DEFAULT, `R54f: ${name}: Reset pending + Apply = exactly the default setup (incl. enemy weights)`);
    check(r.ev("getEnemyDrawWeightsState().pending") === null, `R54f: ${name}: the pending weights are consumed`);
  }
  const dev = track(rawBoot("?scenario=intro&seed=1"));
  const devRun = await dev.runLimited(() => dev.ev(`(async function () {
    const original = DEV_TEST_SCENARIOS.find((s) => s.id === "player-shared-action-cap").run;
    let during = null;
    DEV_TEST_SCENARIOS.find((s) => s.id === "player-shared-action-cap").run = async function () {
      during = { preset: getActivePreset(), hash: activeRules.hash, weights: { ...getEnemyDrawWeightsState().active } };
      return original.apply(this, arguments);
    };
    const result = await window.devTest.runScenario("player-shared-action-cap");
    return { passed: result.passed, during };
  })()`));
  same(devRun, { passed: true, during: { preset: "current", hash: "0d3ce2ec6fa6de", weights: W111 } }, "R54f: a dev scenario runs under current + plain defaults");
  same(setupOf(dev), EXPECTED_DEFAULT, "R54f: the default setup is restored after the dev scenario");

  const hands = ctxs.reduce((n, c) => n + S.handsOf(c), 0);
  check(hands <= HAND_LIMIT, `R54 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return { header: "REQUIREMENT — default battle setup", handsGenerated: hands, result: out };
}
module.exports = { id: ID, run };
