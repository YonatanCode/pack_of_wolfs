"use strict";
// REQUIREMENT — L3 replay payload (scripted bot only; the unmodified intro setup; <= 2 turns per battle)
// Testing boundary (tools/lab/CONTRACT.md): the driver runs a SCRIPTED two-round bot whose order lists are the hand-written
// ones of tests/characterization/_replay.cjs (TURNS[0]: a reshuffle-only round, then a card step written from the hand
// recorded after that reshuffle; TURNS[1]: one card step) on intro / seed 1 / commander / rules=rc:3. No real bot, no
// generated board / orders / seed / payload; payload variants below are hand-written edits. fixtureOnly: true.
// D4a PAYLOAD: runBattle with buildId builds replay.payload with exactly the v1 keys, rulesQuery "rules=rc:3", turns 1-2
//     with steps [[reshuffle], [cards]] / [[cards]], 14-hex eventHash = devTest.hashTurnEvents of that turn's events; the
//     hashes equal those of _replay.cjs record() (the same orders recorded independently, as r47 does); payloadNote null.
// D4b THE PAGE ACCEPTS AND REPLAYS IT: validateReplayPayload(payload) ok and the driver's payloadProblem null; the payload
//     loaded through the replay page path (_replay.bootReplay, build identity served = payload.buildId): ready, Play
//     replays both turns with every eventHash matching, and the final observation hash equals the driver's last
//     observationHash. Hand-written invalid variants (a card in the reshuffle step, 3 steps, a 13-hex eventHash) are refused
//     by BOTH the page validator and payloadProblem.
// D4c TRUNCATED: turn 2 asks for a card the hand lacks (refused): the payload covers turn 1 only, payloadNote says why.
// D4d NO BUILD ID: payload null, payloadNote "no buildId was passed to runBattle".
// D4e REPLAY: replayBattle reproduces D4a and D4c (D4c with options.buildId: its payload came from turn 1).
const S = require("../characterization/_settings.cjs");
const X = require("../characterization/_replay.cjs");
const { runBattle, replayBattle, diffRecords, payloadProblem, encodePayload } = require("../../tools/lab/driver.cjs");

const ID = "d4-replay-payload";
const HAND_LIMIT = 30; // this fixture's own hand ledger
const BUILD = X.FIXTURE_BUILD_ID;
const BASE = { scenarioId: "intro", seed: 1, preset: "commander", rulesQuery: "rules=rc:3", botSeed: 3, fixtureOnly: true, strategy: "scripted-two-round" };
const KEYS = ["v", "buildId", "scenarioId", "seed", "preset", "rulesQuery", "rulesVersion", "rulesHash", "strategy", "botSeed", "result", "turns"];

function check(cond, msg) { if (!cond) throw new Error(`d4 check failed: ${msg}`); }
function same(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const contexts = [];
const load = (opts) => { const g = S.boot(opts.query); contexts.push(g); return g; };
/** One fixed output per decide() call; logs the round it was asked in. */
function scripted(perCall, log) {
  let call = 0;
  return { decide(observation, ctx) { log.push(`${ctx.round}:${observation.hand.cards.join(",")}`); const out = perCall[call]; call += 1; return out; } };
}
const CALLS = [X.TURNS[0][0], X.TURNS[0][1], X.TURNS[1][0]]; // round 0 reshuffle, round 1 cards; turn 2 one round

async function run() {
  // D4a
  const logA = [];
  const a = runBattle({ ...BASE, load, buildId: BUILD, bot: scripted(CALLS, logA), limits: { maxTurnsPerBattle: 2 } });
  const p = a.replay.payload;
  check(a.result === "timeout" && a.turns === 2 && a.perTurn.every((t) => t.status === "ran"), "D4a: two turns ran");
  same(Object.keys(p), KEYS, "D4a: exactly the v1 payload keys");
  same([p.v, p.buildId, p.scenarioId, p.seed, p.preset, p.rulesQuery, p.strategy, p.botSeed, p.result], [1, BUILD, "intro", 1, "commander", "rules=rc:3", "scripted-two-round", 3, "timeout"], "D4a: payload header");
  same([p.rulesVersion, p.rulesHash], [a.rulesVersion, a.rulesHash], "D4a: payload rules = record rules");
  same(p.turns.map((t) => Object.keys(t)), [["turn", "steps", "eventHash"], ["turn", "steps", "eventHash"]], "D4a: turn keys");
  same(p.turns.map((t) => t.steps), [X.TURNS[0], X.TURNS[1]], "D4a: steps as returned by the bot rounds");
  same(p.turns.map((t) => t.eventHash), a.perTurn.map((t) => t.eventHash), "D4a: payload hashes = per-turn hashes");
  check(p.turns.every((t) => /^[0-9a-f]{14}$/.test(t.eventHash)) && a.replay.payloadNote === null, "D4a: 14-hex hashes, no note");
  same(a.perTurn.map((t) => [t.reshuffles, t.reshuffleChargesAfter]), [[1, 2], [0, 2]], "D4a: one reshuffle (rc:3 -> 2 left)");
  const ref = X.record();
  contexts.push(ref.g);
  same(p.turns.map((t) => t.eventHash), ref.turns.slice(0, 2).map((t) => t.eventHash), "D4a: hashes = _replay.cjs record() of the same orders");
  same(`#r=${encodePayload(p)}`, X.encode(p), "D4a: encodePayload = the page's base64url(JSON)");

  // D4b
  const page = X.bootReplay({ hash: X.encode(p), fetch: X.serveBuildId(p.buildId) });
  contexts.push(page);
  same(X.J(page, `validateReplayPayload(${JSON.stringify(p)}).ok`), true, "D4b: the page validator accepts the payload");
  check(payloadProblem(p) === null, "D4b: payloadProblem agrees");
  same(await X.waitBuildCheck(page), "ready", "D4b: build identity matches -> ready");
  same(await page.runLimited(() => X.click(page, "replay-play"), 60000), "done", "D4b: Play replays every recorded turn");
  const st = X.state(page);
  same(st.results.map((r) => [r.match, r.replayed]), p.turns.map((t) => [true, t.eventHash]), "D4b: every replayed hash matches the payload");
  check(st.error === "" && st.status === "done", "D4b: finished cleanly");
  const pageObsHash = require("node:crypto").createHash("sha256").update(JSON.stringify(X.J(page, "observeBattle()"))).digest("hex").slice(0, 16);
  same(pageObsHash, a.perTurn[1].observationHash, "D4b: the page ends on the driver's final observation");
  const edits = {
    cardInReshuffleStep: (q) => { q.turns[0].steps[0].push({ unit: "P1", action: "Move" }); },
    threeSteps: (q) => { q.turns[0].steps.unshift([{ reshuffle: true }]); },
    shortHash: (q) => { q.turns[1].eventHash = q.turns[1].eventHash.slice(1); },
  };
  const variants = Object.fromEntries(Object.entries(edits).map(([k, edit]) => {
    const q = JSON.parse(JSON.stringify(p));
    edit(q);
    const pageVerdict = X.J(page, `validateReplayPayload(${JSON.stringify(q)})`);
    const ours = payloadProblem(q);
    check(pageVerdict.ok === false && ours !== null, `D4b: ${k} refused by the page and by payloadProblem`);
    return [k, { page: pageVerdict.message, driver: ours }];
  }));

  // D4c
  const logC = [];
  const c = runBattle({ ...BASE, load, buildId: BUILD, bot: scripted([...CALLS.slice(0, 2), [{ unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }, { unit: "P1", action: "Attack" }]], logC), limits: { maxTurnsPerBattle: 2 } });
  same(c.perTurn.map((t) => t.status), ["ran", "refused"], "D4c: turn 2 refused");
  same(c.replay.payload.turns.map((t) => t.turn), [1], "D4c: payload covers turn 1 only");
  same(c.replay.payloadNote, "payload covers turns 1-1 of 2: turn 2 did not run (refused); the page cannot replay it", "D4c: note");

  // D4d
  const d = runBattle({ ...BASE, load, bot: scripted([X.TURNS[1][0]], []), limits: { maxTurnsPerBattle: 1 } });
  check(d.replay.payload === null && d.replay.payloadNote === "no buildId was passed to runBattle", "D4d: no buildId, no payload");

  // D4e
  same(diffRecords(a, replayBattle(a, load)), [], "D4e: replay reproduces D4a (payload included)");
  same(diffRecords(c, replayBattle(c, load, { buildId: BUILD })), [], "D4e: replay reproduces D4c");

  const hands = contexts.reduce((n, g) => n + (typeof g.ev("window.__drawn") === "number" ? 1 + g.ev("window.__drawn") : 0), 0);
  check(hands <= HAND_LIMIT, `d4 hand ledger: ${hands} hands (limit ${HAND_LIMIT})`);
  return {
    header: "REQUIREMENT — L3 replay payload", fixtureOnly: true, contexts: contexts.length, hands,
    botSaw: { a: logA, c: logC }, payload: p, perTurn: a.perTurn, pageResults: st.results, refusedVariants: variants,
    truncated: { payloadTurns: c.replay.payload.turns.length, note: c.replay.payloadNote }, noBuildId: d.replay.payloadNote,
  };
}

module.exports = { id: ID, run };
