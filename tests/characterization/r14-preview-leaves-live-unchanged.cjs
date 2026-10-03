"use strict";
// REQUIREMENT — P1e acceptance
// R14: a preview (window.devTest.dryRunTurn) leaves the live battle exactly as it was. For three hand-authored
// boards (plain intro turn with hand-chosen cards; lethal turn with a casualty replan, a heal and a hand
// refill; a double KO) context A takes the full live fingerprint (_preview.liveFingerprint: state snapshot
// incl. hand data and hand-RNG position, the whole DOM, hand view / queue rows / intent tags / overlay /
// health bars / buttons, battle note + log, last turn's events, replay maps, guard depths, playback flag,
// selection) and runs dryRunTurn THREE times with DOM-creation / DOM-mutation / rAF / timer spies counting.
// Asserted per preview: fingerprint identical to the one taken before, every counter zero, no virtual frame
// or timer ran; across the three previews: identical results (same event hash). Then A is compared with a
// control context B (same boot + setup, never previewed): identical fingerprint and the same next value of
// the harness Math.random stream (cosmetic randomness was not consumed).
const P = require("./_preview.cjs");

const ID = "r14-preview-leaves-live-unchanged";

async function run() {
  const out = { header: P.REQ_HEADER, cases: {} };
  for (const [boardId, board] of Object.entries(P.BOARDS)) {
    const a = P.boot();
    const orders = board.setup(a);
    const spied = a.ev("__p1e.installSpies()");
    P.L.check(spied > 50, `spies cover the DOM (${spied})`);
    const before = P.liveFingerprint(a);
    const results = [];
    for (let i = 0; i < 3; i += 1) {
      const { out: r, counters, steps } = P.spiedDryRun(a);
      P.L.check(r.ok, `${boardId} preview ${i + 1} ran: ${JSON.stringify(r.error)}`);
      P.L.same(counters, P.ZERO_COUNTERS, `${boardId} preview ${i + 1}: no DOM creation/mutation, no rAF/timer`);
      P.L.check(steps === 0, `${boardId} preview ${i + 1}: no virtual frame or timer ran`);
      P.L.same(P.liveFingerprint(a), before, `${boardId} preview ${i + 1}: live fingerprint unchanged`);
      results.push(r.result);
    }
    P.L.check(results.every((r) => JSON.stringify(r) === JSON.stringify(results[0])), `${boardId}: the three previews are identical`);
    P.L.check(results[0].eventHash === a.ev(`hashString53(${JSON.stringify(JSON.stringify(results[0].events))})`), `${boardId}: eventHash is the hash of the events`);

    const b = P.boot();
    board.setup(b);
    b.ev("__p1e.installSpies()");
    P.L.same(P.liveFingerprint(a), P.liveFingerprint(b), `${boardId}: previewed context equals a never-previewed control`);
    P.L.check(a.ev("Math.random()") === b.ev("Math.random()"), `${boardId}: harness Math.random stream not advanced by previews`);

    const r = results[0];
    out.cases[boardId] = {
      description: board.description,
      orders,
      previews: 3,
      eventHashes: results.map((x) => x.eventHash),
      outcome: r.outcome,
      events: P.summarizeEvents(r.events),
      predictedRngAdvance: `handState ${JSON.parse(before.state).rng.handState} -> ${r.finalState.rng.handState} (live stays ${JSON.parse(before.state).rng.handState})`,
      liveFingerprintUnchanged: true,
      countersDuringPreviews: P.ZERO_COUNTERS,
      equalsNeverPreviewedControl: true,
    };
  }
  return out;
}
module.exports = { id: ID, run };
