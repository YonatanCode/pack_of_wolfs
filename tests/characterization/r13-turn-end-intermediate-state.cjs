"use strict";
// REQUIREMENT — P1d acceptance
// R13: during a REAL turn (executePlayerActionQueue: every step replayed and animated) that ends in a scripted
// kill, nothing that belongs to a LATER step is visible early. r12 proves this for ticks; r13 covers the TURN-END
// steps (recovery, debugNote, handDraw, turnEnd, outcome) and the casualty replan, in four hand-authored one-turn
// cases on the seed-1 intro boot (no bots, scripted outcomes only):
//   casualty  1-HP E1 dies in tick 1 (replan; E2/E3 survive), wounded P2 (8 HP, 1 safe turn) heals at turn end:
//             non-terminal, so the NEXT-turn enemy preview exists and the overlay must stay hidden for good;
//   victory   P1 bites the 4-HP last enemy in tick 1 (non-lethal) and kills it in tick 2 (outcome player, "You Win!");
//   defeat    the 4-HP last wolf P1 is bitten in tick 1 and dies in tick 2 while E1 survives ("You Lose");
//   double-ko both last units (4 HP each) survive tick 1 and kill each other in tick 2 (a defeat: player side first).
// The hand is authored (data + view) and the cards are queued through the real UI path, so the turn-end draw is real.
// A probe run wraps every presentation name of the c10 trace (_trace.cjs list, read-only) plus the control updaters and
// replayTurnStep itself, and at EVERY step boundary and presentation call reads what the player would see: the DOM
// hand view vs the hand data, the enemy intent tags (text), the result overlay (hidden flag + message), every health
// bar (fill) and defeated flag, the Play button and isExecutingActionQueue. Asserted (hard):
//   - step order: enemyPlan, selection, per tick [moves, swings, damage, replan?, tickEnd], then exactly
//     recovery, debugNote, handDraw, turnEnd, outcome (the TURN LIFECYCLE comment of script.js);
//   - isExecutingActionQueue and the Play button: executing + disabled from the selection step to the turnEnd step;
//     the core's turn-end phases (isExecuting = false, the heal, the hand draw, the preview plan) do not run before
//     the last tick's replay is over: the hand data, health and defeated flags equal the end-of-last-tick state
//     until recovery begins;
//   - hand: the view keeps the queued-cards hand (shorter than the data) until the handDraw replay renders the
//     draw, and equals the data afterwards (and from then on);
//   - health bars change only inside an updateUnitHealthBar call of that unit; a heal is not visible before the
//     recovery step plays and the bar shows healthAfter once it did; defeated flags flip no earlier than the damage
//     step of the tick that kills;
//   - enemy intent tags change only inside a renderEnemyPackIntentTags call made by an enemyPlan / replan / tickEnd /
//     turnEnd step; after a replan or the turnEnd preview they equal that step's planned queue; the next-turn preview
//     is not shown before the turnEnd step (tags during recovery, debugNote and handDraw are the end-of-last-tick tags);
//   - result overlay: hidden at every probe before the outcome step plays, then the right message (or hidden forever
//     when the outcome is "none").
const L = require("./_lifecycle.cjs");
const { PRESENTATION_NAMES } = require("./_trace.cjs");

const ID = "r13-turn-end-intermediate-state";
const EXTRA_NAMES = ["updatePlayerActionControls", "updateActionQueueControls", "syncEnemyModeControls", "refreshConcealmentVisuals"];
const UNIT_KEYS = ["P1", "P2", "P3", "E1", "E2", "E3"];

const VIEW = `JSON.stringify((function(){
  const all = [["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]];
  const fill = (u) => (u.healthBar ? u.healthBar.querySelector(".unit-health-bar-fill").style.getPropertyValue("--unit-health-fill-width") || "-" : "-");
  const tags = (u) => (u.intentTags ? (u.intentTags.hidden ? "" : Array.from(u.intentTags.querySelectorAll(".unit-intent-label")).map((t) => t.textContent).join("+")) : "");
  const o = { handView: Array.from(actionsList.children).map((i) => i.dataset.action), handData: [...playerHand],
    overlayHidden: !!gameResultOverlay.hidden, msg: __resultMsg.textContent, play: executeQueueButton.disabled, executing: isExecutingActionQueue,
    bar: {}, def: {}, hp: {}, tags: {} };
  all.forEach(([k, u]) => { o.bar[k] = fill(u); o.def[k] = !!u.isDefeated; o.hp[k] = u.health; if (u.team === "enemy") o.tags[k] = tags(u); });
  return o; })())`;

const hand5 = (g, cards) => {
  g.ev(`playerHand.splice(0, playerHand.length, ...${JSON.stringify(cards)}); rebuildPlayerHandView();`);
};
const queue = (g, unitVar, cards) => {
  g.ev(`setPlayerSelected(${unitVar})`);
  cards.forEach((c) => g.ev(`applyPlayerAction(${JSON.stringify(c)})`));
  g.ev("setPlayerSelected(null)");
};

const CASES = [
  {
    id: "casualty",
    description: "1-HP E1 (between P1 and P2) dies in tick 1, E2/E3 survive (replan); wounded P3 (8 HP, 1 safe turn, never hit) heals at turn end; non-terminal (no outcome).",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 1 }, { row: 5, col: 7, direction: "topLeft" }, { row: 11, col: 11, direction: "topLeft", health: 8 },
        { row: 5, col: 6, direction: "topLeft", health: 1 }, { row: 0, col: 9, direction: "bottomLeft" }, { row: 0, col: 2, direction: "bottomLeft" }]);
      g.ev("playerFlank.turnsSinceHit = 1; updateUnitHealthBar(playerFlank);");
      hand5(g, ["Attack", "Attack", "Defend", "Move", "Defend"]);
      queue(g, "player", ["Attack"]);
      queue(g, "playerSupport", ["Attack"]);
      queue(g, "playerFlank", ["Defend"]);
    },
    outcome: "none", message: "", healUnit: "P3", victim: "E1", killTick: 1,
  },
  {
    id: "victory",
    description: "P1 bites the 4-HP last enemy E1 in tick 1 (4 -> 1) and kills it in tick 2; wounded P2 (8 HP, 1 safe turn) heals at turn end; outcome player.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight" }, { row: 11, col: 2, direction: "topRight", health: 8 }, null,
        { row: 5, col: 6, direction: "topLeft", health: 4 }]);
      g.ev("playerSupport.turnsSinceHit = 1; updateUnitHealthBar(playerSupport);");
      hand5(g, ["Attack", "Attack", "Defend", "Move", "Defend"]);
      queue(g, "player", ["Attack", "Attack"]);
    },
    outcome: "player", message: "You Win!", healUnit: "P2", victim: "E1", killTick: 2,
  },
  {
    id: "defeat",
    description: "P1 (4 HP, last wolf) trades bites with E1 (10 HP): both survive tick 1, P1 dies in tick 2; E1 lives; outcome enemy.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 4 }, null, null, { row: 5, col: 6, direction: "topLeft" }]);
      hand5(g, ["Attack", "Attack", "Defend", "Move", "Defend"]);
      queue(g, "player", ["Attack", "Attack"]);
    },
    outcome: "enemy", message: "You Lose", victim: "P1", killTick: 2,
  },
  {
    id: "double-ko",
    description: "Last units P1 and E1 (4 HP each) both survive tick 1 and kill each other in tick 2: outcome enemy (defeat), doubleKO.",
    setup: (g) => {
      L.resetUnits(g, [{ row: 5, col: 5, direction: "bottomRight", health: 4 }, null, null, { row: 5, col: 6, direction: "topLeft", health: 4 }]);
      hand5(g, ["Attack", "Attack", "Defend", "Move", "Defend"]);
      queue(g, "player", ["Attack", "Attack"]);
    },
    outcome: "enemy", message: "You Lose", victim: "P1", killTick: 2, doubleKO: true,
  },
];

/** One played turn. probe=false: same turn without any wrapper (read-only proof). */
async function runCase(def, { probe }) {
  const g = L.bootIntro();
  def.setup(g);
  const handQueued = L.domHand(g); // the view the player has when pressing Play
  const log = []; // {at, step, tick, name?, args?, v: view snapshot [, after]}
  let step = "pre";
  let tick = 0;
  if (probe) {
    const snap = () => JSON.parse(g.ev(VIEW));
    const id = (u) => (u && typeof u === "object" && "team" in u ? g.ctx.getBattleDebugUnitId(u) : "{...}");
    const origReplay = g.ctx.replayTurnStep;
    const pending = []; // animations / popups a step started: each must have finished before the next step begins
    g.ctx.replayTurnStep = function (s, ...rest) {
      const unfinished = pending.filter((p) => !p.done).map((p) => `${p.step}:${p.name}`);
      check(unfinished.length === 0, `${def.id}: step "${s.kind}" began while ${unfinished.join(", ")} of an earlier step were still playing (the replay was not awaited)`);
      step = s.kind;
      log.push({ at: "begin", step, tick, v: snap() });
      const r = origReplay.call(this, s, ...rest);
      const done = () => { log.push({ at: "end", step, tick, v: snap() }); };
      if (r && typeof r.then === "function") return r.then((x) => { done(); return x; });
      done();
      return r;
    };
    [...PRESENTATION_NAMES, ...EXTRA_NAMES].forEach((name) => {
      const orig = g.ctx[name];
      g.ctx[name] = function (...args) {
        const rec = { at: "call", step, tick, name, args: args.slice(0, 2).map(id), v: snap() };
        log.push(rec);
        const out = orig.apply(this, args);
        if (out && typeof out.then === "function") {
          const p = { step, name, done: false };
          pending.push(p);
          out.then(() => { p.done = true; }, () => { p.done = true; });
        }
        if (["renderEnemyPackIntentTags", "refreshConcealmentVisuals", "updateUnitHealthBar"].includes(name)) rec.after = snap();
        return out;
      };
    });
    const origTick = g.ctx.executeActionTick;
    g.ctx.executeActionTick = async function (...args) {
      tick += 1;
      return origTick.apply(this, args);
    };
  }
  const events = await L.playTurn(g);
  return { log, events, handQueued, final: JSON.parse(g.ev(VIEW)), budget: g.ev("activeRules.playerActionBudget") };
}

const steps = (log) => log.filter((e) => e.at === "begin").map((e) => e.step);
const expectedTags = (event, budget) => {
  const t = {};
  (event.renderUnits ?? []).filter((u) => u.startsWith("E")).forEach((u) => {
    t[u] = event.queue.filter((q) => q.unit === u).map((q) => q.action).slice(0, budget).join("+");
  });
  return t;
};
const same = L.same;
const check = L.check;

function verify(def, plain, run) {
  const { log, events, handQueued, budget } = run;
  const w = (e, i) => `${def.id} #${i} ${e.step}/${e.at}${e.name ? ` ${e.name} ${e.args.join(",")}` : ""}`;

  // ---- read-only probes + scripted precondition
  same(run.events, plain.events, `${def.id}: probes are read-only (same event log)`);
  same(run.final, plain.final, `${def.id}: probes are read-only (same final view)`);
  const outcome = events.find((e) => e.type === "outcome");
  check(outcome.winner === def.outcome && (outcome.doubleKO === true) === (def.doubleKO === true), `${def.id}: scripted outcome ${JSON.stringify(outcome)}`);
  const lastTick = events.filter((e) => e.type === "tickStart").length;
  check(lastTick === 2 || def.id === "casualty", `${def.id}: ${lastTick} ticks`);
  const deaths = events.filter((e) => e.type === "death");
  check(deaths.some((d) => d.unit === def.victim && d.tick === def.killTick), `${def.id}: ${def.victim} dies in tick ${def.killTick} (${JSON.stringify(deaths)})`);
  if (def.id !== "casualty") check(!deaths.some((d) => d.tick === 1), `${def.id}: tick 1 has a non-lethal hit only`);
  if (def.id !== "casualty") check(events.some((e) => e.type === "damage" && e.tick === 1 && e.damaged && !e.defeated), `${def.id}: tick 1 has a non-lethal hit`);
  const heals = events.find((e) => e.type === "recovery").heals;
  if (def.healUnit) check(heals.some((h) => h.unit === def.healUnit), `${def.id}: ${def.healUnit} heals at turn end`);

  // ---- step order
  const order = steps(log);
  const tail = ["recovery", "debugNote", "handDraw", "turnEnd", "outcome"];
  same(order.slice(-5), tail, `${def.id}: turn-end step order`);
  same(order.slice(0, 2), ["enemyPlan", "selection"], `${def.id}: turn-start step order`);
  const body = order.slice(2, -5);
  check(body.every((k) => ["moves", "swings", "damage", "replan", "tickEnd"].includes(k)) && body[body.length - 1] === "tickEnd", `${def.id}: tick steps only before the turn end: ${body}`);
  check(body.filter((k) => k === "tickEnd").length === lastTick, `${def.id}: one tickEnd per tick`);
  if (def.id === "casualty") check(body.includes("replan"), `${def.id}: casualty replan step`);
  const idx = (kind, at) => log.findIndex((e) => e.step === kind && e.at === at);
  const lastTickEnd = log.map((e, i) => (e.step === "tickEnd" && e.at === "end" ? i : -1)).filter((i) => i >= 0).pop();
  const iRecovery = idx("recovery", "begin");
  const iHandDraw = idx("handDraw", "begin");
  const iHandDrawEnd = idx("handDraw", "end");
  const iTurnEnd = idx("turnEnd", "begin");
  const iOutcome = idx("outcome", "begin");
  const iOutcomeEnd = idx("outcome", "end");
  const base = log[lastTickEnd].v; // what the player sees when the last tick's replay is over
  const first = log.find((e) => e.step === "selection" && e.at === "end").v;

  log.forEach((e, i) => {
    const v = e.v;
    // executing flag + Play button
    const inTurn = i >= idx("selection", "end") && i <= lastTickEnd;
    if (i >= idx("selection", "end") && i <= iTurnEnd) check(v.play === true, `${w(e, i)}: Play button enabled mid-turn`);
    if (inTurn) check(v.executing === true, `${w(e, i)}: isExecutingActionQueue false inside the tick replay (turn-end core ran early)`);
    if (i >= iRecovery) check(v.executing === false, `${w(e, i)}: still executing at turn end`);
    // hand: the data is drawn by the core phase that follows the recovery replay; the view is rendered by the handDraw replay
    if (i < iHandDraw) same(v.handData, handQueued, `${w(e, i)}: hand data refilled before the handDraw phase (draw ran early)`);
    if (i >= iHandDraw) same(v.handData.length, 5, `${w(e, i)}: hand data after the core draw`);
    if (i <= iHandDraw || e.name === "refillAvailableActions") same(v.handView, handQueued, `${w(e, i)}: hand view changed before the handDraw replay rendered it`);
    if (i >= iHandDrawEnd) same(v.handView, v.handData, `${w(e, i)}: hand view == data after the handDraw replay`);
    // overlay
    if (i < iOutcome) check(v.overlayHidden === true && v.msg === "", `${w(e, i)}: result overlay before the outcome replay`);
    // health / defeated / heal: the end-of-last-tick state until the recovery phase ran
    if (def.healUnit && i < iRecovery) check(v.hp[def.healUnit] === base.hp[def.healUnit], `${w(e, i)}: ${def.healUnit} healed before recovery`);
    if (def.healUnit && i < iRecovery) check(v.bar[def.healUnit] === base.bar[def.healUnit], `${w(e, i)}: heal visible before the recovery step`);
    // defeated flag: not before the damage step of the killing tick
    const beforeKill = log.findIndex((x) => x.step === "damage" && x.at === "begin" && x.tick === def.killTick);
    if (i < beforeKill) check(v.def[def.victim] === false, `${w(e, i)}: ${def.victim} defeated before tick ${def.killTick}'s damage step`);
    else check(v.def[def.victim] === true, `${w(e, i)}: ${def.victim} not defeated from tick ${def.killTick}'s damage step on`);
  });

  // bars change only inside an updateUnitHealthBar call of that unit
  for (let i = 1; i < log.length; i += 1) {
    const prev = log[i - 1].after ?? log[i - 1].v;
    UNIT_KEYS.forEach((u) => {
      if (log[i].v.bar[u] !== prev.bar[u]) check(false, `${w(log[i], i)}: ${u} bar changed ${prev.bar[u]} -> ${log[i].v.bar[u]} outside an updateUnitHealthBar`);
    });
  }
  // tags change only inside renderEnemyPackIntentTags (from an enemyPlan / replan / tickEnd / turnEnd step) or the
  // concealment refresh of a moves replay (re-renders the pack's current queue: this tick's consumption, not a plan)
  for (let i = 1; i < log.length; i += 1) {
    const prev = log[i - 1];
    const was = prev.after ?? prev.v;
    if (JSON.stringify(log[i].v.tags) !== JSON.stringify(was.tags)) check(false, `${w(log[i], i)}: intent tags changed outside a render call: ${JSON.stringify(was.tags)} -> ${JSON.stringify(log[i].v.tags)}`);
  }
  log.filter((e) => e.name === "renderEnemyPackIntentTags").forEach((e) => {
    check(["enemyPlan", "replan", "tickEnd", "turnEnd"].includes(e.step), `${def.id}: intent tags rendered by step ${e.step}`);
  });
  log.filter((e) => e.name === "refreshConcealmentVisuals").forEach((e) => {
    check(e.step === "moves", `${def.id}: concealment refresh (re-renders the tags) outside a moves replay: ${e.step}`);
  });
  const sameTags = (a, b, msg) => same(a.tags, b.tags, msg);
  for (let i = lastTickEnd; i <= iTurnEnd; i += 1) sameTags(log[i].v, base, `${w(log[i], i)}: next-turn preview shown before the turnEnd step`);
  // after a replan / the turnEnd preview the tags equal that step's planned queue
  const planEvents = events.filter((e) => e.type === "enemyPlan" || e.type === "replan");
  const checkPlan = (stepKind, nth, event) => {
    const ends = log.filter((e) => e.step === stepKind && e.at === "end");
    const exp = expectedTags(event, budget);
    Object.entries(exp).forEach(([u, t]) => check(ends[nth].v.tags[u] === t, `${def.id}: after ${stepKind}#${nth} ${u} tags "${ends[nth].v.tags[u]}" != planned "${t}"`));
  };
  checkPlan("enemyPlan", 0, planEvents[0]);
  planEvents.filter((e) => e.type === "replan").forEach((e, n) => checkPlan("replan", n, e));
  const preview = planEvents[planEvents.length - 1];
  check(preview.type === "enemyPlan" && preview.reason === "preview", `${def.id}: last plan event is the turn-end preview`);
  checkPlan("turnEnd", 0, preview);
  if (def.id === "casualty") {
    check(JSON.stringify(log[iTurnEnd].v.tags) !== JSON.stringify(log[idx("turnEnd", "end")].v.tags), `${def.id}: the preview replaces the tags at turnEnd`);
    const r0 = idx("replan", "begin");
    sameTags(log[r0].v, log[r0 - 1].v, `${def.id}: tags at replan begin == previous step`);
    check(log[r0 - 1].v.tags.E1 !== "" || first.tags.E1 === "", `${def.id}: E1 keeps its tags until the replan`);
  }
  // bars: the heal shows only after the recovery step
  if (def.healUnit) {
    const h = heals.find((x) => x.unit === def.healUnit);
    const rEnd = log[idx("recovery", "end")].v;
    check(rEnd.bar[def.healUnit] === `${(h.healthAfter / 10) * 100}%` && base.bar[def.healUnit] === `${(h.healthBefore / 10) * 100}%`, `${def.id}: heal bar ${base.bar[def.healUnit]} -> ${rEnd.bar[def.healUnit]}`);
    check(log[iRecovery].v.bar[def.healUnit] === base.bar[def.healUnit] && log[iRecovery].v.hp[def.healUnit] === h.healthAfter, `${def.id}: at recovery begin the core healed, the bar did not`);
  }
  // overlay after the outcome replay
  const fin = log[iOutcomeEnd].v;
  if (def.outcome === "none") check(log.every((e) => e.v.overlayHidden === true) && run.final.overlayHidden, `${def.id}: overlay stays hidden`);
  else check(log[iOutcome].v.overlayHidden === true && fin.overlayHidden === false && fin.msg === def.message && run.final.msg === def.message, `${def.id}: overlay shows ${def.message} after the outcome replay`);
  check(run.final.executing === false, `${def.id}: turn finished`);
  same(run.final.handView, run.final.handData, `${def.id}: final hand view == data`);
  const drawn = events.find((e) => e.type === "handDraw").drawn;
  check(drawn.length > 0 && handQueued.length + drawn.length === 5, `${def.id}: the turn-end draw refills ${handQueued.length} -> 5`);
  // heal popups: only the recovery step shows them, once per heal
  const popups = log.filter((e) => e.name === "showUnitHealPopup");
  check(popups.length === heals.length && popups.every((e) => e.step === "recovery"), `${def.id}: heal popups ${popups.map((e) => e.step)} vs ${heals.length} heals`);
}

const probeLine = (e) => `${e.step}/${e.at}${e.name ? ` ${e.name}${e.args.length ? " " + e.args.join(",") : ""}` : ""}`;
const fmtV = (v) => `hand=${v.handView.length}/${v.handData.length} ovl=${v.overlayHidden ? "hidden" : v.msg} play=${v.play ? "off" : "ON"} exec=${v.executing ? 1 : 0}`
  + ` tags=${Object.entries(v.tags).filter(([, t]) => t).map(([u, t]) => `${u}:${t}`).join(",") || "-"}`
  + ` bars=${UNIT_KEYS.filter((u) => v.bar[u] !== "-").map((u) => `${u}:${v.bar[u].replace("%", "")}${v.def[u] ? "X" : ""}`).join(",")}`;

async function run() {
  const out = { header: L.REQ_HEADER, cases: {} };
  for (const def of CASES) {
    const plain = await runCase(def, { probe: false });
    const run = await runCase(def, { probe: true });
    verify(def, plain, run);
    const lastTickEndBegin = run.log.map((e, i) => (e.step === "tickEnd" && e.at === "begin" ? i : -1)).filter((i) => i >= 0).pop();
    const keyCalls = ["refillAvailableActions", "showGameResult", "concludeBattle", "updateUnitHealthBar", "renderEnemyPackIntentTags", "showUnitHealPopup"];
    const boundaries = run.log.filter((e, i) => (e.at !== "call" || keyCalls.includes(e.name))
      && (i >= lastTickEndBegin || (["damage", "replan"].includes(e.step) && e.tick === def.killTick)));
    out.cases[def.id] = {
      description: def.description,
      stepOrder: steps(run.log).join(" > "),
      handQueued: run.handQueued.join("+"),
      outcome: run.events.find((e) => e.type === "outcome"),
      probes: boundaries.map((e, i) => `${String(i).padStart(2, "0")} ${probeLine(e)}: ${fmtV(e.v)}`),
    };
  }
  return out;
}
module.exports = { id: ID, run };
