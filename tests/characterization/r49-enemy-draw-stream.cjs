"use strict";
// REQUIREMENT — commanderdraw enemy draw (hard assertions; evidence in the golden)
// R49a OPT-IN / IDENTITY: current and commander keep their versions and hashes (0d3ce2ec6fa6de / 1ee7c8d5a26ec1) and their
//      BattleState carries no enemy-draw key; commanderdraw has its own version and hash (= computeRulesHash of its
//      effective record, different from commander's for the same numbers), observation preset, link round trip, label,
//      link status and panel option. The equal-budget links 4v4 / 5v5 / 6v6 (pab = hs = eab, rc 2, cap 3) parse and give
//      three distinct pinned hashes.
// R49b DRAW (pure, deterministic): the exact lists for seeds 1..3 (3 lists each, budget 5) are pinned; structural
//      properties for every budget 0..10 and seeds 1..3: exactly `budget` actions, only Move / Attack / Defend, same-action
//      cap 3 (4 for budget 10, the documented raise), exactly `budget` stream values consumed, same seed -> same lists,
//      different seeds -> different lists; the seed mix is pinned and distinct for the sampled seeds.
// R49c LIVE PLANS over 3 turns (seeds 1..3): the plan pools of turns 1..3 (boot draw + two turn-end draws, hand-authored
//      one-card-per-wolf orders) are the canonical forms of the pure lists 1..3; exactly one live draw per planning moment.
// R49d STREAM ISOLATION: the hand stream and its draws are bit-identical under commander and commanderdraw (boot hand,
//      hand position, a reshuffle, a played turn's refill); a reshuffle / hand draw never moves the enemy stream; under
//      commander and current the enemy stream is never drawn (pool stays null, position stays the derived seed).
// R49e BATTLESTATE: validateBattleState requires the draw fields under commanderdraw and refuses them elsewhere;
//      withBattleState: a draw on a copy never advances the live stream; loadBattleState restores the stream and pool.
const D = require("./_draw.cjs");
const { S, PV } = D;
const { check, same, J } = S;

const ID = "r49-enemy-draw-stream";
const ACTIONS = ["Move", "Attack", "Defend"];
const EQUAL = { "4v4": "rules=pab:4,hs:4,rc:2,cap:3,eab:4", "5v5": "rules=pab:5,hs:5,rc:2,cap:3,eab:5", "6v6": "rules=pab:6,hs:6,rc:2,cap:3,eab:6" };

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  // ---- R49a ---------------------------------------------------------------------------------------------------------
  const cur = track(D.boot(D.CUR));
  const cmd = track(D.boot(D.CMD));
  const drw = track(D.boot(D.DRAW));
  const rulesOf = (g) => J(g, "observeBattle().rules");
  same([rulesOf(cur).version, rulesOf(cur).hash], ["0.1.0-current", "0d3ce2ec6fa6de"], "R49a: current version / hash unchanged");
  same([rulesOf(cmd).version, rulesOf(cmd).hash], ["0.4.0-commander-enemy-actions-targets-fallback", "1ee7c8d5a26ec1"], "R49a: commander version / hash unchanged");
  const dr = rulesOf(drw);
  check(dr.preset === "commanderdraw" && dr.version === "0.1.0-commanderdraw-enemy-random-draw", "R49a: commanderdraw preset + version");
  check(dr.hash !== rulesOf(cmd).hash, "R49a: commanderdraw hash differs from commander for the same numbers");
  check(drw.ev("computeRulesHash(getEffectiveRulesRecord().values) === activeRules.hash"), "R49a: hash = computeRulesHash(effective record)");
  same(J(drw, "getEffectiveRulesRecord().values.enemyDraw"), { version: "0.1.0-commanderdraw-enemy-random-draw", weights: { Move: 1, Attack: 1, Defend: 1 },
    maxSameAction: 3, seedMix: { xor: 0x9e3779b9, multiply: 0x85ebca6b } }, "R49a: the hashed draw constants");
  [cur, cmd].forEach((g, i) => {
    const snap = J(g, "snapshotBattleState()");
    check(!("enemyDrawState" in snap.rng) && !("drawnPool" in snap.enemyPack), `R49a: ${i ? "commander" : "current"} BattleState has no enemy-draw key`);
  });
  const dsnap = J(drw, "snapshotBattleState()");
  check("enemyDrawState" in dsnap.rng && Array.isArray(dsnap.enemyPack.drawnPool), "R49a: commanderdraw BattleState carries the stream position and the drawn pool");
  same(drw.ev(`buildRulesLink(getDefaultSettings(), "intro", 1, "commanderdraw")`), "?scenario=intro&seed=1&preset=commanderdraw", "R49a: link (default numbers)");
  same(drw.ev(`buildRulesLink({ ...getDefaultSettings(), playerActionBudget: 4, handSize: 4, enemyActionBudget: 4 }, "intro", 1, "commanderdraw")`),
    "?scenario=intro&seed=1&preset=commanderdraw&rules=pab:4,hs:4,eab:4", "R49a: link (4v4)");
  same(drw.ev(`buildRulesLink(getDefaultSettings(), "intro", 1, "commander")`), "?scenario=intro&seed=1&preset=commander", "R49a: commander link unchanged");
  same(J(drw, "getRulesLinkStatus()"), { status: "applied", message: "preset commanderdraw (experimental: commander + random enemy action draw); default settings" }, "R49a: link status");
  same(drw.ev("getScenarioLabelText()"), "intro · seed 1 · commander draw (experimental)", "R49a: scenario label");
  check(drw.ev("isCommanderRules() && isEnemyDrawRules() && isTargetSelectionActive()") === true, "R49a: every commander rule applies (target selection active)");
  check(cmd.ev("isCommanderRules() && !isEnemyDrawRules()") === true && cur.ev("!isCommanderRules() && !isEnemyDrawRules()") === true, "R49a: the switch is off elsewhere");
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "..", "index.html"), "utf8");
  check(html.split("\n").some((l) => l.trim() === '<option value="commanderdraw">Commander draw ruleset (experimental: commander + random enemy action draw)</option>'), "R49a: panel option");
  out.identity = { commanderdraw: dr, commanderHash: rulesOf(cmd).hash, currentHash: rulesOf(cur).hash };
  out.equalBudgets = {};
  for (const [name, q] of Object.entries(EQUAL)) {
    const p = J(drw, `parseRulesParams(new URLSearchParams(${JSON.stringify(`?preset=commanderdraw&${q}`)}))`);
    check(p.ok === true && p.preset === "commanderdraw", `R49a: ${name} link parses with the preset`);
    out.equalBudgets[name] = { query: q, hash: drw.ev(`computeRulesHash(computeEffectiveRulesForPreset(${JSON.stringify(p.settings)}, "commanderdraw"))`) };
  }
  check(new Set(Object.values(out.equalBudgets).map((v) => v.hash)).size === 3, "R49a: the three equal-budget variants have distinct hashes");

  // ---- R49b ---------------------------------------------------------------------------------------------------------
  out.seedMix = Object.fromEntries([0, 1, 2, 3, 4294967295].map((s) => [s, drw.ev(`deriveEnemyDrawSeed(${s})`)]));
  check(new Set(Object.values(out.seedMix)).size === 5, "R49b: distinct derived seeds");
  check(Object.entries(out.seedMix).every(([s, v]) => Number(s) !== v), "R49b: the enemy seed is never the battle (hand) seed itself here");
  out.pinnedLists = {};
  [1, 2, 3].forEach((seed) => {
    const lists = D.pureLists(drw, seed, 3, 5);
    same(D.pureLists(drw, seed, 3, 5), lists, `R49b: seed ${seed}: same seed -> same lists`);
    out.pinnedLists[seed] = lists.map((l) => l.join(","));
  });
  check(new Set(Object.values(out.pinnedLists).map((l) => l.join("|"))).size === 3, "R49b: different seeds -> different lists");
  const structure = [];
  for (let budget = 0; budget <= 10; budget += 1) {
    [1, 2, 3].forEach((seed) => {
      const r = J(drw, `(function () { const s = createSeededRandom(deriveEnemyDrawSeed(${seed})); const l = drawEnemyActionList(s, ${budget});
        return { list: l, state: s.getState(), seed: deriveEnemyDrawSeed(${seed}) }; })()`);
      const c = D.counts(r.list);
      const cap = budget === 10 ? 4 : 3;
      check(r.list.length === budget, `R49b: budget ${budget} seed ${seed}: exactly ${budget} actions`);
      check(r.list.every((a) => ACTIONS.includes(a)), `R49b: budget ${budget} seed ${seed}: only the three actions`);
      check(Object.values(c).every((n) => n <= cap), `R49b: budget ${budget} seed ${seed}: cap ${cap} respected (${JSON.stringify(c)})`);
      check(r.state === D.advanced(r.seed, budget), `R49b: budget ${budget} seed ${seed}: exactly ${budget} stream values consumed`);
      if (seed === 1) structure.push(`${budget}: ${r.list.join(",") || "-"}`);
    });
  }
  out.budgets0to10Seed1 = structure;

  // ---- R49c live plans over 3 turns, seeds 1..3 -----------------------------------------------------------------------
  out.livePlans = {};
  for (const seed of [1, 2, 3]) {
    const g = track(D.boot(`?scenario=intro&seed=${seed}&preset=commanderdraw`));
    D.installDrawSpy(g);
    const expected = D.pureLists(g, seed, 3, 5).map(D.canonical);
    const pools = [D.drawStore(g).pool];
    check(D.drawStore(g).state === D.advanced(g.ev(`deriveEnemyDrawSeed(${seed})`), 5), `R49c: seed ${seed}: boot drew exactly one list`);
    for (let turn = 1; turn <= 2; turn += 1) {
      const orders = [...PV.L.queueByIndex(g, "player", [0]), ...PV.L.queueByIndex(g, "playerSupport", [0]), ...PV.L.queueByIndex(g, "playerFlank", [0])];
      check(orders.length === 3, `R49c: seed ${seed} turn ${turn}: three hand-authored orders`);
      PV.L.drainTurn(g);
      pools.push(D.drawStore(g).pool);
    }
    same(pools, expected, `R49c: seed ${seed}: plan pools of turns 1..3 = canonical pure lists 1..3`);
    same(D.drawCalls(g).map((c) => c.split(":")[0]), ["live", "live"], `R49c: seed ${seed}: one live draw per turn end, none elsewhere`);
    out.livePlans[seed] = pools.map((p) => p.join(","));
  }

  // ---- R49d stream isolation ------------------------------------------------------------------------------------------
  const handView = (g) => ({ hand: J(g, "playerHand"), handState: g.ev("handRandom.getState()"), handSeed: g.ev("handSeed") });
  const c2 = track(D.boot(`${D.CMD}&rules=rc:3`));
  const d2 = track(D.boot(`${D.DRAW}&rules=rc:3`));
  same(handView(d2), handView(c2), "R49d: boot hand and hand-stream position identical under commander and commanderdraw");
  const enemyBefore = D.drawStore(d2);
  [c2, d2].forEach((g) => check(J(g, "applyPlayerOrders([{ reshuffle: true }])").ok === true, "R49d: reshuffle applied"));
  same(handView(d2), handView(c2), "R49d: identical after a reshuffle");
  same(D.drawStore(d2), enemyBefore, "R49d: a reshuffle (hand draw) never moves the enemy stream");
  const ord = [{ unit: "P1", action: J(d2, "playerHand")[0] }, { unit: "P2", action: J(d2, "playerHand")[1] }];
  [c2, d2].forEach((g) => check(J(g, `runHeadlessTurn(${JSON.stringify(ord)})`).ok === true, "R49d: turn ran"));
  same(handView(d2), handView(c2), "R49d: identical hand refill after a played turn");
  const curStore0 = D.drawStore(cur);
  check(curStore0.pool === null && curStore0.state === cur.ev("deriveEnemyDrawSeed(1)"), "R49d: current: enemy stream seeded, never drawn");
  [cur, c2].forEach((g, i) => {
    const st = D.drawStore(g);
    check(st.pool === null && st.state === g.ev("deriveEnemyDrawSeed(1)"), `R49d: ${i ? "commander" : "current"}: no enemy draw ever (after load${i ? ", a reshuffle and a turn" : ""})`);
  });
  out.handIsolation = { afterTurn: handView(d2) };

  // ---- R49e BattleState -----------------------------------------------------------------------------------------------
  const g = track(D.boot(D.DRAW));
  const verdict = (edit, from = "snapshotBattleState()") => g.ev(`(function () { const s = ${from}; (${edit})(s);
    try { validateBattleState(s); return "ok"; } catch (e) { return e.name + ": " + e.message; } })()`);
  out.validation = {
    asIs: verdict("(s) => {}"),
    missingPosition: verdict("(s) => { delete s.rng.enemyDrawState; }"),
    negative: verdict("(s) => { s.rng.enemyDrawState = -1; }"),
    tooLarge: verdict("(s) => { s.rng.enemyDrawState = 4294967296; }"),
    fraction: verdict("(s) => { s.rng.enemyDrawState = 1.5; }"),
    badAction: verdict(`(s) => { s.enemyPack.drawnPool = ["Bite"]; }`),
    nullPool: verdict("(s) => { s.enemyPack.drawnPool = null; }"),
    missingPool: verdict("(s) => { delete s.enemyPack.drawnPool; }"),
  };
  out.validationOtherPresets = { commanderWithPosition: cmd.ev(`(function () { const s = snapshotBattleState(); s.rng.enemyDrawState = 5;
    try { validateBattleState(s); return "ok"; } catch (e) { return e.name + ": " + e.message; } })()`),
    currentWithPool: cur.ev(`(function () { const s = snapshotBattleState(); s.enemyPack.drawnPool = [];
    try { validateBattleState(s); return "ok"; } catch (e) { return e.name + ": " + e.message; } })()`) };
  check(out.validation.asIs === "ok" && out.validation.nullPool === "ok", "R49e: valid commanderdraw states pass");
  check(Object.entries(out.validation).filter(([k]) => !["asIs", "nullPool"].includes(k)).every(([, v]) => v.startsWith("BattleStateError")), "R49e: malformed draw fields refused");
  check(Object.values(out.validationOtherPresets).every((v) => v.startsWith("BattleStateError")), "R49e: draw fields refused under other presets");
  D.installDrawSpy(g);
  const live = D.drawStore(g);
  const copyPool = J(g, `withBattleState(snapshotBattleState(), () => { planEnemyPackTurnRules(units.filter((u) => u.team === "enemy" && u.type === "wolf"),
    units.filter((u) => u.team === "player")); return { ...getEnemyDrawState() }; })`);
  same(D.takeDrawCalls(g).map((c) => c.split(":")[0]), ["copy"], "R49e: the copy drew once");
  check(copyPool.state === D.advanced(live.state, 5), "R49e: the copy's stream advanced by one list");
  same(D.drawStore(g), live, "R49e: the live stream and pool are untouched by the copy's draw");
  const saved = J(g, "snapshotBattleState()");
  const savedText = g.ev("JSON.stringify(snapshotBattleState())");
  check(J(g, `runHeadlessTurn([{ unit: "P1", action: playerHand[0] }])`).ok === true, "R49e: a turn ran");
  check(D.drawStore(g).state !== live.state, "R49e: the turn end drew a new list");
  g.ev(`loadBattleState(${JSON.stringify(saved)})`);
  same(D.drawStore(g), live, "R49e: loadBattleState restores the stream position and pool");
  same(g.ev("JSON.stringify(snapshotBattleState())"), savedText, "R49e: and the full snapshot");

  out.hands = D.reportDrawHands(ID, ctxs);
  return { header: D.REQ_HEADER_DRAW, result: out };
}

module.exports = { id: ID, run };
