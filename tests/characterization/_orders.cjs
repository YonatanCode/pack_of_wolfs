"use strict";
// REQUIREMENT — L1 player orders
// Shared helpers for the L1 fixtures (r41..r44; L3a: r46): shared order validation, the headless order door / turn and the
// player-limited observation. Not a fixture itself. Read-only reuse of _preview (probes, live fingerprint, spies),
// _settings (boot with the hand counter) and _targets (the real tile handler).
// HAND LEDGER (testing boundary): this step keeps its OWN ledger (reportOrderHands, asserted <= 60 in total), separate
// from the P2a (500), follow-up (100) and target-selection (100) ledgers. Every context boots through boot(), which
// counts the boot hand and every dealt / refilled hand.
// LIVE (UI) PATHS used as the reference for "headless = live":
//   card order   setPlayerSelected(wolf) + applyPlayerAction(card)   (what the action-menu button handler calls);
//   target order setPlayerSelected(wolf) + handleTileIntent(enemy tile) (the real tile handler; under commander a click
//                on the wolf's CURRENT target clears it, so { target: null } is driven as a click on the current target);
//   Play         executePlayerActionQueue through the real presentation driver (PV.L.playTurn).
// All order lists are hand-authored in the fixtures; nothing here generates orders or boards.
const PV = require("./_preview.cjs");
const S = require("./_settings.cjs");
const TG = require("./_targets.cjs");

const REQ_HEADER_ORDERS = "REQUIREMENT — L1 player orders";
const ORDER_HAND_LIMIT = 60;
const ledger = {};
const CUR = "?scenario=intro&seed=1";
const CMD = "?scenario=intro&seed=1&preset=commander";
const VARS = TG.VARS;

/** Real boot route with the hand counter (S.boot) plus the _preview probes, so PV.liveFingerprint works. */
function boot(query = CUR) {
  const g = S.boot(query);
  PV.L.T.installResultMessageProbe(g);
  PV.installProbes(g);
  return g;
}

/** This step's ledger: hands of every listed context, asserted <= 60 over all L1 fixtures run so far. */
function reportOrderHands(id, contexts) {
  ledger[id] = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  S.check(total <= ORDER_HAND_LIMIT, `L1 hand budget: ${total} hands so far (limit ${ORDER_HAND_LIMIT})`);
  return ledger[id];
}

const J = (g, expr) => PV.evJ(g, expr);
/** Calls in the context, results as plain data. */
const validate = (g, orders) => J(g, `validatePlayerOrders(${JSON.stringify(orders)})`);
const applyOrders = (g, orders) => J(g, `applyPlayerOrders(${JSON.stringify(orders)})`);
const headlessTurn = (g, orders, options) => J(g, `runHeadlessTurn(${JSON.stringify(orders)}${options ? `, ${JSON.stringify(options)}` : ""})`);
const observe = (g) => J(g, "observeBattle()");
const hand = (g) => J(g, "playerHand");
const queues = (g) => J(g, `[player, playerSupport, playerFlank].map((u) => getBattleDebugUnitId(u) + ":" + getUnitActionQueue(u).join(","))`);
const verdictOf = (r) => (r.ok ? "ok" : `${r.reason}@${r.index}`);

/** Drive hand-authored orders through the LIVE UI paths (see the header). Returns one line per order: what happened. */
function uiOrders(g, orders) {
  return orders.map((order) => {
    const v = VARS[order.unit];
    g.ev(`setPlayerSelected(${v})`);
    if ("action" in order) {
      const before = g.ev("playerHand.length");
      g.ev(`applyPlayerAction(${JSON.stringify(order.action)})`);
      return `${order.unit} ${order.action}: ${g.ev("playerHand.length") === before - 1 ? "queued" : "refused"}`;
    }
    const enemyId = order.target === null ? g.ev(`${v}.targetId`) : order.target;
    S.check(typeof enemyId === "string", `uiOrders: ${order.unit} has a target to click for ${JSON.stringify(order)}`);
    TG.clickTile(g, enemyId);
    return `${order.unit} target ${order.target}: ${TG.targets(g).split(" ").find((t) => t.startsWith(order.unit + ":"))}`;
  });
}

/** What a turn left behind: full BattleState (JSON), battle note, observation. */
const after = (g) => ({ state: g.ev("JSON.stringify(snapshotBattleState())"), note: g.ev("lastBattleDebugReport"), observation: observe(g) });

/** LIVE: the orders through the UI paths, then Play (real presentation driver). */
async function playLive(g, orders) {
  const ui = uiOrders(g, orders);
  S.check(ui.every((line) => !line.endsWith("refused")), `live: every order was accepted by the UI: ${ui.join("; ")}`);
  const events = await PV.L.playTurn(g);
  return { ui, events, ...after(g) };
}

/** HEADLESS: runHeadlessTurn with the dev-only events opt-in; its returned observation must equal a fresh one. */
function playHeadless(g, orders) {
  const r = headlessTurn(g, orders, { includeEvents: true });
  S.check(r.ok === true, `headless turn ran: ${JSON.stringify(r).slice(0, 200)}`);
  const rest = after(g);
  S.same(r.observation, rest.observation, "the headless result's observation equals a fresh observeBattle()");
  return { events: r.events, outcome: r.outcome, ...rest };
}

/** Same events, BattleState, battle note and observation; returns a compact golden summary. */
function sameTurn(a, b, label) {
  S.same(a.events, b.events, `${label}: same events`);
  S.same(a.state, b.state, `${label}: same final BattleState`);
  S.same(a.note, b.note, `${label}: same battle note`);
  S.same(a.observation, b.observation, `${label}: same observation`);
  return { ...PV.summarizeEvents(a.events), eventHash: PV.L.hashEvents(a.events), stateHash: PV.sha256(a.state), hand: a.observation.hand.cards };
}

/** Records every validatePlayerOrders call made by game code (the UI paths) as "orders -> verdict". */
function installValidateSpy(g) {
  g.ev(`globalThis.__validations = []; (function () { const orig = validatePlayerOrders;
    validatePlayerOrders = function (orders) { const r = orig.apply(this, arguments);
      __validations.push(JSON.stringify(orders) + " -> " + (r.ok ? "ok" : r.reason + "@" + r.index)); return r; }; })()`);
}
const takeValidations = (g) => { const list = J(g, "__validations"); g.ev("__validations.length = 0"); return list; };

/** Every key name anywhere in a plain-data value, with its path (arrays by index). */
function keyPaths(value, path = "$", out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => keyPaths(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") Object.keys(value).forEach((k) => { out.push({ key: k, path: `${path}.${k}` }); keyPaths(value[k], `${path}.${k}`, out); });
  return out;
}

module.exports = { PV, S, TG, REQ_HEADER_ORDERS, CUR, CMD, VARS, boot, reportOrderHands, J, validate, applyOrders, headlessTurn, observe, hand, queues,
  verdictOf, uiOrders, after, playLive, playHeadless, sameTurn, installValidateSpy, takeValidations, keyPaths };
