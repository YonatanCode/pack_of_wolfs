# Project Notes For Codex

- Do not use Safari/Apple Events for local browser verification in this project. Safari is expected to have "Allow JavaScript from Apple Events" disabled, and the user checks the UI manually.
- Keep automated verification lightweight unless the user asks for deeper testing. Prefer syntax checks, static serving checks, or the in-app Browser plugin when it is available.
- The battlefield `.arena` is scaled with `--arena-scale`, so UI elements added inside the arena or attached to units will visually grow unless they compensate for that scale. For overlays such as health bars, labels, or action tags, keep them separate from the sprite element and apply `scale(var(--arena-scale-inverse))`; update the inverse whenever `resizeArena()` changes `--arena-scale`. Keep size/position tunable with CSS variables.
