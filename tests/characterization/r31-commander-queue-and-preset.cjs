"use strict";
// REQUIREMENT — enemy-action experiment (hard assertions; evidence in the golden)
// R31a: QUEUE LIMIT BY TEAM. With enemy budget != player budget (enemy 3 / player 5, enemy 5 / player 2): under
//       commander the enemy branch of isUnitActionQueueFull caps at the ENEMY budget; under current it still caps at
//       the player budget (unchanged). In all four contexts the intent tags follow each team's own budget (a 6-entry
//       list shows min(6, enemy budget) on E1 and min(6, player budget) on P1) and the planner's tags are the plan
//       cut by the enemy budget.
// R31b: PRESET PLUMBING.
//   - index.html: the commander <option> is present and enabled with the exact label (static read: the harness does
//     not parse index.html; the browser rendering of it is not tested by the current harness);
//   - links: preset=commander alone and with rules= parse (round trip through buildRulesLink / Copy link, a booted
//     copied link reproduces the record); preset=bogus and a duplicate preset are still rejected;
//   - record / hash: commander reports preset commander, version 0.2.0-commander-enemy-actions and a hash that
//     differs from current for identical numbers (default and custom); computeRulesHash(record.values) = record.hash
//     for both presets; the current default hash stays 0d3ce2ec6fa6de; the scenario label is marked
//     "commander (experimental)";
//   - Apply & restart: the pending preset is shown separately (record unchanged until Apply), a failed Apply (restart
//     throws after the rules snapshot) rolls the preset back with the settings, Apply switches it with the settings, Restart / Play Again keep the ACTIVE preset; panel summary / notice name the experimental scope;
//   - tutorial, world mode and dev scenarios reset to current + the default settings exactly as P2a does (the
//     tutorial also resets the preset; pending commander kept and flagged; a dev scenario runs under current and the
//     commander preset and rules are restored afterwards).
// Tutorial-seeded hands (seedTutorialActionHand, not dealt through drawPlayerHandToSize) are counted explicitly.
const fs = require("node:fs");
const path = require("node:path");
const C = require("./_cmd.cjs");
const { S } = C;
const { check, same, J, DEFAULTS, DEFAULT_HASH } = S;

const ID = "r31-commander-queue-and-preset";
const SIX = ["Move", "Attack", "Defend", "Move", "Attack", "Defend"];
const OPTION = '<option value="commander">Commander ruleset (experimental: enemy-action rules only)</option>';
const VERSION = "0.2.0-commander-enemy-actions";
const labels = (g, v) => J(g, `Array.from(${v}.intentTags.querySelectorAll(".unit-intent-label")).map((t) => t.textContent)`);
const parse = (g, q) => J(g, `parseRulesParams(new URLSearchParams(${JSON.stringify(q)}))`);
const currentHashOf = (g, settings) => g.ev(`computeRulesHash(computeEffectiveRules(${JSON.stringify(settings)}))`);

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  let tutorialHands = 0;

  // ---- R31a
  const queueLimit = {};
  [["commander", "eab:3", 3, 5], ["commander", "pab:2", 5, 2], ["current", "eab:3", 3, 5], ["current", "pab:2", 5, 2]].forEach(([preset, rules, eab, pab]) => {
    const g = track(preset === "commander" ? C.bootCommander(rules) : C.bootCurrent(rules));
    const label = `${preset} enemy ${eab} / player ${pab}`;
    check(g.ev("activeRules.enemyActionBudget") === eab && g.ev("activeRules.playerActionBudget") === pab && g.ev("isCommanderRules()") === (preset === "commander"), `${label}: rules`);
    const limit = g.ev("(function () { const q = getUnitActionQueue(enemy); q.length = 0; let n = 0; while (!isUnitActionQueueFull(enemy) && n < 12) { q.push('Move'); n += 1; } q.length = 0; return n; })()");
    check(limit === (preset === "commander" ? eab : pab), `${label}: enemy queue limit ${limit}`);
    check(g.ev("isUnitHidden(enemy)") === false, `${label}: E1 visible`);
    J(g, "units.filter((u) => u.team === 'enemy').map((u) => [getBattleDebugUnitId(u), getEnemyPackActionsForUnit(u)])").forEach(([id, plan]) => {
      const v = { E1: "enemy", E2: "enemySupport", E3: "enemyFlank" }[id];
      same(labels(g, v), plan.slice(0, eab), `${label}: ${id} planner tags = plan cut by the enemy budget`);
    });
    g.ev(`renderUnitIntentTags(enemy, ${JSON.stringify(SIX)}); renderUnitIntentTags(player, ${JSON.stringify(SIX)})`);
    check(labels(g, "enemy").length === Math.min(6, eab) && labels(g, "player").length === Math.min(6, pab), `${label}: tags follow each team's budget`);
    queueLimit[label] = { enemyQueueLimit: limit, enemyTags: labels(g, "enemy").length, playerTags: labels(g, "player").length };
  });

  // ---- R31b: index.html
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  check(html.split("\n").some((line) => line.trim() === OPTION), "index.html: the commander option is enabled with the exact label");

  // links
  const x = track(C.bootCurrent());
  same(parse(x, "preset=commander"), { ok: true, settings: DEFAULTS, hasRules: false, preset: "commander" }, "preset=commander alone parses (default numbers)");
  same(parse(x, "preset=commander&rules=pab:3,hs:7"), { ok: true, settings: { ...DEFAULTS, playerActionBudget: 3, handSize: 7 }, hasRules: true, preset: "commander" }, "preset=commander with rules parses");
  same(parse(x, "preset=current"), { ok: true, settings: DEFAULTS, hasRules: false }, "preset=current keeps its result shape");
  check(parse(x, "preset=bogus").message === 'rules link rejected (unknown preset "bogus"); default settings are used', "preset=bogus still rejected");
  check(parse(x, "preset=commander&preset=current").message === "rules link rejected (duplicate preset parameter); default settings are used", "duplicate preset still rejected");
  check(x.ev(`buildRulesLink(getDefaultSettings(), "intro", 1, "commander")`) === "?scenario=intro&seed=1&preset=commander", "link: commander, default numbers");
  check(x.ev(`buildRulesLink({ ...getDefaultSettings(), playerActionBudget: 3 }, "intro", 1, "commander")`) === "?scenario=intro&seed=1&preset=commander&rules=pab:3", "link: commander with rules");
  check(x.ev(`buildRulesLink(getDefaultSettings(), "intro", 1)`) === "?scenario=intro&seed=1", "link: current default unchanged");
  const curRec = J(x, "window.devTest.getEffectiveRulesRecord()");
  check(curRec.preset === "current" && curRec.hash === DEFAULT_HASH && curRec.version === "0.1.0-current", "current default record and hash unchanged");
  check(x.ev("computeRulesHash(window.devTest.getEffectiveRulesRecord().values)") === DEFAULT_HASH, "current: hash = hash of the record values");

  const k = track(C.bootCommander("pab:3"));
  same(J(k, "window.devTest.getRulesLinkStatus()"), { status: "applied", message: "preset commander (experimental: enemy-action rules only); rules link applied" }, "commander link status");
  const rec = J(k, "window.devTest.getEffectiveRulesRecord()");
  check(rec.preset === "commander" && rec.version === VERSION && rec.customized === true, "commander record: preset, version, customized");
  check(rec.hash !== currentHashOf(k, rec.settings) && /^[0-9a-f]{14}$/.test(rec.hash), "commander hash differs from current for identical numbers (custom)");
  check(k.ev("computeRulesHash(window.devTest.getEffectiveRulesRecord().values)") === rec.hash && k.ev("activeRules.hash") === rec.hash && k.ev("activeRules.preset") === "commander", "commander: hash = hash of the record values = activeRules.hash");
  same(rec.values.enemyRules, { frozenPlan: true, forfeitOnDeath: true, budgetCeiling: true, enemyQueueLimitByEnemyBudget: true, accounting: true }, "commander rule switches (fixed by the preset)");
  check(k.ev("window.devTest.getActivePreset()") === "commander" && k.ev("window.devTest.getPendingPreset()") === "commander", "active and pending preset commander");
  const kLabel = k.ev("scenarioLabelElement.textContent");
  check(kLabel === `intro · seed 1 · custom rules ${rec.hash.slice(0, 6)} · commander (experimental)`, `scenario label: ${kLabel}`);
  const copied = await k.runLimited(() => k.ev("copyRulesLink()"));
  check(copied.copied === true && copied.link === "?scenario=intro&seed=1&preset=commander&rules=pab:3", `Copy link: ${copied.link}`);
  const kk = track(S.boot(copied.link));
  same(J(kk, "window.devTest.getEffectiveRulesRecord()"), rec, "booting the copied link reproduces the commander record");
  same(S.fullState(kk), S.fullState(k), "booting the copied link reproduces the battle");

  const d = track(C.bootCommander());
  const dRec = J(d, "window.devTest.getEffectiveRulesRecord()");
  check(dRec.customized === false && dRec.hash !== DEFAULT_HASH && dRec.version === VERSION, "commander with default numbers: its own hash (not the default)");
  check(d.ev("scenarioLabelElement.textContent") === "intro · seed 1 · commander (experimental)", "scenario label with default numbers");

  // Apply & restart
  const a = track(C.bootCurrent());
  same(J(a, 'window.devTest.setPendingPreset("commander")'), { ok: true, pending: "commander" }, "pending preset set");
  same(J(a, 'window.devTest.setPendingPreset("bogus")'), { ok: false, message: 'unknown preset "bogus"' }, "unknown pending preset refused");
  check(J(a, "window.devTest.getEffectiveRulesRecord()").hash === DEFAULT_HASH && a.ev("window.devTest.getActivePreset()") === "current", "pending only: nothing applied yet");
  check(S.text(a, "rules-pending-state") === "pending differs from active: not applied yet" && a.ev("document.getElementById('rules-preset').value") === "commander", "pending preset shown separately");
  C.G.injectOnce(a, "clearPlayerHand", "throw new Error('injected fault: restart');");
  const failedApply = C.G.attempt(a, "window.devTest.applyPendingSettings()");
  check(failedApply.thrown && failedApply.message === "injected fault: restart", "a failed Apply (restart throws after the rules snapshot)");
  check(a.ev("window.devTest.getActivePreset()") === "current" && a.ev("activeRules.hash") === DEFAULT_HASH && a.ev("isCommanderRules()") === false
    && a.ev("window.devTest.getPendingPreset()") === "commander", "failed Apply: the active preset and activeRules roll back to current, pending commander kept");
  const applied = S.apply(a);
  check(applied.ok === true && applied.record.preset === "commander" && applied.record.hash === dRec.hash, "Apply switches to commander (same record as a commander link boot)");
  same(S.fullState(a), S.fullState(d), "the applied battle equals a commander link boot");
  const summary = S.text(a, "rules-active-summary");
  check(summary.startsWith("active: commander (experimental: enemy-action rules only) · "), `panel summary: ${summary}`);
  const notice = S.text(a, "rules-notice");
  check(notice.endsWith("Commander ruleset (experimental: enemy-action rules only): only the enemy-action rules differ from the current ruleset."), "panel notice names the experimental scope");
  check(S.messages(a).some((m) => m.text === "Applied: commander ruleset (experimental: enemy-action rules only). The battle was restarted; custom settings change gameplay and are not balanced."), "apply message");
  check(a.ev("window.devTest.restartBattle()") === true && J(a, "window.devTest.getEffectiveRulesRecord()").hash === dRec.hash, "Restart keeps the active commander preset");
  a.ev("resetGame()");
  check(J(a, "window.devTest.getEffectiveRulesRecord()").preset === "commander" && a.ev("isCommanderRules()") === true, "Play Again keeps the active commander preset");
  a.ev('window.devTest.setPendingPreset("current")');
  check(a.ev("window.devTest.getActivePreset()") === "commander" && S.text(a, "rules-pending-state") === "pending differs from active: not applied yet", "pending current shown separately while commander is active");

  // tutorial
  const t = track(C.bootCommander());
  t.ev("startGuidedTutorial()");
  tutorialHands += 1;
  check(t.ev("isGuidedTutorialActive") === true, "tutorial active");
  const tRec = J(t, "window.devTest.getEffectiveRulesRecord()");
  check(tRec.preset === "current" && tRec.hash === DEFAULT_HASH && t.ev("isCommanderRules()") === false && t.ev("window.devTest.getPendingPreset()") === "commander", "the tutorial resets the preset to current (default hash); pending commander kept");
  t.ev("endGuidedTutorial()");
  check(t.ev("window.devTest.getActivePreset()") === "current" && S.text(t, "rules-pending-state") === "pending differs from active: not applied (the tutorial reset the active settings)", "after the tutorial: current stays active, pending commander flagged");

  // world mode
  const w = track(S.boot("?mode=world&preset=commander"));
  same(J(w, "window.devTest.getRulesLinkStatus()"), { status: "ignored", message: "rules link ignored: world mode always uses the default settings" }, "world mode ignores preset=commander");
  check(J(w, "window.devTest.getEffectiveRulesRecord()").hash === DEFAULT_HASH && w.ev("window.devTest.getActivePreset()") === "current", "world mode: current, default hash");
  const v = track(C.bootCommander());
  v.ev("clearActiveScenario(); resetGame()");
  check(v.ev("window.devTest.getActivePreset()") === "current" && v.ev("activeRules.hash") === DEFAULT_HASH, "leaving the scenario battle for the world-mode reset switches to current");

  // dev scenario
  const s = track(C.bootCommander());
  s.ev("globalThis.__savedRules = activeRules; globalThis.__seenPresets = []; (function () { const o = resetDevTest; resetDevTest = function () { __seenPresets.push([getActivePreset(), activeRules.hash]); return o.apply(this, arguments); }; })()");
  const dev = await s.runLimited(() => s.ev("window.devTest.runScenario('player-shared-action-cap')"));
  check(dev.passed === true, "dev scenario passes under commander (it runs under current)");
  const seenPresets = J(s, "__seenPresets");
  check(seenPresets.length > 0 && seenPresets.every(([p, h]) => p === "current" && h === DEFAULT_HASH), "the dev scenario ran under current + the default settings");
  check(s.ev("window.devTest.getActivePreset()") === "commander" && s.ev("activeRules === __savedRules") === true, "commander preset and rules restored afterwards");

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, c) => n + S.handsOf(c), 0) + tutorialHands);
  return {
    header: C.REQ_HEADER_CMD,
    handsGenerated,
    tutorialSeededHandsCounted: tutorialHands,
    queueLimitAndTags: queueLimit,
    indexHtmlOption: OPTION,
    links: { commanderAlone: "?scenario=intro&seed=1&preset=commander", commanderWithRules: copied.link },
    records: { currentDefault: { version: curRec.version, hash: curRec.hash }, commanderDefault: { version: dRec.version, hash: dRec.hash },
      commanderPab3: { hash: rec.hash, currentHashSameNumbers: currentHashOf(k, rec.settings) } },
    labels: { commanderDefault: "intro · seed 1 · commander (experimental)", commanderCustom: kLabel },
    panel: { summary, notice },
    failedApplyWithPreset: { error: failedApply.message, activePresetAfter: "current", pendingPresetAfter: "commander" },
    resets: { tutorial: "current + defaults, pending commander kept", world: "current + defaults", devScenario: seenPresets[0] },
  };
}
module.exports = { id: ID, run };
