"use strict";
// REQUIREMENT — P2a acceptance (hard assertions; evidence in the golden)
// R22a: pending vs active are separate: editing pending changes nothing in the battle or the active settings.
// R22b: an invalid pending blocks Apply with NO state change (battle copy, RNG position, active, pending, panel).
// R22c: a valid Apply is atomic: terrain/units/hand/charges/RNG/queues reset together, equal to booting from the
//       equivalent link, and hand size / budget / charges / cap / weights / pool all take effect.
// R22d: the ordinary restart (restartBattle, Play Again = resetGame) keeps the ACTIVE settings; pending stays unapplied.
// R22e: getEffectiveRulesRecord(): preset/customized/version/hash/settings/values; default hash 0d3ce2ec6fa6de, custom
//       hash differs, equals computeRulesHash(values), identical across contexts.
// R22f: Apply is refused (DryRunRejected, nothing changed) while a turn executes or a swap is active.
// R22g: a built-in dev scenario runs under the DEFAULT settings and the custom settings are restored afterwards.
// R22h: Copy link builds the reproducible link of the ACTIVE settings; booting from it reproduces the battle.
const P = require("./_settings.cjs");
const { check, same, J, DEFAULTS, CUSTOM, DEFAULT_HASH, hand } = P;

const ID = "r22-apply-and-record";

async function run() {
  const ctxs = [];
  const mk = (q) => { const g = P.boot(q); ctxs.push(g); return g; };
  const g = mk();

  // ---- R22e (default)
  const def = P.record(g);
  check(def.preset === "current" && def.customized === false && def.version === "0.1.0-current" && def.hash === DEFAULT_HASH, "default record: current, not customized, version, default hash");
  same(def.settings, DEFAULTS, "default record settings");
  same(def.values, J(g, "window.devTest.getRulesRecord().values"), "default effective values are the full RULES");
  check(g.ev("window.devTest.getRulesRecord().hash") === DEFAULT_HASH && g.ev("window.devTest.getBattleRecord().rules.hash") === DEFAULT_HASH, "getRulesRecord / getBattleRecord unchanged");
  same(J(g, "window.devTest.getBattleSeeds()"), { scenarioId: "intro", scenarioVersion: J(g, "getBattleSeeds().scenarioVersion"), seed: 1, handSeed: 1 }, "getBattleSeeds shape unchanged");

  // ---- R22a: editing pending changes nothing
  const stateBefore = P.fullState(g);
  const activeBefore = P.activeSettings(g);
  P.setPending(g, { handSize: 7, playerActionBudget: 3, weightMove: 6 });
  same(P.fullState(g), stateBefore, "editing pending leaves the whole battle state untouched");
  same(P.activeSettings(g), activeBefore, "editing pending leaves the active settings untouched");
  check(g.ev("activeRules.handSize") === 5 && g.ev("actionsList.children.length") === 5 && P.record(g).hash === DEFAULT_HASH, "active rules and hand unchanged");
  check(P.text(g, "rules-pending-state").startsWith("pending differs from active"), "panel says pending differs from active");
  check(P.activeCell(g, "handSize") === "5" && g.ev("document.getElementById('rules-handSize').value") === "7", "active cell shows 5, pending input shows 7");
  check(g.ev("document.getElementById('rules-apply').disabled") === false, "Apply enabled for a valid pending");

  // ---- R22b: invalid pending blocks Apply, no state change
  P.setPending(g, { handSize: "7x" });
  const s1 = P.fullState(g); const p1 = P.pendingSettings(g);
  const refused = P.apply(g);
  check(refused.ok === false && refused.reason === "invalid" && refused.errors.length === 1 && refused.errors[0].field === "handSize", "invalid pending: Apply refused with the errors");
  same(P.fullState(g), s1, "refused Apply: battle copy identical (incl. RNG position, hand, units, terrain)");
  same(P.activeSettings(g), activeBefore, "refused Apply: active unchanged");
  same(P.pendingSettings(g), p1, "refused Apply: pending kept for editing");
  check(g.ev("document.getElementById('rules-apply').disabled") === true, "Apply button disabled when invalid");
  P.click(g, "rules-apply");
  same(P.fullState(g), s1, "clicking the disabled Apply handler still changes nothing");
  P.setPending(g, { handSize: 7, enemyActionBudget: 3, poolMove: 0, poolDefend: 0, poolAttack: 0, weightMove: 0, weightAttack: 0, weightDefend: 0 });
  const refused2 = P.apply(g);
  check(refused2.ok === false && refused2.errors.map((e) => e.field).join() === "drawWeights,handSize", "cross-field errors also block Apply");
  same(P.fullState(g), s1, "refused cross-field Apply: nothing changed");

  // ---- R22c: valid Apply is atomic and equals a link boot
  // disturb the battle first: fight placement, queued orders, a spent reshuffle, moved hand stream
  g.ev("setPlayerSelected(player); applyPlayerAction(playerHand[0]); reshuffleActions(); refillAvailableActions(); player.row = 7; player.health = 4;");
  check(g.ev("reshuffleChargesRemaining") === 1 && g.ev("player.health") === 4, "battle disturbed before Apply");
  const res = P.apply(g, CUSTOM);
  check(res.ok === true, "valid Apply succeeds");
  const linkBoot = mk(P.linkOf(CUSTOM));
  same(P.fullState(g), P.fullState(linkBoot), "after Apply the battle equals a fresh boot from the equivalent link (terrain, units, hand, charges, RNG, queues, rules)");
  check(hand(g).length === 7 && g.ev("reshuffleChargesRemaining") === 4 && g.ev("getQueuedPlayerActionTotal()") === 0 && g.ev("player.health") === 10, "hand 7, charges 4, queues empty, health restored");
  const cap = g.ev("activeRules.maxSameAction"); check(cap === 4, "cap 4");
  same(J(g, "activeRules.enemyActionPool"), ["Attack", "Attack"], "pool from counts");
  check(g.ev("activeRules.playerActionBudget") === 3 && g.ev("activeRules.enemyActionBudget") === 2 && g.ev("activeRules.drawWeights.Move") === 6, "budgets and weights active");
  same(P.activeSettings(g), CUSTOM, "active settings = applied");
  same(P.pendingSettings(g), CUSTOM, "pending normalised to active after Apply");
  check(P.text(g, "rules-pending-state") === "pending matches active" && P.hasClass(g, "rules-panel", "is-custom") && P.activeCell(g, "handSize") === "7", "panel: matches, custom class, active cell 7");
  check(/^intro · seed 1 · custom rules [0-9a-f]{6}$/.test(P.text(g, "scenario-label")) && P.text(g, "scenario-label").endsWith(P.record(g).hash.slice(0, 6)), "scenario label shows the custom-rules marker");
  same(g.ev("document.documentElement.style.getPropertyValue('--hand-slots')") + "/" + g.ev("document.documentElement.style.getPropertyValue('--queue-slots')"), "7/3", "CSS variables 7/3");
  check(P.messages(g).some((m) => /Applied\. The battle was restarted/.test(m.text)) && /changes gameplay/.test(P.text(g, "rules-notice")), "UI says applying changes gameplay");
  // queue budget enforced by the new settings
  g.ev("setPlayerSelected(player); applyPlayerAction(playerHand[0]); applyPlayerAction(playerHand[0]); applyPlayerAction(playerHand[0]); applyPlayerAction(playerHand[0]);");
  check(g.ev("getQueuedPlayerActionTotal()") === 3 && g.ev("isUnitActionQueueFull(player)") === true, "player budget 3 enforced after Apply");

  // ---- R22e (custom)
  const cr = P.record(g);
  check(cr.preset === "current" && cr.customized === true && cr.version === "0.1.0-current" && cr.hash !== DEFAULT_HASH && /^[0-9a-f]{14}$/.test(cr.hash), "custom record");
  check(g.ev(`computeRulesHash(${JSON.stringify(cr.values)})`) === cr.hash, "custom hash == computeRulesHash(effective values)");
  same(cr.values.buildDefaults, J(g, "RULES.buildDefaults"), "effective values keep buildDefaults");
  same(cr.values.perBattle, J(g, "settingsToPerBattle(window.devTest.getActiveSettings())"), "effective perBattle comes from the settings");
  check(P.record(linkBoot).hash === cr.hash && P.record(mk(P.linkOf(CUSTOM))).hash === cr.hash, "custom hash identical across contexts");
  const otherSeed = P.record(mk(P.linkOf(CUSTOM, 9)));
  check(otherSeed.hash === cr.hash, "hash is independent of the seed");
  const wm5 = P.record(mk(P.linkOf({ ...CUSTOM, weightMove: 5 })));
  check(wm5.hash !== cr.hash, "changing one setting changes the hash");
  check(g.ev("window.devTest.getRulesRecord().hash") === DEFAULT_HASH, "getRulesRecord still reports the build defaults record");

  // ---- R22d: ordinary restart keeps ACTIVE settings
  P.setPending(g, { handSize: 6 });
  check(g.ev("window.devTest.restartBattle()") === true, "restart ok");
  same(P.activeSettings(g), CUSTOM, "restartBattle keeps the ACTIVE settings");
  check(hand(g).length === 7 && g.ev("activeRules.handSize") === 7 && P.pendingSettings(g).handSize === 6, "restart: hand 7 (active), pending 6 still unapplied");
  same(P.fullState(g), P.fullState(linkBoot), "restart reproduces the custom battle");
  g.ev("resetGame()");
  check(g.ev("activeRules.handSize") === 7 && hand(g).length === 7 && P.pendingSettings(g).handSize === 6, "Play Again (resetGame) keeps the ACTIVE settings");
  P.setPending(g, { handSize: 7 });

  // ---- R22f: refused mid-turn / during a swap
  const frozen = P.fullState(g);
  const midTurn = {};
  g.ev("isExecutingActionQueue = true");
  P.setPending(g, { handSize: 6 });
  midTurn.executing = P.attempt(g, "window.devTest.applyPendingSettings()");
  check(g.ev("document.getElementById('rules-apply').disabled") === true && P.hasClass(g, "rules-panel", "is-locked"), "panel locked while a turn executes");
  P.click(g, "rules-apply");
  check(P.messages(g).some((m) => m.text === "Not applied (turn-executing). Nothing changed."), "clicking Apply mid-turn reports the refusal");
  g.ev("isExecutingActionQueue = false");
  g.ev("battleStateSwap = {}");
  midTurn.swap = P.attempt(g, "window.devTest.applyPendingSettings()");
  g.ev("battleStateSwap = null");
  same(midTurn, { executing: "DryRunRejected:turn-executing", swap: "DryRunRejected:swap-active" }, "refusals are DryRunRejected with the reason");
  same(P.activeSettings(g), CUSTOM, "refused: active unchanged");
  P.setPending(g, { handSize: 7 });
  same(P.fullState(g), frozen, "refused: battle state unchanged");

  // ---- R22g: dev scenario under defaults, custom settings restored
  const savedRules = J(g, "activeRules");
  const dev = await g.runLimited(() => g.ev("window.devTest.runScenario('player-shared-action-cap')"));
  check(dev.passed === true, "built-in dev scenario passes while custom settings (budget 3) are active, because it runs under the defaults");
  same(P.activeSettings(g), CUSTOM, "custom active settings restored after the dev scenario");
  same(J(g, "activeRules"), savedRules, "activeRules restored after the dev scenario");
  check(g.ev("document.documentElement.style.getPropertyValue('--hand-slots')") === "7", "CSS variables restored");
  const dfl = mk();
  const devDefault = await dfl.runLimited(() => dfl.ev("window.devTest.runScenario('player-shared-action-cap')"));
  check(devDefault.passed === true && P.record(dfl).hash === DEFAULT_HASH, "same scenario under default settings: passes, hash default");

  // ---- R22h: Copy link
  const gl = mk("?scenario=intro&seed=3");
  // Section 14 (default battle setup): a link without preset / rules now boots the default setup, so the current preset names itself.
  same(await gl.runLimited(() => gl.ev("copyRulesLink()")), { copied: true, link: "?scenario=intro&seed=3&preset=current" }, "default settings: link has preset=current and no rules parameter");
  P.apply(gl, CUSTOM);
  const copied = await gl.runLimited(() => gl.ev("copyRulesLink()"));
  check(copied.copied === true && copied.link === "?scenario=intro&seed=3&preset=current&rules=pab:3,hs:7,rc:4,cap:4,wm:6,eab:2,epm:0,epd:0", `Copy link: ${copied.link}`);
  const again = mk(copied.link);
  same(P.fullState(again), P.fullState(gl), "booting from the copied link reproduces the battle");
  check(P.record(again).hash === P.record(gl).hash, "same hash");
  check(P.messages(gl).some((m) => m.text === `Link copied: ${copied.link}`), "panel confirms the copy");

  // ---- reset pending
  P.setPending(g, { handSize: 2 });
  P.click(g, "rules-reset");
  // Section 14: "Reset pending" now sets the default battle setup (commanderdraw, draw weights 1/2/1), not the plain current defaults.
  same(P.pendingSettings(g), { ...DEFAULTS, weightAttack: 2 }, "Reset pending := the default battle setup's settings");
  check(g.ev("window.devTest.getPendingPreset()") === "commanderdraw", "Reset pending := the default battle setup's preset");
  same(P.activeSettings(g), CUSTOM, "Reset pending does not touch the active settings");
  check(P.text(g, "rules-pending-state").startsWith("pending differs from active"), "reset pending is NOT applied");

  const total = ctxs.reduce((n, c) => n + P.handsOf(c), 0);
  P.reportHands(ID, total);
  return { header: P.REQ_HEADER_P2A, handsGenerated: total, defaultRecord: { hash: def.hash, version: def.version }, customHash: cr.hash,
    customSettings: CUSTOM, effectiveEnemyPool: J(g, "activeRules.enemyActionPool"), refusals: { invalidApply: refused.errors, crossField: refused2.errors.map((e) => e.message), ...midTurn },
    copiedLink: copied.link, devScenarioUnderDefaults: { id: dev.id, passed: dev.passed } };
}
module.exports = { id: ID, run };
