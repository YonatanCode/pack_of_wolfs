"use strict";
// REQUIREMENT — L3 visual replay: divergence, refusals and the build-identity warning (hard assertions; golden = messages)
// Same hand-authored battle and recording as r47 (_replay.cjs). Every payload variant below is a hand-written edit.
// R48a DIVERGENCE: turn 2's eventHash tampered -> turn 1 matches, playback stops at turn 2 with "Divergence at turn 2:
//      recorded <h1> vs replayed <h2>" (h2 = the real hash), the board stays visible, Play / Next do nothing more, Restart
//      replay works and replays turn 1 again.
// R48b BUILD MISMATCH: build-id.json names another build -> refused with both short IDs; no setup is loaded (no scenario
//      battle), the board is hidden, Play / Next / Restart do nothing.
// R48c RULES: rulesHash / rulesVersion / both differ from the loaded effective rules -> refused naming exactly the differing
//      field(s); an invalid rulesQuery, an unknown preset and an unknown scenario are refused by the normal strict paths.
// R48d MALFORMED / MISSING: parseReplayLocation (pure) on hand-written broken links and payloads -> the field and message;
//      three full boots show the on-page error, fetch nothing and start nothing.
// R48e BUILD IDENTITY UNAVAILABLE (no fetch, HTTP 404, fetch rejected, not JSON) -> the visible warning "build identity
//      unavailable; relying on rules hash and per-turn event hashes (...)" and the replay proceeds (404 case: turn 1 matches).
const X = require("./_replay.cjs");
const { check, same, J } = X;

const ID = "r48-visual-replay-refusals";

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const rec = X.record();
  track(rec.g);
  const okFetch = X.serveBuildId(X.FIXTURE_BUILD_ID);

  // ---- R48a divergence -----------------------------------------------------------------------------------------------
  const TAMPERED = "00000000000000";
  const a = track(X.bootReplay({ hash: X.encode(X.payloadOf(rec, (p) => { p.turns[1].eventHash = TAMPERED; })), fetch: okFetch }));
  same(await X.waitBuildCheck(a), "ready", "R48a: ready");
  same(await a.runLimited(() => X.click(a, "replay-play"), 60000), "diverged", "R48a: autoplay stops on divergence");
  const sa = X.state(a);
  const expected = `Divergence at turn 2: recorded ${TAMPERED} vs replayed ${rec.turns[1].eventHash}`;
  same(sa.error, expected, "R48a: the divergence names the turn and both hashes");
  same(sa.results.map((r) => `${r.turn}:${r.match}`), ["1:true", "2:false"], "R48a: turn 1 matched, turn 2 diverged");
  check(sa.turnIndex === 1 && sa.playing === false && sa.busy === false, "R48a: stopped at turn 2");
  const pa = X.panel(a);
  same(pa.body, ["is-replay"], "R48a: the board stays visible (not blocked)");
  same(X.snapshot(a), X.snapshot(a), "R48a: (stable read)");
  const afterDivergence = X.snapshot(a);
  same([await a.runLimited(() => X.click(a, "replay-next")), a.ev("toggleReplayPlayback()")], [false, null], "R48a: Next / Play do nothing after a divergence");
  same(X.snapshot(a), afterDivergence, "R48a: nothing changed after the divergence");
  same(X.click(a, "replay-restart"), true, "R48a: Restart replay works after a divergence");
  same(await a.runLimited(() => X.click(a, "replay-next"), 60000), true, "R48a: turn 1 replays (and matches) again after Restart");

  // ---- R48b build mismatch -------------------------------------------------------------------------------------------
  const b = track(X.bootReplay({ hash: X.encode(X.payloadOf(rec)), fetch: X.serveBuildId(X.OTHER_BUILD_ID) }));
  same(await X.waitBuildCheck(b), "refused", "R48b: refused");
  const sb = X.state(b);
  same(sb.error, `Replay refused: build mismatch: the payload was recorded on build ${X.FIXTURE_BUILD_ID.slice(0, 12)}, this page is build ${X.OTHER_BUILD_ID.slice(0, 12)}`, "R48b: both short IDs shown");
  check(sb.setupLoaded === false && b.ev("activeScenario") === null, "R48b: no setup loaded (no scenario battle)");
  const pb = X.panel(b);
  same(pb.body, ["is-replay", "is-replay-blocked"], "R48b: the board is hidden");
  same([pb.play.disabled, pb.next.disabled, pb.restart.disabled], [true, true, true], "R48b: every replay button is disabled");
  same([await b.runLimited(() => X.click(b, "replay-next")), b.ev("toggleReplayPlayback()"), X.click(b, "replay-restart")], [false, null, false], "R48b: Play / Next / Restart do nothing");

  // ---- R48c rules ---------------------------------------------------------------------------------------------------
  const rulesCases = [
    ["rulesHash differs", (p) => { p.rulesHash = "0d3ce2ec6fa6de"; }],
    ["rulesVersion differs", (p) => { p.rulesVersion = "0.3.0-commander-enemy-actions-targets"; }],
    ["both differ", (p) => { p.rulesVersion = "1.0.0"; p.rulesHash = "ffffffffffffff"; }],
    ["rulesQuery rejected by the link parser", (p) => { p.rulesQuery = "rules=zz:1"; }],
    ["rulesQuery fails settings validation", (p) => { p.rulesQuery = "rules=pab:99"; }],
    ["unknown preset", (p) => { p.preset = "bogus"; }],
    ["unknown scenario", (p) => { p.scenarioId = "nowhere"; }],
  ];
  const rules = [];
  for (const [label, edit] of rulesCases) {
    const g = track(X.bootReplay({ hash: X.encode(X.payloadOf(rec, edit)), fetch: okFetch }));
    same(await X.waitBuildCheck(g), "refused", `R48c ${label}: refused`);
    same(X.panel(g).body, ["is-replay", "is-replay-blocked"], `R48c ${label}: the board is hidden`);
    rules.push({ case: label, error: X.state(g).error });
  }
  check(rules[0].error.includes(`rulesHash: recorded 0d3ce2ec6fa6de vs loaded ${rec.rules.hash}`) && !rules[0].error.includes("rulesVersion"), "R48c: only rulesHash named");
  check(rules[1].error.includes("rulesVersion: recorded \"0.3.0-commander-enemy-actions-targets\"") && rules[1].error.includes("rulesHash") === false, "R48c: only rulesVersion named");
  check(rules[2].error.includes("rulesVersion") && rules[2].error.includes("rulesHash"), "R48c: both named");

  // ---- R48d malformed / missing -----------------------------------------------------------------------------------------
  const p0 = X.payloadOf(rec);
  const g = rec.g;
  const parse = (search, hash) => J(g, `parseReplayLocation(${JSON.stringify(search)}, ${JSON.stringify(hash)})`);
  const edit = (fn) => X.encode(X.payloadOf(rec, fn));
  const malformed = [
    ["extra query parameter", "?replay=1&scenario=intro", X.encode(p0)],
    ["duplicate replay parameter", "?replay=1&replay=1", X.encode(p0)],
    ["no #r fragment", "?replay=1", ""],
    ["empty #r", "?replay=1", "#r="],
    ["not base64url", "?replay=1", "#r=***"],
    ["base64url of invalid UTF-8", "?replay=1", "#r=_w"],
    ["too long", "?replay=1", `#r=${"A".repeat(262145)}`],
    ["not JSON", "?replay=1", X.encode("{not json")],
    ["JSON array", "?replay=1", X.encode("[]")],
    ["missing turns", "?replay=1", edit((p) => { delete p.turns; })],
    ["missing buildId", "?replay=1", edit((p) => { delete p.buildId; })],
    ["unknown field", "?replay=1", edit((p) => { p.extra = 1; })],
    ["v 2", "?replay=1", edit((p) => { p.v = 2; })],
    ["buildId short", "?replay=1", edit((p) => { p.buildId = "abc"; })],
    ["scenarioId with a slash", "?replay=1", edit((p) => { p.scenarioId = "../intro"; })],
    ["seed negative", "?replay=1", edit((p) => { p.seed = -1; })],
    ["seed as a string", "?replay=1", edit((p) => { p.seed = "1"; })],
    ["preset uppercase", "?replay=1", edit((p) => { p.preset = "Commander"; })],
    ["rulesQuery without rules=", "?replay=1", edit((p) => { p.rulesQuery = "rc:3"; })],
    ["rulesQuery with a second parameter", "?replay=1", edit((p) => { p.rulesQuery = "rules=rc:3&preset=current"; })],
    ["rulesVersion empty", "?replay=1", edit((p) => { p.rulesVersion = ""; })],
    ["rulesHash uppercase", "?replay=1", edit((p) => { p.rulesHash = p.rulesHash.toUpperCase(); })],
    ["strategy missing", "?replay=1", edit((p) => { delete p.strategy; })],
    ["botSeed fractional", "?replay=1", edit((p) => { p.botSeed = 1.5; })],
    ["result unknown", "?replay=1", edit((p) => { p.result = "won"; })],
    ["turns empty", "?replay=1", edit((p) => { p.turns = []; })],
    ["turn not an object", "?replay=1", edit((p) => { p.turns[1] = "turn"; })],
    ["turn numbered wrong", "?replay=1", edit((p) => { p.turns[0].turn = 2; })],
    ["turn eventHash missing", "?replay=1", edit((p) => { delete p.turns[2].eventHash; })],
    ["turn eventHash malformed", "?replay=1", edit((p) => { p.turns[0].eventHash = "xyz"; })],
    ["turn unknown field", "?replay=1", edit((p) => { p.turns[0].note = "x"; })],
    ["steps empty", "?replay=1", edit((p) => { p.turns[1].steps = []; })],
    ["three steps", "?replay=1", edit((p) => { p.turns[0].steps = [[{ reshuffle: true }], [{ reshuffle: true }], []]; })],
    ["step not a list", "?replay=1", edit((p) => { p.turns[1].steps = [{ unit: "P1", action: "Move" }]; })],
    ["first step not a reshuffle", "?replay=1", edit((p) => { p.turns[0].steps[0] = [{ unit: "P1", action: "Move" }]; })],
    ["unit P4", "?replay=1", edit((p) => { p.turns[1].steps[0][0].unit = "P4"; })],
    ["action Jump", "?replay=1", edit((p) => { p.turns[1].steps[0][1].action = "Jump"; })],
    ["target E4", "?replay=1", edit((p) => { p.turns[1].steps[0][2].target = "E4"; })],
    ["reshuffle not true", "?replay=1", edit((p) => { p.turns[0].steps[0][0].reshuffle = "yes"; })],
    ["order with an extra key", "?replay=1", edit((p) => { p.turns[2].steps[0][3].extra = 1; })],
    ["order null", "?replay=1", edit((p) => { p.turns[2].steps[0][0] = null; })],
  ];
  const parsed = malformed.map(([label, search, hash]) => {
    const r = parse(search, hash);
    check(r.ok === false && typeof r.field === "string" && r.message.length > 0, `R48d ${label}: refused with a field and a message`);
    return { case: label, field: r.field, message: r.message };
  });
  same(parse("?replay=1", X.encode(p0)).ok, true, "R48d: the unedited payload parses");
  const pageCases = [
    ["no #r fragment", ""],
    ["not JSON", X.encode("{not json")],
    ["v 2", edit((p) => { p.v = 2; })],
  ];
  const pages = [];
  for (const [label, hash] of pageCases) {
    const pg = track(X.bootReplay({ hash, fetch: okFetch }));
    await pg.runLimited(async () => {});
    const sp = X.state(pg);
    const pp = X.panel(pg);
    check(sp.status === "refused" && sp.setupLoaded === false && pg.ev("activeScenario") === null, `R48d page ${label}: refused, nothing started`);
    same(pg.fetchCalls, [], `R48d page ${label}: no build check was made`);
    same(pp.body, ["is-replay", "is-replay-blocked"], `R48d page ${label}: the board is hidden`);
    check(pp.error === sp.error && sp.error.startsWith("Replay refused: "), `R48d page ${label}: the error is on the page`);
    pages.push({ case: label, error: pp.error, buttons: [pp.play.disabled, pp.next.disabled, pp.restart.disabled] });
  }

  // ---- R48e build identity unavailable -----------------------------------------------------------------------------------
  const unavailableCases = [
    ["no fetch (harness / old browser)", undefined],
    ["HTTP 404 (dev server)", X.serveStatus(404)],
    ["fetch rejected", X.failFetch("network down")],
    ["not JSON", X.serveText("<!doctype html>")],
  ];
  const unavailable = [];
  for (const [label, fetch] of unavailableCases) {
    const ug = track(X.bootReplay({ hash: X.encode(X.payloadOf(rec)), fetch }));
    same(await X.waitBuildCheck(ug), "ready", `R48e ${label}: proceeds`);
    const su = X.state(ug);
    check(su.warning.startsWith("build identity unavailable; relying on rules hash and per-turn event hashes ("), `R48e ${label}: the warning`);
    same(X.panel(ug).warning, su.warning, `R48e ${label}: the warning is visible on the page`);
    const row = { case: label, warning: su.warning };
    if (label.startsWith("HTTP 404")) {
      same(await ug.runLimited(() => X.click(ug, "replay-next"), 60000), true, "R48e: turn 1 replays and matches without a build identity");
      row.turn1 = X.state(ug).results[0];
    }
    unavailable.push(row);
  }

  return {
    header: X.REQ_HEADER,
    divergence: { error: sa.error, results: sa.results, panel: { turn: pa.turn, status: pa.status, error: pa.error, buttons: [pa.play.disabled, pa.next.disabled, pa.restart.disabled] } },
    buildMismatch: { error: sb.error, fetchCalls: b.fetchCalls, panel: { turn: pb.turn, status: pb.status, orders: pb.orders } },
    rules,
    malformed: parsed,
    pages,
    unavailable,
    hands: X.reportReplayHands(ID, ctxs),
  };
}
module.exports = { id: ID, run };
