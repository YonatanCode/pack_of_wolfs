// Background music: one looping track per screen — fight music during a battle, "Menu and map" while the
// world map is open. Which screen is showing is read from the `is-zoomed-out` class that script.js puts on the
// stage while the map is open, so this file never touches game logic. Classic script, copied verbatim into dist.
// Browsers block audio until the page has had a user gesture: the first play() is attempted on load and, if it is
// refused, retried on the first click / key press. Music is OFF by default: the dev-tools "Music" button turns it
// on and off, and the choice is remembered in localStorage.
(() => {
  const TRACKS = {
    fight: "assets/sound/Fight_music.m4a",
    map: "assets/sound/Menu and map.m4a",
  };
  const MUSIC_STORAGE_KEY = "game.musicOn";

  const stage = document.querySelector(".stage");
  const musicButton = document.getElementById("dev-toggle-music");

  // The visual replay page (?replay=1) is a silent viewer.
  if (!stage || new URLSearchParams(location.search).has("replay")) {
    return;
  }

  const audio = {};
  for (const [name, src] of Object.entries(TRACKS)) {
    // "none": the long map track is only fetched once the map is first opened.
    audio[name] = Object.assign(new Audio(encodeURI(src)), { loop: true, preload: "none" });
  }

  let current = null;
  let enabled = readEnabled();

  function readEnabled() {
    try {
      return localStorage.getItem(MUSIC_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeEnabled(value) {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Storage unavailable (private window, blocked site data): the choice just won't persist.
    }
  }

  function renderMusicButton() {
    if (musicButton) {
      musicButton.textContent = enabled ? "Music: on" : "Music: off";
      musicButton.classList.toggle("is-active", enabled);
      musicButton.setAttribute("aria-pressed", String(enabled));
    }
  }

  // Play the track for the current screen. A battle's fight music starts from the top; the map track resumes
  // where it left off.
  function sync() {
    if (!enabled) {
      return;
    }

    const wanted = stage.classList.contains("is-zoomed-out") ? "map" : "fight";

    if (wanted !== current) {
      if (current) {
        audio[current].pause();
      }
      if (wanted === "fight") {
        audio.fight.currentTime = 0;
      }
      current = wanted;
    }

    audio[current].play().catch(() => {
      // Autoplay refused (no user gesture yet): retry once on the first interaction.
      const retry = () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
        sync();
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });
    });
  }

  musicButton?.addEventListener("click", () => {
    enabled = !enabled;
    writeEnabled(enabled);
    renderMusicButton();

    if (enabled) {
      sync();
    } else {
      for (const track of Object.values(audio)) {
        track.pause();
      }
    }
  });

  new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ["class"] });

  renderMusicButton();
  sync();
})();
