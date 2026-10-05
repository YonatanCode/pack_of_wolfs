"use strict";
// REQUIREMENT — L3a reshuffle order (hard assertions; evidence in the golden)
// The headless order { reshuffle: true } uses the Reshuffle button's own rules half (reshufflePlayerHandData) and the
// shared validation (validatePlayerOrders). Live reference: the REAL button listener (reshuffleButton's click handler,
// i.e. reshuffleActions), card clicks and enemy clicks through O.uiOrders, Play through the real presentation driver.
// R46a CURRENT, headless = live: [P1 Attack, reshuffle] (the queued card is discarded, not returned) then a turn
//      [P1 Attack, P2 Move, P3 Defend] written from the recorded post-reshuffle hand. After the reshuffle: same hand,
//      queues, charges, hand-stream state and full BattleState; after the turn: same events, BattleState, note,
//      observation and stream state. Carry-over: the turn-end draw refills exactly the 3 spent cards (prepended) and
//      the 2 unplayed post-reshuffle cards are kept as the suffix.
// R46b COMMANDER, the same with targets: [P2 Defend (first queue: auto-pick), reshuffle, P1 -> E2 (a target order after
//      a reshuffle is allowed: it does not depend on the hand)], then a turn [P1 Move, P2 Attack, P3 Attack]. Targets
//      survive the reshuffle (live behaviour) and the frozen enemy plan is unchanged by it.
// R46c NO CHARGES (rc:0): { reshuffle: true } is refused no-reshuffle-charges by the validator, the door and the
//      headless turn; nothing changes (live fingerprint incl. RNG position, no hand drawn). The button click validates
//      through the same function (spy) with the same reason, changes nothing, and the button is disabled.
// R46d ATOMIC MIXED LISTS (default charges 2): a card after a reshuffle (hand-not-observed, for each of Move / Attack /
//      Defend: the same reason and message whatever the undrawn hand would hold), a third reshuffle with two charges
//      (no-reshuffle-charges, counted in sequence), malformed reshuffle orders, a reshuffle-only turn and a
//      card-then-reshuffle turn (no-player-orders: the reshuffle discards the card), turn executing (also the UI click),
//      tutorial (door only): every refusal leaves the live fingerprint (state incl. hand-stream position, DOM, view,
//      debug, flags) and the draw counter unchanged. Then [reshuffle, reshuffle] is accepted (two hands drawn, charges
//      0) and a further reshuffle is refused; the button's disabled state agrees.
// R46e OBSERVATION after a headless reshuffle: the same pinned key sets as r44 (top level, rules, hand, unit records),
//      the new hand and charges are visible, no key name contains seed / rng / state / random and no value equals the
//      post-reshuffle hand-stream state (number or string). The hand and battle seeds are 1 here, a legitimate observed
//      value (one charge left), so for them only the key-name check applies.
// Hand ledger: the L1 ledger of _orders.cjs (limit 60). No generated orders or boards; at most one turn per context.
const O = require("./_orders.cjs");
const { PV, S } = O;
const { check, same } = S;

const ID = "r46-orders-reshuffle";
const R = { reshuffle: true };
const RNG_EXPR = "({ handState: handRandom.getState(), handSeed, seed: activeScenarioSeed })";
const CLICK_RESHUFFLE = `reshuffleButton.listeners.filter((l) => l.type === "click").forEach((l) => l.fn())`;
const SEEN = ["id", "team", "type", "row", "col", "direction", "health", "maxHealth", "defeated", "concealed"];

const stream = (g) => g.ev("handRandom.getState()");
const drawn = (g) => g.ev("window.__drawn");
/** Planning state after the pre-turn steps: everything a reshuffle touches, plus the full BattleState. */
const planning = (g) => ({ hand: O.hand(g), queues: O.queues(g), charges: g.ev("reshuffleChargesRemaining"), stream: stream(g),
  targets: O.TG.targets(g), state: g.ev("JSON.stringify(snapshotBattleState())") });

/** LIVE pre-turn steps: a reshuffle order is a click on the real Reshuffle button, the rest go through O.uiOrders. */
function liveSteps(g, orders) {
  return orders.map((order) => {
    if ("reshuffle" in order) {
      const before = g.ev("reshuffleChargesRemaining");
      g.ev(CLICK_RESHUFFLE);
      return `reshuffle: ${g.ev("reshuffleChargesRemaining") === before - 1 ? "spent" : "refused"}`;
    }
    return O.uiOrders(g, [order])[0];
  });
}

/** One equivalence case: pre-turn steps (live clicks vs one door list), then one turn (live Play vs runHeadlessTurn). */
async function equivalence(query, steps, turn, label, track) {
  const live = track(O.boot(query));
  const head = track(O.boot(query));
  const ui = liveSteps(live, steps);
  check(ui.every((line) => !line.endsWith("refused")), `${label}: every live step accepted: ${ui.join("; ")}`);
  const door = O.applyOrders(head, steps);
  same(door.ok, true, `${label}: the door accepted the list`);
  const a = planning(live);
  const b = planning(head);
  same(b, a, `${label}: after the reshuffle: same hand, queues, charges, hand-stream state, targets, BattleState`);
  const liveTurn = await O.playLive(live, turn);
  const headTurn = O.playHeadless(head, turn);
  const summary = O.sameTurn(liveTurn, headTurn, `${label} turn`);
  same(stream(head), stream(live), `${label}: same hand-stream state after the turn`);
  const draw = headTurn.events.find((e) => e.type === "handDraw");
  const spent = turn.filter((o) => "action" in o).length;
  check(draw.drawn.length === spent, `${label}: the turn-end draw refills exactly the ${spent} spent cards`);
  const kept = [...a.hand];
  turn.filter((o) => "action" in o).forEach((o) => kept.splice(kept.indexOf(o.action), 1));
  same(headTurn.observation.hand.cards, [...draw.drawn, ...kept], `${label}: carry-over: drawn cards prepended, unplayed cards kept as the suffix`);
  const { state, ...shown } = a;
  return { steps, liveUi: ui, door, afterReshuffle: { ...shown, stateHash: PV.sha256(state) }, turnOrders: turn, turn: summary,
    carryOver: { drawn: draw.drawn, kept }, streamAfterTurn: stream(head) };
}

/** One refused list: same verdict from validator / door / headless turn (null = skip), nothing changed, nothing drawn. */
function refuse(g, label, orders, expect) {
  const before = { fingerprint: PV.liveFingerprint(g), drawn: drawn(g) };
  const got = {};
  if (expect.validate !== null) got.validate = O.verdictOf(O.validate(g, orders));
  if (expect.apply !== null) got.apply = O.verdictOf(O.applyOrders(g, orders));
  const turn = O.headlessTurn(g, orders);
  got.turn = O.verdictOf(turn);
  same(got, Object.fromEntries(Object.entries(expect).filter(([, v]) => v !== null)), `${label}: verdicts`);
  same({ fingerprint: PV.liveFingerprint(g), drawn: drawn(g) }, before, `${label}: nothing changed (state incl. hand-stream position, DOM, view, debug, flags), no hand drawn`);
  return { case: label, orders, ...got, message: turn.message };
}
const all = (v) => ({ validate: v, apply: v, turn: v });

/** Key walk of one observation against r44's pinned key sets and the RNG values read in the context. */
function keyWalk(obs, rng) {
  const paths = O.keyPaths(obs);
  same(Object.keys(obs), ["schema", "config", "rules", "terrain", "units", "hand", "outcome"], "top-level keys (r44 pin)");
  same(Object.keys(obs.rules), ["preset", "version", "hash", "playerActionBudget", "enemyActionBudget", "handSize", "maxSameAction"], "rules keys (r44 pin)");
  same(Object.keys(obs.hand), ["cards", "reshuffleChargesRemaining"], "hand keys");
  const extra = obs.rules.preset === "commander" ? ["movementMode", "queue", "target", "targetSource"] : ["movementMode", "queue"];
  obs.units.forEach((u) => same(Object.keys(u), u.team === "player" ? [...SEEN, ...extra] : SEEN, `${u.id}: record keys (r44 pin)`));
  const rngKeys = paths.filter((p) => ["seed", "rng", "state", "random"].some((part) => p.key.toLowerCase().includes(part))).map((p) => p.path);
  same(rngKeys, [], "no key name contains seed / rng / state / random");
  // Value check on the hand-stream state (number or string). The hand seed and battle seed are 1 in these boots, a value
  // the observation legitimately holds (e.g. one charge left), so they are covered by the key-name check only.
  const rngValues = [rng.handState, String(rng.handState)];
  const leaves = (v) => (Array.isArray(v) ? v.flatMap(leaves) : v && typeof v === "object" ? Object.values(v).flatMap(leaves) : [v]);
  const hits = leaves(obs).filter((v) => rngValues.includes(v));
  same(hits, [], "no value equals the hand-stream state");
  check(rng.handSeed === 1 && rng.seed === 1, "seeds are 1 (key-name check only, see above)");
  return { keysWalked: paths.length, rngKeyNames: rngKeys, rngValueHits: hits };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };

  // ---- R46a current
  const current = await equivalence(O.CUR, [{ unit: "P1", action: "Attack" }, R],
    [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Defend" }], "R46a current", track);
  same(current.afterReshuffle.hand, ["Move", "Attack", "Defend", "Attack", "Defend"], "R46a: post-reshuffle hand (the turn is written from it)");
  same(current.afterReshuffle.queues, ["P1:", "P2:", "P3:"], "R46a: the queued Attack was discarded with the hand");
  same(current.afterReshuffle.charges, 1, "R46a: one charge spent");

  // ---- R46b commander (+ frozen plan untouched, target order after the reshuffle)
  const commander = await equivalence(O.CMD, [{ unit: "P2", action: "Defend" }, R, { unit: "P1", target: "E2" }],
    [{ unit: "P1", action: "Move" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Attack" }], "R46b commander", track);
  same(commander.afterReshuffle.hand, ["Move", "Attack", "Defend", "Attack", "Defend"], "R46b: post-reshuffle hand (the turn is written from it)");
  same(commander.afterReshuffle.targets, "P1:E2/chosen P2:E3/auto P3:-", "R46b: P2's auto target survives the reshuffle; P1's chosen after it");
  // frozen plan: a fresh commander context, reshuffle through the door, plan unchanged
  const frozen = track(O.boot(O.CMD));
  const frozenBefore = O.J(frozen, "({ plan: getPackQueueData(), frozen: getEnemyPlanState().frozen })");
  same(O.applyOrders(frozen, [R]), { ok: true, queuedTotal: 0 }, "R46b: a reshuffle-only list is accepted by the door");
  check(frozenBefore.frozen === true && frozenBefore.plan.length > 0, "R46b: the enemy plan is frozen and non-empty before the reshuffle");
  same(O.J(frozen, "({ plan: getPackQueueData(), frozen: getEnemyPlanState().frozen })"), frozenBefore, "R46b: the frozen enemy plan is unchanged by a headless reshuffle");

  // ---- R46e observation after the headless reshuffle (commander, frozen context)
  const obs = O.observe(frozen);
  same(obs.hand, { cards: ["Move", "Attack", "Defend", "Attack", "Defend"], reshuffleChargesRemaining: 1 }, "R46e: the new hand and charges are observed");
  const walk = keyWalk(obs, O.J(frozen, RNG_EXPR));
  const none = track(O.boot(`${O.CUR}&preset=current&rules=rc:0`));
  const walkCurrent = keyWalk(O.observe(none), O.J(none, RNG_EXPR));

  // ---- R46c no charges (rc:0)
  const noCharge = [];
  noCharge.push(refuse(none, "rc:0: reshuffle", [R], all("no-reshuffle-charges@0")));
  noCharge.push(refuse(none, "rc:0: card then reshuffle", [{ unit: "P1", action: "Attack" }, R], all("no-reshuffle-charges@1")));
  O.installValidateSpy(none);
  const beforeClick = { fingerprint: PV.liveFingerprint(none), drawn: drawn(none) };
  const click = liveSteps(none, [R]);
  same({ fingerprint: PV.liveFingerprint(none), drawn: drawn(none) }, beforeClick, "R46c: the refused button click changed nothing");
  const uiNoCharge = { click, validations: O.takeValidations(none), buttonDisabled: none.ev("reshuffleButton.disabled"), canReshuffle: none.ev("canReshuffle()") };
  same(uiNoCharge, { click: ["reshuffle: refused"], validations: ['[{"reshuffle":true}] -> no-reshuffle-charges@0'], buttonDisabled: true, canReshuffle: false },
    "R46c: the button validates through the same function, same reason; the button is disabled");

  // ---- R46d atomic mixed lists (current, charges 2)
  const g = track(O.boot());
  const cases = [];
  ["Move", "Attack", "Defend"].forEach((action) => cases.push(refuse(g, `card ${action} after a reshuffle`, [R, { unit: "P2", action }], all("hand-not-observed@1"))));
  same(new Set(cases.map((c) => c.message)).size, 1, "hand-not-observed: one message whatever the card");
  cases.push(refuse(g, "card, reshuffle, card", [{ unit: "P1", action: "Attack" }, R, { unit: "P2", action: "Move" }], all("hand-not-observed@2")));
  cases.push(refuse(g, "three reshuffles with two charges", [R, R, R], all("no-reshuffle-charges@2")));
  cases.push(refuse(g, "card, reshuffle, then a bad unit", [{ unit: "P1", action: "Attack" }, R, { unit: "P9", action: "Move" }], all("unknown-unit@2")));
  cases.push(refuse(g, "reshuffle: false", [{ unit: "P1", action: "Attack" }, { reshuffle: false }], all("malformed-order@1")));
  cases.push(refuse(g, "reshuffle with a unit", [{ reshuffle: true, unit: "P1" }], all("malformed-order@0")));
  cases.push(refuse(g, "reshuffle with an action", [{ reshuffle: true, action: "Move" }], all("malformed-order@0")));
  cases.push(refuse(g, "reshuffle-only turn", [R], { validate: "ok", apply: null, turn: "no-player-orders@-1" }));
  cases.push(refuse(g, "card then reshuffle as a turn (the card is discarded)", [{ unit: "P1", action: "Attack" }, R], { validate: "ok", apply: null, turn: "no-player-orders@-1" }));
  g.ev("isExecutingActionQueue = true");
  cases.push(refuse(g, "turn executing (flag raised)", [R], all("turn-executing@-1")));
  O.installValidateSpy(g);
  const beforeBusyClick = { fingerprint: PV.liveFingerprint(g), drawn: drawn(g) };
  const busyClick = liveSteps(g, [R]);
  same({ fingerprint: PV.liveFingerprint(g), drawn: drawn(g) }, beforeBusyClick, "R46d: the button click while a turn executes changed nothing");
  const uiBusy = { click: busyClick, validations: O.takeValidations(g) };
  same(uiBusy, { click: ["reshuffle: refused"], validations: ['[{"reshuffle":true}] -> turn-executing@-1'] }, "R46d: the busy button click validates through the same function");
  g.ev("isExecutingActionQueue = false; isGuidedTutorialActive = true");
  same(g.ev("canReshuffle()"), true, "R46d: in the tutorial the UI button stays enabled (unchanged)");
  cases.push(refuse(g, "guided tutorial active (door only; the UI button stays usable in the tutorial)", [R], { validate: "ok", apply: "tutorial-active@-1", turn: "tutorial-active@-1" }));
  g.ev("isGuidedTutorialActive = false");
  const handBefore = O.hand(g);
  const accepted = { verdict: O.applyOrders(g, [R, R]), drawnHands: drawn(g), charges: g.ev("reshuffleChargesRemaining"), hand: O.hand(g), handBefore };
  same({ verdict: accepted.verdict, drawnHands: accepted.drawnHands, charges: accepted.charges }, { verdict: { ok: true, queuedTotal: 0 }, drawnHands: 2, charges: 0 },
    "R46d: [reshuffle, reshuffle] accepted: two hands drawn, no charge left");
  cases.push(refuse(g, "no charge left after two", [R], all("no-reshuffle-charges@0")));
  same(g.ev("canReshuffle()"), false, "R46d: the button's state agrees (canReshuffle false)");

  return {
    header: "REQUIREMENT — L3a reshuffle order",
    hands: O.reportOrderHands(ID, ctxs),
    current,
    commander: { ...commander, frozenPlan: { length: frozenBefore.plan.length, unchangedByReshuffle: true } },
    noCharges: { cases: noCharge, ui: uiNoCharge },
    atomic: { cases, uiBusy, accepted },
    observation: { afterHeadlessReshuffle: obs.hand, keyWalk: walk, keyWalkCurrent: walkCurrent },
  };
}
module.exports = { id: ID, run };
