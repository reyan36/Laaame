# 🎮 LAAAME

A 2D endless runner browser game starring **Slipping Jimmy**, who must dodge obstacles while sprinting through the streets. Built with pure HTML5 Canvas, CSS, and vanilla JavaScript — no frameworks, no dependencies.

---

## 🕹️ How to Play

Open `index.html` in a modern browser (Chrome recommended) and start running.

### ⌨️ Keyboard Mode (Default)

| Key | Action |
|-----|--------|
| `↑` / `W` | Move up one lane |
| `↓` / `S` | Move down one lane |
| `Space` | Dash (0.5s invincibility, 5s cooldown) |
| `M` | Mute / Unmute |
| `Esc` | Pause / Resume |

### 🎙️ Voice Mode

| Volume | Action |
|--------|--------|
| Loud speaking | Move to top lane |
| Normal speaking | Stay in center lane |
| Silent | Move to bottom lane |

Voice mode uses your microphone for movement — select it in the menu before starting. No voice data is stored.

---

## 📈 Difficulty Levels

| Level | Target Score | Unlocked By |
|-------|-------------|-------------|
| Easy | 333 | Default |
| Medium | 3,333 | Beat Easy |
| Hard | 33,333 | Beat Medium |
| Extreme | 99,999 | Beat Hard |

Each level gets progressively faster with more frequent and dangerous obstacles.

---

## 🚧 Obstacles

- **📁 Case Files** — Stacks of legal documents sliding across the ground
- **🔨 Hammer (Gavel)** — Fast-moving judge's gavel
- **🔫 Gun** — Fires bullets at Jimmy. Both the gun and its bullets are lethal

---

## ✨ Features

- **Two Control Modes** — Keyboard or Voice (microphone-based) with a mode selector in the menu
- **Dash Mechanic** — Press Space for a brief burst of invincibility with afterimage trail effects
- **📱 Phone Collectible** — Rare phone pickups spawn in lanes. Grab one for +500 bonus points and a *"Better Call Saul!"* animation with signal wave effects
- **Screen Shake** — Canvas shakes on death for impact feedback
- **🌗 Day/Night Theme** — Toggle between a dark city night and a bright daytime look
- **🎵 Music & SFX** — Menu song, two in-game tracks (auto-rotate), and per-obstacle collision sounds. Mute/unmute pauses and resumes without restarting
- **💬 Context-Aware Catchphrases** — Jimmy says different things depending on performance: confident when doing well, frustrated after multiple deaths, and milestone callouts at score thresholds
- **Speech Bubbles** — Follow Jimmy as he moves between lanes
- **🎆 Particle System** — Dust trails, hit particles, dash burst, confetti on level completion, and sparkle effects on phone pickup
- **Parallax Scrolling** — Multi-layer seamless city background with buildings and windows
- **Progress Bar** — Visual progress toward the target score at the bottom of the screen
- **🏆 High Scores** — Per-difficulty high scores saved to localStorage
- **Loading Screen** — Preloads all audio and sprite assets with a progress bar

---

## 🥚 Easter Egg

Type `saulgoodman` during gameplay to instantly win the level. Works in both keyboard and voice modes.

---

## 📂 Project Structure

```
Laaame/
├── index.html                  Main HTML — all screen overlays and UI
├── style.css                   Full styling, day/night themes, animations
├── game.js                     Complete game logic (~1800 lines)
└── Assets/
    ├── Music/
    │   ├── Menu Song.mp3
    │   ├── In-Game Music 1.mp3
    │   └── In-Game Music 2.mp3
    ├── Sound Effects/
    │   ├── Case File Sound.mp3
    │   ├── Hammer Sound.mp3
    │   └── Gun Sound.mp3
    └── Sprites/
        └── jimmy.png
```

---

## 🔧 Technical Details

- **Rendering** — HTML5 Canvas 2D with `requestAnimationFrame` game loop
- **Audio** — HTML5 Audio elements with preloading, clone-based SFX for overlapping sounds
- **Voice Mode** — Web Audio API `AnalyserNode` for RMS amplitude detection with exponential smoothing, noise floor filtering, hysteresis thresholds, and zone hold timers
- **Persistence** — `localStorage` for unlocked levels and high scores
- **Zero dependencies** — runs entirely in the browser

---

## 🌐 Browser Support

Chrome (recommended), Edge, Firefox. Voice mode requires microphone permissions and works best in Chrome.


## 👨‍💻 Developer

[**Reyan Arshad**](https://www.linkedin.com/in/reyan36)


## 📜 License

This project is licensed under the [MIT License](LICENSE).


## ⚠️ Disclaimer

This game is made for fun and educational purposes only. Music and sound effects are not owned by the developer. All rights belong to their respective owners.
