"use strict";
// REQUIREMENT — target selection (hard assertions; evidence in the golden)
// Hand-authored boards, enemy budget 0 (the pack passes), P1 alone with one Attack (queued directly), target chosen
// through the tile handler.
// R35a ADJACENT TO A NON-TARGET ONLY: P1 at 6,6 facing E1 (6,5, adjacent); the chosen target E2 is far (2,9). Commander:
//      the Attack is consumed, the swing names E2, it is a Miss with reason "target-not-adjacent" (the existing Miss
//      event, so the existing Miss popup replays), nobody takes damage (no fallback to E1); note
//      "miss: E2 not adjacent". Current control (characterization): the same Attack hits the adjacent E1.
// R35b ADJACENT TO BOTH: E1 at 6,5 (the one P1 faces) and E2 at 5,6, target E2. Commander: only E2 is hit (once,
//      3 damage), E1 untouched; note "hit E2 ...". Current control (characterization): the facing rule hits E1.
// R35c DRY RUN = PLAY for both commander turns (events and final state).
const TG = require("./_targets.cjs");
const { C, PV, S } = TG;
const { check, same } = S;

const ID = "r35-target-attack";
const BOARDS = {
  nonTargetOnly: [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight" }, { row: 2, col: 9, direction: "bottomLeft" }, null],
  both: [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight" }, { row: 5, col: 6, direction: "bottomLeft" }, null],
};

async function attackTurn(g, boardId) {
  TG.board(g, BOARDS[boardId]);
  TG.clickTile(g, "P1");
  TG.clickTile(g, "E2");
  PV.L.pushOrders(g, "player", ["Attack"]);
  const preview = PV.dryRun(g);
  const events = await PV.L.playTurn(g);
  const note = g.ev("lastBattleDebugReport");
  const line = TG.noteLines(note, /^Tick 1:/)[0].replace(/^Tick 1: /, "").split(" | ").find((l) => l.startsWith("P1 "));
  const health = S.J(g, "({ E1: enemy.health, E2: enemySupport.health })");
  return { preview, events, line, health, finalState: PV.snapshot(g) };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const g = track(C.bootCommander("eab:0"));
  const cur = track(C.bootCurrent("eab:0"));

  // ---- R35a
  const a = await attackTurn(g, "nonTargetOnly");
  check(C.ofType(a.events, "consumed")[0].actions.some((x) => x.unit === "P1" && x.action === "Attack"), "commander: the Attack is consumed");
  same(C.one(a.events, "attackSwing").target, "E2", "commander: the swing names the committed target E2");
  same(C.one(a.events, "miss"), { type: "miss", tick: 1, attacker: "P1", reason: "target-not-adjacent", target: "E2" }, "commander: Miss target-not-adjacent");
  check(C.ofType(a.events, "hit").length === 0 && C.ofType(a.events, "damage").length === 0, "commander: no hit, no damage (no fallback to the adjacent E1)");
  same(a.health, { E1: 10, E2: 10 }, "commander: nobody hurt");
  check(a.line === "P1 lead wolf Attack 6,6 -> 6,6 miss: E2 not adjacent", `commander: note line (${a.line})`);
  const ac = await attackTurn(cur, "nonTargetOnly");
  same(C.one(ac.events, "hit"), { type: "hit", tick: 1, attacker: "P1", target: "E1", damage: 3, defended: false }, "current (characterization): the Attack hits the adjacent E1");
  check(C.ofType(ac.events, "miss").length === 0 && ac.events.every((e) => !TG.TARGET_EVENT_TYPES.includes(e.type)), "current: no miss, no target events");

  // ---- R35b
  const b = await attackTurn(g, "both");
  same(C.ofType(b.events, "hit"), [{ type: "hit", tick: 1, attacker: "P1", target: "E2", damage: 3, defended: false }], "commander: only the committed target E2 is hit");
  same(b.health, { E1: 10, E2: 7 }, "commander: E1 untouched, E2 -3");
  check(C.ofType(b.events, "miss").length === 0, "commander: no miss");
  check(b.line.startsWith("P1 lead wolf Attack 6,6 -> 6,6 hit E2 "), `commander: note line (${b.line})`);
  const bc = await attackTurn(cur, "both");
  same(C.ofType(bc.events, "hit").map((h) => h.target), ["E1"], "current (characterization): the facing rule hits E1");

  // ---- R35c dry run = play
  [["nonTargetOnly", a], ["both", b]].forEach(([id, r]) => {
    check(r.preview.ok, `${id}: preview ran`);
    same(r.preview.result.events, r.events, `${id}: preview events = played events`);
    same(r.preview.result.finalState, r.finalState, `${id}: preview final state = played final state`);
  });

  return {
    header: TG.REQ_HEADER_TARGETS,
    hands: TG.reportTargetHands(ID, ctxs),
    nonTargetOnly: { commander: { summary: TG.turnSummary(a.events), noteLine: a.line, health: a.health }, current: { summary: TG.turnSummary(ac.events), noteLine: ac.line } },
    adjacentToBoth: { commander: { summary: TG.turnSummary(b.events), noteLine: b.line, health: b.health }, current: { summary: TG.turnSummary(bc.events), noteLine: bc.line } },
  };
}
module.exports = { id: ID, run };
