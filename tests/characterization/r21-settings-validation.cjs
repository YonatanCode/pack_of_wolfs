"use strict";
// REQUIREMENT — P2a acceptance (hard assertions; tables and messages are reported in the golden)
// R21a: SETTINGS_BOUNDS and the defaults (defaults expand to exactly today's perBattle values and pool array).
// R21b: strict per-field validation: min / max accepted, min-1 / max+1 / 1.5 / "5" / "5abc" / NaN / Infinity / null /
//       undefined / true rejected (no coercion), with the exact message.
// R21c: cross-field errors and warnings (exact messages), all problems reported together, zero enemy budget valid.
// R21d: link grammar: round trip, fixed key order, default -> no rules param, strict rejection of the WHOLE parameter,
//       boot behaviour (rejected -> defaults + status, applied, world mode ignores), presets, strict panel input parsing.
const P = require("./_settings.cjs");
const { check, same, J, DEFAULTS, DEFAULT_HASH } = P;

const ID = "r21-settings-validation";
const BOUNDS = {
  playerActionBudget: [1, 8], handSize: [1, 8], reshuffleCharges: [0, 9], maxSameAction: [1, 8],
  weightMove: [0, 20], weightAttack: [0, 20], weightDefend: [0, 20], enemyActionBudget: [0, 10], poolMove: [0, 10], poolDefend: [0, 10], poolAttack: [0, 10],
};
// companions that keep the cross-field rules satisfied while a field sits on its edge
const EDGE_COMPANION = { maxSameAction: { 1: { handSize: 3 } }, handSize: {}, weightMove: {}, weightAttack: {}, weightDefend: {} };
const BAD = { "1.5": "1.5", '"5"': '"5"', '"5abc"': '"5abc"', NaN: "NaN", Infinity: "Infinity", "-Infinity": "-Infinity", null: "null", undefined: "undefined", true: "true", "[]": "[]", '""': '""' };

async function run() {
  const ctxs = [];
  const mk = (q) => { const c = P.boot(q); ctxs.push(c); return c; };
  const g = mk();
  const v = (expr) => J(g, `validateSettings(${expr})`);
  const withField = (key, valueExpr, companion = {}) => `({ ...getDefaultSettings(), ...${JSON.stringify(companion)}, ${key}: ${valueExpr} })`;

  // ---- R21a
  same(J(g, "window.SETTINGS_BOUNDS"), Object.fromEntries(Object.entries(BOUNDS).map(([k, [min, max]]) => [k, { min, max }])), "SETTINGS_BOUNDS table");
  same(J(g, "getDefaultSettings()"), DEFAULTS, "default settings");
  same(J(g, "settingsToPerBattle(getDefaultSettings())"), J(g, "RULES.perBattle"), "default settings expand to exactly RULES.perBattle");
  same(J(g, "settingsToPerBattle(getDefaultSettings()).enemyActionPool"), ["Move", "Move", "Defend", "Attack", "Attack"], "default pool array");
  same(J(g, "settingsToPerBattle({ ...getDefaultSettings(), poolMove: 1, poolDefend: 2, poolAttack: 3 }).enemyActionPool"),
    ["Move", "Defend", "Defend", "Attack", "Attack", "Attack"], "pool order is canonical: Move, Defend, Attack");
  check(g.ev("computeRulesHash(computeEffectiveRules(getDefaultSettings()))") === DEFAULT_HASH && g.ev("RULES_HASH") === DEFAULT_HASH, "default effective hash is 0d3ce2ec6fa6de");
  same(J(g, "window.RULESET_PRESETS"), { current: { label: "Current rules", available: true },
    commander: { label: "Commander ruleset (experimental: enemy-action rules only)", available: true } }, "preset registry");

  // ---- R21b
  const fieldReport = {};
  Object.entries(BOUNDS).forEach(([key, [min, max]]) => {
    const msg = `${key} must be a whole number from ${min} to ${max}`;
    const row = { accepted: [], rejected: [] };
    [min, max].forEach((edge) => {
      const r = v(withField(key, String(edge), EDGE_COMPANION[key]?.[edge] ?? {}));
      check(r.valid === true && r.errors.length === 0, `${key}=${edge} is valid (${JSON.stringify(r.errors)})`);
      row.accepted.push(edge);
    });
    [[min - 1, String(min - 1)], [max + 1, String(max + 1)], ...Object.entries(BAD).map(([label, expr]) => [label, expr])].forEach(([label, expr]) => {
      const r = v(withField(key, expr));
      same(r.errors, [{ field: key, message: msg }], `${key}=${label} is rejected with exactly one exact error`);
      check(r.valid === false, `${key}=${label} invalid`);
      row.rejected.push(String(label));
    });
    fieldReport[key] = { message: msg, ...row };
  });

  // ---- R21c
  const W = (m, a, d, extra = {}) => `({ ...getDefaultSettings(), weightMove: ${m}, weightAttack: ${a}, weightDefend: ${d}, ...${JSON.stringify(extra)} })`;
  const cross = {};
  cross.allZero = v(W(0, 0, 0));
  same(cross.allZero.errors, [
    { field: "drawWeights", message: "at least one draw weight must be greater than 0" },
    { field: "handSize", message: "the hand cannot be filled: 0 drawable action(s) x maxSameAction 3 = 0, but handSize is 5" }], "all weights 0: both errors, exact");
  cross.oneDrawable = v(W(1, 0, 0));
  same(cross.oneDrawable.errors, [{ field: "handSize", message: "the hand cannot be filled: 1 drawable action(s) x maxSameAction 3 = 3, but handSize is 5" }], "1 drawable x cap 3 < hand 5");
  check(v(W(1, 0, 0, { handSize: 3 })).valid && v(W(1, 1, 0, { handSize: 6 })).valid && !v(W(1, 1, 0, { handSize: 7 })).valid, "fillability boundary: drawable x cap >= handSize");
  cross.capLow = v(`({ ...getDefaultSettings(), maxSameAction: 1 })`);
  same(cross.capLow.errors, [{ field: "handSize", message: "the hand cannot be filled: 3 drawable action(s) x maxSameAction 1 = 3, but handSize is 5" }], "cap 1 with hand 5");
  cross.budgetAboveHand = v(`({ ...getDefaultSettings(), playerActionBudget: 6 })`);
  check(cross.budgetAboveHand.valid === true, "player budget above hand size is allowed");
  same(cross.budgetAboveHand.warnings, [{ field: "playerActionBudget", message: "at most 5 cards can be queued per turn; the budget is not resized" }], "player budget warning");
  cross.enemyBudgetAbovePool = v(`({ ...getDefaultSettings(), enemyActionBudget: 5, poolMove: 2, poolDefend: 0, poolAttack: 0 })`);
  check(cross.enemyBudgetAbovePool.valid === true, "enemy budget above pool is allowed");
  same(cross.enemyBudgetAbovePool.warnings, [{ field: "enemyActionBudget", message: "the enemy can plan at most 2 actions (pool size); neither budget nor pool is resized" }], "enemy budget > pool warning");
  cross.emptyPool = v(`({ ...getDefaultSettings(), enemyActionBudget: 3, poolMove: 0, poolDefend: 0, poolAttack: 0 })`);
  check(cross.emptyPool.valid === true, "empty pool with budget > 0 is allowed");
  same(cross.emptyPool.warnings, [{ field: "enemyActionBudget", message: "the enemy has nothing to plan" }], "empty pool warning");
  cross.zeroBudget = v(`({ ...getDefaultSettings(), enemyActionBudget: 0 })`);
  check(cross.zeroBudget.valid === true && cross.zeroBudget.warnings.length === 0, "zero enemy budget is valid and silent");
  cross.zeroBudgetEmptyPool = v(`({ ...getDefaultSettings(), enemyActionBudget: 0, poolMove: 0, poolDefend: 0, poolAttack: 0 })`);
  check(cross.zeroBudgetEmptyPool.valid === true && cross.zeroBudgetEmptyPool.warnings.length === 0, "zero budget with empty pool: valid, no warning");
  check(v("getDefaultSettings()").valid && v("getDefaultSettings()").warnings.length === 0, "defaults: valid, no warnings");
  cross.together = v(`({ ...getDefaultSettings(), playerActionBudget: "5", handSize: 9, reshuffleCharges: -1, weightMove: 0, weightAttack: 0, weightDefend: 0, enemyActionBudget: 4, poolMove: 0, poolDefend: 0, poolAttack: 0 })`);
  same(cross.together.errors.map((e) => e.field), ["playerActionBudget", "handSize", "reshuffleCharges", "drawWeights"], "all problems at once (field errors + weights)");
  same(cross.together.warnings, [{ field: "enemyActionBudget", message: "the enemy has nothing to plan" }], "warnings reported next to the errors");
  cross.empty = v("{}");
  check(cross.empty.errors.length === 11 && cross.empty.valid === false, "an empty object reports all 11 fields");
  cross.unknown = v(`({ ...getDefaultSettings(), bogus: 1 })`);
  same(cross.unknown.errors, [{ field: "bogus", message: "bogus is not a known setting" }], "unknown key");
  same(v("null").errors, [{ field: "settings", message: "settings must be an object" }], "non-object");
  const before = J(g, "getDefaultSettings()");
  g.ev("const probe = { ...getDefaultSettings(), handSize: 99 }; validateSettings(probe); window.__probe = JSON.stringify(probe);");
  check(JSON.parse(g.ev("window.__probe")).handSize === 99 && JSON.stringify(before) === JSON.stringify(DEFAULTS), "validation does not mutate its input");

  // ---- R21d: link grammar
  const parse = (query) => J(g, `parseRulesParams(new URLSearchParams(${JSON.stringify(query)}))`);
  const link = (patchExpr) => g.ev(`buildRulesLink({ ...getDefaultSettings(), ...${patchExpr} }, "intro", 7)`);
  check(link("{}") === "?scenario=intro&seed=7" && g.ev("formatRulesParam(getDefaultSettings())") === "", "default settings: no preset/rules parameter at all");
  const SAMPLES = [
    { handSize: 7, playerActionBudget: 3 }, { enemyActionBudget: 0 }, { weightMove: 6, weightAttack: 0, weightDefend: 2, maxSameAction: 4 },
    { poolMove: 0, poolDefend: 3, poolAttack: 1, enemyActionBudget: 4 }, { reshuffleCharges: 0, handSize: 8, playerActionBudget: 8, maxSameAction: 8 },
    { playerActionBudget: 1, handSize: 1, reshuffleCharges: 9, maxSameAction: 1, weightMove: 20, weightAttack: 20, weightDefend: 20, enemyActionBudget: 10, poolMove: 10, poolDefend: 10, poolAttack: 10 },
  ];
  const roundTrips = SAMPLES.map((patch) => {
    const l = link(JSON.stringify(patch));
    const query = l.slice(l.indexOf("&seed=") + 1);
    const r = parse(query);
    check(r.ok === true && r.hasRules === true, `round trip parses: ${l}`);
    same(r.settings, { ...DEFAULTS, ...patch }, `round trip settings: ${l}`);
    same(J(g, `getSettingsKeys()`).filter((k) => ({ ...DEFAULTS, ...patch })[k] !== DEFAULTS[k]).map((k) => P.KEY[k]), l.split("rules=")[1].split(",").map((x) => x.split(":")[0]), `only non-default keys, fixed order: ${l}`);
    return l;
  });
  check(roundTrips[0] === "?scenario=intro&seed=7&preset=current&rules=pab:3,hs:7", "key order is pab,hs,rc,cap,wm,wa,wd,eab,epm,epd,epa");
  same(parse("seed=7"), { ok: true, settings: DEFAULTS, hasRules: false }, "no rules parameter: defaults");
  same(parse("preset=current"), { ok: true, settings: DEFAULTS, hasRules: false }, "preset=current alone: defaults");
  const REJECT = {
    unknownKey: ["rules=zz:1", 'unknown key "zz"'], duplicateKey: ["rules=hs:5,hs:6", 'duplicate key "hs"'], malformedNoColon: ["rules=hs5", 'malformed pair "hs5"'],
    malformedEmptyValue: ["rules=hs:", 'hs must be a whole number, got ""'], emptyRules: ["rules=", 'malformed pair ""'], trailingComma: ["rules=hs:6,", 'malformed pair ""'],
    fraction: ["rules=hs:1.5", 'hs must be a whole number, got "1.5"'], trailingJunk: ["rules=hs:5abc", 'hs must be a whole number, got "5abc"'],
    negative: ["rules=hs:-1", 'hs must be a whole number, got "-1"'], spaced: ["rules=hs:%205", 'hs must be a whole number, got " 5"'],
    leadingZero: ["rules=hs:05", 'hs must be a whole number, got "05"'], upperKey: ["rules=HS:5", 'malformed pair "HS:5"'],
    overMax: ["rules=hs:9", "handSize must be a whole number from 1 to 8"], underMin: ["rules=pab:0", "playerActionBudget must be a whole number from 1 to 8"],
    weightOverMax: ["rules=wm:21", "weightMove must be a whole number from 0 to 20"],
    crossField: ["rules=wm:0,wa:0,wd:0", "at least one draw weight must be greater than 0; the hand cannot be filled: 0 drawable action(s) x maxSameAction 3 = 0, but handSize is 5"],
    bogusPreset: ["preset=bogus&rules=hs:6", 'unknown preset "bogus"'], duplicatePreset: ["preset=current&preset=current", "duplicate preset parameter"],
    duplicateRules: ["rules=hs:6&rules=hs:7", "duplicate rules parameter"],
  };
  const rejectReport = {};
  Object.entries(REJECT).forEach(([name, [query, reason]]) => {
    const r = parse(query);
    same(r, { ok: false, message: `rules link rejected (${reason}); default settings are used` }, `rejects ${name}: ${query}`);
    rejectReport[name] = r.message;
  });
  // boot behaviour (4 boots): rejected link -> defaults + status; valid -> applied; world -> ignored
  const bootStatus = {};
  ["&preset=current&rules=hs:7,hs:6", "&preset=bogus&rules=hs:7", "&rules=hs:9,pab:3"].forEach((q, i) => {
    const b = mk(`?scenario=intro&seed=1${q}`);
    const st = J(b, "window.devTest.getRulesLinkStatus()");
    check(st.status === "rejected" && st.message.startsWith("rules link rejected ("), `boot ${q}: rejected`);
    check(P.record(b).hash === DEFAULT_HASH && P.record(b).customized === false && b.ev("actionsList.children.length") === 5, `boot ${q}: battle booted with the defaults (no partial application)`);
    check(P.messages(b).some((m) => m.text === st.message && m.cls === "is-warning"), `boot ${q}: message surfaced in the panel`);
    bootStatus[`rejected${i}`] = st.message;
  });
  const ok = mk("?scenario=intro&seed=1&preset=current&rules=hs:7,wm:6");
  same(J(ok, "window.devTest.getRulesLinkStatus()"), { status: "applied", message: "rules link applied" }, "valid link status");
  same(P.activeSettings(ok), { ...DEFAULTS, handSize: 7, weightMove: 6 }, "valid link: active settings");
  same(P.pendingSettings(ok), P.activeSettings(ok), "valid link: pending = active");
  check(P.record(ok).customized === true && P.record(ok).hash !== DEFAULT_HASH && ok.ev("actionsList.children.length") === 7, "valid link applied at boot (hand of 7)");
  same(ok.ev("document.documentElement.style.getPropertyValue('--hand-slots')") + "/" + ok.ev("document.documentElement.style.getPropertyValue('--queue-slots')"), "7/5", "CSS variables follow the active settings");
  const def = mk();
  same(def.ev("document.documentElement.style.getPropertyValue('--hand-slots')") + "/" + def.ev("document.documentElement.style.getPropertyValue('--queue-slots')"), "5/5", "default CSS variables 5/5");
  const world = mk("?mode=world&preset=current&rules=hs:7");
  same(J(world, "window.devTest.getRulesLinkStatus()"), { status: "ignored", message: "rules link ignored: world mode always uses the default settings" }, "world mode ignores the link, with a message");
  check(P.record(world).hash === DEFAULT_HASH && P.hasClass(world, "rules-panel", "is-locked") && P.messages(world).some((m) => /world mode/.test(m.text)), "world mode: defaults, panel locked, message shown");
  same(P.attempt(world, "window.devTest.applyPendingSettings()"), "DryRunRejected:no-scenario-battle", "world mode: Apply refused");
  // presets in the panel
  const pr = mk();
  pr.ev("document.getElementById('rules-preset').value = 'commander'");
  P.click(pr, "rules-preset", "change");
  check(pr.ev("window.devTest.getPendingPreset()") === "commander" && pr.ev("document.getElementById('rules-preset').value") === "commander", "selecting commander sets the pending preset");
  check(!P.messages(pr).some((m) => m.cls === "is-error"), "selecting commander shows no error");
  check(P.record(pr).preset === "current" && P.record(pr).hash === DEFAULT_HASH, "the effective record stays current / DEFAULT_HASH until Apply");
  // strict panel input parsing
  const inputs = { "5": 5, "0": 0, "-1": -1, "5abc": "5abc", "": "", " 5": " 5", "1.5": "1.5", "05": "05", "5 ": "5 ", "1e1": "1e1", "9999999": 9999999 };
  Object.entries(inputs).forEach(([text, expected]) => same(pr.ev(`readRulesInputValue(${JSON.stringify(text)})`), expected, `panel input ${JSON.stringify(text)}`));
  check(pr.ev("readRulesInputValue(undefined)") === "", "panel input undefined stays an (invalid) empty string");
  pr.ev("document.getElementById('rules-handSize').value = '5abc'");
  P.click(pr, "rules-handSize", "input");
  check(P.pendingSettings(pr).handSize === "5abc" && P.messages(pr).some((m) => m.text === "handSize must be a whole number from 1 to 8"), "typing 5abc keeps the raw text and shows the error (never coerced)");
  check(pr.ev("document.getElementById('rules-apply').disabled") === true, "Apply is disabled while the pending settings are invalid");

  const handsGenerated = P.reportHands(ID, ctxs.reduce((n, c) => n + P.handsOf(c), 0)); // boot hands only (no other draws)
  return { header: P.REQ_HEADER_P2A, handsGenerated, bounds: BOUNDS, defaults: DEFAULTS, perField: fieldReport, crossField: cross, links: { roundTrips, rejections: rejectReport, bootStatus },
    presets: ["current (available)", "commander (available: experimental, enemy-action rules only)"], panelInputParsing: inputs };
}
module.exports = { id: ID, run };
