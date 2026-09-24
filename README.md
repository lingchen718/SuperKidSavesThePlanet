# Super Kid Saves the Planet 🌍

A kid-friendly arcade game about protecting the planet, rebuilt as a **front-end only web app** from the original [pygame project](https://github.com/lingchen718/superkid-saves-the-planet).

Catch the good eco items, dodge the pollution, answer the quiz questions, and bring Earth back to 100% health before the 5-minute timer runs out.

> No accounts. No login. No backend. It runs 100% in the browser.

## ✨ What's in the game

- **Catch good items** (recycling, trees, solar power…) to raise planet health and earn points.
- **Avoid bad items** (smoke, trash, plastic…) — they hurt the planet and cost a life.
- **🧊 Ice cubes:** catching an ice cube **freezes Super Kid for 3 seconds** before you can move again.
- **🛡 Shield power-up:** catch a shield to block bad items for 7 seconds.
- **📈 Difficulty ramp:** items fall a little faster (and slightly more often) every minute.
- **🏆 Best score** is saved in the browser (localStorage) — no account needed.
- **Eco quizzes:** every 5 catches opens a quick quiz. Answer correctly for a big +6 health bonus.
- **Clean Environment mode:** when planet health reaches **50%**, the world transforms from polluted to clean (background + music change).
- **Win / Game Over screens** with confetti, score, and instant replay.
- **More falling items** with a slightly faster drop speed for extra action.
- **Original hand-drawn backgrounds** (polluted city vs. clean nature) kept from the original game.
- **Touch & keyboard controls** so it works on phones, tablets, and desktops.
- **Fully responsive layout** — the 4:3 play area scales to any screen and the controls stay anchored to the game.
- **Mute toggle** (top-right 🔊 button).
- **Pause / resume** (top-right ⏸ button or `P`).

## 🎮 Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left / right | `←` `→` or `A` `D` | Hold the left / right half of the screen |
| Start / restart | `Enter` or `Space` | Tap anywhere / tap **Play Again** |
| Answer quiz | `A` `B` `C` | Tap the answer |
| Continue after quiz | Any key | Tap anywhere |
| Toggle sound | — | 🔊 button (top-right) |
| Pause / resume | `P` or `Esc` | ⏸ button (top-right) |

## ▶️ Run it locally

Just open `index.html` in a browser, or serve the folder:

```bash
# Python
python3 -m http.server 8000
# then visit http://localhost:8000
```

(Serving over HTTP is recommended so fonts and sounds load consistently.)

## 🚀 Publish it as a web app

The project is a static site, so it can be hosted anywhere (GitHub Pages, Netlify, Vercel, itch.io…).

**GitHub Pages (free):**

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch** and select the branch (e.g. `main`) and the `/ (root)` folder.
4. Save. Your game will be live at `https://<username>.github.io/<repo>/`.

> Tip: if you prefer the game at the repo root URL, keep the `index.html` in the root as it is now.

## 🗂 Project structure

```
SuperKidSavesThePlanet/
├── index.html          # page shell + canvas + mute button
├── css/
│   └── style.css       # layout, font, responsive canvas
├── js/
│   ├── quizzes.js      # all ECO + MATH quiz data, story lines, win messages
│   └── game.js         # game loop, rendering, input, audio, freeze mechanic
└── assets/
    ├── images/         # sprites + backgrounds (reused from the original game)
    ├── sounds/         # sound effects + music (.ogg)
    └── fonts/          # Comic Neue webfont
```

## 🛠 Adding more features

The code is organised so new mechanics are easy to add:

- **Gameplay tuning** — constants live at the top of `js/game.js`:
  `GAME_DURATION`, `QUIZ_INTERVAL`, `CLEAN_HEALTH_THRESHOLD`, `FREEZE_SECONDS`,
  `SHIELD_SECONDS`, `STARTING_HEALTH`, `STARTING_LIVES`, and the difficulty ramp
  (`BASE_SPAWN_PER_SEC`, `BASE_FALL_SPEED_*`, `SPEEDUP_PER_MINUTE`, `SPAWN_RAMP_PER_MINUTE`).
  The best score is stored under `BEST_SCORE_KEY`.
- **New falling item types** — extend `_spawnItem()` and `_handleCatch()` in `js/game.js`
  (and optionally add a sprite in `assets/images/`).
- **New quiz questions** — edit `js/quizzes.js`.
- **More text** — intro story lines and win messages are also in `js/quizzes.js`.

## 📚 Original game

The original Python/pygame version (game logic, art, sounds, quizzes) is at
[github.com/lingchen718/superkid-saves-the-planet](https://github.com/lingchen718/superkid-saves-the-planet).
This repository is a faithful browser port of that game, with the ice-cube freeze mechanic added.
