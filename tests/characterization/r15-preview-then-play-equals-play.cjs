"use strict";
// REQUIREMENT — P1e acceptance
// R15: previewing does not change what Play then does, and the preview predicts it exactly. Two fresh contexts
// per case, same boot, same seed, same hand-authored choices, a call-through presentation-call trace
// (c10-style wrappers over the c10 names plus the other presentation entry points, stamped with the virtual
// clock) installed from the start in both:
//   A: dryRunTurn() twice, then the real executePlayerActionQueue();
//   B: the real executePlayerActionQueue() only.
// Asserted per played turn: identical event log, final state snapshot (incl. the SUBSEQUENT hand data and the
// hand-RNG position), outcome, battle-note text (lexical and window mirror), hand view, virtual-clock usage and
// the FULL presentation trace (the previews add zero entries); and the preview's predicted events /
// finalState / outcome / eventHash equal what the real turn then produced (dry run == real rules path).
// Cases: the plain intro board over two turns (cards picked by index each turn), and the lethal board
// (casualty replan, heal, refill) followed by a second turn.
const P = require("./_preview.cjs");

const ID = "r15-preview-then-play-equals-play";

const CASES = [
  {
    id: "plain-two-turns",
    description: "Seed-1 intro board, untouched; each turn the first hand card (by index) to P1, P2, P3.",
    turns: [P.BOARDS.plain.setup, P.BOARDS.plain.setup],
  },
  {
    id: "lethal-then-second-turn",
    description: "Lethal board (E1 and P1 die in tick 1, pack replanned, P3 heals, 4 cards redrawn), then a second turn: first hand card to P2 and P3.",
    turns: [(g) => P.BOARDS.lethal.setup(g), (g) => [...P.L.queueByIndex(g, "playerSupport", [0]), ...P.L.queueByIndex(g, "playerFlank", [0])]],
  },
];

async function playSide(def, withPreview) {
  const g = P.boot();
  const trace = P.installPresentationTrace(g);
  const turns = [];
  for (const choose of def.turns) {
    const orders = choose(g);
    let predictions = [];
    if (withPreview) {
      const traceLen = trace.length;
      const steps = g.usage().steps;
      predictions = [P.dryRun(g), P.dryRun(g)];
      predictions.forEach((p, i) => P.L.check(p.ok, `${def.id} preview ${i + 1} ran: ${JSON.stringify(p.error)}`));
      P.L.check(trace.length === traceLen, `${def.id}: previews added zero presentation calls (${trace.slice(traceLen).join(" / ")})`);
      P.L.check(g.usage().steps === steps, `${def.id}: previews used no virtual time`);
    }
    const events = await P.L.playTurn(g);
    turns.push({
      orders,
      predictions: predictions.map((p) => p.result),
      events,
      eventHash: g.ev(`hashString53(${JSON.stringify(JSON.stringify(events))})`),
      state: P.snapshot(g),
      note: g.ev("lastBattleDebugReport"),
      windowNote: g.ev("window.lastBattleDebugReport ?? null"),
      handView: P.evJ(g, "Array.from(actionsList.children).map((i) => i.dataset.action)"),
      usage: g.usage(),
    });
  }
  return { turns, trace };
}

async function run() {
  const out = { header: P.REQ_HEADER, cases: {} };
  for (const def of CASES) {
    const a = await playSide(def, true);
    const b = await playSide(def, false);
    P.L.same(a.trace, b.trace, `${def.id}: full presentation-call trace identical with and without previews`);
    const turns = a.turns.map((ta, i) => {
      const tb = b.turns[i];
      const t = `${def.id} turn ${i + 1}`;
      P.L.same(ta.orders, tb.orders, `${t}: same choices`);
      P.L.same(ta.events, tb.events, `${t}: event log`);
      P.L.same(ta.state, tb.state, `${t}: final state snapshot (hand data + RNG position included)`);
      P.L.same([ta.note, ta.windowNote], [tb.note, tb.windowNote], `${t}: battle note`);
      P.L.same(ta.handView, tb.handView, `${t}: hand view`);
      P.L.same(ta.usage, tb.usage, `${t}: virtual clock / steps`);
      ta.predictions.forEach((p, k) => {
        P.L.same(p.events, ta.events, `${t}: preview ${k + 1} predicted the events`);
        P.L.same(p.finalState, ta.state, `${t}: preview ${k + 1} predicted the final state`);
        P.L.same(p.outcome, (({ winner, doubleKO }) => ({ winner, doubleKO }))(ta.events.find((e) => e.type === "outcome")), `${t}: preview ${k + 1} predicted the outcome`);
        P.L.check(p.eventHash === ta.eventHash, `${t}: preview ${k + 1} event hash`);
      });
      return {
        orders: ta.orders,
        eventHash: ta.eventHash,
        predictedHashes: ta.predictions.map((p) => p.eventHash),
        outcome: ta.predictions[0].outcome,
        events: P.summarizeEvents(ta.events),
        handAfter: ta.state.hand.cards.join(","),
        rngAfter: `seed=${ta.state.rng.handSeed} state=${ta.state.rng.handState}`,
        noteLines: ta.note.split("\n").length,
      };
    });
    out.cases[def.id] = {
      description: def.description,
      turns,
      presentationTraceEntries: a.trace.length,
      previewsAddedPresentationCalls: 0,
      previewThenPlayEqualsPlay: true,
      previewPredictedPlay: true,
    };
  }
  return out;
}
module.exports = { id: ID, run };
