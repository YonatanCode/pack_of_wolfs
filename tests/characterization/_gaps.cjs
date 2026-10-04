"use strict";
// Shared helpers for the P2a gap-check fixtures (r25..r27). Not a fixture itself.
// Read-only reuse of _preview (probes, live fingerprint, boards, dry runs) and _settings (links, Apply, hand ledger).
// HAND BUDGET: every context counts its hands like the P2a fixtures (boot hand + every dealt/refilled hand, dry runs
// included) and reports them to the SEPARATE follow-up ledger (_settings.reportStepHands, <= 100 in total).
const PV = require("./_preview.cjs");
const S = require("./_settings.cjs");

const REQ_HEADER_GAPS = "REQUIREMENT — P2a gap checks";

/** The _settings hand counter, installed on a context booted elsewhere (the boot hand is the +1 in handsOf). */
function installHandCounter(g) {
  g.ev(`window.__drawn = 0; (function () { const orig = drawPlayerHandToSize;
    drawPlayerHandToSize = function () { const r = orig.apply(this, arguments); if (r.length) window.__drawn += 1; return r; }; })()`);
  return S.countInlineHands(g);
}

/** _preview boot (probes for liveFingerprint, seed-1 intro), hand counter, then `patch` applied through the real Apply. */
function bootPreviewCustom(patch) {
  const g = PV.boot();
  installHandCounter(g);
  const applied = S.apply(g, patch);
  S.check(applied.ok === true, `custom settings applied: ${JSON.stringify(applied)}`);
  return g;
}

/** Next n hand-stream values WITHOUT consuming them (a copy of the stream at its current position). */
const peekStream = (g, n = 3) => PV.evJ(g, `(function () { const r = createSeededRandom(handRandom.getState()); return Array.from({ length: ${n} }, () => r()); })()`);

/** Run code in the context; { thrown, name, reason, message } (never throws on the host side). */
const attempt = (g, code) => PV.evJ(g, `(function () { try { ${code}; return { thrown: false }; }
  catch (e) { return { thrown: true, name: e && e.name, reason: (e && e.reason) ?? null, message: String(e && e.message).split("\\n")[0] }; } })()`);

/** One-shot fault: the global `name` runs `body` (with __orig = the current function) on its next call only. */
function injectOnce(g, name, body) {
  g.ev(`(function () { const __orig = ${name}; ${name} = function (...a) { ${name} = __orig; ${body} }; })()`);
}

module.exports = { PV, S, REQ_HEADER_GAPS, installHandCounter, bootPreviewCustom, peekStream, attempt, injectOnce };
