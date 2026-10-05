"use strict";
// G2: approvals gate + run.cjs refusal paths + --check-only. Temp dirs, fake approval files, injected build-id.
// The --run success path is NEVER executed here: every --run case must refuse, and loadModules is a spy that fails the fixture if reached.
const fs = require("node:fs");
const path = require("node:path");
const { main } = require("../../tools/lab/run.cjs");
const { loadApprovals, consumeAuthorization } = require("../../tools/lab/approvals.cjs");
const { manifestHash } = require("../../tools/lab/manifest.cjs");
const { BUILD, OTHER_BUILD, BOT_IDS, baseManifest, tmpDir, writeJson, cleanup } = require("./_g.cjs");

const ID = "g2-approvals-run";
const MH = manifestHash(baseManifest());
const OTHER_MH = "c".repeat(64);
const pc = (buildId = BUILD) => ({ buildId, quote: "fake playcheck", recordedAt: "2000-01-01T00:00:00Z" });
const au = (o = {}) => ({ buildId: BUILD, manifestHash: MH, quote: "fake authorization", recordedAt: "2000-01-01T00:00:00Z", consumedAt: null, ...o });
const good = () => ({ playchecks: [pc()], authorizations: [au()] });

async function cli(args, { approvals, manifest = baseManifest(), build = { buildId: BUILD, dirty: false } } = {}) {
  const dir = tmpDir();
  try {
    const mf = path.join(dir, "m.json");
    writeJson(mf, manifest);
    const ap = path.join(dir, "approvals.json");
    if (approvals !== undefined) writeJson(ap, approvals);
    const lines = []; const errs = [];
    let moduleLoads = 0; let buildCalls = 0;
    const code = await main(["--manifest", mf, ...args, "--approvals", ap], {
      botIds: BOT_IDS,
      currentBuild: () => { buildCalls++; return build; },
      loadModules: () => { moduleLoads++; throw new Error("fixture must never reach the driver"); },
      out: (s) => lines.push(s.split(dir).join("<tmp>")), err: (s) => errs.push(s.split(dir).join("<tmp>").replace(/(not valid JSON): .*$/, "$1")),
    });
    let after = null;
    if (fs.existsSync(ap)) { try { after = JSON.parse(fs.readFileSync(ap, "utf8")); } catch { after = "unparseable"; } }
    return { code, out: lines, err: errs, moduleLoads, buildCalls, approvalsAfter: after };
  } finally { cleanup(dir); }
}
const run = (approvals, extra = {}) => cli(["--run"], { approvals, ...extra });

async function exec() {
  const cases = {};
  const R = (r) => ({ code: r.code, err: r.err, moduleLoads: r.moduleLoads });

  // --- --check-only: never touches the driver, even when every gate passes ---
  const ok = await cli(["--check-only"], { approvals: good() });
  cases["check-only-all-pass"] = { code: ok.code, out: ok.out, moduleLoads: ok.moduleLoads, consumedAfter: ok.approvalsAfter.authorizations[0].consumedAt };
  const bad = await cli(["--check-only"], { approvals: undefined });
  cases["check-only-no-approvals"] = { code: bad.code, out: bad.out, moduleLoads: bad.moduleLoads, approvalsFileCreated: bad.approvalsAfter !== null };
  const inv = await cli(["--check-only"], { approvals: good(), manifest: { ...baseManifest(), extra: 1 } });
  cases["check-only-invalid-manifest"] = { code: inv.code, out: inv.out, moduleLoads: inv.moduleLoads };

  // --- --run refusals (each must refuse, exit 2, never load modules, never consume) ---
  const refuse = async (name, approvals, extra) => { const r = await run(approvals, extra); cases[name] = { ...R(r), consumedAfter: r.approvalsAfter && r.approvalsAfter.authorizations ? r.approvalsAfter.authorizations.map((a) => a.consumedAt) : null }; };
  await refuse("run-invalid-manifest", good(), { manifest: { ...baseManifest(), limits: { maxBattles: 10 } } });
  await refuse("run-stale-build", good(), { build: { buildId: OTHER_BUILD, dirty: false } });
  await refuse("run-dirty-tree", good(), { build: { buildId: BUILD, dirty: true } });
  await refuse("run-unknown-dirty-state", good(), { build: { buildId: BUILD, dirty: null } });
  await refuse("run-no-approvals-file", undefined);
  await refuse("run-no-playcheck", { playchecks: [], authorizations: [au()] });
  await refuse("run-playcheck-other-build", { playchecks: [pc(OTHER_BUILD)], authorizations: [au()] });
  await refuse("run-no-authorization", { playchecks: [pc()], authorizations: [] });
  await refuse("run-authorization-other-manifest", { playchecks: [pc()], authorizations: [au({ manifestHash: OTHER_MH })] });
  await refuse("run-authorization-other-build", { playchecks: [pc()], authorizations: [au({ buildId: OTHER_BUILD })] });
  await refuse("run-authorization-consumed", { playchecks: [pc()], authorizations: [au({ consumedAt: "2000-01-02T00:00:00Z" })] });
  await refuse("run-malformed-not-json", "{ not json");
  await refuse("run-malformed-shape", { playchecks: "x", authorizations: [] });
  await refuse("run-malformed-record", { playchecks: [pc()], authorizations: [{ buildId: BUILD }] });
  await refuse("run-malformed-unknown-key", { playchecks: [], authorizations: [], extra: 1 });
  // manifest.buildId stale but approvals match the stale id: approvals are matched to the CURRENT build, so this still refuses
  await refuse("run-manifest-claims-old-build-with-old-approvals", { playchecks: [pc(OTHER_BUILD)], authorizations: [au({ buildId: OTHER_BUILD })] }, { manifest: { ...baseManifest(), buildId: OTHER_BUILD } });

  // usage errors
  const u1 = await main(["--check-only", "--run", "--manifest", "x"], { err: () => {}, out: () => {} });
  const u2 = await main(["--run"], { err: () => {}, out: () => {} });
  const u3 = await main(["--manifest", "x", "--bogus"], { err: () => {}, out: () => {} });
  cases["usage-errors"] = { both: u1, noManifest: u2, unknownArg: u3 };

  // --- approvals.cjs consume path directly ---
  const dir = tmpDir();
  try {
    const f = path.join(dir, "approvals.json");
    writeJson(f, { playchecks: [pc()], authorizations: [au(), au({ manifestHash: OTHER_MH })] });
    const first = consumeAuthorization(f, BUILD, MH, { now: () => "2001-01-01T00:00:00Z" });
    const second = consumeAuthorization(f, BUILD, MH, { now: () => "2002-01-01T00:00:00Z" });
    const after = loadApprovals(f).data;
    const leftovers = fs.readdirSync(dir).filter((n) => n.endsWith(".tmp"));
    cases["consume-single-use"] = { first, second, consumed: after.authorizations.map((a) => a.consumedAt), otherManifestUntouched: after.authorizations[1].consumedAt === null, tmpLeftovers: leftovers.length };
    cases["consume-wrong-manifest"] = consumeAuthorization(f, BUILD, "d".repeat(64));
    cases["consume-wrong-build"] = consumeAuthorization(f, OTHER_BUILD, OTHER_MH);
    cases["consume-missing-file"] = (({ ok, reason }) => ({ ok, reason: reason.split(dir).join("<tmp>") }))(consumeAuthorization(path.join(dir, "nope.json"), BUILD, MH));
    writeJson(path.join(dir, "bad.json"), "][");
    cases["consume-malformed"] = (({ ok, reason }) => ({ ok, reason: reason.replace(/:.*$/, "") }))(consumeAuthorization(path.join(dir, "bad.json"), BUILD, MH));
    cases["load-missing-is-empty"] = (({ ok, data, missing }) => ({ ok, data, missing }))(loadApprovals(path.join(dir, "nope.json")));
  } finally { cleanup(dir); }
  return cases;
}

async function runFixture() { return { id: ID, cases: await exec() }; }
module.exports = { id: ID, run: runFixture };
