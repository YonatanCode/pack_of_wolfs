"use strict";
// REQUIREMENT — commanderdraw enemy draw weights (hard assertions; evidence in the golden; ENGINE-NOTES section 13.1)
// R52a DEFAULTS BYTE-IDENTICAL: current / commander / commanderdraw hashes unchanged (0d3ce2ec6fa6de / 1ee7c8d5a26ec1 /
//      197edd95522f77; 4v4 149db90d99fe1b, 6v6 0c62352e2b5ed9), also with the default weights written out
//      (dwm:1,dwa:1,dwd:1); the hashed enemyDraw record is unchanged; the pure lists with explicit 1 / 1 / 1 weights equal
//      r49's pinned lists (seeds 1..3) and budgets 0..10 (seed 1), read from r49's golden; the boot plan equals r49's; the
//      parse results of current / commander keep their shape (no enemyDrawWeights key); default links emit no dw key.
// R52b NON-DEFAULT WEIGHTS (three hand-picked triples): pinned lists for seeds 1..3 (3 lists, budget 5); for every budget
//      0..10 and seeds 1..3 the draw is formable exactly when validation accepts it, and then: exactly `budget` actions,
//      only actions with weight > 0 (weight 0 never drawn), cap respected, exactly `budget` stream values, same seed ->
//      same lists. Live boot (seed 1): hash = computeRulesHash(effective record), enemyDraw.weights = the triple, distinct
//      hashes, the boot plan = the canonical first pure list, customized record, label and link round trip.
// R52c HAND STREAM: the hand stream is bit-identical under default and non-default enemy weights (boot hand, a reshuffle,
//      a played turn's refill); the enemy stream advances by exactly one list per planning moment either way.
// R52d VALIDATION: every rejection case of the link parser with its pinned message (also under other presets), direct
//      validateEnemyDrawWeights cases, a rejected boot, Apply (refused when the draw cannot be formed; kept under
//      commanderdraw; reset to the defaults under another preset) and the tutorial reset.
// R52e DRY RUN = PLAY under non-default weights (seed 1, 1 / 3 / 1): the preview leaves the live battle (incl. the enemy
//      stream) unchanged; the real Play turn has the same events and final BattleState; its turn-end list is the second
//      pure list of those weights.
const fs = require("node:fs");
const path = require("node:path");
const D = require("./_draw.cjs");
const { S, PV } = D;
const { check, same, J } = S;

const ID = "r52-enemy-draw-weights";
const ACTIONS = ["Move", "Attack", "Defend"];
const R49 = JSON.parse(fs.readFileSync(path.join(__dirname, "goldens", "r49-enemy-draw-stream.json"), "utf8")).result;
const DEFAULT_W = { Move: 1, Attack: 1, Defend: 1 };
const TRIPLES = {
  attackHeavy: { weights: { Move: 1, Attack: 3, Defend: 1 }, link: "dwm:1,dwa:3,dwd:1" },
  noMove: { weights: { Move: 0, Attack: 1, Defend: 1 }, link: "dwm:0,dwa:1,dwd:1" },
  moveHeavyNoDefend: { weights: { Move: 5, Attack: 1, Defend: 0 }, link: "dwm:5,dwa:1,dwd:0" },
};
const drawQuery = (rules) => `${D.DRAW}${rules ? `&rules=${rules}` : ""}`;
const parse = (g, query) => J(g, `parseRulesParams(new URLSearchParams(${JSON.stringify(query)}))`);
const rejected = (reason) => ({ ok: false, message: `rules link rejected (${reason}); default settings are used` });

async function run() {
  const ctxs = [];
  const track = (g) => { ctxs.push(g); return g; };
  const out = {};

  // ---- R52a ---------------------------------------------------------------------------------------------------------
  const cur = track(D.boot(D.CUR));
  const cmd = track(D.boot(D.CMD));
  const drw = track(D.boot(D.DRAW));
  const hashOf = (g) => g.ev("activeRules.hash");
  same([hashOf(cur), hashOf(cmd), hashOf(drw)], ["0d3ce2ec6fa6de", "1ee7c8d5a26ec1", "197edd95522f77"], "R52a: current / commander / commanderdraw default hashes unchanged");
  same(J(drw, "getEffectiveRulesRecord().values.enemyDraw"), { version: "0.1.0-commanderdraw-enemy-random-draw", weights: DEFAULT_W, maxSameAction: 3,
    seedMix: { xor: 0x9e3779b9, multiply: 0x85ebca6b } }, "R52a: the hashed draw record is unchanged");
  check(J(drw, "getEffectiveRulesRecord()").customized === false, "R52a: default commanderdraw is not customized");
  const hashFor = (g, query) => {
    const p = parse(g, query);
    check(p.ok === true, `R52a: parses: ${query} (${p.message})`);
    return g.ev(`computeRulesHash(computeEffectiveRulesForPreset(${JSON.stringify(p.settings)}, ${JSON.stringify(p.preset ?? "current")}, ${JSON.stringify(p.enemyDrawWeights)}))`);
  };
  same(hashFor(drw, "?preset=commanderdraw&rules=dwm:1,dwa:1,dwd:1"), "197edd95522f77", "R52a: explicit default weights hash as the defaults");
  same(hashFor(drw, "?preset=commanderdraw&rules=pab:4,hs:4,rc:2,cap:3,eab:4,dwm:1,dwa:1,dwd:1"), "149db90d99fe1b", "R52a: 4v4 hash unchanged with explicit default weights");
  same(hashFor(drw, "?preset=commanderdraw&rules=pab:6,hs:6,rc:2,cap:3,eab:6"), "0c62352e2b5ed9", "R52a: 6v6 hash unchanged");
  same(parse(drw, "?preset=commanderdraw").enemyDrawWeights, DEFAULT_W, "R52a: commanderdraw parse carries the default weights");
  check(!("enemyDrawWeights" in parse(drw, "?preset=commander&rules=pab:3")) && !("enemyDrawWeights" in parse(drw, "?rules=pab:3")), "R52a: current / commander parse results keep their shape");
  [1, 2, 3].forEach((seed) => {
    same(D.pureLists(drw, seed, 3, 5, DEFAULT_W).map((l) => l.join(",")), R49.pinnedLists[seed], `R52a: seed ${seed}: explicit 1 / 1 / 1 lists = r49's pinned lists`);
  });
  same(Array.from({ length: 11 }, (_, b) => `${b}: ${D.pureLists(drw, 1, 1, b, DEFAULT_W)[0].join(",") || "-"}`), R49.budgets0to10Seed1, "R52a: budgets 0..10 (seed 1) = r49's");
  same(D.drawStore(drw).pool.join(","), R49.livePlans[1][0], "R52a: the default boot plan = r49's");
  same(drw.ev(`buildRulesLink(getDefaultSettings(), "intro", 1, "commanderdraw", getActiveEnemyDrawWeights())`), "?scenario=intro&seed=1&preset=commanderdraw", "R52a: default weights emit no dw key");
  out.defaults = { hashes: { current: hashOf(cur), commander: hashOf(cmd), commanderdraw: hashOf(drw) } };

  // ---- R52b ---------------------------------------------------------------------------------------------------------
  out.triples = {};
  const live = {};
  for (const [name, { weights, link }] of Object.entries(TRIPLES)) {
    const allowed = ACTIONS.filter((a) => weights[a] > 0);
    const pinned = {};
    [1, 2, 3].forEach((seed) => {
      const lists = D.pureLists(drw, seed, 3, 5, weights);
      same(D.pureLists(drw, seed, 3, 5, weights), lists, `R52b: ${name} seed ${seed}: same seed -> same lists`);
      pinned[seed] = lists.map((l) => l.join(","));
    });
    check(JSON.stringify(pinned) !== JSON.stringify(R49.pinnedLists), `R52b: ${name}: the weights change the lists`);
    const formable = [];
    for (let budget = 0; budget <= 10; budget += 1) {
      const verdict = J(drw, `validateEnemyDrawWeights(${JSON.stringify(weights)}, { ...getDefaultSettings(), enemyActionBudget: ${budget} })`);
      const cap = budget === 10 ? 4 : 3;
      check(verdict.valid === (allowed.length * cap >= budget), `R52b: ${name} budget ${budget}: validation accepts exactly the formable budgets`);
      if (!verdict.valid) continue;
      formable.push(budget);
      [1, 2, 3].forEach((seed) => {
        const r = J(drw, `(function () { const s = createSeededRandom(deriveEnemyDrawSeed(${seed})); const l = drawEnemyActionList(s, ${budget}, ${JSON.stringify(weights)});
          return { list: l, state: s.getState(), seed: deriveEnemyDrawSeed(${seed}) }; })()`);
        const c = D.counts(r.list);
        check(r.list.length === budget, `R52b: ${name} budget ${budget} seed ${seed}: exactly ${budget} actions`);
        check(r.list.every((a) => allowed.includes(a)), `R52b: ${name} budget ${budget} seed ${seed}: only actions with weight > 0 (${r.list.join(",")})`);
        check(Object.values(c).every((n) => n <= cap), `R52b: ${name} budget ${budget} seed ${seed}: cap ${cap} respected (${JSON.stringify(c)})`);
        check(r.state === D.advanced(r.seed, budget), `R52b: ${name} budget ${budget} seed ${seed}: exactly ${budget} stream values consumed`);
      });
    }
    const g = track(D.boot(drawQuery(link)));
    live[name] = g;
    same(J(g, "getRulesLinkStatus()").status, "applied", `R52b: ${name}: link applied`);
    same(J(g, "getEffectiveRulesRecord().values.enemyDraw.weights"), weights, `R52b: ${name}: hashed weights = the triple`);
    check(g.ev("computeRulesHash(getEffectiveRulesRecord().values) === activeRules.hash"), `R52b: ${name}: hash = computeRulesHash(effective record)`);
    check(J(g, "getEffectiveRulesRecord()").customized === true, `R52b: ${name}: the record is customized`);
    same(D.drawStore(g).pool, D.canonical(D.pureLists(g, 1, 1, 5, weights)[0]), `R52b: ${name}: the boot plan = the canonical first pure list`);
    check(D.drawStore(g).pool.every((a) => allowed.includes(a)), `R52b: ${name}: the live plan has no weight-0 action`);
    same(g.ev("getScenarioLabelText()"), `intro · seed 1 · custom rules ${hashOf(g).slice(0, 6)} · commander draw (experimental)`, `R52b: ${name}: label`);
    const copyLink = g.ev(`buildRulesLink(getActiveSettings(), "intro", 1, "commanderdraw", getActiveEnemyDrawWeights())`);
    const back = parse(g, copyLink.slice(copyLink.indexOf("?")));
    check(back.ok === true, `R52b: ${name}: the copy link parses (${copyLink})`);
    same(back.enemyDrawWeights, weights, `R52b: ${name}: the copy link round-trips the weights`);
    out.triples[name] = { weights, link, hash: hashOf(g), copyLink, formableBudgets: formable, pinnedLists: pinned, bootPlan: D.drawStore(g).pool };
  }
  const hashes = [hashOf(drw), ...Object.values(out.triples).map((t) => t.hash)];
  check(new Set(hashes).size === hashes.length, "R52b: every weight triple has its own hash");
  same(drw.ev(`buildRulesLink(getDefaultSettings(), "intro", 1, "commander", { Move: 0, Attack: 2, Defend: 1 })`), "?scenario=intro&seed=1&preset=commander", "R52b: other presets never emit dw keys");

  // ---- R52c + R52e: one hand-authored turn under default (drw) and 1 / 3 / 1 weights (heavy), same orders ----------------
  const heavy = live.attackHeavy;
  const handView = (g) => ({ hand: J(g, "playerHand"), handState: g.ev("handRandom.getState()"), handSeed: g.ev("handSeed") });
  same(handView(heavy), handView(drw), "R52c: boot hand and hand-stream position identical under default and non-default enemy weights");
  [drw, heavy].forEach((g) => check(J(g, "applyPlayerOrders([{ reshuffle: true }])").ok === true, "R52c: reshuffle applied"));
  same(handView(heavy), handView(drw), "R52c: identical after a reshuffle");
  const stores0 = [D.drawStore(drw), D.drawStore(heavy)];
  same(stores0.map((s) => s.state), [D.advanced(drw.ev("deriveEnemyDrawSeed(1)"), 5), D.advanced(heavy.ev("deriveEnemyDrawSeed(1)"), 5)], "R52c: one list drawn at boot either way");
  // hand-authored: one card per wolf, the first three cards of the (identical) hand, through the order door
  const hand = J(heavy, "playerHand");
  const orders = [{ unit: "P1", action: hand[0] }, { unit: "P2", action: hand[1] }, { unit: "P3", action: hand[2] }];
  [heavy, drw].forEach((g) => check(J(g, `applyPlayerOrders(${JSON.stringify(orders)})`).ok === true, "R52c: the same orders queued in both battles"));
  D.installDrawSpy(heavy);
  const fp = PV.liveFingerprint(heavy);
  const preview = PV.dryRun(heavy);
  check(preview.ok === true, "R52e: preview ran");
  same(PV.liveFingerprint(heavy), fp, "R52e: the preview leaves the live battle unchanged (incl. the enemy stream)");
  same(D.drawStore(heavy), stores0[1], "R52e: the live enemy stream did not move during the preview");
  const copyDraws = D.takeDrawCalls(heavy);
  check(copyDraws.length === 1 && copyDraws[0].startsWith("copy:"), "R52e: the preview drew once, on its copy");
  const events = await PV.L.playTurn(heavy);
  same(preview.result.events, events, "R52e: preview events = played events");
  same(preview.result.finalState, PV.snapshot(heavy), "R52e: preview final BattleState = played (incl. enemy stream and drawn pool)");
  same(D.takeDrawCalls(heavy), [copyDraws[0].replace("copy:", "live:")], "R52e: the played turn's only draw is the turn end's, equal to the copy's");
  const heavyW = TRIPLES.attackHeavy.weights;
  same(D.drawStore(heavy).pool, D.canonical(D.pureLists(heavy, 1, 2, 5, heavyW)[1]), "R52e: the turn-end list is the second pure list of the weights");
  await PV.L.playTurn(drw);
  same(handView(heavy), handView(drw), "R52c: identical hand refill after the played turn");
  same(D.drawStore(drw).pool.join(","), R49.livePlans[1][1], "R52c: the default battle's turn-end list = r49's turn 2 plan");
  out.turn = { orders, eventHash: PV.L.hashEvents(events), finalStateHash: PV.sha256(JSON.stringify(PV.snapshot(heavy))), nextPool: D.drawStore(heavy).pool,
    hand: handView(heavy) };

  // ---- R52d ---------------------------------------------------------------------------------------------------------
  const REJECT = {
    noPreset: ["?rules=dwm:2", "dwm is an enemy draw weight: it needs preset=commanderdraw"],
    current: ["?preset=current&rules=pab:4,dwa:2", "dwa is an enemy draw weight: it needs preset=commanderdraw"],
    commander: ["?preset=commander&rules=dwd:0", "dwd is an enemy draw weight: it needs preset=commanderdraw"],
    duplicate: ["?preset=commanderdraw&rules=dwm:1,dwm:2", 'duplicate key "dwm"'],
    fraction: ["?preset=commanderdraw&rules=dwa:1.5", 'dwa must be a whole number, got "1.5"'],
    negative: ["?preset=commanderdraw&rules=dwa:-1", 'dwa must be a whole number, got "-1"'],
    leadingZero: ["?preset=commanderdraw&rules=dwd:05", 'dwd must be a whole number, got "05"'],
    empty: ["?preset=commanderdraw&rules=dwd:", 'dwd must be a whole number, got ""'],
    junk: ["?preset=commanderdraw&rules=dwm:2x", 'dwm must be a whole number, got "2x"'],
    upperCase: ["?preset=commanderdraw&rules=DWM:2", 'malformed pair "DWM:2"'],
    overMax: ["?preset=commanderdraw&rules=dwm:21", "enemyWeightMove must be a whole number from 0 to 20"],
    hugeNumber: ["?preset=commanderdraw&rules=dwa:1234567", 'dwa must be a whole number, got "1234567"'],
    allZero: ["?preset=commanderdraw&rules=dwm:0,dwa:0,dwd:0",
      "at least one enemy draw weight must be greater than 0; the enemy draw cannot be formed: 0 drawable action(s) x cap 3 = 0, but enemyActionBudget is 5"],
    allZeroBudgetZero: ["?preset=commanderdraw&rules=eab:0,dwm:0,dwa:0,dwd:0", "at least one enemy draw weight must be greater than 0"],
    twoActionsBudget7: ["?preset=commanderdraw&rules=eab:7,dwm:0", "the enemy draw cannot be formed: 2 drawable action(s) x cap 3 = 6, but enemyActionBudget is 7"],
    oneActionBudget4: ["?preset=commanderdraw&rules=eab:4,dwm:0,dwa:0", "the enemy draw cannot be formed: 1 drawable action(s) x cap 3 = 3, but enemyActionBudget is 4"],
    twoActionsBudget10: ["?preset=commanderdraw&rules=eab:10,dwd:0", "the enemy draw cannot be formed: 2 drawable action(s) x cap 4 = 8, but enemyActionBudget is 10"],
    withSettingsErrors: ["?preset=commanderdraw&rules=hs:9,dwm:0,dwa:0,dwd:0",
      "handSize must be a whole number from 1 to 8; at least one enemy draw weight must be greater than 0; the enemy draw cannot be formed: 0 drawable action(s) x cap 3 = 0, but enemyActionBudget is 5"],
  };
  out.rejections = {};
  Object.entries(REJECT).forEach(([name, [query, reason]]) => {
    same(parse(drw, query), rejected(reason), `R52d: rejects ${name}: ${query}`);
    out.rejections[name] = reason;
  });
  const ACCEPT = ["eab:6,dwm:0", "eab:3,dwm:0,dwa:0,dwd:20", "dwm:20,dwa:20,dwd:20", "eab:0,dwm:0,dwa:0,dwd:1", "eab:10,dwm:1,dwa:1,dwd:1", "dwa:0,pab:4"];
  ACCEPT.forEach((rules) => check(parse(drw, `?preset=commanderdraw&rules=${rules}`).ok === true, `R52d: accepts ${rules}`));
  const direct = (expr) => J(drw, `validateEnemyDrawWeights(${expr}, getDefaultSettings()).errors.map((e) => e.message)`);
  out.direct = {
    notObject: direct("null"),
    array: direct("[1, 1, 1]"),
    unknownAction: direct("({ Move: 1, Attack: 1, Defend: 1, Bite: 1 })"),
    stringValue: direct(`({ Move: "1", Attack: 1, Defend: 1 })`),
    fraction: direct("({ Move: 1, Attack: 1.5, Defend: 1 })"),
    missing: direct("({ Move: 1, Attack: 1 })"),
  };
  same(out.direct, {
    notObject: ["enemy draw weights must be an object"], array: ["enemy draw weights must be an object"], unknownAction: ["Bite is not an enemy draw action"],
    stringValue: ["enemyWeightMove must be a whole number from 0 to 20"], fraction: ["enemyWeightAttack must be a whole number from 0 to 20"],
    missing: ["enemyWeightDefend must be a whole number from 0 to 20"],
  }, "R52d: direct validation messages (no coercion)");

  const bad = track(D.boot(drawQuery("dwm:0,dwa:0,dwd:0")));
  same(J(bad, "getRulesLinkStatus()").status, "rejected", "R52d: a rejected link boots with the defaults");
  same([hashOf(bad), J(bad, "getActiveEnemyDrawWeights()")], ["0d3ce2ec6fa6de", DEFAULT_W], "R52d: rejected link: current default hash and default weights");

  const nm = live.noMove; // 0 / 1 / 1, eab 5
  const nmHash = hashOf(nm);
  const refusedApply = S.apply(nm, { enemyActionBudget: 7 });
  same([refusedApply.ok, refusedApply.reason, refusedApply.errors], [false, "invalid", [{ field: "enemyActionBudget",
    message: "the enemy draw cannot be formed: 2 drawable action(s) x cap 3 = 6, but enemyActionBudget is 7" }]], "R52d: Apply refuses a draw that cannot be formed");
  same([hashOf(nm), J(nm, "getActiveEnemyDrawWeights()"), J(nm, "getActiveSettings()").enemyActionBudget], [nmHash, TRIPLES.noMove.weights, 5], "R52d: the refused Apply changed nothing");
  const okApply = S.apply(nm, { enemyActionBudget: 6 });
  check(okApply.ok === true, "R52d: Apply with a formable budget");
  same(J(nm, "getActiveEnemyDrawWeights()"), TRIPLES.noMove.weights, "R52d: Apply under commanderdraw keeps the weights");
  same(hashOf(nm), nm.ev(`computeRulesHash(computeEffectiveRulesForPreset({ ...getDefaultSettings(), enemyActionBudget: 6 }, "commanderdraw", ${JSON.stringify(TRIPLES.noMove.weights)}))`),
    "R52d: the applied hash covers the kept weights");
  check(D.drawStore(nm).pool.length === 6 && !D.drawStore(nm).pool.includes("Move"), "R52d: the restarted battle draws 6 actions without Move");
  nm.ev(`setPendingPreset("commander")`);
  check(S.apply(nm).ok === true, "R52d: Apply under commander");
  same([J(nm, "getActiveEnemyDrawWeights()"), nm.ev("getActivePreset()")], [DEFAULT_W, "commander"], "R52d: Apply under another preset resets the weights to the defaults");
  const mh = live.moveHeavyNoDefend;
  check(mh.ev("enterTutorialDefaultSettings()") === true, "R52d: the tutorial switch ran");
  same([J(mh, "getActiveEnemyDrawWeights()"), mh.ev("getActivePreset()"), hashOf(mh)], [DEFAULT_W, "current", "0d3ce2ec6fa6de"], "R52d: the tutorial resets the weights with the preset");
  out.apply = { refusedErrors: refusedApply.errors, appliedHash: okApply.record.hash };

  out.hands = D.reportWeightHands(ID, ctxs);
  return { header: "REQUIREMENT — commanderdraw enemy draw weights", result: out };
}

module.exports = { id: ID, run };
