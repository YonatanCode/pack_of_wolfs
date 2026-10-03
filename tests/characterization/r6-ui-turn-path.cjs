"use strict";
// REQUIREMENT — P1b acceptance
// R6: the real UI turn path. Boot ?scenario=intro&seed=1, queue hand-chosen cards (by index) for the 3
// player wolves, executePlayerActionQueue() (which runs the enemy planner) for 2 turns, end the battle
// with a scripted terminal outcome (devEndFight(true)), assert the result overlay, resetGame() as
// "Play Again", compare with a fresh load. The whole sequence runs in two fresh contexts and must
// produce identical states (enemy planning determinism + Play Again).
const { REQ_HEADER, check, same, bootScenario, hand, snapshot, queueByIndex } = require("./_scn.cjs");

const ID = "r6-ui-turn-path";
const PLAN = [
  { p1: [0, 1], p2: [2], p3: [0] },
  { p1: [1], p2: [0, 3], p3: [2] },
];

async function play() {
  const g = bootScenario(1);
  const fresh = snapshot(g);
  const log = { fresh, turns: [] };
  for (const t of PLAN) {
    const cards = [queueByIndex(g, "player", t.p1), queueByIndex(g, "playerSupport", t.p2), queueByIndex(g, "playerFlank", t.p3)];
    check(g.ev("hasQueuedPlayerActions()") === true, "orders queued");
    await g.runLimited(() => g.ev("executePlayerActionQueue()"));
    check(g.ev("isExecutingActionQueue") === false, "turn finished");
    log.turns.push({ cards, snapshot: snapshot(g) });
  }
  const last = log.turns[1].snapshot;
  check(Object.keys(last.units).filter((k) => k[0] === "E").some((k) => last.units[k].row !== fresh.units[k].row || last.units[k].col !== fresh.units[k].col), "enemy planner moved at least one enemy wolf");
  check(log.turns[0].snapshot.debugReport.lexical !== "", "a battle debug report was captured by the UI turn path");
  g.ev("devEndFight(true)");
  const ended = snapshot(g);
  check(ended.overlayHidden === false, "result overlay shown");
  // (message text is not observable: the stub DOM's querySelector returns a detached element)
  log.resultText = "overlay shown";
  g.ev("resetGame()");
  log.afterPlayAgain = snapshot(g);
  same(log.afterPlayAgain, fresh, "Play Again (resetGame) equals a fresh load");
  return log;
}

async function run() {
  const a = await play();
  const b = await play();
  same(a, b, "two fresh contexts: identical states through 2 UI turns, ending and Play Again");
  return { header: REQ_HEADER, seed: 1, startHand: a.fresh.hand, cardsPerTurn: a.turns.map((t) => t.cards),
    afterTurn: a.turns.map((t) => ({ units: Object.fromEntries(Object.entries(t.snapshot.units).map(([k, v]) => [k, [v.row, v.col, v.health]])), packQueue: t.snapshot.packQueue, hand: t.snapshot.hand })),
    resultText: a.resultText, playAgainEqualsFresh: true };
}
module.exports = { id: ID, run };
