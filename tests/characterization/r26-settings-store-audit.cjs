"use strict";
// REQUIREMENT — P2a gap checks (hard assertions; evidence in the golden)
// R26: the settings store (getRulesState(): the mutable P2a state kept off the top level, so r19's binding audit
// cannot see it) is untouched by previews and refused operations. Its KEY SET is pinned (KNOWN_KEYS: a new store
// field fails here until it is added deliberately, so it cannot be forgotten silently), and its full value
// (JSON of every field) plus the identity of the store and its object fields (active, pending, linkStatus, notice)
// are compared before / after each of:
//   - a rejected preview with no player orders (no-player-orders);
//   - two dry runs (custom settings active, pending differing from active, link status and notice set);
//   - two failed dry runs (fault in turn-start enemy planning; fault in the turn-end hand refill);
//   - rejected previews: options.queues (BattleStateError), nested in withBattleState (swap-active), during a turn
//     (turn-executing);
//   - a refused Apply: during a turn (turn-executing) and inside a battle-state swap (swap-active).
// Setup: boot through a custom link (link status "applied"), then a real Apply of another custom set (sets
// linkStatusStale), then pending edited to differ from active (messagesSignature refreshed by the panel).
const G = require("./_gaps.cjs");
const { PV, S } = G;
const { check, same, J } = S;

const ID = "r26-settings-store-audit";
const KNOWN_KEYS = ["active", "linkStatus", "linkStatusStale", "messagesSignature", "notice", "pending", "tutorialReset"];
const keysOf = (g) => J(g, "Object.keys(getRulesState()).sort()");
const storeValue = (g) => g.ev("JSON.stringify(getRulesState(), (k, v) => (v === undefined ? '__undefined' : v))");
const CAPTURE = `globalThis.__store = (function () { const s = getRulesState(); return { s, active: s.active, pending: s.pending, linkStatus: s.linkStatus, notice: s.notice }; })()`;
const SAME_IDENTITY = `(function () { const s = getRulesState(); const c = __store;
  return s === c.s && s.active === c.active && s.pending === c.pending && s.linkStatus === c.linkStatus && s.notice === c.notice; })()`;

async function run() {
  const g = S.boot(S.linkOf({ playerActionBudget: 4, enemyActionBudget: 3 }));
  const bootKeys = keysOf(g);
  check(bootKeys.every((k) => KNOWN_KEYS.includes(k)), `boot: every store key is a known key (${bootKeys.join(",")})`);
  const applied = S.apply(g, { playerActionBudget: 3, handSize: 6, weightMove: 5, enemyActionBudget: 3, poolMove: 1, poolDefend: 0 });
  check(applied.ok === true, "a real Apply of another custom set");
  S.setPending(g, { handSize: 7, reshuffleCharges: 4 });
  same(keysOf(g), KNOWN_KEYS, "store key set is pinned (add a new field to KNOWN_KEYS deliberately)");
  const store = J(g, "getRulesState()");
  check(store.notice && store.notice.text && store.linkStatus.status === "applied" && store.linkStatusStale === true
    && JSON.stringify(store.pending) !== JSON.stringify(store.active) && typeof store.messagesSignature === "string", "every store field holds a non-trivial value");

  const base = storeValue(g);
  g.ev(CAPTURE);
  const steps = [];
  const unchanged = (label) => {
    same(keysOf(g), KNOWN_KEYS, `${label}: key set unchanged`);
    check(storeValue(g) === base, `${label}: store value unchanged`);
    check(g.ev(SAME_IDENTITY) === true, `${label}: store and its object fields keep their identity`);
    steps.push(label);
  };
  const rejected = (label, code, expect) => {
    const r = G.attempt(g, code);
    check(r.thrown && `${r.name}:${r.reason ?? r.message}` === expect, `${label}: expected ${expect}, got ${JSON.stringify(r)}`);
    unchanged(`${label} (${expect})`);
  };

  rejected("preview without player orders", "dryRunTurn()", "DryRunRejected:no-player-orders");
  PV.BOARDS.plain.setup(g);
  unchanged("player orders queued");
  [1, 2].forEach((i) => { check(PV.dryRun(g).ok, `dry run ${i} ran`); unchanged(`dry run ${i}`); });
  G.injectOnce(g, "planEnemyPackTurnRules", "throw new Error('injected fault: enemy planning');");
  rejected("failed dry run (turn-start planning)", "dryRunTurn()", "Error:injected fault: enemy planning");
  G.injectOnce(g, "drawPlayerHandToSize", "throw new Error('injected fault: hand refill');");
  rejected("failed dry run (turn-end refill)", "dryRunTurn()", "Error:injected fault: hand refill");
  rejected("preview with options.queues", "dryRunTurn({ queues: { P1: ['Attack'] } })",
    "BattleStateError:dryRunTurn previews only the currently queued player orders; options.queues is not supported");
  rejected("nested preview", "withBattleState(snapshotBattleState(), () => dryRunTurn())", "DryRunRejected:swap-active");
  rejected("preview during a turn", "isExecutingActionQueue = true; try { dryRunTurn(); } finally { isExecutingActionQueue = false; }", "DryRunRejected:turn-executing");
  rejected("Apply during a turn", "isExecutingActionQueue = true; try { applyPendingSettings(); } finally { isExecutingActionQueue = false; }", "DryRunRejected:turn-executing");
  rejected("Apply inside a battle-state swap", "withBattleState(snapshotBattleState(), () => applyPendingSettings())", "DryRunRejected:swap-active");

  const handsGenerated = S.reportStepHands(ID, S.handsOf(g));
  return { header: G.REQ_HEADER_GAPS, handsGenerated, knownKeys: KNOWN_KEYS, bootKeys, auditedStore: JSON.parse(base), unchangedAfter: steps };
}
module.exports = { id: ID, run };
