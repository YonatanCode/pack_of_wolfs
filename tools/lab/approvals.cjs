"use strict";
/*
 * Battle Lab approvals (lab/approvals.json, gitignored). READ and CONSUME only.
 * This module deliberately has NO function that creates a playcheck or an authorization: those records are written
 * only by the coordinator after explicit user chat messages. The one write this module performs is marking an
 * existing authorization consumed (temp file + rename, then re-read to verify).
 * PoC-grade process control, not a security boundary.
 */
const fs = require("node:fs");
const path = require("node:path");

const HEX64 = /^[0-9a-f]{64}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.length > 0;

function validateShape(d) {
  const errors = [];
  if (!isObj(d)) return ["approvals file must be a JSON object"];
  for (const k of Object.keys(d)) if (k !== "playchecks" && k !== "authorizations") errors.push(`unknown key: ${k}`);
  if (!Array.isArray(d.playchecks)) errors.push("playchecks must be an array");
  if (!Array.isArray(d.authorizations)) errors.push("authorizations must be an array");
  if (errors.length) return errors;
  const PC = ["buildId", "quote", "recordedAt"];
  const AU = ["buildId", "manifestHash", "quote", "recordedAt", "consumedAt"];
  d.playchecks.forEach((r, i) => {
    const p = `playchecks[${i}]`;
    if (!isObj(r)) { errors.push(`${p} must be an object`); return; }
    for (const k of Object.keys(r)) if (!PC.includes(k)) errors.push(`${p}: unknown key ${k}`);
    if (!HEX64.test(r.buildId ?? "")) errors.push(`${p}.buildId must be 64 hex chars`);
    if (!isStr(r.quote)) errors.push(`${p}.quote must be a non-empty string`);
    if (!isStr(r.recordedAt)) errors.push(`${p}.recordedAt must be a non-empty string`);
  });
  d.authorizations.forEach((r, i) => {
    const p = `authorizations[${i}]`;
    if (!isObj(r)) { errors.push(`${p} must be an object`); return; }
    for (const k of Object.keys(r)) if (!AU.includes(k)) errors.push(`${p}: unknown key ${k}`);
    if (!HEX64.test(r.buildId ?? "")) errors.push(`${p}.buildId must be 64 hex chars`);
    if (!HEX64.test(r.manifestHash ?? "")) errors.push(`${p}.manifestHash must be 64 hex chars`);
    if (!isStr(r.quote)) errors.push(`${p}.quote must be a non-empty string`);
    if (!isStr(r.recordedAt)) errors.push(`${p}.recordedAt must be a non-empty string`);
    if (!("consumedAt" in r) || !(r.consumedAt === null || isStr(r.consumedAt))) errors.push(`${p}.consumedAt must be null or a timestamp string`);
  });
  return errors;
}

/** loadApprovals(file) -> { ok, data, error }. A missing file means no approvals (ok, empty). Anything unparseable is refused. */
function loadApprovals(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return { ok: true, data: { playchecks: [], authorizations: [] }, missing: true, error: null };
    return { ok: false, data: null, error: `cannot read approvals file: ${e.message}` };
  }
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, data: null, error: `approvals file is not valid JSON: ${e.message}` }; }
  const errors = validateShape(data);
  if (errors.length) return { ok: false, data: null, error: `approvals file malformed: ${errors.join("; ")}` };
  return { ok: true, data, missing: false, error: null };
}

const findPlaycheck = (data, buildId) => data.playchecks.find((r) => r.buildId === buildId) || null;
const findAuthorizations = (data, buildId, manifestHash) => data.authorizations.filter((r) => r.buildId === buildId && r.manifestHash === manifestHash);

/**
 * Gate status for a build + manifest. Pure read.
 * -> { playcheck: {ok, reason}, authorization: {ok, reason} }
 */
function checkApprovals(data, buildId, manifestHash) {
  const pc = findPlaycheck(data, buildId);
  const playcheck = pc ? { ok: true, reason: "playcheck recorded for this exact build" }
    : { ok: false, reason: data.playchecks.length ? `no playcheck for build ${buildId} (playchecks exist only for other builds)` : `no playcheck for build ${buildId}` };
  const matches = findAuthorizations(data, buildId, manifestHash);
  const open = matches.find((r) => r.consumedAt === null);
  let authorization;
  if (open) authorization = { ok: true, reason: "unconsumed authorization for this exact build and manifest hash" };
  else if (matches.length) authorization = { ok: false, reason: "authorization for this build and manifest hash was already consumed (single-use)" };
  else if (data.authorizations.some((r) => r.buildId === buildId)) authorization = { ok: false, reason: `no authorization for manifest hash ${manifestHash} (authorizations exist only for other manifests)` };
  else authorization = { ok: false, reason: `no authorization for build ${buildId} and manifest hash ${manifestHash}` };
  return { playcheck, authorization };
}

/**
 * Consume one unconsumed authorization (build + manifest hash). Write temp file, rename, re-read to verify.
 * -> { ok, reason }. Never creates records.
 */
function consumeAuthorization(file, buildId, manifestHash, opts = {}) {
  const lock = `${file}.lock`;
  let fd;
  try {
    fd = fs.openSync(lock, "wx");
  } catch (e) {
    if (e && e.code === "EEXIST") return { ok: false, reason: `approvals lock exists (${path.basename(lock)}): another consume is in progress or a previous one crashed; remove the lock file by hand only after checking approvals.json` };
    return { ok: false, reason: `cannot create approvals lock: ${e.message}` };
  }
  try {
    return consumeLocked(file, buildId, manifestHash, opts);
  } finally {
    try { fs.closeSync(fd); } catch { /* best effort */ }
    try { fs.rmSync(lock, { force: true }); } catch { /* best effort */ }
  }
}

function consumeLocked(file, buildId, manifestHash, opts) {
  const now = opts.now ? opts.now() : new Date().toISOString();
  const loaded = loadApprovals(file);
  if (!loaded.ok) return { ok: false, reason: loaded.error };
  if (loaded.missing) return { ok: false, reason: `approvals file not found: ${file}` };
  const data = loaded.data;
  const status = checkApprovals(data, buildId, manifestHash);
  if (!status.authorization.ok) return { ok: false, reason: status.authorization.reason };
  const idx = data.authorizations.findIndex((r) => r.buildId === buildId && r.manifestHash === manifestHash && r.consumedAt === null);
  data.authorizations[idx].consumedAt = now;
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    return { ok: false, reason: `could not write consumption record: ${e.message}` };
  }
  const check = loadApprovals(file);
  const rec = check.ok ? check.data.authorizations[idx] : null;
  if (!rec || rec.consumedAt !== now || rec.buildId !== buildId || rec.manifestHash !== manifestHash) {
    return { ok: false, reason: "consumption could not be verified after writing; treat the authorization as unusable" };
  }
  return { ok: true, reason: "authorization consumed", consumedAt: now };
}

module.exports = { loadApprovals, checkApprovals, consumeAuthorization, validateShape };
