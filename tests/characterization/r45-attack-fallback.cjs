"use strict";
// REQUIREMENT — commander attack fallback (hard assertions; evidence in the golden)
// A wolf with a committed target whose Attack finds that target not adjacent (or defeated) still hits an enemy that IS
// adjacent, chosen by the same selection the wolf uses with no target (getAttackTargetFromSnapshot / getAttackTarget:
// snapshot adjacency, facing tiebreak, no randomness). The hit event carries fallbackFromTargetId. Commander only;
// current is unchanged. Hand-authored boards, enemy plan scripted empty, one turn each (<= 1 turn per context).
// R45a TARGET ADJACENT: P1 (6,6) faces E1 (6,5); E2 (5,6) is also adjacent and is the target: E2 is hit, no fallback field.
// R45b TARGET FAR, ANOTHER ADJACENT: target E2 at (2,9); E1 (6,5) adjacent: E1 is hit, fallbackFromTargetId E2, no miss.
// R45c TARGET DEFEATED EARLIER IN THE TURN, ANOTHER ADJACENT: P1 kills E1 (1 HP) in tick 1; P2 (9,9) queue
//      Defend, Move, Attack with target E1 and E2 adjacent (9,10): Move is skipped (target-defeated, unchanged), the
//      Attack hits E2 with fallbackFromTargetId E1.
// R45d NOBODY ADJACENT: target E2 far, E1 far: a Miss "target-not-adjacent" (target E2), no hit.
// R45e TARGET DEFEATED, NOBODY ADJACENT: as R45c with E2 far: P2's Move AND Attack are skipped (target-defeated).
// R45f PREVIEW = PLAY for every commander board (events, final state); HEADLESS = LIVE for R45b (runHeadlessTurn with
//      includeEvents vs the UI card click + Play: events, state, note, observation).
// R45g CURRENT PRESET UNCHANGED: boards b and c under current: no fallback field, no target events, hits by the
//      current rules (golden = characterization).
const O = require("./_orders.cjs");
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r45-attack-fallback";
const NONE = [];
const BOARDS = {
  a: [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight" }, { row: 5, col: 6, direction: "bottomLeft" }, null],
  b: [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight" }, { row: 2, col: 9, direction: "bottomLeft" }, null],
  c: [{ row: 6, col: 6, direction: "topLeft" }, { row: 9, col: 9, direction: "bottomRight" }, null, { row: 6, col: 5, direction: "bottomRight", health: 1 }, { row: 9, col: 10, direction: "topLeft" }, null],
  d: [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 2, col: 2, direction: "bottomRight" }, { row: 2, col: 9, direction: "bottomLeft" }, null],
  e: [{ row: 6, col: 6, direction: "topLeft" }, { row: 9, col: 9, direction: "bottomRight" }, null, { row: 6, col: 5, direction: "bottomRight", health: 1 }, { row: 2, col: 9, direction: "bottomLeft" }, null],
};
const ORDERS = {
  a: { target: [["P1", "E2"]], queues: { player: ["Attack"] } },
  b: { target: [["P1", "E2"]], queues: { player: ["Attack"] } },
  c: { target: [["P1", "E1"], ["P2", "E1"]], queues: { player: ["Attack"], playerSupport: ["Defend", "Move", "Attack"] } },
  d: { target: [["P1", "E2"]], queues: { player: ["Attack"] } },
  e: { target: [["P1", "E1"], ["P2", "E1"]], queues: { player: ["Attack"], playerSupport: ["Defend", "Move", "Attack"] } },
};

async function playBoard(g, id) {
  TG.board(g, BOARDS[id], NONE);
  ORDERS[id].target.forEach(([wolf, enemy]) => { TG.clickTile(g, wolf); TG.clickTile(g, enemy); });
  Object.entries(ORDERS[id].queues).forEach(([unit, actions]) => PV.L.pushOrders(g, unit, actions));
  const preview = PV.dryRun(g);
  const events = await PV.L.playTurn(g);
  const note = g.ev("lastBattleDebugReport");
  const health = S.J(g, "({ E1: enemy.health, E2: enemySupport.health })");
  check(preview.ok, `${id}: preview ran`);
  same(preview.result.events, events, `${id}: preview events = played events`);
  same(preview.result.finalState, PV.snapshot(g), `${id}: preview final state = played final state`);
  return { events, note, health, noteTicks: TG.noteLines(note, /^Tick \d:/) };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const hits = (r) => C.ofType(r.events, "hit");

  // Each board gets its own fresh commander context (one turn per context).
  const R = {};
  for (const id of ["a", "b", "c", "d", "e"]) R[id] = await playBoard(track(C.bootCommander("eab:0")), id);

  // R45a
  same(hits(R.a), [{ type: "hit", tick: 1, attacker: "P1", target: "E2", damage: 3, defended: false }], "R45a: target E2 hit, no fallback field");
  same(R.a.health, { E1: 10, E2: 7 }, "R45a: E1 untouched");
  // R45b
  same(hits(R.b), [{ type: "hit", tick: 1, attacker: "P1", target: "E1", damage: 3, defended: false, fallbackFromTargetId: "E2" }], "R45b: adjacent E1 hit, marked fallback from E2");
  check(C.ofType(R.b.events, "miss").length === 0, "R45b: no miss");
  same(R.b.health, { E1: 7, E2: 10 }, "R45b: health");
  // R45c
  same(C.ofType(R.c.events, "targetSkipped"), [{ type: "targetSkipped", tick: 2, unit: "P2", action: "Move", target: "E1", reason: "target-defeated" }], "R45c: only P2's Move is skipped");
  same(hits(R.c).filter((h) => h.attacker === "P2"), [{ type: "hit", tick: 3, attacker: "P2", target: "E2", damage: 3, defended: false, fallbackFromTargetId: "E1" }], "R45c: P2's Attack falls back to E2");
  check(!C.ofType(R.c.events, "move").some((e) => e.unit === "P2"), "R45c: no move event for P2");
  // R45d
  same(C.one(R.d.events, "miss"), { type: "miss", tick: 1, attacker: "P1", reason: "target-not-adjacent", target: "E2" }, "R45d: Miss target-not-adjacent");
  check(hits(R.d).length === 0, "R45d: no hit");
  same(R.d.health, { E1: 10, E2: 10 }, "R45d: nobody hurt");
  // R45e
  same(C.ofType(R.e.events, "targetSkipped").map((e) => `${e.tick}:${e.unit}:${e.action}`), ["2:P2:Move", "3:P2:Attack"], "R45e: Move and Attack skipped (target-defeated)");
  check(!hits(R.e).some((h) => h.attacker === "P2") && !C.ofType(R.e.events, "miss").some((m) => m.attacker === "P2"), "R45e: P2 neither hits nor misses");

  // R45f headless = live (board b: P1 -> E2 chosen, one Attack from the boot hand)
  const orders = [{ unit: "P1", target: "E2" }, { unit: "P1", action: "Attack" }];
  const live = track(O.boot(O.CMD));
  const head = track(O.boot(O.CMD));
  [live, head].forEach((g) => TG.board(g, BOARDS.b, NONE));
  const liveTurn = await O.playLive(live, orders);
  const headTurn = O.playHeadless(head, orders);
  const headlessSummary = O.sameTurn(liveTurn, headTurn, "R45f headless vs live");
  same(C.ofType(headTurn.events, "hit"), [{ type: "hit", tick: 1, attacker: "P1", target: "E1", damage: 3, defended: false, fallbackFromTargetId: "E2" }], "R45f: the headless turn takes the fallback hit");

  // R45g current unchanged
  const cur = {};
  for (const id of ["b", "c"]) {
    const g = track(C.bootCurrent());
    TG.board(g, BOARDS[id], NONE);
    PV.L.pushOrders(g, "player", ["Attack"]);
    if (id === "c") PV.L.pushOrders(g, "playerSupport", ["Defend", "Move", "Attack"]);
    const events = await PV.L.playTurn(g);
    check(events.every((e) => !TG.TARGET_EVENT_TYPES.includes(e.type) && !("fallbackFromTargetId" in e)), `current ${id}: no target events, no fallback field`);
    cur[id] = { summary: TG.turnSummary(events) };
  }

  return {
    header: "REQUIREMENT — commander attack fallback",
    hands: TG.reportTargetHands(ID, ctxs),
    boards: Object.fromEntries(Object.entries(R).map(([id, r]) => [id, { summary: TG.turnSummary(r.events), noteTicks: r.noteTicks, health: r.health }])),
    headlessEqualsLive: headlessSummary,
    current: cur,
  };
}
module.exports = { id: ID, run };
