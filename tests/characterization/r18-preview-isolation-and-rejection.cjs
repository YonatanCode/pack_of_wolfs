"use strict";
// REQUIREMENT — P1e acceptance
// R18: previews are isolated from the hand-view compatibility shim, and refused while anything is in flight.
// (a) SHIM ISOLATION. Plain board, cards queued, then a simulated external DOM edit of the hand (the list is
//     replaced by five new <li> elements, so the view diverges from the 2-card DATA hand). During the dry run
//     actionsList.children is a THROWING getter: the preview never reads the DOM hand. It draws from the DATA
//     (3 cards drawn, not the 0 an adopted 5-card hand would draw), and afterwards the hand data, the DOM list
//     (element identity) and playerHandViewItems are unchanged and the edit is still pending. While a swap is
//     active every shim entry point throws (adoptExternalPlayerHandEdits, preparePlayerHandForEdit,
//     getAvailableActionCount, getAvailableActionTotal, refillAvailableActions) and adopts nothing. Afterwards
//     the shim behaves exactly as in a never-previewed control (same adoption, same played turn).
// (b) REJECTION. dryRunTurn is called from call-through hooks while a real Play turn is in flight:
//     between ticks (executeActionTick), mid-replay of a move (moveUnitToTile), mid-tick swing replay
//     (playUnitAnimationCycles), the turn-end hand replay (refillAvailableActions) and inside the core
//     (applyTurnEndRecoveryRules); outside a turn while a wolf is mid-move; inside another swap (dryRunTurn,
//     loadBattleState, withBattleState); and with each guard flag raised synthetically; plus a turn with no
//     player orders. Each attempt throws DryRunRejected with the expected reason and leaves the live
//     fingerprint (state + DOM + view + debug + flags) unchanged, and the in-flight turn / move completes
//     identically to a control context that never attempted a preview.
const P = require("./_preview.cjs");

const ID = "r18-preview-isolation-and-rejection";

const SHIM_EDIT = `actionsList.replaceChildren(...["Attack", "Attack", "Attack", "Defend", "Defend"].map((a) => createAvailableActionItem(a)))`;
const SHIM_CALLS = ["adoptExternalPlayerHandEdits()", "preparePlayerHandForEdit()", "getAvailableActionCount('Move')", "getAvailableActionTotal()", "refillAvailableActions()"];

function shimSide(withPreview) {
  const g = P.boot();
  const orders = P.BOARDS.plain.setup(g);
  g.ev(SHIM_EDIT);
  const res = { orders };
  if (withPreview) {
    const before = P.liveFingerprint(g);
    g.ev(`globalThis.__kids = actionsList.children; globalThis.__domReads = 0;
      Object.defineProperty(actionsList, "children", { configurable: true, enumerable: true,
        get() { __domReads += 1; throw new Error("DOM hand read during a dry run"); } });`);
    let r;
    try {
      r = P.dryRun(g);
    } finally {
      g.ev(`Object.defineProperty(actionsList, "children", { value: __kids, writable: true, enumerable: true, configurable: true });`);
    }
    P.L.check(r.ok, `preview with a diverged DOM hand ran: ${JSON.stringify(r.error)}`);
    P.L.check(g.ev("__domReads") === 0, "the preview never read the DOM hand");
    const draw = r.result.events.find((e) => e.type === "handDraw");
    P.L.same(P.liveFingerprint(g), before, "preview left hand data, DOM list and view items unchanged");
    P.L.check(g.ev("isPlayerHandViewExternallyEdited()") === true, "the DOM edit is still pending (not adopted)");
    const guarded = JSON.parse(g.ev(`JSON.stringify(withBattleState(snapshotBattleState(), () => ${JSON.stringify(SHIM_CALLS)}.map((c) => {
      try { (0, eval)(c); return c + " -> NO THROW"; } catch (e) { return c + " -> " + e.message; } })))`));
    guarded.forEach((line) => P.L.check(/Presentation call during a battle-state swap: adoptExternalPlayerHandEdits$/.test(line), `shim disabled during a swap: ${line}`));
    P.L.same(P.liveFingerprint(g), before, "the guarded shim calls adopted nothing");
    res.preview = { dataHandUsed: before.handData, drawn: draw.drawn, handAfterDraw: draw.hand, domReads: 0 };
    res.shimDuringSwap = guarded;
  }
  res.adoptedTotal = g.ev("getAvailableActionTotal()");
  res.after = P.liveFingerprint(g);
  return { g, res };
}

async function shimIsolation() {
  const a = shimSide(true);
  const b = shimSide(false);
  P.L.same(a.res.after, b.res.after, "after the preview the shim adopts the edit exactly like a never-previewed control");
  P.L.check(a.res.preview.drawn.length === 5 - a.res.preview.dataHandUsed.length, "the preview drew to size from the DATA hand");
  const ea = await P.L.playTurn(a.g);
  const eb = await P.L.playTurn(b.g);
  P.L.same(ea, eb, "the played turn after the preview equals the control's");
  P.L.same(P.snapshot(a.g), P.snapshot(b.g), "final state equals the control's");
  return {
    orders: a.res.orders,
    domEditShows: ["Attack", "Attack", "Attack", "Defend", "Defend"],
    preview: a.res.preview,
    shimDuringSwap: a.res.shimDuringSwap,
    adoptedTotalAfterPreview: a.res.adoptedTotal,
    adoptedTotalControl: b.res.adoptedTotal,
    playedTurnEqualsControl: true,
  };
}

// ---- (b) rejection --------------------------------------------------------------------------------------
function attempt(g, call = "dryRunTurn()") {
  const before = P.liveFingerprint(g);
  const r = JSON.parse(g.ev(`JSON.stringify((function () { try { ${call}; return { thrown: false }; }
    catch (e) { return { thrown: true, name: e.name, reason: e.reason ?? null, message: e.message }; } })())`));
  P.L.same(P.liveFingerprint(g), before, `rejected ${call} changed nothing`);
  return r;
}

const HOOKS = [
  { name: "executeActionTick", expect: "turn-executing", where: "between ticks of a Play turn" },
  { name: "moveUnitToTile", expect: "turn-driver-running", where: "mid-replay of a core move" },
  { name: "playUnitAnimationCycles", expect: "turn-driver-running", where: "mid-tick swing replay" },
  { name: "refillAvailableActions", expect: "turn-driver-running", where: "turn-end hand replay (isExecutingActionQueue already false)" },
  { name: "applyTurnEndRecoveryRules", expect: "turn-core-running", where: "inside the turn core" },
];

async function inFlightSide(withHooks) {
  const g = P.boot();
  P.BOARDS.lethal.setup(g);
  const seen = {};
  if (withHooks) {
    HOOKS.forEach((h) => {
      const orig = g.ctx[h.name];
      g.ctx[h.name] = function (...args) {
        if (!seen[h.name]) {
          const r = attempt(g);
          seen[h.name] = { where: h.where, thrown: r.thrown, name: r.name, reason: r.reason, flags: P.evJ(g, "__p1e.flags()") };
        }
        return orig.apply(this, args);
      };
    });
  }
  const events = await P.L.playTurn(g);
  return { seen, events, state: P.snapshot(g), view: P.evJ(g, "__p1e.view()"), note: g.ev("lastBattleDebugReport"), usage: g.usage() };
}

async function inFlightRejection() {
  const a = await inFlightSide(true);
  const b = await inFlightSide(false);
  HOOKS.forEach((h) => {
    const s = a.seen[h.name];
    P.L.check(s, `hook ${h.name} was reached`);
    P.L.check(s.thrown && s.name === "DryRunRejected" && s.reason === h.expect, `${h.name}: rejected with ${h.expect} (got ${s.name}/${s.reason})`);
  });
  ["events", "state", "view", "note", "usage"].forEach((k) => P.L.same(a[k], b[k], `in-flight turn with rejected previews: ${k} equals the control`));
  return Object.fromEntries(HOOKS.map((h) => {
    const s = a.seen[h.name];
    return [h.name, `${s.where}: ${s.name} reason=${s.reason} (executing=${s.flags.isExecutingActionQueue} driverDepth=${s.flags.turnDriverDepth} pendingMoves=${s.flags.pendingMoveReplays})`];
  }));
}

async function movingSide(tryPreview) {
  const g = P.boot();
  P.BOARDS.plain.setup(g);
  g.ev("globalThis.__mv = movePlayerToTile(9, 5);");
  let r = null;
  if (tryPreview) {
    P.L.check(g.ev("hasMovingPlayerUnits()") === true, "a wolf is mid-move");
    r = attempt(g);
  }
  await g.runLimited(() => g.ev("__mv"));
  return { r, after: P.liveFingerprint(g), usage: g.usage() };
}

async function movingRejection() {
  const a = await movingSide(true);
  const b = await movingSide(false);
  P.L.check(a.r.thrown && a.r.reason === "units-moving", `mid-move preview rejected: ${JSON.stringify(a.r)}`);
  P.L.same([a.after, a.usage], [b.after, b.usage], "the move completed exactly like the control's");
  return `${a.r.name} reason=${a.r.reason}; move completed identically to the control`;
}

function syntheticRejections() {
  const g = P.boot();
  P.BOARDS.plain.setup(g);
  const out = {};
  const cases = [
    ["inside withBattleState: dryRunTurn()", "withBattleState(snapshotBattleState(), () => dryRunTurn())", "swap-active"],
    ["inside withBattleState: loadBattleState(...)", "withBattleState(snapshotBattleState(), () => loadBattleState(snapshotBattleState()))", "swap-active"],
    ["inside withBattleState: withBattleState(...)", "withBattleState(snapshotBattleState(), () => withBattleState(snapshotBattleState(), () => 1))", "swap-active"],
    ["turnCoreDepth raised", "turnCoreDepth += 1; try { dryRunTurn(); } finally { turnCoreDepth -= 1; }", "turn-core-running"],
    ["turnDriverDepth raised", "turnDriverDepth += 1; try { dryRunTurn(); } finally { turnDriverDepth -= 1; }", "turn-driver-running"],
    ["isExecutingActionQueue set", "isExecutingActionQueue = true; try { dryRunTurn(); } finally { isExecutingActionQueue = false; }", "turn-executing"],
    ["pendingMoveReplays entry", "pendingMoveReplays.set(player, { to: { row: 0, col: 0 }, moved: true }); try { dryRunTurn(); } finally { pendingMoveReplays.delete(player); }", "move-replay-pending"],
    ["loadBattleState while executing", "isExecutingActionQueue = true; try { loadBattleState(snapshotBattleState()); } finally { isExecutingActionQueue = false; }", "turn-executing"],
  ];
  cases.forEach(([label, call, expect]) => {
    const r = attempt(g, call);
    P.L.check(r.thrown && r.name === "DryRunRejected" && r.reason === expect, `${label}: expected ${expect}, got ${JSON.stringify(r)}`);
    out[label] = `${r.name} reason=${r.reason}`;
  });
  // No orders: Play would not start a turn, so neither does a preview. options.queues supplies orders to the COPY only.
  const n = P.boot();
  const r = attempt(n);
  P.L.check(r.thrown && r.reason === "no-player-orders", `no orders: ${JSON.stringify(r)}`);
  out["no queued player orders"] = `${r.name} reason=${r.reason}`;
  const before = P.liveFingerprint(n);
  const q = P.dryRun(n, { queues: { P1: ["Move"], P3: ["Defend"] } });
  P.L.check(q.ok, "options.queues gives the copy orders");
  P.L.same(P.liveFingerprint(n), before, "options.queues changed nothing live");
  const consumed = q.result.events.find((e) => e.type === "consumed");
  out["options.queues on the copy only"] = `consumed tick 1: ${consumed.actions.map((x) => `${x.unit}:${x.action}`).join(" ")}; live queues untouched`;
  return out;
}

async function run() {
  return {
    header: P.REQ_HEADER,
    shimIsolation: await shimIsolation(),
    rejection: {
      inFlightPlayTurn: await inFlightRejection(),
      midMove: await movingRejection(),
      synthetic: syntheticRejections(),
    },
  };
}
module.exports = { id: ID, run };
