"use strict";
// REQUIREMENT — commanderdraw enemy draw (hard assertions; evidence in the golden)
// R51 VISUAL REPLAY under commanderdraw (equal budgets 4v4): ONE hand-authored 3-turn battle (intro, seed 1,
//      ?preset=commanderdraw&rules=pab:4,hs:4,eab:4; turn 2 = reshuffle-only step, then a card step written from the hand
//      that reshuffle drew), recorded ONCE headlessly (the Lab driver's way). The payload (v1, unchanged schema: the enemy
//      stream is derived from preset + seed, no new field) replays through the ?replay=1 page with every per-turn event
//      hash equal, the final BattleState (incl. rng.enemyDrawState / enemyPack.drawnPool) equal to the recording, and the
//      Restart replay setup equal to the recording's first state (enemy stream reset with the hand stream).
const X = require("./_replay.cjs");
const D = require("./_draw.cjs");
const { check, same, J } = X;

const ID = "r51-enemy-draw-replay";
const QUERY = "?scenario=intro&seed=1&preset=commanderdraw&rules=pab:4,hs:4,eab:4";
const RULES_QUERY = "rules=pab:4,hs:4,eab:4";
const R = { reshuffle: true };
/** Hand-authored. Boot hand [Attack, Move, Attack, Defend]; turn 2's reshuffle draws [Defend, Attack, Defend, Attack];
 *  turn 3's hand is [Attack, Move, Attack, Defend]. */
const TURNS = [
  [[{ unit: "P1", target: "E1" }, { unit: "P1", action: "Move" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Defend" }]],
  [[R], [{ unit: "P2", target: "E2" }, { unit: "P2", action: "Attack" }, { unit: "P3", action: "Defend" }, { unit: "P1", action: "Attack" }]],
  [[{ unit: "P3", action: "Move" }, { unit: "P3", action: "Attack" }, { unit: "P1", action: "Attack" }, { unit: "P2", action: "Defend" }]],
];

function record() {
  const g = X.bootNormal(QUERY);
  const rules = J(g, "observeBattle().rules");
  const initialState = X.snapshot(g);
  const pools = [J(g, "getEnemyDrawState().pool")];
  const turns = TURNS.map((steps, index) => {
    steps.slice(0, -1).forEach((step) => check(J(g, `applyPlayerOrders(${JSON.stringify(step)})`).ok === true, `record turn ${index + 1}: pre-turn step accepted`));
    const r = J(g, `runHeadlessTurn(${JSON.stringify(steps[steps.length - 1])}, { includeEvents: true })`);
    check(r.ok === true, `record turn ${index + 1}: headless turn ran: ${JSON.stringify(r).slice(0, 200)}`);
    pools.push(J(g, "getEnemyDrawState().pool"));
    return { turn: index + 1, steps, eventHash: J(g, `hashTurnEvents(${JSON.stringify(r.events)})`) };
  });
  return { g, rules, initialState, turns, pools, finalState: X.snapshot(g), finalObservation: J(g, "observeBattle()") };
}

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const rec = record();
  track(rec.g);
  const payload = {
    v: 1, buildId: X.FIXTURE_BUILD_ID, scenarioId: "intro", seed: 1, preset: "commanderdraw", rulesQuery: RULES_QUERY,
    rulesVersion: rec.rules.version, rulesHash: rec.rules.hash, strategy: "scripted-fixture", botSeed: 0, result: "timeout",
    turns: rec.turns.map(({ turn, steps, eventHash }) => ({ turn, steps, eventHash })),
  };
  check(rec.rules.preset === "commanderdraw" && rec.rules.playerActionBudget === 4 && rec.rules.enemyActionBudget === 4 && rec.rules.handSize === 4, "R51: equal budgets 4v4 under commanderdraw");
  check("enemyDrawState" in JSON.parse(rec.finalState).rng, "R51: the recorded BattleState carries the enemy stream");

  const a = track(X.bootReplay({ hash: X.encode(payload), fetch: X.serveBuildId(X.FIXTURE_BUILD_ID) }));
  same(await X.waitBuildCheck(a), "ready", "R51: build identity matches -> ready");
  const ready = X.snapshot(a);
  same(ready, rec.initialState, "R51: the replay setup equals the recording's first state (incl. the enemy stream)");
  same(await a.runLimited(() => X.click(a, "replay-play"), 60000), "done", "R51: Play replays every recorded turn");
  const st = X.state(a);
  same(st.results.map((r) => r.match), [true, true, true], "R51: every turn's event hash matches");
  same(st.results.map((r) => r.replayed), rec.turns.map((t) => t.eventHash), "R51: replayed hashes = recorded hashes");
  same(X.snapshot(a), rec.finalState, "R51: final BattleState = the recording (incl. enemy stream and drawn pool)");
  same(J(a, "observeBattle()"), rec.finalObservation, "R51: final observation = the recording");
  same(X.click(a, "replay-restart"), true, "R51: Restart replay accepted");
  same(X.snapshot(a), rec.initialState, "R51: Restart resets the setup incl. the enemy stream");

  return {
    header: D.REQ_HEADER_DRAW,
    battle: { query: QUERY, turns: TURNS, rules: rec.rules, recordedEventHashes: rec.turns.map((t) => t.eventHash), drawnPools: rec.pools,
      finalStateHash: X.sha256(rec.finalState) },
    replay: { status: st.status, matches: st.results.map((r) => r.match) },
    hands: D.reportDrawHands(ID, ctxs),
  };
}

module.exports = { id: ID, run };
