"use strict";
// REQUIREMENT — L3 turn accounting (scripted bot only; one hand-placed board; hand-written event lists)
// The driver counts planned (orders), executed / attacksHit / attacksMissed (event log) and wasted (skips + actions cleared
// by a death + actions still queued after the turn) INDEPENDENTLY. When they do not balance, nothing is forced:
// notExecuted is clamped at 0 and perTurn.accountingNote names the imbalance; the report counts such turns in a note.
// D5a ENGINE, CARRIED-OVER CARD: the loader hand-places P1 (6,6) next to E1 (6,5, 10 HP) and queues one Defend for P1
//     through the dev door before the battle starts (a card queued outside the bot's orders, as a UI click would leave
//     it). The scripted bot plans [Attack] (it sees P1.queue ["Defend"]). Both resolve: planned 1, executed 2,
//     notExecuted 0 (clamped from -1), accountingNote "unplanned-actions-resolved: 1". replayBattle reproduces it.
// D5b HELPER (accountTurn) on hand-written event lists: balanced; miss + target skip + death-cleared + unplayed (balanced,
//     wasted 3 from independent counts); a planned action that appears nowhere ("planned-actions-unaccounted: 1"); a hit
//     event without an Attack ("hits-without-attack: 1", not counted as attacksHit); an action with no order
//     ("unplanned-actions-resolved: 1"); enemy counts.
// D5c REPORT: buildReport over the D5a record carries "accounting: 1 turn(s) ..." (fixed text).
const S = require("../characterization/_settings.cjs");
const TG = require("../characterization/_targets.cjs");
const { runBattle, replayBattle, diffRecords, accountTurn } = require("../../tools/lab/driver.cjs");
const { buildReport } = require("../../tools/lab/report.cjs");

const ID = "d5-accounting";
function check(cond, msg) { if (!cond) throw new Error(`d5 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const BOARD = [{ row: 6, col: 6, direction: "topLeft" }, null, null, { row: 6, col: 5, direction: "bottomRight", health: 10 }, null, null];
const contexts = [];
const load = (opts) => {
  const g = S.boot(opts.query);
  contexts.push(g);
  TG.board(g, BOARD, []);
  const r = JSON.parse(g.ev(`JSON.stringify(window.devTest.applyPlayerOrders([{ unit: "P1", action: "Defend" }]))`));
  check(r.ok === true, "D5a: the carried-over Defend is queued");
  return g;
};
const consumed = (tick, ...pairs) => ({ type: "consumed", tick, actions: pairs.map(([unit, action]) => ({ unit, action, executed: null })) });
const pick = (a) => ({ planned: a.planned, executed: a.executed, attacksHit: a.attacksHit, attacksMissed: a.attacksMissed, missReasons: a.missReasons,
  wasted: a.wasted, notExecuted: a.notExecuted, accountingNote: a.accountingNote });

function run() {
  // D5a
  const saw = [];
  const bot = { id: "scripted-carry", decide(obs) { saw.push(obs.units.filter((u) => u.team === "player").map((u) => `${u.id}:${u.queue.join(",")}`).join(" ")); return [{ unit: "P1", action: "Attack" }]; } };
  const rec = runBattle({ load, bot, scenarioId: "intro", seed: 1, preset: "commander", botSeed: 1, fixtureOnly: true, customSetup: "hand-placed board + a pre-queued card", limits: { maxTurnsPerBattle: 1 } });
  same(saw, ["P1:Defend"], "D5a: the bot sees the carried-over card");
  const t = rec.perTurn[0];
  same(pick(t), { planned: 1, executed: 2, attacksHit: 1, attacksMissed: 0, missReasons: {}, wasted: 0, notExecuted: 0, accountingNote: "unplanned-actions-resolved: 1" }, "D5a: imbalance recorded, not hidden");
  same(t.byUnit.P1, { planned: 1, executed: 2, attacksHit: 1, attacksMissed: 0, wasted: 0 }, "D5a: byUnit");
  same(diffRecords(rec, replayBattle(rec, load)), [], "D5a: replay reproduces the record");

  // D5b
  const cases = {
    balanced: accountTurn({ planned: { P1: 2 }, events: [consumed(1, ["P1", "Attack"]), { type: "hit", tick: 1, attacker: "P1", target: "E1" }, consumed(2, ["P1", "Move"])] }),
    missSkipClearedUnplayed: accountTurn({
      planned: { P1: 2, P2: 3 },
      events: [
        consumed(1, ["P1", "Attack"], ["P2", "Move"]), { type: "miss", tick: 1, attacker: "P1", reason: "target-not-adjacent", target: "E1" },
        consumed(2, ["P2", "Attack"]), { type: "targetSkipped", tick: 2, unit: "P2", action: "Attack", target: "E2", reason: "target-defeated" },
        { type: "death", tick: 2, unit: "P2" }, { type: "queueCleared", tick: 2, unit: "P2", cleared: ["Defend"] },
      ],
      queuesAfter: { P1: 1 },
    }),
    plannedUnaccounted: accountTurn({ planned: { P1: 2 }, events: [consumed(1, ["P1", "Move"])] }),
    hitWithoutAttack: accountTurn({ planned: { P1: 1 }, events: [consumed(1, ["P1", "Move"]), { type: "hit", tick: 1, attacker: "P1", target: "E1" }] }),
    unplannedResolved: accountTurn({ planned: {}, events: [consumed(1, ["P1", "Defend"])] }),
    enemy: accountTurn({ planned: { P1: 1 }, events: [consumed(1, ["P1", "Defend"], ["E1", "Attack"], ["E2", "Attack"]), { type: "hit", tick: 1, attacker: "E1", target: "P1" }, { type: "miss", tick: 1, attacker: "E2" }] }),
  };
  same(pick(cases.balanced), { planned: 2, executed: 2, attacksHit: 1, attacksMissed: 0, missReasons: {}, wasted: 0, notExecuted: 0, accountingNote: null }, "D5b: balanced");
  same(pick(cases.missSkipClearedUnplayed), { planned: 5, executed: 1, attacksHit: 0, attacksMissed: 1, missReasons: { "target-not-adjacent": 1 }, wasted: 3, notExecuted: 4, accountingNote: null },
    "D5b: P1 miss + unplayed Move, P2 Move + skipped Attack + cleared Defend");
  same([cases.missSkipClearedUnplayed.byUnit.P1.wasted, cases.missSkipClearedUnplayed.byUnit.P2.wasted], [1, 2], "D5b: wasted per wolf");
  same(pick(cases.plannedUnaccounted), { planned: 2, executed: 1, attacksHit: 0, attacksMissed: 0, missReasons: {}, wasted: 0, notExecuted: 1, accountingNote: "planned-actions-unaccounted: 1" }, "D5b: unaccounted");
  same(pick(cases.hitWithoutAttack), { planned: 1, executed: 1, attacksHit: 0, attacksMissed: 0, missReasons: {}, wasted: 0, notExecuted: 0, accountingNote: "hits-without-attack: 1" }, "D5b: hit without an Attack");
  same(pick(cases.unplannedResolved), { planned: 0, executed: 1, attacksHit: 0, attacksMissed: 0, missReasons: {}, wasted: 0, notExecuted: 0, accountingNote: "unplanned-actions-resolved: 1" }, "D5b: unplanned");
  same(cases.enemy.enemy, { executed: 1, attacksHit: 1, attacksMissed: 1 }, "D5b: enemy counts (E2's miss has no reason)");
  check(cases.enemy.accountingNote === null, "D5b: enemy actions never enter the player balance");

  // D5c
  const report = buildReport({ manifestHash: "fixture-manifest", buildId: "fixture-build", battles: [rec] });
  check(report.notes.includes("accounting: 1 turn(s) do not balance planned = executed + attacksMissed + wasted (see perTurn[].accountingNote)"), "D5c: report note");

  const hands = contexts.reduce((n, g) => n + S.handsOf(g), 0);
  check(hands <= 10, `d5 hand ledger: ${hands} hands (limit 10)`);
  return { header: "REQUIREMENT — L3 turn accounting", fixtureOnly: true, contexts: contexts.length, hands, engine: { botSaw: saw, turn: t }, helper: cases, reportNotes: report.notes };
}

module.exports = { id: ID, run };
