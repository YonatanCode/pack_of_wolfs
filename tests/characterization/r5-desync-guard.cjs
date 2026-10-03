"use strict";
// REQUIREMENT — P1b acceptance
// R5: anything that would let the board drift from the scenario exits it: restartBattle() then returns
// false and getBattleSeeds().scenarioId is null. Each trigger runs in its own fresh context.
const { REQ_HEADER, check, bootScenario, seeds, evJson, units } = require("./_scn.cjs");

const ID = "r5-desync-guard";

async function run() {
  const results = {};
  const trigger = async (name, fn) => {
    const g = bootScenario(1);
    check(seeds(g).scenarioId === "intro", `${name}: scenario active before`);
    const ret = await fn(g);
    const after = seeds(g);
    check(after.scenarioId === null, `${name}: scenarioId null after`);
    check(g.ev("window.devTest.restartBattle()") === false, `${name}: restartBattle refused after exit`);
    check(g.ev("document.getElementById('scenario-label').textContent") === "custom board (scenario exited)", `${name}: label says scenario exited`);
    results[name] = { returned: ret, scenarioIdAfter: after.scenarioId, restartBattle: false };
    return g;
  };
  await trigger("setArenaSize(10)", (g) => g.ev("window.devTest.setArenaSize(10)"));
  await trigger("setEnemyMode('stag')", (g) => g.ev("window.devTest.setEnemyMode('stag')"));
  await trigger("runScenario('double-attack')", (g) => g.runLimited(async () => (await g.ev("window.devTest.runScenario('double-attack')")).passed));
  // resetGame() after exit takes the legacy path and does not resurrect the scenario
  const g = await trigger("setArenaSize(8) then resetGame()", (gg) => gg.ev("window.devTest.setArenaSize(8)"));
  g.ev("resetGame()");
  check(seeds(g).scenarioId === null, "resetGame after exit does not revive scenario");
  // same-mode click is a no-op that KEEPS the scenario (declared change vs the first P1b measurement,
  // where setEnemyMode('wolves') exited it)
  const w = bootScenario(1);
  const seedsBefore = seeds(w);
  const handBefore = JSON.stringify(evJson(w, "Array.from(actionsList.children).map((i) => i.dataset.action)"));
  check(w.ev("window.devTest.setEnemyMode('wolves')") === true, "setEnemyMode(same) returns true");
  check(JSON.stringify(seeds(w)) === JSON.stringify(seedsBefore) && seeds(w).scenarioId === "intro", "same-mode click keeps scenario and seeds");
  check(JSON.stringify(evJson(w, "Array.from(actionsList.children).map((i) => i.dataset.action)")) === handBefore, "same-mode click leaves the hand untouched");
  check(w.ev("window.devTest.restartBattle()") === true, "restartBattle still works after same-mode click");
  check(JSON.stringify(seeds(w)) === JSON.stringify(seedsBefore), "seeds unchanged after restart");
  results["setEnemyMode('wolves') on wolves scenario (same mode)"] = { returned: true, scenarioIdAfter: "intro", restartBattle: true };
  // a no-op resize to the same size does not change the board and keeps the scenario (documented behaviour)
  const k = bootScenario(1);
  results["setArenaSize(12) (no-op, same size)"] = { returned: k.ev("window.devTest.setArenaSize(12)"), scenarioIdAfter: seeds(k).scenarioId };
  check(seeds(k).scenarioId === "intro", "same-size resize keeps the scenario");
  return { header: REQ_HEADER,
    declaredChange: "P1b follow-up: setEnemyMode(sameMode) on an active scenario is now a no-op returning true and KEEPS the scenario (first measurement: it exited the scenario). A different mode (stag), setArenaSize to another size and runScenario still exit it.",
    results };
}
module.exports = { id: ID, run };
