"use strict";
// REQUIREMENT — L3 visual replay
// Shared helpers for r47 / r48 (the ?replay=1#r=<payload> page, script.js "VISUAL REPLAY (L3)"). Not a fixture itself.
// TESTING BOUNDARY: ONE hand-authored, scripted 3-turn battle (TURNS below: intro, seed 1, commander, rules rc:3; turn 1
// is a reshuffle-only step and then a card step, written from the hand recorded after that reshuffle). Its eventHash
// values are obtained by running exactly these orders ONCE through the live game headlessly (record(): applyPlayerOrders
// for the reshuffle step, runHeadlessTurn for the last step, hashTurnEvents of its events), as the Lab driver does. No
// bot, no generated battle, board or payload, no fuzzing: every payload variant in r47 / r48 is a hand-written edit.
// HARNESS SEAMS (fixture-local, nothing in tests/harness changes): loadGame() sets window.location before it creates the
// vm context, so bootReplay() wraps vm.createContext for that one call to add location.hash and, optionally, a fetch
// stub (the harness has no fetch: "unavailable"). Events are never fired by the harness, so listeners are called directly.
// HAND LEDGER: this step keeps its own ledger (reportReplayHands, asserted <= 60 over r47 + r48); every context counts its
// boot hand plus each drawPlayerHandToSize call that drew cards.
const vm = require("node:vm");
const { loadGame } = require("../harness/load-game.cjs");
const { sha256 } = require("../harness/util.cjs");
const { check, same } = require("./_scn.cjs");

const REQ_HEADER = "REQUIREMENT — L3 visual replay";
const QUERY = "?scenario=intro&seed=1&preset=commander&rules=rc:3";
const FIXTURE_BUILD_ID = "47".repeat(32); // the build the hand-written payload claims (served by the fetch stub)
const OTHER_BUILD_ID = "48".repeat(32);
const R = { reshuffle: true };
/** Hand-authored orders. Turn 1's card step uses the post-reshuffle hand [Move, Attack, Defend, Attack, Defend]. */
const TURNS = [
  [[R], [{ unit: "P1", target: "E2" }, { unit: "P1", action: "Move" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Defend" }]],
  [[{ unit: "P3", action: "Move" }, { unit: "P1", action: "Attack" }, { unit: "P2", target: "E3" }, { unit: "P2", action: "Attack" }]],
  [[{ unit: "P1", action: "Move" }, { unit: "P1", action: "Move" }, { unit: "P3", action: "Attack" }, { unit: "P2", action: "Defend" }]],
];
const HAND_LIMIT = 60;
const ledger = {};

const J = (g, expr) => JSON.parse(g.ev(`JSON.stringify(${expr})`) ?? "null");

function countHands(g) {
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  return g;
}
const handsOf = (g) => 1 + g.ev("window.__drawn");
function reportReplayHands(id, contexts) {
  ledger[id] = contexts.reduce((n, g) => n + handsOf(g), 0);
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  check(total <= HAND_LIMIT, `L3 replay hand budget: ${total} hands so far (limit ${HAND_LIMIT})`);
  return ledger[id];
}

/** Normal boot route (no replay). */
const bootNormal = (query = QUERY) => countHands(loadGame({ query, scenarios: true }));

/** Replay boot: ?replay=1 (or `search`) plus a location.hash, and an optional fetch stub; g.fetchCalls records its calls. */
function bootReplay({ hash, fetch, search = "?replay=1" } = {}) {
  const calls = [];
  const original = vm.createContext;
  vm.createContext = (sandbox, options) => {
    if (sandbox.location) sandbox.location.hash = hash;
    if (fetch) sandbox.fetch = (...args) => { calls.push(String(args[0])); return fetch(...args); };
    return original(sandbox, options);
  };
  let g;
  try {
    g = loadGame({ query: search, scenarios: true });
  } finally {
    vm.createContext = original;
  }
  g.fetchCalls = calls;
  return countHands(g);
}

/** fetch stubs (resolve / reject like window.fetch; only the members the page reads). */
const serveBuildId = (buildId) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ buildId }) });
const serveStatus = (status) => async () => ({ ok: false, status, text: async () => "" });
const serveText = (text) => async () => ({ ok: true, status: 200, text: async () => text });
const failFetch = (message) => async () => { throw new Error(message); };

/** Run TURNS once through the live game headlessly (the Lab driver's way) and keep what a replay must reproduce. */
function record() {
  const g = bootNormal(QUERY);
  const rules = J(g, "observeBattle().rules");
  const initialState = g.ev("JSON.stringify(snapshotBattleState())");
  const turns = TURNS.map((steps, index) => {
    steps.slice(0, -1).forEach((step) => {
      const r = J(g, `applyPlayerOrders(${JSON.stringify(step)})`);
      check(r.ok === true, `record turn ${index + 1}: pre-turn step accepted: ${JSON.stringify(r)}`);
    });
    const r = J(g, `runHeadlessTurn(${JSON.stringify(steps[steps.length - 1])}, { includeEvents: true })`);
    check(r.ok === true, `record turn ${index + 1}: headless turn ran: ${JSON.stringify(r).slice(0, 200)}`);
    return { turn: index + 1, steps, eventHash: J(g, `hashTurnEvents(${JSON.stringify(r.events)})`), events: r.events };
  });
  return {
    g, rules, initialState, turns,
    finalState: g.ev("JSON.stringify(snapshotBattleState())"),
    finalObservation: J(g, "observeBattle()"),
    finalNote: g.ev("lastBattleDebugReport"),
  };
}

/** The hand-written payload (contract v1) for the recorded battle; `edit` is a hand-written change for one case. */
function payloadOf(rec, edit) {
  const payload = {
    v: 1, buildId: FIXTURE_BUILD_ID, scenarioId: "intro", seed: 1, preset: "commander", rulesQuery: "rules=rc:3",
    rulesVersion: rec.rules.version, rulesHash: rec.rules.hash, strategy: "scripted-fixture", botSeed: 0, result: "timeout",
    turns: rec.turns.map(({ turn, steps, eventHash }) => ({ turn, steps, eventHash })),
  };
  const copy = JSON.parse(JSON.stringify(payload));
  if (edit) edit(copy);
  return copy;
}
const encode = (payload) => `#r=${Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8").toString("base64url")}`;

const state = (g) => J(g, `(({ active, status, setupLoaded, turnIndex, playing, busy, error, warning, results }) =>
  ({ active, status, setupLoaded, turnIndex, playing, busy, error, warning, results }))(getReplayState())`);
/** What the panel shows (texts; hidden elements as null). */
const panel = (g) => J(g, `(() => {
  const t = (id) => { const e = document.getElementById(id); return e.hidden ? null : e.textContent; };
  const b = (id) => ({ text: document.getElementById(id).textContent, disabled: document.getElementById(id).disabled });
  const orders = document.getElementById("replay-orders");
  return { hidden: document.getElementById("replay-panel").hidden, turn: t("replay-turn"), meta: t("replay-meta"), warning: t("replay-warning"),
    error: t("replay-error"), status: t("replay-status"), orders: orders.hidden ? null : orders.children.map((c) => c.textContent),
    play: b("replay-play"), next: b("replay-next"), restart: b("replay-restart"),
    body: ["is-replay", "is-replay-blocked"].filter((c) => document.body.classList.contains(c)) };
})()`);
/** Calls the click listener(s) of an element by id; returns what the (last) listener returned (a promise for replay buttons). */
const click = (g, id) => g.ev(`(() => { let out; document.getElementById(${JSON.stringify(id)}).listeners.filter((l) => l.type === "click").forEach((l) => { out = l.fn({ target: null, stopPropagation() {}, preventDefault() {} }); }); return out; })()`);
const waitBuildCheck = (g) => g.runLimited(() => g.ev("getReplayState().buildCheck"));
const snapshot = (g) => g.ev("JSON.stringify(snapshotBattleState())");

module.exports = { REQ_HEADER, QUERY, FIXTURE_BUILD_ID, OTHER_BUILD_ID, TURNS, J, check, same, sha256, reportReplayHands, bootNormal, bootReplay,
  serveBuildId, serveStatus, serveText, failFetch, record, payloadOf, encode, state, panel, click, waitBuildCheck, snapshot };
