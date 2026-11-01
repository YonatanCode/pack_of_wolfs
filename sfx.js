// Sound effects, synthesized with the Web Audio API (no audio files). Exposes window.Sfx; script.js calls it from
// the presentation layer. Effects are OFF by default: the dev-tools "Effects" button turns them on and off (separate
// from the Music button) and the choice is remembered in localStorage. Classic script, copied verbatim into dist.
(() => {
  const SFX_STORAGE_KEY = "game.sfxOn";
  const MASTER_VOLUME = 0.5;
  // Several units often move in the same instant; collapse those into one swoosh.
  const MIN_MOVE_GAP_S = 0.07;
  // A move's swoosh lasts as long as the move, within these bounds.
  const MIN_SWOOSH_S = 0.18;
  const MAX_SWOOSH_S = 0.6;
  const NOISE_SECONDS = 1;
  // Every swoosh is a little different: pitch +-PITCH_JITTER, loudness +-LOUDNESS_JITTER, length +-LENGTH_JITTER.
  const PITCH_JITTER = 0.18;
  const LOUDNESS_JITTER = 0.2;
  const LENGTH_JITTER = 0.08;

  const sfxButton = document.getElementById("dev-toggle-sfx");
  // The visual replay page (?replay=1) is a silent viewer.
  const silent = new URLSearchParams(location.search).has("replay");

  let enabled = readEnabled();
  let ctx = null;
  let master = null;
  let noise = null;
  let lastMoveAt = -Infinity;

  function readEnabled() {
    try {
      return localStorage.getItem(SFX_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeEnabled(value) {
    try {
      localStorage.setItem(SFX_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Storage unavailable (private window, blocked site data): the choice just won't persist.
    }
  }

  function renderSfxButton() {
    if (sfxButton) {
      sfxButton.textContent = enabled ? "Effects: on" : "Effects: off";
      sfxButton.classList.toggle("is-active", enabled);
      sfxButton.setAttribute("aria-pressed", String(enabled));
    }
  }

  // The AudioContext is created on first use, which only happens while effects are on.
  function ready() {
    if (silent || !enabled || typeof AudioContext === "undefined") {
      return false;
    }

    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);

      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    return true;
  }

  // The sound of one tile move: a single swoosh of band-passed noise whose pitch sweeps up and back down, as long
  // as the move itself (moveDurationMs, from script.js) so it follows the run animation. Pitch, loudness, length and
  // where the sweep peaks are all nudged randomly per call.
  function move(moveDurationMs = 0) {
    if (!ready() || ctx.currentTime - lastMoveAt < MIN_MOVE_GAP_S) {
      return;
    }

    const t0 = ctx.currentTime;
    lastMoveAt = t0;
    const spread = (amount) => 1 + (Math.random() * 3 - 1) * amount;
    const dur = Math.min(MAX_SWOOSH_S, Math.max(MIN_SWOOSH_S, (moveDurationMs / 1000) * spread(LENGTH_JITTER)));
    const pitch = spread(PITCH_JITTER);
    const peakAt = 0.5 + Math.random() * 0.1;

    const source = ctx.createBufferSource();
    source.buffer = noise;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(450 * pitch, t0);
    band.frequency.exponentialRampToValueAtTime(1800 * pitch, t0 + dur * (peakAt + 0.05));
    band.frequency.exponentialRampToValueAtTime(700 * pitch, t0 + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.5 * spread(LOUDNESS_JITTER), t0 + dur * peakAt);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    source.connect(band).connect(gain).connect(master);
    source.start(t0);
    source.stop(t0 + dur);
  }

  sfxButton?.addEventListener("click", () => {
    enabled = !enabled;
    writeEnabled(enabled);
    renderSfxButton();

    if (enabled) {
      ready(); // create/resume the context inside this click so the browser allows playback
    }
  });

  renderSfxButton();

  window.Sfx = { move };
})();
