"use strict";
// REQUIREMENT — commanderdraw enemy draw weights (hard assertions; evidence in the golden; ENGINE-NOTES section 13.1)
// R53 VISUAL REPLAY with non-default enemy weights: ONE hand-authored 3-turn battle (intro, seed 1,
//      ?preset=commanderdraw&rules=pab:4,hs:4,eab:4,dwm:0,dwa:2,dwd:1; r51's orders, valid because the hand stream does not
//      depend on the enemy weights), recorded ONCE headlessly (the Lab driver's way). The weights ride in the payload's
//      rulesQuery (v1 schema unchanged): the ?replay=1 page replays it with every per-turn event hash equal, the final
//      BattleState equal to the recording, no drawn list containing Move, and Restart replay equal to the first state.
//      The rulesHash check covers the weights: the same payload without the dw keys is refused (rulesHash differs), and
//      the dw keys under preset commander are refused by the strict link parser.
const X = require("./_replay.cjs");
const D = require("./_draw.cjs");
const { check, same, J } = X;

const ID = "r53-enemy-draw-weights-replay";
const RULES_QUERY = "rules=pab:4,hs:4,eab:4,dwm:0,dwa:2,dwd:1";
const QUERY = `?scenario=intro&seed=1&preset=commanderdraw&${RULES_QUERY}`;
const R = { reshuffle: true };
/** Hand-authored (r51's orders). Boot hand [Attack, Move, Attack, Defend]; turn 2's reshuffle draws [Defend, Attack, Defend,
 *  Attack]; turn 3's hand is [Attack, Move, Attack, Defend]: the same hands as r51 (enemy weights never touch the hand stream). */
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
  check(rec.rules.preset === "commanderdraw" && rec.rules.hash !== "149db90d99fe1b", "R53: commanderdraw 4v4 with a hash of its own (the weights are hashed)");
  same(J(rec.g, "getActiveEnemyDrawWeights()"), { Move: 0, Attack: 2, Defend: 1 }, "R53: the recording ran under the link's weights");
  check(rec.pools.every((p) => p.length === 4 && !p.includes("Move")), `R53: every drawn list has 4 actions and no Move (${JSON.stringify(rec.pools)})`);

  const a = track(X.bootReplay({ hash: X.encode(payload), fetch: X.serveBuildId(X.FIXTURE_BUILD_ID) }));
  same(await X.waitBuildCheck(a), "ready", "R53: build identity matches -> ready");
  same(J(a, "getActiveEnemyDrawWeights()"), { Move: 0, Attack: 2, Defend: 1 }, "R53: the replay setup applied the weights from rulesQuery");
  same(X.snapshot(a), rec.initialState, "R53: the replay setup equals the recording's first state");
  same(await a.runLimited(() => X.click(a, "replay-play"), 60000), "done", "R53: Play replays every recorded turn");
  const st = X.state(a);
  same(st.results.map((r) => r.match), [true, true, true], "R53: every turn's event hash matches");
  same(st.results.map((r) => r.replayed), rec.turns.map((t) => t.eventHash), "R53: replayed hashes = recorded hashes");
  same(X.snapshot(a), rec.finalState, "R53: final BattleState = the recording (incl. enemy stream and drawn pool)");
  same(J(a, "observeBattle()"), rec.finalObservation, "R53: final observation = the recording");
  same(X.click(a, "replay-restart"), true, "R53: Restart replay accepted");
  same(X.snapshot(a), rec.initialState, "R53: Restart resets the setup incl. the weights and the enemy stream");

  // refusals: the rulesHash covers the weights; the dw keys need preset=commanderdraw
  const refusal = async (edit) => {
    const g = track(X.bootReplay({ hash: X.encode({ ...payload, ...edit }), fetch: X.serveBuildId(X.FIXTURE_BUILD_ID) }));
    await X.waitBuildCheck(g);
    return X.state(g).error;
  };
  const withoutWeights = await refusal({ rulesQuery: "rules=pab:4,hs:4,eab:4" });
  same(withoutWeights, `Replay refused: the recorded rules differ from the rules this page loaded: rulesHash: recorded ${rec.rules.hash} vs loaded 149db90d99fe1b`,
    "R53: the same payload without the weights is refused (rulesHash)");
  const underCommander = await refusal({ preset: "commander" });
  same(underCommander, "Replay refused: the recorded preset / rulesQuery do not load: rules link rejected (dwm is an enemy draw weight: it needs preset=commanderdraw)",
    "R53: the weights under preset commander are refused by the link parser");

  return {
    header: "REQUIREMENT — commanderdraw enemy draw weights",
    battle: { query: QUERY, turns: TURNS, rules: rec.rules, recordedEventHashes: rec.turns.map((t) => t.eventHash), drawnPools: rec.pools,
      finalStateHash: X.sha256(rec.finalState) },
    replay: { status: st.status, matches: st.results.map((r) => r.match) },
    refusals: { withoutWeights, underCommander },
    hands: D.reportWeightHands(ID, ctxs),
  };
}

module.exports = { id: ID, run };
