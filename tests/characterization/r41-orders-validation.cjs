"use strict";
// REQUIREMENT — L1 player orders: validation and atomic refusal (hard assertions; evidence in the golden)
// R41a EVERY REASON. Hand-authored order lists, one per refusal reason of validatePlayerOrders and of the headless door
//      (applyPlayerOrders / runHeadlessTurn): malformed list / order, unknown unit (enemy id, unknown id), defeated wolf,
//      unknown action, card not in the hand, max-same-action (cap 1), the shared pack budget (default 5 with an empty
//      hand; budget 3 with the card still in the hand), invalid target (a wolf, an unknown id, a non-string), defeated
//      target, target outside commander, turn executing, driver busy, tutorial, no player orders, battle over.
// R41b ATOMIC. Each refused list (including a list whose LAST order fails after four valid ones: two cards and two
//      targets) is refused with the same reason and index by the validator, the door and the headless turn, and the
//      live fingerprint (_preview: state incl. hand, queues, targets, RNG position; DOM; view; debug log; flags) is
//      unchanged afterwards.
// R41c SHARED WITH THE UI. A spy on validatePlayerOrders shows the UI paths (applyPlayerAction for a card click,
//      handleEnemyTargetIntent for an enemy click) validating their one order through the same function and getting the
//      same reason as the headless list for the same order (card-not-in-hand, max-same-action, action-budget,
//      target-defeated, turn-executing); a refused click changes neither the hand nor the queues. Known difference: a
//      defeated wolf cannot be selected in the UI, so its click is validated with no unit (unknown-unit) where the
//      headless order names it (unit-defeated); both refuse.
// R41d ACCEPTED. A valid mixed list (target + card) is applied by the door through the UI's data paths: first-match card
//      taken, queue, target "chosen"; { target: null } clears; the hand VIEW is left as it was (documented: like
//      drainTurnCore, the door renders nothing).
const O = require("./_orders.cjs");
const { PV, S } = O;
const { check, same } = S;

const ID = "r41-orders-validation";

/** One refused list: same verdict from validate / apply / headless turn (expect.validate / apply / turn; null = skip),
 *  and the live fingerprint unchanged. */
function refuse(g, label, orders, expect) {
  const before = PV.liveFingerprint(g);
  const got = {};
  if (expect.validate !== null) got.validate = O.verdictOf(O.validate(g, orders));
  if (expect.apply !== null) got.apply = O.verdictOf(O.applyOrders(g, orders));
  const turn = O.headlessTurn(g, orders);
  got.turn = O.verdictOf(turn);
  const want = Object.fromEntries(Object.entries(expect).filter(([, v]) => v !== null));
  same(got, want, `${label}: verdicts`);
  same(PV.liveFingerprint(g), before, `${label}: nothing changed (state, DOM, view, debug, flags)`);
  return { case: label, orders, ...got, message: turn.message };
}
const all = (v) => ({ validate: v, apply: v, turn: v });

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const cases = [];

  // ---- commander, default numbers: hand [Attack, Move, Attack, Defend, Defend]
  const g = track(O.boot(O.CMD));
  same(O.hand(g), ["Attack", "Move", "Attack", "Defend", "Defend"], "commander boot hand");
  cases.push(refuse(g, "not a list", { unit: "P1", action: "Move" }, all("malformed-orders@-1")));
  cases.push(refuse(g, "order without action or target", [{ unit: "P1" }], all("malformed-order@0")));
  cases.push(refuse(g, "order with action AND target", [{ unit: "P1", action: "Move", target: "E1" }], all("malformed-order@0")));
  cases.push(refuse(g, "null order", [null], all("malformed-order@0")));
  cases.push(refuse(g, "enemy id as unit", [{ unit: "E1", action: "Move" }], all("unknown-unit@0")));
  cases.push(refuse(g, "unknown unit id", [{ unit: "P4", action: "Move" }], all("unknown-unit@0")));
  cases.push(refuse(g, "unknown action", [{ unit: "P1", action: "Jump" }], all("unknown-action@0")));
  cases.push(refuse(g, "second Move: one Move card in the hand", [{ unit: "P1", action: "Move" }, { unit: "P2", action: "Move" }], all("card-not-in-hand@1")));
  cases.push(refuse(g, "sixth card: budget 5 full (hand also empty)", [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Defend" },
    { unit: "P1", action: "Defend" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Move" }], all("action-budget@5")));
  cases.push(refuse(g, "target a player wolf", [{ unit: "P1", target: "P2" }], all("invalid-target@0")));
  cases.push(refuse(g, "target an unknown id", [{ unit: "P1", target: "E7" }], all("invalid-target@0")));
  cases.push(refuse(g, "target not a string", [{ unit: "P1", target: 3 }], all("invalid-target@0")));
  cases.push(refuse(g, "valid prefix (2 targets, 2 cards), last order fails", [{ unit: "P1", target: "E2" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" },
    { unit: "P3", target: "E3" }, { unit: "P3", action: "Move" }], all("card-not-in-hand@4")));
  check(O.J(g, "[player.targetId ?? null, playerFlank.targetId ?? null]").every((t) => t === null), "atomic: no target of the valid prefix was set");
  cases.push(refuse(g, "empty list: Play would not start", [], { validate: "ok", apply: "ok", turn: "no-player-orders@-1" }));
  cases.push(refuse(g, "target only: Play would not start", [{ unit: "P1", target: "E2" }], { validate: "ok", apply: null, turn: "no-player-orders@-1" }));
  g.ev("isExecutingActionQueue = true");
  cases.push(refuse(g, "turn executing (flag raised)", [{ unit: "P1", action: "Move" }], all("turn-executing@-1")));
  g.ev("isExecutingActionQueue = false; turnDriverDepth = 1");
  cases.push(refuse(g, "turn driver busy (flag raised)", [{ unit: "P1", action: "Move" }], { validate: "ok", apply: "turn-driver-running@-1", turn: "turn-driver-running@-1" }));
  g.ev("turnDriverDepth = 0; isGuidedTutorialActive = true");
  cases.push(refuse(g, "guided tutorial active (flag raised)", [{ unit: "P1", action: "Move" }], { validate: "ok", apply: "tutorial-active@-1", turn: "tutorial-active@-1" }));
  g.ev("isGuidedTutorialActive = false");

  // ---- current, cap 1, hand size 3: hand [Attack, Move, Defend]
  const cap = track(O.boot(`${O.CUR}&preset=current&rules=hs:3,cap:1`));
  same(O.hand(cap), ["Attack", "Move", "Defend"], "cap-1 boot hand");
  cases.push(refuse(cap, "second Move with cap 1", [{ unit: "P1", action: "Move" }, { unit: "P2", action: "Move" }], all("max-same-action@1")));
  cases.push(refuse(cap, "target under current", [{ unit: "P1", target: "E1" }], all("target-selection-inactive@0")));

  // ---- current, budget 3: the fourth card is refused although it is in the hand
  const pab = track(O.boot(`${O.CUR}&preset=current&rules=pab:3`));
  cases.push(refuse(pab, "fourth card with budget 3 (Defend still in the hand)", [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Attack" },
    { unit: "P1", action: "Defend" }], all("action-budget@3")));

  // ---- commander, P3 and E2 defeated (set directly), then every enemy defeated
  const dead = track(O.boot(O.CMD));
  dead.ev("playerFlank.health = 0; playerFlank.isDefeated = true; enemySupport.health = 0; enemySupport.isDefeated = true;");
  cases.push(refuse(dead, "defeated wolf", [{ unit: "P3", action: "Move" }], all("unit-defeated@0")));
  cases.push(refuse(dead, "defeated target", [{ unit: "P1", target: "E2" }], all("target-defeated@0")));

  // ---- R41c: the UI paths validate through the same function (spy), same reasons, refusals change nothing
  const ui = {};
  [g, cap, pab, dead].forEach(O.installValidateSpy);
  const refusedClickKeepsState = (ctx, label, fn) => {
    const before = [O.hand(ctx), O.queues(ctx)];
    fn();
    same([O.hand(ctx), O.queues(ctx)], before, `${label}: the refused click changed neither hand nor queues`);
  };
  ui.cardNotInHand = O.uiOrders(g, [{ unit: "P1", action: "Move" }]);
  refusedClickKeepsState(g, "card-not-in-hand", () => ui.cardNotInHand.push(...O.uiOrders(g, [{ unit: "P2", action: "Move" }])));
  ui.cardNotInHandValidations = O.takeValidations(g);
  same(ui.cardNotInHandValidations, ['[{"unit":"P1","action":"Move"}] -> ok', '[{"unit":"P2","action":"Move"}] -> card-not-in-hand@0'], "UI card clicks: same validation, card-not-in-hand");

  ui.maxSameAction = O.uiOrders(cap, [{ unit: "P1", action: "Move" }]);
  refusedClickKeepsState(cap, "max-same-action", () => ui.maxSameAction.push(...O.uiOrders(cap, [{ unit: "P2", action: "Move" }])));
  same(O.takeValidations(cap).slice(-1), ['[{"unit":"P2","action":"Move"}] -> max-same-action@0'], "UI card click: max-same-action");

  ui.actionBudget = O.uiOrders(pab, [{ unit: "P1", action: "Attack" }, { unit: "P2", action: "Move" }, { unit: "P3", action: "Attack" }]);
  refusedClickKeepsState(pab, "action-budget", () => ui.actionBudget.push(...O.uiOrders(pab, [{ unit: "P1", action: "Defend" }])));
  same(O.takeValidations(pab).slice(-1), ['[{"unit":"P1","action":"Defend"}] -> action-budget@0'], "UI card click: action-budget");
  check(O.hand(pab).includes("Defend"), "budget refusal with the Defend card still in the hand");

  refusedClickKeepsState(dead, "target-defeated", () => { dead.ev("setPlayerSelected(player)"); O.TG.clickTile(dead, "E2"); });
  ui.targetDefeated = { validations: O.takeValidations(dead), status: O.TG.status(dead) };
  same(ui.targetDefeated.validations, ['[{"unit":"P1","target":"E2"}] -> target-defeated@0'], "UI enemy click: target-defeated");
  check(ui.targetDefeated.status.endsWith("E2 is defeated: pick a living enemy"), "UI: the defeated-target status line is unchanged");
  refusedClickKeepsState(dead, "defeated wolf", () => { dead.ev("setPlayerSelected(playerFlank); applyPlayerAction('Move')"); });
  ui.defeatedWolf = { selected: O.TG.selected(dead), validations: O.takeValidations(dead) };
  same(ui.defeatedWolf, { selected: null, validations: ['[{"unit":null,"action":"Move"}] -> unknown-unit@0'] }, "UI: a defeated wolf cannot be selected (no unit: unknown-unit)");

  g.ev("isExecutingActionQueue = true");
  refusedClickKeepsState(g, "turn-executing", () => { g.ev("setPlayerSelected(player); applyPlayerAction('Attack')"); O.TG.clickTile(g, "E1"); });
  ui.turnExecuting = { validations: O.takeValidations(g), status: O.TG.status(g) };
  g.ev("isExecutingActionQueue = false");
  same(ui.turnExecuting.validations, ['[{"unit":"P1","action":"Attack"}] -> turn-executing@-1', '[{"unit":"P1","target":"E1"}] -> turn-executing@-1'], "UI card and enemy clicks while executing: turn-executing");
  check(ui.turnExecuting.status.endsWith("targets are locked while the turn plays"), "UI: the locked status line is unchanged");

  dead.ev("enemy.health = 0; enemy.isDefeated = true; enemyFlank.health = 0; enemyFlank.isDefeated = true;");
  cases.push(refuse(dead, "battle over (every enemy defeated)", [{ unit: "P1", action: "Move" }], { validate: "ok", apply: "battle-over@-1", turn: "battle-over@-1" }));

  // ---- R41d accepted list through the door (fresh commander context; the view is not rendered by the door)
  const ok = track(O.boot(O.CMD));
  const viewBefore = O.J(ok, "__p1e.view().handView");
  const accepted = O.applyOrders(ok, [{ unit: "P1", target: "E2" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Defend" }]);
  same(accepted, { ok: true, queuedTotal: 2 }, "a valid list is accepted");
  const afterAccept = { hand: O.hand(ok), queues: O.queues(ok), targets: O.TG.targets(ok), handView: O.J(ok, "__p1e.view().handView") };
  same(afterAccept.hand, ["Move", "Attack", "Defend"], "first-match cards taken (Attack #1, Defend #1)");
  same(afterAccept.targets, "P1:E2/chosen P2:E3/auto P3:-", "P1 chosen E2 kept; P2's first queue auto-picked (UI rule)");
  same(afterAccept.handView, viewBefore, "the door renders nothing: the hand view still shows the old hand");
  same(O.applyOrders(ok, [{ unit: "P1", target: null }]), { ok: true, queuedTotal: 2 }, "a clear-target order is accepted");
  afterAccept.afterClear = O.TG.targets(ok);
  same(afterAccept.afterClear, "P1:- P2:E3/auto P3:-", "{ target: null } clears P1's target");

  return {
    header: "REQUIREMENT — L1 player orders: validation and atomic refusal",
    hands: O.reportOrderHands(ID, ctxs),
    cases,
    ui,
    accepted: { verdict: accepted, ...afterAccept, handViewBefore: viewBefore },
  };
}
module.exports = { id: ID, run };
