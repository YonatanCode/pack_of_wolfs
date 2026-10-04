"use strict";
// REQUIREMENT — P2a gap checks (hard assertions; evidence in the golden)
// R27a: FAILED APPLY CONSISTENCY. Custom settings PREV active (link boot), pending NEXT. A one-shot fault makes
//       restartBattle() throw AFTER takeActiveRulesSnapshot() (clearPlayerHand, called by loadScenario after the
//       snapshot, throws; the fault records the activeRules hash it saw, proving the NEXT snapshot had been taken).
//       Afterwards: the store's active settings equal PREV, the module activeRules (version, hash, values) equals the
//       PREV snapshot, --hand-slots / --queue-slots equal the PREV values, the pending settings (NEXT) are preserved;
//       then a normal Apply works (NEXT active, NEXT hash, CSS variables and hand size follow NEXT).
// R27b: ENEMY INTENT TAGS FOLLOW THE ENEMY BUDGET. With enemy budget != player budget (enemy 3 vs player 5, enemy 5
//       vs player 2): the planner's tags show each wolf's planned actions cut by the enemy budget; a hand-authored
//       6-entry pack plan for E1 shows min(6, enemy budget) tags; a 6-entry player queue shows min(6, player budget)
//       tags (renderUnitIntentTags slices by team).
// R27c: PANEL INPUT "-0" / "0". readRulesInputValue("-0") stays the raw string "-0" and validation rejects it for every
//       field with the standard message (also typed into the panel: pending keeps "-0", the error is shown, Apply is
//       disabled); "0" becomes the number 0 and is accepted for every min-0 field.
const G = require("./_gaps.cjs");
const { S } = G;
const { check, same, J } = S;

const ID = "r27-failed-apply-tags-input";
const PREV = { playerActionBudget: 4, handSize: 6, reshuffleCharges: 3, enemyActionBudget: 4 };
const NEXT = { playerActionBudget: 2, handSize: 7, maxSameAction: 4, enemyActionBudget: 2 };
const NEXT_FULL = { ...S.DEFAULTS, ...PREV, ...NEXT }; // pending starts as the active PREV, NEXT is edited on top
const css = (g) => g.ev("document.documentElement.style.getPropertyValue('--hand-slots') + '/' + document.documentElement.style.getPropertyValue('--queue-slots')");
const labels = (g, unitVar) => J(g, `Array.from(${unitVar}.intentTags.querySelectorAll(".unit-intent-label")).map((t) => t.textContent)`);
const SIX = ["Move", "Attack", "Defend", "Move", "Attack", "Defend"];

async function run() {
  const ctxs = [];
  const mk = (q) => { const g = S.boot(q); ctxs.push(g); return g; };

  // ---- R27a
  const g = mk(S.linkOf(PREV));
  const prevActive = S.activeSettings(g);
  const prevRules = J(g, "activeRules");
  const prevCss = css(g);
  same(prevActive, { ...S.DEFAULTS, ...PREV }, "PREV active");
  check(prevCss === "6/4", "PREV CSS variables 6/4");
  S.setPending(g, NEXT);
  const nextHash = g.ev(`computeRulesHash(computeEffectiveRules(${JSON.stringify(NEXT_FULL)}))`);
  G.injectOnce(g, "clearPlayerHand", "globalThis.__faultSaw = { hash: activeRules.hash, css: document.documentElement.style.getPropertyValue('--hand-slots') }; throw new Error('injected fault: restart');");
  const failed = G.attempt(g, "window.devTest.applyPendingSettings()");
  check(failed.thrown && failed.message === "injected fault: restart", `Apply threw the injected restart fault: ${JSON.stringify(failed)}`);
  const saw = J(g, "__faultSaw");
  same(saw, { hash: nextHash, css: "7" }, "the fault fired AFTER takeActiveRulesSnapshot() (NEXT rules and CSS were in place)");
  same(S.activeSettings(g), prevActive, "after the failure: store.active equals PREV");
  same(J(g, "activeRules"), prevRules, "after the failure: module activeRules (version, hash, values) equals the PREV snapshot");
  check(S.record(g).hash === prevRules.hash, "after the failure: the effective record reports the PREV hash");
  check(css(g) === prevCss, `after the failure: CSS variables back to ${prevCss} (got ${css(g)})`);
  same(S.pendingSettings(g), NEXT_FULL, "after the failure: pending NEXT preserved");
  const ok = S.apply(g);
  check(ok.ok === true, "a normal Apply works afterwards");
  same(S.activeSettings(g), NEXT_FULL, "NEXT active");
  check(g.ev("activeRules.hash") === nextHash && S.record(g).hash === nextHash, "NEXT hash active");
  check(css(g) === "7/2" && J(g, "playerHand").length === 7, "CSS variables and hand follow NEXT");

  // ---- R27b
  const tagCases = {};
  [{ enemyActionBudget: 3, playerActionBudget: 5 }, { enemyActionBudget: 5, playerActionBudget: 2 }].forEach((patch) => {
    const t = mk(S.linkOf(patch));
    const label = `enemy ${patch.enemyActionBudget} / player ${patch.playerActionBudget}`;
    check(t.ev("isUnitHidden(enemy)") === false, `${label}: E1 is not concealed`);
    const planned = J(t, `units.filter((u) => u.team === "enemy").map((u) => [getBattleDebugUnitId(u), getEnemyPackActionsForUnit(u), u.intentTags ? Array.from(u.intentTags.querySelectorAll(".unit-intent-label")).map((x) => x.textContent) : null])`);
    planned.forEach(([id, plan, tags]) => same(tags, plan.slice(0, patch.enemyActionBudget), `${label}: ${id} planner tags = plan cut by the enemy budget`));
    t.ev(`queueDevTestPackActions(${JSON.stringify(SIX.map((action) => ({ unitId: "enemy", action })))})`);
    const enemyTags = labels(t, "enemy");
    same(enemyTags, SIX.slice(0, Math.min(6, patch.enemyActionBudget)), `${label}: 6-entry E1 plan shows min(6, enemy budget) tags`);
    t.ev(`getUnitActionQueue(player).push(...${JSON.stringify(SIX)}); renderUnitIntentTags(player)`);
    const playerTags = labels(t, "player");
    same(playerTags, SIX.slice(0, Math.min(6, patch.playerActionBudget)), `${label}: 6-entry P1 queue shows min(6, player budget) tags`);
    tagCases[label] = { plannerTags: Object.fromEntries(planned.map(([id, , tags]) => [id, tags])), enemySixShown: enemyTags.length, playerSixShown: playerTags.length };
  });

  // ---- R27c
  const p = ctxs[ctxs.length - 1];
  const keys = J(p, "getSettingsKeys()");
  const minusZero = {};
  check(p.ev('readRulesInputValue("-0")') === "-0", 'readRulesInputValue("-0") is the raw string "-0"');
  keys.forEach((key) => {
    const r = J(p, `validateSettings({ ...getDefaultSettings(), ${key}: readRulesInputValue("-0") })`);
    const b = J(p, `window.SETTINGS_BOUNDS.${key}`);
    same(r.errors, [{ field: key, message: `${key} must be a whole number from ${b.min} to ${b.max}` }], `${key} = "-0" rejected with the standard message`);
    minusZero[key] = r.errors[0].message;
  });
  p.ev("document.getElementById('rules-reshuffleCharges').value = '-0'");
  S.click(p, "rules-reshuffleCharges", "input");
  check(S.pendingSettings(p).reshuffleCharges === "-0" && S.messages(p).some((m) => m.text === "reshuffleCharges must be a whole number from 0 to 9" && m.cls === "is-error"),
    "typing -0 keeps the raw text and shows the standard error");
  check(p.ev("document.getElementById('rules-apply').disabled") === true, "Apply disabled while -0 is pending");
  const minZero = keys.filter((key) => J(p, `window.SETTINGS_BOUNDS.${key}.min`) === 0);
  check(p.ev('readRulesInputValue("0")') === 0 && p.ev('Object.is(readRulesInputValue("0"), 0)') === true, '"0" becomes the number 0');
  minZero.forEach((key) => {
    const r = J(p, `validateSettings({ ...getDefaultSettings(), ${key}: readRulesInputValue("0") })`);
    check(r.valid === true && r.errors.length === 0, `${key} = 0 accepted (${JSON.stringify(r.errors)})`);
  });
  p.ev("document.getElementById('rules-reshuffleCharges').value = '0'");
  S.click(p, "rules-reshuffleCharges", "input");
  check(S.pendingSettings(p).reshuffleCharges === 0 && p.ev("document.getElementById('rules-apply').disabled") === false, "typing 0 sets pending 0 and Apply is enabled");

  const handsGenerated = S.reportStepHands(ID, ctxs.reduce((n, c) => n + S.handsOf(c), 0));
  return {
    header: G.REQ_HEADER_GAPS,
    handsGenerated,
    failedApply: { prev: PREV, next: NEXT, fault: failed.message, faultSaw: saw, prevHash: prevRules.hash, nextHash, prevCss, restored: true, pendingPreserved: true, applyAfterwards: "ok" },
    intentTags: tagCases,
    panelInput: { minusZero, zeroAcceptedFor: minZero },
  };
}
module.exports = { id: ID, run };
