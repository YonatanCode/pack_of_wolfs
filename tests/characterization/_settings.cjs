"use strict";
// Shared helpers for the P2a settings fixtures (r20..r24). Not a fixture itself.
// HAND BUDGET (testing boundary): the only generated data allowed is seeded hand draws, at most 500 TOTAL across
// all P2a fixtures. Every context boots through boot(), which counts the boot hand and wraps
// drawPlayerHandToSize so each dealt/refilled hand is counted; handsOf(g) reports the count for that context and
// reportHands(id, n) accumulates the running total (asserted <= 500).
const { loadGame } = require("../harness/load-game.cjs");
const S = require("./_scn.cjs");

const REQ_HEADER_P2A = "REQUIREMENT — P2a acceptance";
const DEFAULT_HASH = "0d3ce2ec6fa6de";
const DEFAULTS = { playerActionBudget: 5, handSize: 5, reshuffleCharges: 2, maxSameAction: 3, weightMove: 1, weightAttack: 1, weightDefend: 1,
  enemyActionBudget: 5, poolMove: 2, poolDefend: 1, poolAttack: 2 };
const HAND_LIMIT = 500;
const ledger = {};

const CUSTOM = { playerActionBudget: 3, handSize: 7, reshuffleCharges: 4, maxSameAction: 4, weightMove: 6, weightAttack: 1, weightDefend: 1,
  enemyActionBudget: 2, poolMove: 0, poolDefend: 0, poolAttack: 2 };

/** Real boot route in a fresh context, with the hand counter installed. query defaults to the intro scenario, seed 1. */
function boot(query = "?scenario=intro&seed=1", extra = {}) {
  const g = loadGame({ query, scenarios: true, ...extra });
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  return g;
}
/** Hands dealt in this context (+1 for the boot hand, dealt before the counter existed). */
const handsOf = (g) => 1 + g.ev("window.__drawn");
function reportHands(id, n) {
  ledger[id] = n;
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  S.check(total <= HAND_LIMIT, `P2a hand budget: ${total} hands generated so far (limit ${HAND_LIMIT})`);
  return n;
}

const linkOf = (patch, seed = 1) => `?scenario=intro&seed=${seed}&preset=current&rules=${Object.entries(patch).map(([k, v]) => `${KEY[k]}:${v}`).join(",")}`;
const KEY = { playerActionBudget: "pab", handSize: "hs", reshuffleCharges: "rc", maxSameAction: "cap", weightMove: "wm", weightAttack: "wa", weightDefend: "wd",
  enemyActionBudget: "eab", poolMove: "epm", poolDefend: "epd", poolAttack: "epa" };

const J = (g, expr) => JSON.parse(g.ev(`JSON.stringify(${expr})`) ?? "null");
const activeSettings = (g) => J(g, "window.devTest.getActiveSettings()");
const pendingSettings = (g) => J(g, "window.devTest.getPendingSettings()");
const record = (g) => J(g, "window.devTest.getEffectiveRulesRecord()");
const setPending = (g, patch) => g.ev(`window.devTest.setPendingSettings(${JSON.stringify(patch)})`);
/** setPending + apply; returns the apply result (plain). */
const apply = (g, patch) => { if (patch) setPending(g, patch); return J(g, "window.devTest.applyPendingSettings()"); };
/** Call fn-expression; returns "Name:reason" if it threw a DryRunRejected, "ok" otherwise. */
const attempt = (g, expr) => g.ev(`(function () { try { ${expr}; return "ok"; } catch (e) { return e.name + ":" + (e.reason ?? e.message); } })()`);
const fullState = (g) => J(g, "window.devTest.snapshotBattleState()");
const text = (g, id) => g.ev(`document.getElementById(${JSON.stringify(id)}).textContent`);
const activeCell = (g, key) => g.ev(`document.querySelector('[data-rules-active="${key}"]').textContent`);
const messages = (g) => J(g, "document.getElementById('rules-messages').children.map((c) => ({ cls: c.className, text: c.textContent }))");
const hasClass = (g, id, cls) => g.ev(`document.getElementById(${JSON.stringify(id)}).classList.contains(${JSON.stringify(cls)})`);
const click = (g, id, type = "click") => g.ev(`document.getElementById(${JSON.stringify(id)}).listeners.filter((l) => l.type === ${JSON.stringify(type)}).forEach((l) => l.fn())`);

module.exports = { ...S, loadGame, REQ_HEADER_P2A, DEFAULT_HASH, DEFAULTS, CUSTOM, KEY, boot, handsOf, reportHands, linkOf, J, activeSettings, pendingSettings, record,
  setPending, apply, attempt, fullState, text, activeCell, messages, hasClass, click };
