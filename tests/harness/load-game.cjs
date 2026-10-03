"use strict";
/*
 * Headless loader: runs the UNMODIFIED script.js inside a node:vm context with a stubbed DOM.
 *
 * DESIGN CHOICES (read before trusting a result)
 * - Context isolation: every call to loadGame() builds a FRESH vm context, re-runs script.js
 *   from scratch and re-seeds Math.random. Callers use one context per scenario / per fixture
 *   sub-case, so no state (units, queues, hand, terrain, reshuffle charges) leaks between them.
 * - Math.random: the context's Math.random is replaced BEFORE script.js runs with mulberry32(seed)
 *   (default seed 0xC0FFEE). The live game is unseeded; this is only for reproducibility.
 *   Note script.js's own startup (buildArena, first refillAvailableActions) already consumes
 *   values from this stream, so fixtures that care call reseed(n) right before the code under test.
 * - Clock: a deterministic VIRTUAL-TIME scheduler. performance.now() is fake; each "frame" advances
 *   it by 40 ms and runs every queued requestAnimationFrame callback once (units' idle loops all tick
 *   in the same frame). setTimeout/clearTimeout are virtual too (they fire when virtual time reaches
 *   their due time; if no rAF is pending, time jumps to the next timer). The pump only runs while a
 *   runLimited() call is in flight, and each step yields via setImmediate so promises settle in
 *   between. Because nothing depends on wall-clock time the frame count and every state are
 *   reproducible. Frame cap (default 4000 frames = 160 s virtual) rejects runLimited() with
 *   "frame-cap"; a 30 s wall-clock timeout rejects with "timeout". (A real-time setTimeout first
 *   attempt made frame counts depend on machine speed, hence the virtual clock.)
 * - Caps: the step cap counts rAF frames plus virtual timer fires; vm.runInContext calls carry a 30 s
 *   `timeout` so a synchronous infinite loop throws. Usage is exposed via game.usage()/drainUsage().
 * - DOM: a Proxy-wrapped *functional* element (children, parentElement, dataset, classList,
 *   style.setProperty/getPropertyValue, append/prepend/replaceChildren/remove/appendChild/
 *   insertBefore/removeChild, textContent as plain property, getBoundingClientRect -> zeros,
 *   querySelector(All) over descendants by tag/.class/#id/[data-x]) is used for EVERY element, so
 *   the action hand (#actions-list) really holds <li data-action> children. Not implemented:
 *   layout (all rects are 0, so no FLIP slide animations), CSS cascade/getComputedStyle (returns
 *   an empty-value object so e.g. tree-outline opacity reads as NaN/0), events (addEventListener
 *   is recorded and never fired), real image loading (Image.decode resolves immediately; load
 *   events fire on next tick). Unknown element properties read as undefined; a fixed list of
 *   method names (NOOP_METHODS) read as no-op functions. document.querySelector(sel) returns one
 *   cached element per selector string; element.querySelector returns a descendant match or a
 *   fresh detached element (so unguarded chained calls don't throw).
 */
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const util = require("node:util");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT_PATH = path.join(ROOT, "script.js");
const DEFAULT_SEED = 0xc0ffee;
const FRAME_MS = 40;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOOP_METHODS = new Set([
  "addEventListener", "removeEventListener", "dispatchEvent", "focus", "blur", "click",
  "scrollIntoView", "setPointerCapture", "releasePointerCapture", "animate", "after", "before",
  "replaceWith", "insertAdjacentElement", "insertAdjacentHTML", "toggleAttribute", "getAnimations",
  "select", "scrollTo", "requestFullscreen", "showModal", "close",
]);

function createDom(env) {
  function makeClassList(el) {
    const get = () => String(el.className || "").split(/\s+/).filter(Boolean);
    const set = (list) => { el.className = list.join(" "); };
    return {
      add: (...c) => { const l = get(); c.forEach((x) => { if (!l.includes(x)) l.push(x); }); set(l); },
      remove: (...c) => set(get().filter((x) => !c.includes(x))),
      toggle: (c, force) => {
        const has = get().includes(c);
        const want = force === undefined ? !has : Boolean(force);
        if (want && !has) set([...get(), c]);
        if (!want && has) set(get().filter((x) => x !== c));
        return want;
      },
      contains: (c) => get().includes(c),
      replace: (a, b) => { const l = get(); const i = l.indexOf(a); if (i >= 0) { l[i] = b; set(l); } },
      get length() { return get().length; },
      toString: () => get().join(" "),
    };
  }

  function makeStyle() {
    const props = new Map();
    const style = {
      setProperty(k, v) { props.set(k, String(v)); },
      getPropertyValue(k) { return props.get(k) ?? ""; },
      removeProperty(k) { const v = props.get(k) ?? ""; props.delete(k); return v; },
    };
    return style;
  }

  function matches(el, sel) {
    sel = sel.trim();
    if (!sel) return false;
    // compound simple selectors only: tag, .class, #id, [data-x], [data-x="v"]
    const re = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+|\[[^\]]+\])*)$/;
    const m = re.exec(sel);
    if (!m) return false;
    if (m[1] && el.tagName.toLowerCase() !== m[1].toLowerCase()) return false;
    const parts = m[2].match(/[.#][\w-]+|\[[^\]]+\]/g) || [];
    return parts.every((p) => {
      if (p[0] === ".") return el.classList.contains(p.slice(1));
      if (p[0] === "#") return el.id === p.slice(1);
      const am = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(p);
      if (!am) return false;
      const name = am[1];
      const val = name.startsWith("data-")
        ? el.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]
        : el.attributes.get(name);
      return am[2] === undefined ? val !== undefined : String(val) === am[2];
    });
  }

  function descendants(el, out = []) {
    for (const c of el.children) { out.push(c); descendants(c, out); }
    return out;
  }

  function createElement(tag = "div") {
    const target = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      children: [],
      parentNode: null,
      className: "",
      id: "",
      dataset: {},
      attributes: new Map(),
      listeners: [],
      textContent: "",
      style: makeStyle(),
      hidden: false,
      disabled: false,
    };
    target.classList = makeClassList(target);
    const detach = (node) => {
      if (node.parentNode) {
        const sib = node.parentNode.children;
        const i = sib.indexOf(node);
        if (i >= 0) sib.splice(i, 1);
        node.parentNode = null;
      }
    };
    const flatten = (nodes) => nodes.flatMap((n) => {
      if (n && n.__isFragment) { const kids = [...n.children]; kids.forEach((k) => detach(k)); return kids; }
      if (n === null || n === undefined || typeof n !== "object") {
        return [createTextNode(String(n))];
      }
      return [n];
    });
    Object.defineProperties(target, {
      parentElement: { get: () => target.parentNode },
      firstElementChild: { get: () => target.children[0] ?? null },
      lastElementChild: { get: () => target.children[target.children.length - 1] ?? null },
      childElementCount: { get: () => target.children.length },
    });
    Object.assign(target, {
      append(...nodes) { flatten(nodes).forEach((n) => { detach(n); n.parentNode = proxy; target.children.push(n); }); },
      prepend(...nodes) {
        const list = flatten(nodes);
        list.forEach((n) => detach(n));
        list.forEach((n) => { n.parentNode = proxy; });
        target.children.unshift(...list);
      },
      appendChild(n) { target.append(n); return n; },
      replaceChildren(...nodes) {
        target.children.forEach((c) => { c.parentNode = null; });
        target.children.length = 0;
        target.append(...nodes);
      },
      insertBefore(n, ref) {
        detach(n);
        const i = ref ? target.children.indexOf(ref) : -1;
        n.parentNode = proxy;
        if (i < 0) target.children.push(n); else target.children.splice(i, 0, n);
        return n;
      },
      removeChild(n) { detach(n); return n; },
      remove() { detach(proxy); },
      contains(n) { return n === proxy || descendants(target).includes(n); },
      setAttribute(k, v) {
        target.attributes.set(k, String(v));
        if (k === "class") target.className = String(v);
        if (k === "id") target.id = String(v);
        if (k.startsWith("data-")) target.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
      },
      getAttribute(k) { return target.attributes.has(k) ? target.attributes.get(k) : null; },
      removeAttribute(k) { target.attributes.delete(k); },
      hasAttribute(k) { return target.attributes.has(k); },
      addEventListener(type, fn, opts) { target.listeners.push({ type, fn, opts }); },
      removeEventListener() {},
      getBoundingClientRect() {
        return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
      },
      querySelectorAll(sel) {
        const list = descendants(target).filter((n) => sel.split(",").some((s) => matches(n, s)));
        return list;
      },
      querySelector(sel) {
        const found = descendants(target).find((n) => sel.split(",").some((s) => matches(n, s)));
        return found ?? createElement("div");
      },
      closest() { return null; },
      matches(sel) { return matches(target, sel); },
      cloneNode() { return createElement(tag); },
      offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0, offsetTop: 0, offsetLeft: 0,
    });
    const proxy = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop === "string" && NOOP_METHODS.has(prop)) return () => undefined;
        return undefined;
      },
      set(t, prop, value) {
        t[prop] = value;
        if (prop === "id") t.attributes.set("id", String(value));
        return true;
      },
    });
    return proxy;
  }

  function createTextNode(text) {
    const n = createElement("#text");
    n.nodeType = 3;
    n.textContent = text;
    return n;
  }

  function createFragment() {
    const f = createElement("#fragment");
    f.__isFragment = true;
    return f;
  }

  const body = createElement("body");
  const documentElement = createElement("html");
  const selectorCache = new Map();
  const idCache = new Map();
  const cached = (cache, key) => {
    if (!cache.has(key)) {
      const el = createElement("div");
      if (key.startsWith("#")) el.id = key.slice(1);
      body.append(el);
      cache.set(key, el);
    }
    return cache.get(key);
  };

  const document = {
    body,
    documentElement,
    head: createElement("head"),
    createElement,
    createElementNS: (_ns, tag) => createElement(tag),
    createTextNode,
    createDocumentFragment: createFragment,
    getElementById: (id) => cached(idCache, "#" + id),
    querySelector: (sel) => cached(selectorCache, sel),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
    fonts: { ready: Promise.resolve() },
  };
  return document;
}

// ---- console / error capture ------------------------------------------------------------------
// Every context records console.error, console.warn, exceptions thrown out of game timer/rAF
// callbacks, and unhandled promise rejections. run-all drains them after each fixture and FAILS on
// any that is not in tests/harness/console-allowlist.cjs. console.log/info/debug stay silent.
const consoleEvents = [];
let currentLabel = "(no fixture)";
function setFixtureLabel(label) { currentLabel = label; }
function recordEvent(label, kind, text) {
  consoleEvents.push({ fixture: label, kind, message: String(text).replace(/\s+/g, " ").slice(0, 200) });
}
/** Events recorded since the last call (clears the list). */
function drainConsole() { return consoleEvents.splice(0, consoleEvents.length); }
process.on("unhandledRejection", (reason) => {
  recordEvent(currentLabel, "unhandledRejection", reason && reason.message ? reason.message : util.inspect(reason));
});

const SYNC_TIMEOUT_MS = 30000; // vm-level limit for any single synchronous evaluation (infinite-loop guard)
const instances = [];

/**
 * options: seed, frameCap, label (id used in console-error reports; defaults to the fixture run-all
 * is currently executing), query ("?scenario=intro&seed=1" -> window.location.search; default: no
 * location at all, i.e. the original headless world boot), scenarios (true -> run scenarios/*.js
 * before script.js so window.BATTLE_SCENARIOS exists, as index.html does).
 */
function loadGame({ seed = DEFAULT_SEED, frameCap = 4000, label, query, scenarios = false } = {}) {
  const ctxLabel = label ?? currentLabel;
  // stepCap counts rAF frames AND virtual timer fires (frameCap is kept as the option name).
  const state = { frames: 0, timerFires: 0, frameCap, capped: false, now: 1000, rejectCap: null, active: 0 };
  instances.push(state);
  const capPromise = new Promise((_, reject) => { state.rejectCap = reject; });
  capPromise.catch(() => {});

  const document = createDom(state);
  let rafQueue = [];
  let timerQueue = [];
  let nextId = 1;
  let seq = 0;
  let pumping = false;

  const fireDueTimers = () => {
    for (;;) {
      if (state.capped) return;
      const due = timerQueue.filter((t) => t.due <= state.now).sort((x, y) => x.due - y.due || x.seq - y.seq);
      if (!due.length) return;
      const t = due[0];
      timerQueue = timerQueue.filter((x) => x !== t);
      state.timerFires += 1;
      if (state.frames + state.timerFires > state.frameCap) {
        state.capped = true;
        state.rejectCap(new Error("frame-cap"));
        return;
      }
      try { t.fn(...t.args); } catch (e) { recordEvent(ctxLabel, "uncaughtException", e && e.message ? e.message : e); }
    }
  };
  const pump = () => {
    pumping = false;
    if (state.active <= 0 || state.capped) return;
    if (rafQueue.length === 0 && timerQueue.length === 0) return;
    if (rafQueue.length === 0) {
      state.now = Math.max(state.now, Math.min(...timerQueue.map((t) => t.due)));
      fireDueTimers();
    } else {
      state.frames += 1;
      if (state.frames + state.timerFires > state.frameCap) {
        state.capped = true;
        state.rejectCap(new Error("frame-cap"));
        return;
      }
      state.now += FRAME_MS;
      fireDueTimers();
      if (state.capped) return;
      const batch = rafQueue;
      rafQueue = [];
      batch.forEach((r) => {
        if (r.cancelled) return;
        try { r.cb(state.now); } catch (e) { recordEvent(ctxLabel, "uncaughtException", e && e.message ? e.message : e); }
      });
    }
    schedule();
  };
  const schedule = () => {
    if (!pumping && state.active > 0 && !state.capped) {
      pumping = true;
      setImmediate(pump);
    }
  };

  const sandbox = {
    console: {
      log() {}, info() {}, debug() {},
      warn: (...a) => recordEvent(ctxLabel, "console.warn", util.format(...a)),
      error: (...a) => recordEvent(ctxLabel, "console.error", util.format(...a)),
    },
    document,
    navigator: { clipboard: { writeText: () => Promise.resolve() }, userAgent: "node-headless" },
    URLSearchParams, // browser global used by the scenario boot route
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: { now: () => state.now },
    getComputedStyle: () => ({ getPropertyValue: () => "", opacity: "" }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(cb) {
      const r = { id: nextId++, cb, cancelled: false };
      rafQueue.push(r);
      schedule();
      return r.id;
    },
    cancelAnimationFrame(id) {
      rafQueue.forEach((r) => { if (r.id === id) r.cancelled = true; });
    },
    setTimeout(fn, ms = 0, ...args) {
      const t = { id: nextId++, due: state.now + Math.max(0, Number(ms) || 0), seq: seq++, fn, args };
      timerQueue.push(t);
      schedule();
      return t.id;
    },
    clearTimeout(id) { timerQueue = timerQueue.filter((t) => t.id !== id); },
    setInterval: () => 0,
    clearInterval() {},
    Image: class {
      constructor() { this.listeners = {}; this.complete = true; this.naturalWidth = 1; this.naturalHeight = 1; }
      addEventListener(type, fn) { setImmediate(() => { if (type === "load") fn(); }); }
      decode() { return Promise.resolve(); }
      set src(v) { this._src = v; }
      get src() { return this._src; }
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  if (query !== undefined) sandbox.location = { search: String(query), href: "http://localhost/" + query, pathname: "/" };

  const ctx = vm.createContext(sandbox, { name: "game" });
  let rng = mulberry32(seed);
  // Replace the CONTEXT's Math.random before any game code runs.
  vm.runInContext("(function(r){ Math.random = r; })", ctx, { timeout: SYNC_TIMEOUT_MS })(() => rng());

  if (scenarios) {
    const dir = path.join(ROOT, "scenarios");
    fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().forEach((f) => {
      vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: "scenarios/" + f, timeout: SYNC_TIMEOUT_MS });
    });
  }
  const code = fs.readFileSync(SCRIPT_PATH, "utf8");
  vm.runInContext(code, ctx, { filename: "script.js", timeout: SYNC_TIMEOUT_MS });

  const api = {
    ctx,
    sandbox,
    clock: state,
    /** Evaluate an expression/statement in the game's top-level scope (can read let/const). */
    ev: (src) => vm.runInContext(src, ctx, { timeout: SYNC_TIMEOUT_MS }),
    /** Virtual steps consumed so far: rAF frames + timer fires (compared with the cap). */
    usage: () => ({ frames: state.frames, timerFires: state.timerFires, steps: state.frames + state.timerFires, cap: state.frameCap }),
    /** Reset the seeded stream (do this immediately before code whose randomness you record). */
    reseed: (s = seed) => { rng = mulberry32(s); },
    /** Run an async fn with a wall-clock timeout and the animation-frame cap. */
    async runLimited(fn, timeoutMs = 30000) {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      });
      state.active += 1;
      schedule();
      try {
        return await Promise.race([Promise.resolve().then(fn), timeout, capPromise]);
      } finally {
        state.active -= 1;
        clearTimeout(timer);
      }
    },
  };
  return api;
}

/** Usage across every context created since the last call (used by run-all per fixture). */
function drainUsage() {
  const list = instances.splice(0, instances.length);
  const steps = list.map((s) => s.frames + s.timerFires);
  return {
    contexts: list.length,
    maxSteps: Math.max(0, ...steps),
    totalSteps: steps.reduce((a, b) => a + b, 0),
    cap: list.length ? list[0].frameCap : 0,
  };
}

module.exports = { drainUsage, drainConsole, setFixtureLabel, SYNC_TIMEOUT_MS, loadGame, mulberry32, ROOT, DEFAULT_SEED };
