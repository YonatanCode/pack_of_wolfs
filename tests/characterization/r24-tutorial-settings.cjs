"use strict";
// REQUIREMENT — P2a acceptance (hard assertions; evidence in the golden)
// R24a: entering the guided tutorial with CUSTOM active settings switches the ACTIVE settings to the supported
//       defaults (default hash) and restarts the battle under them, exactly as if the tutorial had started from a
//       default battle (state equality with a control context); the custom settings do not leak into it.
// R24b: Apply is refused during the tutorial (DryRunRejected, nothing changed); the panel is locked.
// R24c: after the tutorial ends the active settings STAY the defaults; the pending (custom) values are preserved and
//       flagged "not applied (the tutorial reset the active settings)"; a later Apply works.
// R24d: under the default settings the tutorial does NOT restart the battle (unchanged behaviour); a tutorial start
//       during a running turn is refused without touching the settings.
// The real startGuidedTutorial / endGuidedTutorial are called (they are function declarations inside the tutorial
// block of script.js and become globals in the classic script; the stub DOM provides #toggle-tutorial / #tutorial-overlay).
const P = require("./_settings.cjs");
const { check, same, J, DEFAULTS, CUSTOM, DEFAULT_HASH, hand } = P;

const ID = "r24-tutorial-settings";

async function run() {
  const ctxs = [];
  const mk = (q) => { const g = P.boot(q); ctxs.push(g); return g; };

  check(mk().ev("typeof startGuidedTutorial === 'function' && typeof endGuidedTutorial === 'function'"), "the real tutorial functions are reachable in the harness");

  // ---- R24a
  const g = mk(P.linkOf(CUSTOM));
  same(P.activeSettings(g), CUSTOM, "custom active settings before the tutorial");
  check(hand(g).length === 7 && P.record(g).hash !== DEFAULT_HASH, "custom battle: hand 7, custom hash");
  g.ev("player.row = 7; player.health = 4; setPlayerSelected(player); applyPlayerAction(playerHand[0]);"); // disturb it
  g.ev("startGuidedTutorial()");
  check(g.ev("isGuidedTutorialActive") === true, "tutorial active");
  same(P.activeSettings(g), DEFAULTS, "ACTIVE settings are the defaults during the tutorial");
  check(P.record(g).hash === DEFAULT_HASH && P.record(g).customized === false && g.ev("activeRules.handSize") === 5 && g.ev("activeRules.playerActionBudget") === 5, "default hash, 5/5, not customized");
  const hands = hand(g);
  check(hands.length === 5 && ["Move", "Attack", "Defend"].every((a) => hands.includes(a)), "the tutorial hand has 5 cards with one of every action");
  const control = mk();
  control.ev("startGuidedTutorial()");
  same(P.fullState(g), P.fullState(control), "state equals a default battle that started the tutorial (battle was restarted under the defaults, no custom leak)");
  check(g.ev("player.health") === 10 && g.ev("player.row") === 11 && g.ev("getQueuedPlayerActionTotal()") === 0, "battle restarted: units at spawn, queues empty");
  same(g.ev("document.documentElement.style.getPropertyValue('--hand-slots')") + "/" + g.ev("document.documentElement.style.getPropertyValue('--queue-slots')"), "5/5", "CSS variables back to 5/5");
  check(!/custom rules/.test(P.text(g, "scenario-label")), "label has no custom-rules marker");
  same(P.pendingSettings(g), CUSTOM, "pending custom values preserved in the panel");
  check(P.text(g, "rules-pending-state") === "pending differs from active: not applied (the tutorial reset the active settings)", "pending flagged: not applied (the tutorial reset the active settings)");
  check(P.messages(g).some((m) => /The tutorial reset the active settings to the defaults and restarted the battle/.test(m.text)), "panel tells the user");

  // ---- R24b
  const during = P.fullState(g);
  check(P.attempt(g, "window.devTest.applyPendingSettings()") === "DryRunRejected:tutorial-active", "Apply refused during the tutorial");
  check(g.ev("document.getElementById('rules-apply').disabled") === true && P.hasClass(g, "rules-panel", "is-locked") && g.ev("document.getElementById('rules-handSize').disabled") === true, "Apply and inputs disabled, panel locked");
  same(P.fullState(g), during, "refused: nothing changed");
  same(P.activeSettings(g), DEFAULTS, "refused: active still default");

  // ---- R24c
  g.ev("endGuidedTutorial()");
  check(g.ev("isGuidedTutorialActive") === false, "tutorial ended");
  same(P.activeSettings(g), DEFAULTS, "active settings STAY the defaults after the tutorial");
  check(P.record(g).hash === DEFAULT_HASH && g.ev("activeRules.handSize") === 5, "default hash after the tutorial");
  same(P.pendingSettings(g), CUSTOM, "pending custom values still preserved");
  check(P.text(g, "rules-pending-state") === "pending differs from active: not applied (the tutorial reset the active settings)", "still flagged not applied");
  check(P.hasClass(g, "rules-panel", "is-locked") === false && g.ev("document.getElementById('rules-apply').disabled") === false, "panel unlocked, Apply enabled");
  check(g.ev("window.devTest.restartBattle()") === true && P.record(g).hash === DEFAULT_HASH && hand(g).length === 5, "ordinary restart after the tutorial still uses the defaults (pending not applied)");
  check(P.apply(g).ok === true && P.record(g).hash !== DEFAULT_HASH && hand(g).length === 7, "a later Apply of the preserved pending values works");
  check(P.text(g, "rules-pending-state") === "pending matches active", "flag cleared after Apply");

  // ---- R24d
  const d = mk();
  d.ev("player.row = 7; setPlayerSelected(player); applyPlayerAction(playerHand[0]);");
  const beforeDefault = hand(d).length;
  d.ev("startGuidedTutorial()");
  check(d.ev("player.row") === 7 && d.ev("getQueuedPlayerActionTotal()") === 1 && beforeDefault === 4, "default settings: the tutorial start does NOT restart the battle (as before)");
  check(P.text(d, "rules-pending-state") === "pending matches active", "default settings: nothing flagged");
  const busy = mk(P.linkOf(CUSTOM));
  busy.ev("isExecutingActionQueue = true");
  busy.ev("startGuidedTutorial()");
  busy.ev("isExecutingActionQueue = false");
  check(busy.ev("isGuidedTutorialActive") === false, "tutorial start refused during a running turn");
  same(P.activeSettings(busy), CUSTOM, "refused tutorial start: custom settings untouched");
  check(P.messages(busy).some((m) => m.cls === "is-error" && /tutorial was not started: a turn is running/.test(m.text)), "refusal explained in the panel");

  const total = ctxs.reduce((n, c) => n + P.handsOf(c), 0);
  P.reportHands(ID, total);
  return { header: P.REQ_HEADER_P2A, handsGenerated: total, tutorialHand: hands, activeDuringTutorial: DEFAULTS,
    pendingFlag: "pending differs from active: not applied (the tutorial reset the active settings)" };
}
module.exports = { id: ID, run };
