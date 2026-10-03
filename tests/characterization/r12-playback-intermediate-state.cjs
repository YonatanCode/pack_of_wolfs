"use strict";
// REQUIREMENT — P1d acceptance
// R12: what the player sees during playback is the state of the step being played, never a later one.
// Part A: a scripted 3-tick dev turn (window.devTest.runTurn: the tick-only subset on the same tick core),
//   tick 1 = a non-lethal hit (P1 bites E1, 10 -> 7), tick 2 = a kill (E2 bites the 1-HP P2), tick 3 = a move
//   (P3). Part B: the real executePlayerActionQueue on the untouched intro board (planner-driven enemies).
// Expected values come from c9-style per-tick snapshots S0..Sn (state after each executeActionTick) of a
// separate state-only run. A probe run wraps every presentation name of the c10 trace (_trace.cjs list,
// read-only) and records, at EVERY call, the live state of all six units (position, health, defeated,
// sprite animation, sprite hidden) plus what the call rendered (health-bar fill and visibility, the queue
// timeline). Asserted for every call inside tick k:
//   - before tick k's damage replay starts: health / defeated / sprite == S(k-1) (no unit shows its own
//     hit, death or anyone else's later damage early); from the damage replay on: health / defeated == Sk;
//   - positions are S(k-1) or Sk (moves of tick k only), moveUnitToTile is passed the Sk cell, and every
//     call from tick k's end-of-tick render on sees Sk positions;
//   - a health bar refreshed in tick k shows the Sk health of that unit (the hp after THIS hit);
//   - the queue timeline rendered at tick k's end equals the Sk player queues;
// and before tick 1 everything equals S0, after the last tick positions equal Sn. The probe run's own
// per-tick snapshots must equal the state-only run's (probes are read-only).
const L = require("./_lifecycle.cjs");
const { PRESENTATION_NAMES } = require("./_trace.cjs");

const ID = "r12-playback-intermediate-state";
const DAMAGE_NAMES = ["showUnitMissPopup", "updateUnitHealthBar", "showUnitDamagePopup", "playUnitHitReaction", "playUnitDeath"];
const TICK_END_NAMES = ["renderActionQueue", "renderPlayerTimeline"];

const STATE = `JSON.stringify(Object.fromEntries([["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]]
  .filter(([, u]) => isUnitActive(u)).map(([k, u]) => [k, { row: u.row, col: u.col, health: u.health, isDefeated: !!u.isDefeated,
    queue: u.team === "player" ? [...getUnitActionQueue(u)] : null }])))`;
const SPRITES = `JSON.stringify(Object.fromEntries([["P1",player],["P2",playerSupport],["P3",playerFlank],["E1",enemy],["E2",enemySupport],["E3",enemyFlank]]
  .filter(([, u]) => isUnitActive(u)).map(([k, u]) => [k, { animation: u.animationName, hidden: !!u.element.hidden }])))`;
const TIMELINE = "JSON.stringify(Array.from(actionQueueList.children).map((row) => Array.from(row.querySelectorAll('.action-label')).map((l) => l.textContent)))";

const PARTS = [
  {
    id: "A-scripted-dev-turn",
    description: "devTest.runTurn: t1 P1 bites E1 (10->7, E1 idle), t2 E2 bites 1-HP P2 (dies, no replan: a player died), t3 P3 moves.",
    setup: (g) => {
      L.resetUnits(g, [
        { row: 5, col: 5, direction: "bottomRight" }, { row: 8, col: 2, direction: "topRight", health: 1 }, { row: 10, col: 8, direction: "topRight" },
        { row: 5, col: 6, direction: "topLeft" }, { row: 8, col: 3, direction: "bottomLeft" }, { row: 2, col: 10, direction: "bottomLeft" }]);
      g.ev(`queueDevTestPackActions([{ unitId: "enemySupport", action: "Defend" }, { unitId: "enemyFlank", action: "Defend" }, { unitId: "enemySupport", action: "Attack" }]);
        getUnitActionQueue(player).push("Attack"); getUnitActionQueue(playerFlank).push("Defend", "Defend", "Move");`);
    },
    play: (g) => g.runLimited(() => g.ev("window.devTest.runTurn()")),
    expectTicks: 3,
  },
  {
    id: "B-real-turn-intro",
    description: "executePlayerActionQueue on the untouched seed-1 intro board; P1 cards 0,1, P2 card 2, P3 card 0 (by index).",
    setup: (g) => {
      const h = L.domHand(g);
      g.ev("setPlayerSelected(player)"); [h[0], h[1]].forEach((c) => g.ev(`applyPlayerAction(${JSON.stringify(c)})`));
      g.ev("setPlayerSelected(playerSupport)"); g.ev(`applyPlayerAction(${JSON.stringify(h[2])})`);
      g.ev("setPlayerSelected(playerFlank)"); g.ev(`applyPlayerAction(${JSON.stringify(h[0])})`);
    },
    play: (g) => L.playTurn(g),
    expectTicks: 2,
  },
];

async function runPart(part, { probe }) {
  const g = L.bootIntro();
  part.setup(g);
  const snaps = [JSON.parse(g.ev(STATE))];
  const probes = [];
  let segment = "pre";
  let tick = 0;
  L.T.installTickHook(g,
    () => { tick += 1; segment = `tick${tick}`; },
    () => { snaps.push(JSON.parse(g.ev(STATE))); segment = "post"; });
  if (probe) {
    const id = (u) => (u && typeof u === "object" && "team" in u ? g.ctx.getBattleDebugUnitId(u) : u);
    PRESENTATION_NAMES.forEach((name) => {
      const orig = g.ctx[name];
      g.ctx[name] = function (...args) {
        const rec = { segment, name, args: args.slice(0, 3).map((a) => (typeof a === "object" && a !== null && !("team" in a) ? "{...}" : id(a))),
          state: JSON.parse(g.ev(STATE)), sprites: JSON.parse(g.ev(SPRITES)) };
        probes.push(rec); // call-START order (state is read before the call); rendered values are added after it
        const result = orig.apply(this, args);
        if (name === "updateUnitHealthBar" && args[0].healthBar) {
          rec.bar = { fill: args[0].healthBar.querySelector(".unit-health-bar-fill").style.getPropertyValue("--unit-health-fill-width"), hidden: !!args[0].healthBar.hidden };
        }
        if (name === "renderPlayerTimeline") rec.timeline = JSON.parse(g.ev(TIMELINE));
        return result;
      };
    });
  }
  await part.play(g);
  return { snaps, probes, ticks: tick };
}

const pos = (s) => `${s.row},${s.col}`;

function checkProbes(part, snaps, probes) {
  const damageStarted = {};
  const tickEndStarted = {};
  probes.forEach((p, i) => {
    const where = `${part.id} call #${i} ${p.segment} ${p.name} ${p.args.join(",")}`;
    if (p.segment === "pre" || p.segment === "post") {
      const ref = p.segment === "pre" ? snaps[0] : snaps[snaps.length - 1];
      Object.entries(p.state).forEach(([u, s]) => L.check(pos(s) === pos(ref[u]), `${where}: ${u} position ${pos(s)} != ${pos(ref[u])}`));
      if (p.segment === "pre") Object.entries(p.state).forEach(([u, s]) => L.check(s.health === ref[u].health && s.isDefeated === ref[u].isDefeated, `${where}: ${u} health before tick 1`));
      return;
    }
    const k = Number(p.segment.slice(4));
    const before = snaps[k - 1];
    const after = snaps[k];
    if (DAMAGE_NAMES.includes(p.name)) damageStarted[k] = true;
    if (TICK_END_NAMES.includes(p.name)) tickEndStarted[k] = true;
    const ref = damageStarted[k] ? after : before;
    Object.entries(p.state).forEach(([u, s]) => {
      L.check(s.health === ref[u].health && s.isDefeated === ref[u].isDefeated,
        `${where}: ${u} hp ${s.health}${s.isDefeated ? " defeated" : ""} but the ${damageStarted[k] ? "after" : "before"}-tick-${k} state is hp ${ref[u].health}${ref[u].isDefeated ? " defeated" : ""}`);
      L.check(pos(s) === pos(before[u]) || pos(s) === pos(after[u]), `${where}: ${u} at ${pos(s)}, neither tick-${k} start nor end`);
      if (tickEndStarted[k]) L.check(pos(s) === pos(after[u]), `${where}: ${u} end-of-tick position`);
      if (!damageStarted[k] && !before[u].isDefeated) {
        L.check(p.sprites[u].animation !== "death" && !p.sprites[u].hidden, `${where}: ${u} sprite shows a death before its tick-${k} damage replay`);
      }
    });
    if (p.name === "moveUnitToTile") L.check(`${p.args[1]},${p.args[2]}` === pos(after[p.args[0]]), `${where}: move target is the tick-${k} cell`);
    if (p.bar) {
      const u = p.args[0];
      L.check(p.bar.fill === `${(after[u].health / 10) * 100}%`, `${where}: bar ${p.bar.fill} != tick-${k} hp ${after[u].health}`);
      L.check(p.bar.hidden === (after[u].isDefeated || after[u].health === 10), `${where}: bar visibility`);
    }
    if (p.timeline) {
      L.same(p.timeline, ["P1", "P2", "P3"].map((u) => (after[u] ? after[u].queue : [])), `${where}: rendered queues == tick-${k} queues`);
    }
  });
}

const fmtSnap = (s) => Object.entries(s).map(([u, v]) => `${u} ${pos(v)} hp${v.health}${v.isDefeated ? " DEF" : ""}${v.queue ? ` q=${v.queue.join("+") || "-"}` : ""}`).join(" | ");

async function run() {
  const out = { header: L.REQ_HEADER, parts: {} };
  for (const part of PARTS) {
    const stateOnly = await runPart(part, { probe: false });
    const probed = await runPart(part, { probe: true });
    L.check(stateOnly.ticks === part.expectTicks, `${part.id}: ${stateOnly.ticks} ticks`);
    L.same(probed.snaps, stateOnly.snaps, `${part.id}: probes are read-only (same per-tick states)`);
    checkProbes(part, stateOnly.snaps, probed.probes);
    out.parts[part.id] = {
      description: part.description,
      perTickState: stateOnly.snaps.map((s, i) => `S${i}: ${fmtSnap(s)}`),
      calls: probed.probes.map((p) => `${p.segment} ${p.name} ${p.args.join(" ")}`.trimEnd()
        + (p.bar ? ` bar=${p.bar.fill}${p.bar.hidden ? " hidden" : ""}` : "")
        + (p.timeline ? ` timeline=${p.timeline.map((q) => q.join("+") || "-").join("/")}` : "")),
    };
  }
  return out;
}
module.exports = { id: ID, run };
