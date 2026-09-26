/* =========================================================================
   Super Kid Saves the Planet — browser edition
   A faithful, front-end-only port of the original pygame game, plus extras:
   - an ICE CUBE item that freezes Super Kid for 3 seconds
   - a SHIELD power-up that blocks bad items for 6 seconds
   - a difficulty ramp (items get faster each minute)
   - a best score saved in the browser (localStorage)
   - responsive canvas, touch controls, mute toggle
   -------------------------------------------------------------------------
   No accounts, no backend. Runs 100% in the browser.
   ========================================================================= */

"use strict";

/* ----------------------------- Constants ------------------------------- */

const LOGICAL_W = 1200;
const LOGICAL_H = 900;

const STATE = {
  INTRO: "intro",
  PLAYING: "playing",
  WON: "won",
  GAMEOVER: "gameover",
};

const GAME_DURATION = 4 * 60;            // 4 minute mission
const QUIZ_INTERVAL = 5;                 // quiz after every N catches
const CLEAN_HEALTH_THRESHOLD = 50;       // planet health that unlocks the clean environment
const FREEZE_SECONDS = 3;                // ice-cube freeze duration
const SHIELD_SECONDS = 7;                // shield power-up duration
const STARTING_HEALTH = 10;
const STARTING_LIVES = 8;

const ITEM_SIZE = 44;                    // on-screen falling item size (px)
const KID_SIZE = 118;                    // on-screen kid size (px)

const BASE_SPAWN_PER_SEC = 2.6;          // items per second at the start
const BASE_FALL_SPEED_POLLUTED = 720;    // polluted-mode fall speed (px/s)
const BASE_FALL_SPEED_CLEAN = 790;       // clean-mode fall speed (px/s)
const SPEEDUP_PER_MINUTE = 0.10;         // +10% fall speed every minute
const SPAWN_RAMP_PER_MINUTE = 0.15;      // +0.15 items/sec every minute

const BEST_SCORE_KEY = "superKidBestScore";
const COMBO_STEP = 5;                     // good catches per combo level
const COMBO_MAX = 4;                      // max combo multiplier

// Flying monsters polluting the world (blocky, semi-transparent, disappear as it heals)
const MONSTER_START = 15;          // monsters at the start
const MONSTER_FADE_START = 20;     // they start disappearing at 20% health
const MONSTER_FADE_STEP = 2;       // one leaves every +2% health
const MONSTER_PX = 10;
const MONSTER_ROWS = [
  ".DDDDD.",
  "DMMMMMD",
  "DMEMMED",
  "DMMMMMD",
  "DMMMMMD",
  ".D.D.D.",
];
const MONSTER_PALETTE = { M: "#7a6d60", D: "#4f453c", E: "#201811" };

// Bees & butterflies arrive in the clean world
const BEE_START = 50;              // first bee at 50% health
const BEE_STEP = 5;                // one more every +5% health
const BEE_MAX = 10;                // max flying creatures

// Unlockable aura "skins" — the Super Kid image stays clear, only the glow changes.
const SKIN_KEY = "superKidSkin";
const SKINS = [
  { id: "none",   name: "No Aura", cost: 0,   aura: null },
  { id: "green",  name: "Green",   cost: 20,  aura: "110,230,160" },
  { id: "cyan",   name: "Cyan",    cost: 40,  aura: "90,220,220" },
  { id: "blue",   name: "Blue",    cost: 60,  aura: "110,190,255" },
  { id: "purple", name: "Purple",  cost: 80,  aura: "190,140,255" },
  { id: "pink",   name: "Pink",    cost: 100, aura: "255,140,200" },
  { id: "gold",   name: "Gold",    cost: 130, aura: "255,210,80", gold: true },
];

/* ------------------------------ Utilities ------------------------------ */

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

/* ---------------------------- Asset loading ---------------------------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load " + src));
    img.src = src;
  });
}

const ASSETS = {
  images: {},
  sounds: {},
  music: {},
};

const IMAGE_FILES = {
  player: "assets/images/super_kid.png",
  pollutedBg: "assets/images/polluted_4.png",
  cleanBg: "assets/images/clean_1.png",
  introUniverse: "assets/images/intro_universe_bg.png",
  introEarth: "assets/images/intro_polluted_earth.png",
  winEarth: "assets/images/win_clean_earth.png",
};

const SOUND_FILES = {
  good: "assets/sounds/coinsplash.ogg",
  bad: "assets/sounds/alarm.ogg",
  quiz: "assets/sounds/magical_6.ogg",
  celebration: "assets/sounds/newthingget.ogg",
};

const MUSIC_FILES = {
  polluted: "assets/sounds/Iwan Gabovitch - Dark Ambience Loop.ogg",
  clean: "assets/sounds/A Journey Awaits.ogg",
};

async function loadAssets() {
  const imagePromises = Object.entries(IMAGE_FILES).map(async ([key, src]) => {
    ASSETS.images[key] = await loadImage(src);
  });

  // Good / bad falling-item sprites (10 of each).
  for (let i = 1; i <= 10; i++) {
    imagePromises.push(
      loadImage(`assets/images/good_${i}.png`).then(img => {
        ASSETS.images[`good_${i}`] = img;
      })
    );
    imagePromises.push(
      loadImage(`assets/images/bad_${i}.png`).then(img => {
        ASSETS.images[`bad_${i}`] = img;
      })
    );
  }

  await Promise.all(imagePromises);
  ASSETS.images.ice = makeIceCubeSprite();
  ASSETS.images.shield = makeShieldSprite();
  return ASSETS;
}

/* ------------------------- Ice cube sprite (vector) -------------------- */

function makeIceCubeSprite() {
  const size = 160;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");

  ctx.translate(size / 2, size / 2);

  // Soft drop shadow
  ctx.fillStyle = "rgba(20, 60, 120, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.34, size * 0.30, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cube body (isometric-ish): top, front-left, front-right faces
  const s = size * 0.34;
  const top = [
    [0, -s * 0.62],
    [s * 0.78, -s * 0.18],
    [0, s * 0.30],
    [-s * 0.78, -s * 0.18],
  ];
  const frontLeft = [
    [-s * 0.78, -s * 0.18],
    [0, s * 0.30],
    [0, s * 0.94],
    [-s * 0.78, s * 0.44],
  ];
  const frontRight = [
    [s * 0.78, -s * 0.18],
    [0, s * 0.30],
    [0, s * 0.94],
    [s * 0.78, s * 0.44],
  ];

  function path(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  // top face (lightest)
  path(top);
  ctx.fillStyle = "rgba(210, 240, 255, 0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // front-left face (mid blue)
  path(frontLeft);
  ctx.fillStyle = "rgba(125, 205, 250, 0.96)";
  ctx.fill();
  ctx.stroke();

  // front-right face (deeper blue)
  path(frontRight);
  ctx.fillStyle = "rgba(60, 155, 225, 0.96)";
  ctx.fill();
  ctx.stroke();

  // small highlight streak
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.14);
  ctx.lineTo(-s * 0.30, -s * 0.14);
  ctx.lineTo(-s * 0.48, s * 0.05);
  ctx.lineTo(-s * 0.68, s * 0.05);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();

  // snowflake on the front face
  ctx.save();
  ctx.translate(s * 0.02, s * 0.55);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26);
    ctx.stroke();
  }
  ctx.restore();

  return c;
}

/* ------------------------ Shield sprite (vector) ----------------------- */

function makeShieldSprite() {
  const size = 160;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");

  ctx.translate(size / 2, size / 2);

  // Soft drop shadow
  ctx.fillStyle = "rgba(20, 60, 120, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.34, size * 0.30, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const s = size * 0.36;

  // Shield outline (rounded top, pointed bottom)
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, -s * 0.55);
  ctx.lineTo(s, s * 0.10);
  ctx.lineTo(0, s);
  ctx.lineTo(-s, s * 0.10);
  ctx.lineTo(-s, -s * 0.55);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, "#eafcff");
  grad.addColorStop(0.5, "#6bc8ff");
  grad.addColorStop(1, "#2f8fe0");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.stroke();

  // Inner rim
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.78);
  ctx.lineTo(s * 0.78, -s * 0.42);
  ctx.lineTo(s * 0.78, s * 0.06);
  ctx.lineTo(0, s * 0.76);
  ctx.lineTo(-s * 0.78, s * 0.06);
  ctx.lineTo(-s * 0.78, -s * 0.42);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Star
  ctx.fillStyle = "#fff3a6";
  ctx.beginPath();
  const spikes = 5;
  const outer = s * 0.46;
  const inner = s * 0.22;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  return c;
}

/* ------------------------------ Audio ---------------------------------- */

class AudioManager {
  constructor() {
    this.muted = false;
    this.unlocked = false;
    this.ac = null;               // WebAudio context for the freeze chime
    this.currentMusic = null;     // "polluted" | "clean" | null
    this.sounds = {};
    this.musicEls = {};
  }

  /* Must be called from a user gesture before any sound may play. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    } catch (e) { /* ignore */ }

    // Build (but don't play) the music elements.
    for (const [mode, src] of Object.entries(MUSIC_FILES)) {
      const el = new Audio(src);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0.6;
      this.musicEls[mode] = el;
    }
    for (const [name, src] of Object.entries(SOUND_FILES)) {
      this.sounds[name] = new Audio(src);
      this.sounds[name].preload = "auto";
    }
  }

  resumeCtx() {
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    for (const el of Object.values(this.musicEls)) el.muted = muted;
    for (const el of Object.values(this.sounds)) el.muted = muted;
  }

  playMusic(mode) {
    if (!this.unlocked || !this.musicEls[mode]) return;
    if (this.currentMusic === mode) return;
    if (this.currentMusic && this.musicEls[this.currentMusic]) {
      this.musicEls[this.currentMusic].pause();
      this.musicEls[this.currentMusic].currentTime = 0;
    }
    const el = this.musicEls[mode];
    this.currentMusic = mode;
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }

  stopMusic() {
    if (this.currentMusic && this.musicEls[this.currentMusic]) {
      this.musicEls[this.currentMusic].pause();
      this.musicEls[this.currentMusic].currentTime = 0;
    }
    this.currentMusic = null;
  }

  play(name) {
    if (!this.unlocked || !this.sounds[name] || this.muted) return;
    const base = this.sounds[name];
    const clone = base.cloneNode();
    clone.volume = base.volume;
    clone.currentTime = 0;
    const p = clone.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* A short icy chime, synthesised so we don't need an extra asset. */
  playFreeze() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

    [880, 660, 523].forEach((freq, i) => {
      const osc = this.ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 1.2);
      osc.connect(gain);
      osc.start(t + i * 0.06);
      osc.stop(t + 1.25);
    });
  }

  /* A bright rising chime when the shield is picked up. */
  playShield() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.20, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      osc.connect(gain);
      osc.start(t + i * 0.07);
      osc.stop(t + 0.75);
    });
  }

  /* A soft thud when the shield blocks a bad item. */
  playShieldBlock() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    const osc = this.ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.3);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  /* A quick rising chime when a combo levels up. */
  playCombo() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    [660, 880].forEach((freq, i) => {
      const osc = this.ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      osc.connect(gain);
      osc.start(t + i * 0.08);
      osc.stop(t + 0.55);
    });
  }

  /* A soft magical sparkle for world-rebuild milestones. */
  playBuild() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = this.ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      osc.connect(gain);
      osc.start(t + i * 0.06);
      osc.stop(t + 0.95);
    });
  }

  /* A soft blip when a factory closes. */
  playPoof() {
    if (!this.unlocked || this.muted) return;
    this.resumeCtx();
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const gain = this.ac.createGain();
    gain.connect(this.ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    const osc = this.ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

}

/* ------------------------------ Game ----------------------------------- */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = new AudioManager();
    this.state = STATE.INTRO;

    this.keys = { left: false, right: false };
    this.pointerDown = false;
    this.quizActive = false;
    this.quiz = null;
    this.quizResult = null;
    this.quizOptionRects = [];

    this.lastTime = 0;
    this.elapsed = 0;             // mission seconds elapsed (pauses during quiz)
    this.timeUp = false;

    // Player
    this.kid = {
      x: 0,                        // left edge
      y: 0,                        // feet Y (bottom)
      w: KID_SIZE,
      h: KID_SIZE,
      facingRight: true,
      bobTimer: 0,
      flashType: 0,                // 0 none, 1 good, 2 bad
      flashTimer: 0,
      squash: 1,
      squashTimer: 0,
    };

    // Frozen state
    this.frozen = false;
    this.freezeRemaining = 0;
    this.freezeParticles = [];

    // Shield power-up state
    this.shieldRemaining = 0;

    // Pause state
    this.paused = false;

    // Ambient background-motion particles (smoke / petals / sparks)
    this.ambient = [];

    // Chimney positions that emit brown smoke, spread across the whole scene.
    this.brownEmitters = [
      { x: 130, y: 360 },
      { x: 270, y: 330 },
      { x: 400, y: 380 },
      { x: 540, y: 340 },
      { x: 680, y: 300 },
      { x: 820, y: 360 },
      { x: 950, y: 330 },
      { x: 1070, y: 380 },
    ];

    // Combo
    this.combo = 0;
    this.comboMult = 1;
    this.comboPopup = "";
    this.comboPopupTimer = 0;

    // Flying monsters + clean-world creatures
    this.monsters = [];         // blocky semi-transparent monsters (polluted)
    this.creatures = [];        // bees + butterflies (clean)
    this.bursts = [];           // poof / confetti particles

    // Aura skin (cosmetic, unlockable by best score)
    this.selectedSkinId = "none";
    try { this.selectedSkinId = localStorage.getItem(SKIN_KEY) || "none"; } catch (e) {}
    this.skinMenuOpen = false;
    this.skinsButtonRect = null;
    this.skinSlotRects = [];
    this.skinsBackRect = null;

    // Best score (persisted in the browser)
    this.bestScore = 0;
    try {
      const v = parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10);
      this.bestScore = isNaN(v) ? 0 : v;
    } catch (e) { /* private mode / no storage */ }
    this.newBest = false;

    // Clean-mode state
    this.cleanMode = false;
    this.cleanMsgTimer = 0;

    this.items = [];
    this.itemsCaught = 0;
    this.quizCounter = 0;
    this.ecoActions = 0;
    this.score = 0;
    this.health = STARTING_HEALTH;
    this.lives = STARTING_LIVES;
    this.gameWon = false;

    this.winParticles = [];
    this.winStartTime = 0;
    this.winElapsed = 0;
    // Intro subtitle state
    this.introLineIndex = 0;
    this.introLineTime = 0;

    this.playAgainRect = null;

    this._bindInput();
  }

  async init() {
    await loadAssets();
    this._resetPlayerPosition();
    this._startLoop();
  }

  /* ------------------------------ Input -------------------------------- */

  _bindInput() {
    const cv = this.canvas;

    cv.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    cv.addEventListener("pointerup", (e) => this._onPointerUp(e));
    cv.addEventListener("pointercancel", (e) => this._onPointerUp(e));
    cv.addEventListener("pointermove", (e) => this._onPointerMove(e));

    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup", (e) => this._onKeyUp(e));

    const muteBtn = document.getElementById("mute-btn");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        this.audio.unlock();
        const muted = !this.audio.muted;
        this.audio.setMuted(muted);
        muteBtn.textContent = muted ? "🔇" : "🔊";
      });
    }

    const pauseBtn = document.getElementById("pause-btn");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => this.togglePause());
    }
  }

  togglePause() {
    if (this.state !== STATE.PLAYING || this.quizActive) return;
    this.paused = !this.paused;
    this._syncPauseButton();
  }

  _syncPauseButton() {
    const btn = document.getElementById("pause-btn");
    if (btn) btn.textContent = this.paused ? "▶️" : "⏸️";
  }

  _toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (LOGICAL_W / rect.width),
      y: (e.clientY - rect.top) * (LOGICAL_H / rect.height),
    };
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.audio.unlock();
    this.pointerDown = true;
    const p = this._toLogical(e);

    if (this.state === STATE.INTRO) {
      if (this.skinMenuOpen) {
        this._handleSkinMenuTap(p);
        return;
      }
      if (this.skinsButtonRect && this._hit(p, this.skinsButtonRect)) {
        this.skinMenuOpen = true;
        return;
      }
      this._startGame();
      return;
    }

    if (this.quizActive) {
      this._handleQuizTap(p);
      return;
    }

    if (this.state === STATE.GAMEOVER || this.state === STATE.WON) {
      // Any tap restarts — friendlier for kids than aiming at the button.
      this._startGame();
      return;
    }

    if (this.state === STATE.PLAYING) {
      if (this.paused) return;
      // Hold left / right half of the screen to move (touch friendly).
      if (p.x < LOGICAL_W / 2) {
        this.keys.left = true;
        this.keys.right = false;
      } else {
        this.keys.right = true;
        this.keys.left = false;
      }
    }
  }

  _onPointerUp() {
    this.pointerDown = false;
    this.keys.left = false;
    this.keys.right = false;
  }

  _onPointerMove(e) {
    // While a finger is held and dragged across the centre, keep the
    // movement side in sync with the pointer position.
    if (this.pointerDown && this.state === STATE.PLAYING && !this.quizActive) {
      const p = this._toLogical(e);
      if (p.x < LOGICAL_W / 2) {
        this.keys.left = true;
        this.keys.right = false;
      } else {
        this.keys.right = true;
        this.keys.left = false;
      }
    }
  }

  _onKeyDown(e) {
    const k = e.key;
    if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(k)) e.preventDefault();

    this.audio.unlock();

    // Pause / resume (P or Escape) — only during active gameplay.
    if (k === "p" || k === "P" || k === "Escape") {
      if (this.state === STATE.PLAYING && !this.quizActive) this.togglePause();
      return;
    }

    if (this.state === STATE.INTRO) {
      if (this.skinMenuOpen) {
        if (k === "Escape" || k === "Backspace") this.skinMenuOpen = false;
        return;
      }
      if (k === "Enter" || k === " ") this._startGame();
      return;
    }

    if (this.quizActive) {
      const map = { a: 0, A: 0, b: 1, B: 1, c: 2, C: 2 };
      if (k in map) this._evaluateQuiz(map[k]);
      else if (this.quizResult) this._dismissQuiz();
      return;
    }

    if (this.state === STATE.GAMEOVER || this.state === STATE.WON) {
      if (k === "Enter" || k === " " || k === "r" || k === "R") this._startGame();
      return;
    }

    if (this.state === STATE.PLAYING) {
      if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.left = true;
      if (k === "ArrowRight" || k === "d" || k === "D") this.keys.right = true;
    }
  }

  _onKeyUp(e) {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") this.keys.right = false;
  }

  _hit(p, rect) {
    return p.x >= rect.x && p.x <= rect.x + rect.w &&
           p.y >= rect.y && p.y <= rect.y + rect.h;
  }

  /* --------------------------- State changes --------------------------- */

  _resetPlayerPosition() {
    this.kid.x = (LOGICAL_W - this.kid.w) / 2;
    this.kid.y = LOGICAL_H - 26;
    this.kid.facingRight = true;
    this.kid.bobTimer = 0;
  }

  _startGame() {
    this.state = STATE.PLAYING;
    this.items = [];
    this.itemsCaught = 0;
    this.quizCounter = 0;
    this.ecoActions = 0;
    this.score = 0;
    this.health = STARTING_HEALTH;
    this.lives = STARTING_LIVES;
    this.gameWon = false;
    this.timeUp = false;
    this.elapsed = 0;
    this.quizActive = false;
    this.quiz = null;
    this.quizResult = null;
    this.cleanMode = false;
    this.cleanMsgTimer = 0;
    this.frozen = false;
    this.freezeRemaining = 0;
    this.freezeParticles = [];
    this.shieldRemaining = 0;
    this.newBest = false;
    this.paused = false;
    this.ambient = [];
    this.combo = 0;
    this.comboMult = 1;
    this.comboPopup = "";
    this.comboPopupTimer = 0;
    this.monsters = [];
    this.creatures = [];
    this.bursts = [];
    this._spawnMonsters();
    this._syncPauseButton();
    this._resetPlayerPosition();
    this.audio.playMusic("polluted");
  }

  _winGame() {
    this.gameWon = true;
    this.health = 100;
    this.state = STATE.WON;
    this._updateBestScore();
    this.winStartTime = this.elapsed;
    this.winParticles = [];
    for (let i = 0; i < 120; i++) this._spawnWinParticle(true);
    this.audio.play("celebration");
    this.audio.playMusic("clean");
  }

  _gameOver() {
    this.state = STATE.GAMEOVER;
    this._updateBestScore();
    this.audio.stopMusic();
  }

  _updateBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.newBest = true;
      try { localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore)); } catch (e) {}
    } else {
      this.newBest = false;
    }
  }

  /* ---------------------------- Quiz logic ----------------------------- */

  _triggerQuiz() {
    this.quizActive = true;
    this.quizResult = null;
    this.quizOptionRects = [];
    this.quiz = this.cleanMode
      ? pick(ECO_QUIZZES)
      : pick(ECO_QUIZZES.concat(MATH_QUIZZES));
    this.audio.play("quiz");
  }

  _handleQuizTap(p) {
    if (this.quizResult) {
      this._dismissQuiz();
      return;
    }
    for (let i = 0; i < this.quizOptionRects.length; i++) {
      if (this._hit(p, this.quizOptionRects[i])) {
        this._evaluateQuiz(i);
        return;
      }
    }
  }

  _evaluateQuiz(i) {
    if (i === this.quiz.answer) {
      this.quizResult = "correct";
      this.score += 6;
      this.health = clamp(this.health + 6, 0, 100);
      this.ecoActions += 1;
      this.audio.play("good");
    } else {
      this.quizResult = "wrong";
      this.audio.play("bad");
    }
  }

  _dismissQuiz() {
    this.quizActive = false;
    this.quiz = null;
    this.quizResult = null;
    this.quizOptionRects = [];
  }

  /* --------------------------- Gameplay logic -------------------------- */

  _spawnItem() {
    const r = Math.random();
    let type;
    if (r < 0.46) type = "good";
    else if (r < 0.82) type = "bad";
    else if (r < 0.92) type = "ice";
    else type = "shield";

    let sprite;
    if (type === "good") sprite = ASSETS.images[`good_${randInt(1, 10)}`];
    else if (type === "bad") sprite = ASSETS.images[`bad_${randInt(1, 10)}`];
    else if (type === "ice") sprite = ASSETS.images.ice;
    else sprite = ASSETS.images.shield;

    const x = rand(0, LOGICAL_W - ITEM_SIZE);
    this.items.push({
      type,
      sprite,
      x,
      y: -ITEM_SIZE,
      w: ITEM_SIZE,
      h: ITEM_SIZE,
    });
  }

  _kidRect(pad = 0) {
    return {
      x: this.kid.x + this.kid.w * (pad / 2),
      y: this.kid.y - this.kid.h * (1 - pad / 2),
      w: this.kid.w * (1 - pad),
      h: this.kid.h * (1 - pad),
    };
  }

  _rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  _handleCatch(item) {
    if (this.state !== STATE.PLAYING) return;
    this.itemsCaught += 1;

    if (item.type === "good") {
      this.combo += 1;
      const newMult = Math.min(COMBO_MAX, 1 + Math.floor(this.combo / COMBO_STEP));
      if (newMult > this.comboMult) {
        this.comboMult = newMult;
        this.comboPopup = "COMBO x" + newMult + "!";
        this.comboPopupTimer = 1.6;
        this.audio.playCombo();
      }
      const healthGain = this.comboMult >= 3 ? 2 : 1;
      this.score += this.comboMult;
      this.health = clamp(this.health + healthGain, 0, 100);
      this.ecoActions += 1;
      this.kid.flashType = 1;
      this.kid.flashTimer = 18;
      this.kid.squash = 0.75;
      this.kid.squashTimer = 10;
      this.audio.play("good");
    } else if (item.type === "bad") {
      if (this.shieldRemaining > 0) {
        // The shield absorbs the hit — no damage, no lost life.
        this.kid.flashType = 4;
        this.kid.flashTimer = 12;
        this.audio.playShieldBlock();
      } else {
        this.combo = 0;
        this.comboMult = 1;
        this.score = Math.max(0, this.score - 1);
        this.health = clamp(this.health - 3, 0, 100);
        this.lives -= 1;
        this.kid.flashType = 2;
        this.kid.flashTimer = 18;
        this.audio.play("bad");
      }
    } else if (item.type === "ice") {
      this.frozen = true;
      this.freezeRemaining = FREEZE_SECONDS;
      this.freezeParticles = [];
      this.kid.flashType = 3;   // icy-blue tint
      this.kid.flashTimer = 18;
      this.audio.playFreeze();
    } else if (item.type === "shield") {
      this.shieldRemaining = SHIELD_SECONDS;
      this.kid.flashType = 4;   // golden tint
      this.kid.flashTimer = 18;
      this.audio.playShield();
    }

    if (item.type === "good" || item.type === "bad") {
      this.quizCounter += 1;
      if (this.quizCounter % QUIZ_INTERVAL === 0) {
        this._triggerQuiz();
      }
    }

    if (this.lives <= 0 || this.health <= 0) {
      this._gameOver();
      return;
    }
    if (this.health >= 100) {
      this._winGame();
    }
  }

  _update(dt) {
    if (this.paused && this.state === STATE.PLAYING) return;

    // Keep the background alive on the play + game-over screens.
    if (this.state === STATE.PLAYING || this.state === STATE.GAMEOVER) {
      this._updateAmbient(dt);
      this._updateBursts(dt);
      this._updateFlyers(dt);
    }

    if (this.state === STATE.INTRO) {
      this._updateIntro(dt);
      return;
    }

    if (this.state === STATE.WON) {
      this._updateWinParticles(dt);
      return;
    }

    if (this.state === STATE.GAMEOVER) {
      return;
    }

    // PLAYING ------------------------------------------------------------
    if (this.timeUp) return;

    // Global mission clock pauses only while a quiz is open.
    if (!this.quizActive) {
      this.elapsed += dt;
    }

    if (this.elapsed >= GAME_DURATION) {
      this.timeUp = true;
      this._gameOver();
      return;
    }

    // Music follows the environment.
    this.audio.playMusic(this.cleanMode ? "clean" : "polluted");

    if (!this.quizActive) {
      this._updateKid(dt);
      this._updateItems(dt);
      if (this.state !== STATE.PLAYING) return; // won or game over this frame
      this._updateFreeze(dt);
      this._updateShield(dt);
      this._checkCleanMode();
    }

    this._checkMonsters();
    this._checkCreatures();
    if (this.comboPopupTimer > 0) this.comboPopupTimer -= dt;
    if (this.cleanMsgTimer > 0) this.cleanMsgTimer -= dt;
  }

  _updateKid(dt) {
    const speed = 760; // px / second
    const frozen = this.frozen;

    if (!frozen) {
      if (this.keys.right) {
        this.kid.facingRight = true;
        this.kid.x += speed * dt;
      } else if (this.keys.left) {
        this.kid.facingRight = false;
        this.kid.x -= speed * dt;
      }
    }

    this.kid.x = clamp(this.kid.x, 4, LOGICAL_W - this.kid.w - 4);

    const isMoving = !frozen && (this.keys.left || this.keys.right);
    this.kid.bobTimer += dt;
    const offset = isMoving
      ? Math.sin(this.kid.bobTimer * 10.8) * 5
      : Math.sin(this.kid.bobTimer * 0.9) * 2;

    // We'll apply the bob as a visual offset at draw time.
    this.kid.bobOffset = offset;

    if (this.kid.flashTimer > 0) this.kid.flashTimer -= 1;
    else this.kid.flashType = 0;

    if (this.kid.squashTimer > 0) {
      this.kid.squashTimer -= 1;
      this.kid.squash = 1 - 0.25 * (this.kid.squashTimer / 10);
    } else {
      this.kid.squash = 1;
    }
  }

  _updateItems(dt) {
    // Difficulty ramp: a little faster + a few more items every minute.
    const minutes = Math.floor(this.elapsed / 60);
    const spawnPerSec = BASE_SPAWN_PER_SEC + minutes * SPAWN_RAMP_PER_MINUTE;
    if (Math.random() < spawnPerSec * dt) this._spawnItem();

    const baseFall = this.cleanMode ? BASE_FALL_SPEED_CLEAN : BASE_FALL_SPEED_POLLUTED;
    const fallSpeed = baseFall * (1 + minutes * SPEEDUP_PER_MINUTE);
    const caught = [];
    const playerRect = this._kidRect(0.28);

    for (const item of this.items) {
      item.y += fallSpeed * dt;
      const itemRect = { x: item.x, y: item.y, w: item.w, h: item.h };
      if (this._rectsOverlap(playerRect, itemRect)) {
        caught.push(item);
      }
    }

    // Remove off-screen and caught items.
    this.items = this.items.filter(
      (it) => !caught.includes(it) && it.y < LOGICAL_H + it.h
    );

    for (const item of caught) this._handleCatch(item);
  }

  _updateFreeze(dt) {
    if (!this.frozen) return;

    this.freezeRemaining -= dt;

    // Spawn falling snow / sparkle particles around the kid.
    if (Math.random() < 30 * dt) {
      this.freezeParticles.push({
        x: this.kid.x + rand(0, this.kid.w),
        y: this.kid.y - rand(0, this.kid.h),
        vy: rand(30, 70),
        size: rand(2, 5),
        life: rand(0.6, 1.2),
        age: 0,
      });
    }

    for (const p of this.freezeParticles) {
      p.age += dt;
      p.y += p.vy * dt;
      p.x += Math.sin((p.age + p.size) * 6) * 18 * dt;
    }
    this.freezeParticles = this.freezeParticles.filter((p) => p.age < p.life);

    if (this.freezeRemaining <= 0) {
      this.frozen = false;
      this.freezeRemaining = 0;
      this.freezeParticles = [];
    }
  }

  _updateShield(dt) {
    if (this.shieldRemaining > 0) {
      this.shieldRemaining -= dt;
      if (this.shieldRemaining <= 0) this.shieldRemaining = 0;
    }
  }

  /* ---------------- Ambient background-motion particles ---------------- */

  _updateAmbient(dt) {
    if (this.cleanMode) {
      // More life as the planet gets healthier (50 -> 100).
      const life = 1 + 0.8 * clamp((this.health - CLEAN_HEALTH_THRESHOLD) / 50, 0, 1);
      if (Math.random() < 2.5 * life * dt) this._spawnPetal();
      if (Math.random() < 1.5 * life * dt) this._spawnSpark();
    } else {
      // Smoke thins out as the planet cleans up (0 -> 50).
      const smog = 1 - 0.75 * clamp(this.health / CLEAN_HEALTH_THRESHOLD, 0, 1);
      if (Math.random() < 2.5 * smog * dt) this._spawnSmoke();
      if (Math.random() < 1.6 * smog * dt) this._spawnBrownSmoke();
    }

    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i];
      p.age += dt;

      if (p.kind === "smoke") {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.age * 1.5 + p.phase) * 8 * dt;
        p.r += p.grow * dt;
        p.alpha = p.baseAlpha * (1 - p.age / p.maxLife);
      } else if (p.kind === "brown") {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.age * 1.2 + p.phase) * 10 * dt;
        p.r += p.grow * dt;
        p.alpha = p.baseAlpha * (1 - p.age / p.maxLife);
      } else if (p.kind === "petal") {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin((p.age + p.phase) * 2) * 24 * dt;
        p.rot += p.spin * dt;
        p.alpha = p.baseAlpha * (1 - p.age / p.maxLife);
      } else { // spark
        p.alpha = p.baseAlpha * Math.sin((p.age / p.maxLife) * Math.PI);
      }

      if (p.age >= p.maxLife || p.y > LOGICAL_H + 40 || p.alpha <= 0) {
        this.ambient.splice(i, 1);
      }
    }
  }

  _spawnSmoke() {
    this.ambient.push({
      kind: "smoke",
      x: rand(0, LOGICAL_W),
      y: LOGICAL_H - rand(0, 230),
      vx: rand(-6, 6),
      vy: rand(-28, -16),
      r: rand(10, 22),
      grow: rand(4, 8),
      baseAlpha: rand(0.10, 0.22),
      phase: rand(0, Math.PI * 2),
      age: 0,
      maxLife: rand(4, 7),
    });
  }

  _spawnBrownSmoke() {
    const e = pick(this.brownEmitters);
    this.ambient.push({
      kind: "brown",
      x: e.x + rand(-18, 18),
      y: e.y + rand(-8, 8),
      vx: rand(-7, 7),
      vy: rand(-30, -18),
      r: rand(12, 20),
      grow: rand(3, 6),
      baseAlpha: rand(0.10, 0.18),
      phase: rand(0, Math.PI * 2),
      age: 0,
      maxLife: rand(5, 8),
    });
  }

  _spawnPetal() {
    const colors = ["#ffd66b", "#ff8fa3", "#b9f27a", "#9ad8ff", "#ffb3c6"];
    this.ambient.push({
      kind: "petal",
      x: rand(0, LOGICAL_W),
      y: -20,
      vx: rand(-12, 12),
      vy: rand(40, 80),
      size: rand(3, 7),
      color: pick(colors),
      rot: rand(0, 360),
      spin: rand(-100, 100),
      baseAlpha: rand(0.5, 0.85),
      phase: rand(0, Math.PI * 2),
      age: 0,
      maxLife: rand(7, 11),
    });
  }

  _spawnSpark() {
    this.ambient.push({
      kind: "spark",
      x: rand(0, LOGICAL_W),
      y: rand(40, LOGICAL_H * 0.6),
      size: rand(1.5, 3),
      baseAlpha: rand(0.4, 0.8),
      age: 0,
      maxLife: rand(1.2, 2.5),
    });
  }

  _drawAmbient() {
    const ctx = this.ctx;
    for (const p of this.ambient) {
      ctx.save();
      if (p.kind === "smoke") {
        ctx.globalAlpha = clamp(p.alpha, 0, 1);
        ctx.fillStyle = "#c7c2c9";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "brown") {
        ctx.globalAlpha = clamp(p.alpha, 0, 1);
        ctx.fillStyle = "#9a6a44";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = clamp(p.alpha * 0.7, 0, 1);
        ctx.fillStyle = "#c88a50";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "petal") {
        ctx.globalAlpha = clamp(p.alpha, 0, 1);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else { // spark
        ctx.globalAlpha = clamp(p.alpha, 0, 1);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _checkCleanMode() {
    if (!this.cleanMode && this.health >= CLEAN_HEALTH_THRESHOLD) {
      this.cleanMode = true;
      this.cleanMsgTimer = 3;
      this.ambient = [];   // swap smoke for petals / sparks
      this.audio.playMusic("clean");
    }
  }

  /* ------------------------------- Intro ------------------------------- */

  _updateIntro(dt) {
    this.introLineTime += dt;
    const hold = 3.0;
    if (this.introLineTime >= hold && this.introLineIndex < INTRO_STORY_LINES.length) {
      this.introLineTime = 0;
      this.introLineIndex += 1;
      if (this.introLineIndex >= INTRO_STORY_LINES.length) {
        this.introLineIndex = INTRO_STORY_LINES.length - 1; // stay on last line
      }
    }
  }

  /* ------------------------------ Win screen --------------------------- */

  _spawnWinParticle(burst) {
    const colors = ["#ffdc32", "#64ff78", "#50c8ff", "#ff78b4", "#ffffff", "#b4ff64"];
    this.winParticles.push({
      x: rand(0, LOGICAL_W),
      y: burst ? rand(-40, LOGICAL_H / 2) : rand(-80, -10),
      vx: rand(-1.5, 1.5) * 60,
      vy: rand(1.5, 4.5) * 60,
      size: rand(4, 12),
      color: pick(colors),
      alpha: 1,
      shape: pick(["circle", "rect", "star"]),
      angle: rand(0, 360),
      spin: rand(-4, 4) * 60,
    });
  }

  _updateWinParticles(dt) {
    this.winElapsed += dt;
    if (Math.random() < 3 * dt) this._spawnWinParticle(false);
    for (const p of this.winParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.alpha -= 0.5 * dt;
    }
    this.winParticles = this.winParticles.filter(
      (p) => p.y < LOGICAL_H + 20 && p.alpha > 0
    );
  }

  /* ------------------------------- Render ------------------------------ */

  _startLoop() {
    this.lastTime = performance.now();
    const frame = (now) => {
      const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
      this.lastTime = now;
      this._update(dt);
      this._render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    switch (this.state) {
      case STATE.INTRO:
        this._drawIntro();
        if (this.skinMenuOpen) this._drawSkinMenu();
        break;
      case STATE.PLAYING:  this._drawPlaying(); break;
      case STATE.WON:      this._drawWin(); break;
      case STATE.GAMEOVER: this._drawPlaying(); this._drawGameOver(); break;
    }
  }

  _drawImageCover(img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    this.ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  _drawIntro() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;

    // 1. Universe background
    this._drawImageCover(ASSETS.images.introUniverse, LOGICAL_W, LOGICAL_H);

    // 2. Earth image, centred, with a pulsing rim
    const earth = ASSETS.images.introEarth;
    const ew = Math.min(LOGICAL_W * 0.46, earth.width * 0.62);
    const eh = ew * (earth.height / earth.width);
    const ex = (LOGICAL_W - ew) / 2;
    const ey = LOGICAL_H * 0.16;

    const glow = 0.5 + 0.5 * Math.sin(t * 1.6);
    ctx.save();
    ctx.shadowColor = `rgba(90, 190, 255, ${0.35 + glow * 0.3})`;
    ctx.shadowBlur = 50 + glow * 30;
    ctx.drawImage(earth, ex, ey, ew, eh);
    ctx.restore();

    // 3. Title
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 54px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#0a0e19";
    ctx.fillText("SuperKid Saves the Planet", LOGICAL_W / 2 + 3, 62 + 3);
    const grad = ctx.createLinearGradient(0, 20, 0, 78);
    grad.addColorStop(0, "#a5f3ff");
    grad.addColorStop(1, "#7be07b");
    ctx.fillStyle = grad;
    ctx.fillText("SuperKid Saves the Planet", LOGICAL_W / 2, 62);

    // 4. Story subtitle (one line at a time)
    let line;
    if (this.introLineIndex < INTRO_STORY_LINES.length) {
      line = INTRO_STORY_LINES[this.introLineIndex];
    }
    if (line !== undefined) {
      const lineAge = this.introLineTime;
      const alpha = clamp(Math.min(lineAge / 0.5, (3.0 - lineAge) / 0.5), 0, 1);
      if (alpha > 0) {
        const isDanger = /DANGER|smoke|chokes|lose|crying|longer|Plastic|Animals/.test(line);
        const isHope = /HOPE|YOU|SAVE|difference|Collect|answer|hero|ready/.test(line);
        ctx.save();
        ctx.globalAlpha = alpha;
        const color = isDanger ? "#e8a0a0" : isHope ? "#9fe8c8" : "#d8e0ee";
        const subY = ey + eh + 30;
        const fs = 30;
        ctx.font = `700 ${fs}px 'Comic Neue', 'Comic Sans MS', sans-serif`;
        const tw = ctx.measureText(line).width;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundedRect(ctx, LOGICAL_W / 2 - tw / 2 - 24, subY - fs - 6, tw + 48, fs + 22, 14);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillText(line, LOGICAL_W / 2, subY);
        ctx.restore();
      }
    }

    // 5. Pulsing "begin" prompt
    if (this.bestScore > 0) {
      ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillStyle = "rgba(255, 235, 170, 0.85)";
      ctx.fillText("Best Score: " + this.bestScore, LOGICAL_W / 2, LOGICAL_H * 0.86);
    }

    const pulse = 0.65 + 0.35 * Math.sin(t * 3.0);
    ctx.font = "700 30px 'Comic Neue', 'Comic Sans MS', sans-serif";
    const msg = "Press ENTER or tap anywhere to Begin!";
    ctx.fillStyle = `rgba(${Math.round(160 * pulse + 60)}, ${Math.round(200 * pulse + 40)}, ${Math.round(230 * pulse + 25)}, 1)`;
    ctx.fillText(msg, LOGICAL_W / 2, LOGICAL_H * 0.9);

    // Skins button (bottom-left corner)
    const sbw = 160, sbh = 50, sbx = 34, sby = LOGICAL_H - 72;
    this.skinsButtonRect = { x: sbx, y: sby, w: sbw, h: sbh };
    ctx.fillStyle = "rgba(20, 30, 55, 0.82)";
    roundedRect(ctx, sbx, sby, sbw, sbh, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    roundedRect(ctx, sbx, sby, sbw, sbh, 12);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillText("✨ Aura", sbx + sbw / 2, sby + 33);
  }

  _drawPlaying() {
    const ctx = this.ctx;

    // Background — original artwork
    if (this.cleanMode) {
      ctx.save();
      ctx.filter = "contrast(1.15)";   // a touch more definition in clean mode
    }
    this._drawImageCover(
      this.cleanMode ? ASSETS.images.cleanBg : ASSETS.images.pollutedBg,
      LOGICAL_W,
      LOGICAL_H
    );
    if (this.cleanMode) {
      ctx.restore();
      // Keep the light, soft look — a little contrast without losing the wash.
      ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    // Subtle animated layer on top of the original background
    this._drawAmbient();

    // Flying monsters + clean-world creatures + poof particles
    this._drawMonsters();
    this._drawCreatures();
    this._drawBursts();

    // Items (with colour-coded effects so players can read them at a glance)
    for (const item of this.items) {
      this._drawItemEffects(item);
      ctx.drawImage(item.sprite, item.x, item.y, item.w, item.h);
    }

    // Aura behind the kid (based on equipped skin)
    this._drawPlayerAura();

    // Kid
    this._drawKid();

    // Shield bubble
    if (this.shieldRemaining > 0) this._drawShield();

    // Freeze particles + overlay
    if (this.frozen) this._drawFreezeEffects();

    // HUD
    this._drawHud();

    // Combo indicator
    this._drawCombo();

    // Clean-mode unlock message
    if (this.cleanMsgTimer > 0) this._drawCleanMessage();

    // Quiz
    if (this.quizActive) this._drawQuiz();

    // Pause overlay
    if (this.paused) this._drawPausedOverlay();
  }

  _drawPausedOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5, 10, 22, 0.62)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.textAlign = "center";
    ctx.font = "700 64px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#0a0e19";
    ctx.fillText("PAUSED", LOGICAL_W / 2 + 3, LOGICAL_H / 2 - 18 + 3);
    ctx.fillStyle = "#ffd66b";
    ctx.fillText("PAUSED", LOGICAL_W / 2, LOGICAL_H / 2 - 18);

    ctx.font = "400 26px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#e6eef8";
    ctx.fillText("Press P or tap ⏸ to resume", LOGICAL_W / 2, LOGICAL_H / 2 + 30);
  }

  /* Colour-coded identify aids:
     green  = good (catch it)
     red    = bad / ice (avoid it)
     gold   = shield (grab it for protection) */
  _drawItemEffects(item) {
    const ctx = this.ctx;
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const t = performance.now() / 1000;

    if (item.type === "good") {
      this._glow(cx, cy, item.w * 0.72, "110,230,110", 0.30 + 0.12 * Math.sin(t * 5));
    } else if (item.type === "bad") {
      this._glow(cx, cy, item.w * 0.66, "255,90,70", 0.28 + 0.12 * Math.sin(t * 5));
    } else if (item.type === "ice") {
      // Red alarming aura + orbiting red sparks — clearly dangerous.
      this._glow(cx, cy, item.w * 1.05, "255,60,60", 0.42 + 0.16 * Math.sin(t * 5));
      for (let k = 0; k < 4; k++) {
        const a = t * 2.4 + (k * Math.PI) / 2;
        const sx = cx + Math.cos(a) * item.w * 0.78;
        const sy = cy + Math.sin(a) * item.w * 0.78;
        const tw = 0.5 + 0.5 * Math.sin(t * 7 + k);
        ctx.fillStyle = `rgba(255, 130, 120, ${0.5 + 0.5 * tw})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + tw * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.type === "shield") {
      // Golden aura + orbiting sparkles — a reward worth seeking.
      this._glow(cx, cy, item.w * 1.05, "255,210,80", 0.40 + 0.15 * Math.sin(t * 4));
      for (let k = 0; k < 4; k++) {
        const a = t * 2.2 + (k * Math.PI) / 2;
        const sx = cx + Math.cos(a) * item.w * 0.78;
        const sy = cy + Math.sin(a) * item.w * 0.78;
        const tw = 0.5 + 0.5 * Math.sin(t * 6 + k);
        ctx.fillStyle = `rgba(255, 235, 150, ${0.5 + 0.5 * tw})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + tw * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _glow(cx, cy, r, rgb, alpha) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${rgb}, ${clamp(alpha, 0, 1)})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ------------- Flying monsters + clean-world creatures ------------- */

  _spawnMonsters() {
    this.monsters = [];
    for (let i = 0; i < MONSTER_START; i++) {
      this.monsters.push({
        x: rand(70, LOGICAL_W - 70),
        y: rand(140, 520),
        vx: (Math.random() < 0.5 ? -1 : 1) * rand(30, 60),
        phase: rand(0, Math.PI * 2),
        born: performance.now() + i * 120,
      });
    }
  }

  _targetMonsterCount() {
    if (this.health < MONSTER_FADE_START) return MONSTER_START;
    const removed = Math.min(MONSTER_START, 1 + Math.floor((this.health - MONSTER_FADE_START) / MONSTER_FADE_STEP));
    return MONSTER_START - removed;
  }

  _checkMonsters() {
    const target = this._targetMonsterCount();
    while (this.monsters.length > target) {
      const idx = Math.floor(Math.random() * this.monsters.length);
      const m = this.monsters[idx];
      this.monsters.splice(idx, 1);
      this._spawnPoof(m.x, m.y);
      this.audio.playPoof();
    }
  }

  _targetCreatureCount() {
    if (this.health < BEE_START) return 0;
    return Math.min(BEE_MAX, 1 + Math.floor((this.health - BEE_START) / BEE_STEP));
  }

  _addCreature() {
    const kind = this.creatures.length === 0 ? "bee" : (Math.random() < 0.5 ? "bee" : "butterfly");
    this.creatures.push({
      kind,
      x: rand(80, LOGICAL_W - 80),
      y: rand(140, 520),
      vx: (Math.random() < 0.5 ? -1 : 1) * rand(24, 46),
      phase: rand(0, Math.PI * 2),
      born: performance.now(),
    });
    if (this.creatures.length === 1) this.audio.playBuild();
  }

  _checkCreatures() {
    const target = this._targetCreatureCount();
    while (this.creatures.length < target) this._addCreature();
  }

  _updateFlyers(dt) {
    const all = this.monsters.concat(this.creatures);
    for (const f of all) {
      f.x += f.vx * dt;
      if (f.x < 30) { f.x = 30; f.vx = Math.abs(f.vx); }
      if (f.x > LOGICAL_W - 30) { f.x = LOGICAL_W - 30; f.vx = -Math.abs(f.vx); }
    }
  }

  /* Bouncy pop-in scale. */
  _popScale(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c1 = 1.70158, c3 = c1 + 1;
    return clamp(1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2), 0, 1.2);
  }

  _drawMonsters() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    for (const m of this.monsters) {
      const s = this._popScale((performance.now() - m.born) / 400);
      const y = m.y + Math.sin(t * 2 + m.phase) * 16;
      this._drawMonster(ctx, m.x, y, s);
    }
  }

  _drawMonster(ctx, x, y, s) {
    const px = MONSTER_PX;
    const w = MONSTER_ROWS[0].length, h = MONSTER_ROWS.length;
    ctx.save();
    ctx.globalAlpha = 0.5;   // a little bit invisible but disturbing
    this._drawPattern(ctx, MONSTER_ROWS, MONSTER_PALETTE, x - (w * px * s) / 2, y - (h * px * s) / 2, px, s);
    ctx.restore();
  }

  _drawCreatures() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    for (const c of this.creatures) {
      const s = this._popScale((performance.now() - c.born) / 400);
      const y = c.y + Math.sin(t * 2 + c.phase) * 18;
      if (c.kind === "bee") this._drawBee(ctx, c.x, y, s);
      else this._drawButterfly(ctx, c.x, y, s);
    }
  }

  _drawBee(ctx, x, y, s) {
    const px = 7;
    const rows = [".WW.", "BBYY", "YYBB", "BBYY"];
    const palette = { W: "rgba(234,246,255,0.92)", B: "#2b2b2b", Y: "#f5c542" };
    const w = rows[0].length, h = rows.length;
    this._drawPattern(ctx, rows, palette, x - (w * px * s) / 2, y - (h * px * s) / 2, px, s);
  }

  _drawButterfly(ctx, x, y, s) {
    const px = 7;
    const rows = ["P....P", "PPBBPP", ".PBBP."];
    const palette = { P: "#ff8fa3", B: "#4a2c1a" };
    const w = rows[0].length, h = rows.length;
    this._drawPattern(ctx, rows, palette, x - (w * px * s) / 2, y - (h * px * s) / 2, px, s);
  }

  _spawnPoof(x, y) {
    for (let i = 0; i < 10; i++) {
      this.bursts.push({
        x: x + rand(-14, 14),
        y: y + rand(-12, 12),
        vx: rand(-55, 55),
        vy: rand(-80, -20),
        size: rand(4, 9),
        color: pick(["#d7d3d6", "#b9b5ba", "#ffffff"]),
        rot: rand(0, Math.PI * 2),
        spin: rand(-6, 6),
        shape: "circle",
        age: 0,
        life: rand(0.5, 0.9),
      });
    }
  }

  _updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.age += dt;
      p.vy += 620 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.age >= p.life) this.bursts.splice(i, 1);
    }
  }

  _drawBursts() {
    const ctx = this.ctx;
    for (const p of this.bursts) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* Blocky pixel-art renderer. */
  _drawPattern(ctx, rows, palette, x, y, px, s) {
    const p = px * s;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === "." || ch === " ") continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * p, y + r * p, p, p);
      }
    }
  }

  /* A glowing aura around the player, based on the equipped aura skin. */
  _drawPlayerAura() {
    const skin = SKINS.find((sk) => sk.id === this.selectedSkinId) || SKINS[0];
    if (!skin || !skin.aura) return;
    const color = skin.aura;
    const gold = !!skin.gold;
    const ctx = this.ctx;
    const kid = this.kid;
    const cx = kid.x + kid.w / 2;
    const cy = kid.y - kid.h / 2;
    const t = performance.now() / 1000;
    const r = kid.w * (gold ? 0.68 : 0.56) * (1 + 0.05 * Math.sin(t * 3));

    // Soft glow fill (no ring around Super Kid).
    const glow = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    glow.addColorStop(0, `rgba(${color}, ${gold ? 0.55 : 0.38})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Gold gets an extra outer halo for a more dramatic glow.
    if (gold) {
      const r2 = r * 1.4;
      const g2 = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r2);
      g2.addColorStop(0, "rgba(255, 220, 110, 0.24)");
      g2.addColorStop(1, "rgba(255, 220, 110, 0)");
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.fill();
    }

    // Orbiting sparkles in the aura's own colour.
    const count = gold ? 8 : 5;
    for (let k = 0; k < count; k++) {
      const a = t * 2.4 + (k * Math.PI * 2) / count;
      const sx = cx + Math.cos(a) * r * 1.22;
      const sy = cy + Math.sin(a) * r * 1.22;
      const tw = 0.5 + 0.5 * Math.sin(t * (gold ? 8 : 6) + k);
      ctx.fillStyle = `rgba(${color}, ${0.55 + 0.45 * tw})`;
      ctx.beginPath(); ctx.arc(sx, sy, (gold ? 4.5 : 3) + tw * 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  _handleSkinMenuTap(p) {
    if (this.skinsBackRect && this._hit(p, this.skinsBackRect)) {
      this.skinMenuOpen = false;
      return;
    }
    for (let i = 0; i < this.skinSlotRects.length; i++) {
      if (this._hit(p, this.skinSlotRects[i])) {
        const skin = SKINS[i];
        if (skin.cost === 0 || this.bestScore >= skin.cost) {
          this.selectedSkinId = skin.id;
          try { localStorage.setItem(SKIN_KEY, skin.id); } catch (e) {}
        }
        return;
      }
    }
  }

  _drawSkinMenu() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5, 8, 18, 0.82)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.textAlign = "center";
    ctx.font = "700 40px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CHOOSE YOUR AURA", LOGICAL_W / 2, 68);

    ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffd66b";
    ctx.fillText("Best Score: " + this.bestScore, LOGICAL_W / 2, 104);

    const slotW = 150, slotH = 210, gap = 10;
    const totalW = SKINS.length * slotW + (SKINS.length - 1) * gap;
    let sx = (LOGICAL_W - totalW) / 2;
    const sy = 136;
    this.skinSlotRects = [];

    SKINS.forEach((skin) => {
      const rect = { x: sx, y: sy, w: slotW, h: slotH };
      this.skinSlotRects.push(rect);
      const unlocked = skin.cost === 0 || this.bestScore >= skin.cost;
      const selected = this.selectedSkinId === skin.id;

      ctx.fillStyle = selected ? "rgba(60, 150, 70, 0.92)" : "rgba(20, 28, 48, 0.92)";
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
      ctx.fill();
      ctx.strokeStyle = selected ? "#b4ff64" : (unlocked ? "#ffffff" : "#3a4560");
      ctx.lineWidth = selected ? 4 : 2.5;
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
      ctx.stroke();

      // Super Kid icon (clear) with the aura colour behind it
      const iw = 84, ih = 84;
      const icx = rect.x + slotW / 2;
      const icy = rect.y + 16 + ih / 2;
      if (skin.aura) {
        const g = ctx.createRadialGradient(icx, icy, 10, icx, icy, iw * 0.66);
        g.addColorStop(0, `rgba(${skin.aura}, 0.5)`);
        g.addColorStop(1, `rgba(${skin.aura}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(icx, icy, iw * 0.66, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${skin.aura}, 0.9)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(icx, icy, iw * 0.62, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.drawImage(ASSETS.images.player, rect.x + (slotW - iw) / 2, rect.y + 16, iw, ih);

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 19px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillText(skin.name, rect.x + slotW / 2, rect.y + 138);

      ctx.font = "400 17px 'Comic Neue', 'Comic Sans MS', sans-serif";
      if (selected) {
        ctx.fillStyle = "#b4ff64";
        ctx.fillText("SELECTED", rect.x + slotW / 2, rect.y + 166);
      } else if (unlocked) {
        ctx.fillStyle = "#ffd66b";
        ctx.fillText("TAP TO EQUIP", rect.x + slotW / 2, rect.y + 166);
      } else {
        ctx.fillStyle = "#9aa6c0";
        ctx.fillText("🔒 Score " + skin.cost, rect.x + slotW / 2, rect.y + 166);
      }

      sx += slotW + gap;
    });

    // Back button
    const bw = 220, bh = 56;
    const bx = (LOGICAL_W - bw) / 2, by = 372;
    this.skinsBackRect = { x: bx, y: by, w: bw, h: bh };
    ctx.fillStyle = "rgba(40, 60, 100, 0.9)";
    roundedRect(ctx, bx, by, bw, bh, 14);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    roundedRect(ctx, bx, by, bw, bh, 14);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillText("Back", LOGICAL_W / 2, by + 38);
  }

  _drawCombo() {
    const ctx = this.ctx;

    // Streak pill under the timer
    if (this.comboMult >= 2 && this.state === STATE.PLAYING) {
      const label = "COMBO x" + this.comboMult + " · " + this.combo;
      ctx.textAlign = "center";
      ctx.font = "700 22px 'Comic Neue', 'Comic Sans MS', sans-serif";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      roundedRect(ctx, LOGICAL_W / 2 - tw / 2 - 16, 60, tw + 32, 32, 12);
      ctx.fill();
      ctx.fillStyle = "#ffd66b";
      ctx.fillText(label, LOGICAL_W / 2, 83);
    }

    // Level-up popup
    if (this.comboPopupTimer > 0) {
      const alpha = clamp(this.comboPopupTimer / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.font = "700 46px 'Comic Neue', 'Comic Sans MS', sans-serif";
      const msg = this.comboPopup;
      const y = 220;
      ctx.fillStyle = "#0a0e19";
      ctx.fillText(msg, LOGICAL_W / 2 + 2, y + 2);
      ctx.fillStyle = "#ffd66b";
      ctx.fillText(msg, LOGICAL_W / 2, y);
      ctx.restore();
    }
  }

  _drawKid() {
    const ctx = this.ctx;
    const kid = this.kid;

    // Ground shadow
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(
      kid.x + kid.w / 2,
      LOGICAL_H - 10,
      kid.w * 0.36,
      8,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    const bob = kid.bobOffset || 0;
    const drawW = kid.w;
    const drawH = kid.h * kid.squash;
    const drawX = kid.x;
    const drawY = kid.y - drawH + bob; // feet stay anchored

    ctx.save();
    ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
    if (!kid.facingRight) ctx.scale(-1, 1);

    // Draw the selected skin (with a tint for flash effects).
    const flash = this._flashedSprite(ASSETS.images.player, kid);
    ctx.drawImage(flash, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  /* Glowing protective bubble + countdown shown while the shield is active. */
  _drawShield() {
    const ctx = this.ctx;
    const kid = this.kid;
    const cx = kid.x + kid.w / 2;
    const cy = kid.y - kid.h / 2;
    const r = kid.w * 0.74;
    const t = performance.now() / 1000;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, "rgba(150,220,255,0.08)");
    grad.addColorStop(0.7, "rgba(120,200,255,0.22)");
    grad.addColorStop(1, "rgba(170,235,255,0.5)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(215,245,255,${0.55 + 0.3 * Math.sin(t * 4)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const secs = Math.ceil(this.shieldRemaining);
    ctx.textAlign = "center";
    ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#0a2a44";
    ctx.fillText("SHIELD " + secs + "s", cx + 2, kid.y - kid.h - 14 + 2);
    ctx.fillStyle = "#9fdfff";
    ctx.fillText("SHIELD " + secs + "s", cx, kid.y - kid.h - 14);
  }

  /* Returns the player image with a translucent colour tint applied. */
  _flashedSprite(base, kid) {
    if (kid.flashType === 0 || kid.flashTimer <= 0) return base;

    const color = kid.flashType === 1 ? "80,255,130"
                : kid.flashType === 2 ? "255,80,80"
                : kid.flashType === 4 ? "255,215,90"
                : "130,210,255"; // ice

    // Pulsing blink (on/off a few times).
    const pulse = kid.flashTimer % 6;
    if (pulse >= 3) return base;

    if (!this._flashCache || this._flashCache.key !== kid.flashType) {
      const c = document.createElement("canvas");
      c.width = base.width;
      c.height = base.height;
      const cctx = c.getContext("2d");
      cctx.drawImage(base, 0, 0);
      cctx.globalCompositeOperation = "source-atop";
      cctx.fillStyle = `rgba(${color},0.6)`;
      cctx.fillRect(0, 0, c.width, c.height);
      this._flashCache = { key: kid.flashType, canvas: c };
    }
    return this._flashCache.canvas;
  }

  _drawFreezeEffects() {
    const ctx = this.ctx;
    const kid = this.kid;

    // Icy blue vignette over the whole screen.
    ctx.save();
    ctx.fillStyle = "rgba(80, 170, 240, 0.12)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.restore();

    // Falling snow particles.
    for (const p of this.freezeParticles) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.fillStyle = "#dff4ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ice block around the kid.
    ctx.save();
    const ix = kid.x - 12;
    const iy = kid.y - kid.h - 14;
    const iw = kid.w + 24;
    const ih = kid.h + 30;
    ctx.fillStyle = "rgba(150, 220, 255, 0.28)";
    ctx.strokeStyle = "rgba(220, 245, 255, 0.9)";
    ctx.lineWidth = 4;
    roundedRect(ctx, ix, iy, iw, ih, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Countdown label.
    const secs = Math.ceil(this.freezeRemaining);
    ctx.textAlign = "center";
    ctx.font = "700 42px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#0a1a2e";
    ctx.fillText("FROZEN!", LOGICAL_W / 2 + 2, 108 + 2);
    ctx.fillStyle = "#bfeaff";
    ctx.fillText("FROZEN!", LOGICAL_W / 2, 108);
    ctx.font = "700 28px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Thawing in ${secs}…`, LOGICAL_W / 2, 148);
  }

  _drawHud() {
    const ctx = this.ctx;

    // Planet health card + bar
    const healthColor = this.health >= 70 ? "#3cdc5a" : this.health >= 35 ? "#ffc83c" : "#ff5050";
    this._hudCard("PLANET HEALTH  " + this.health + "%", 18, 18, "#14783c");
    const barW = 150;
    const barH = 14;
    ctx.fillStyle = "#e6e6e6";
    roundedRect(ctx, 18, 64, barW, barH, 8);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    roundedRect(ctx, 18, 64, barW, barH, 8);
    ctx.stroke();
    const fillW = (barW - 4) * clamp(this.health / 100, 0, 1);
    if (fillW > 0) {
      ctx.fillStyle = healthColor;
      roundedRect(ctx, 20, 66, fillW, barH - 4, 6);
      ctx.fill();
    }

    // Lives
    this._hudCard("LIVES  " + this.lives, 18, 94, "#285ab4");

    // Timer (top centre)
    const remaining = Math.max(0, GAME_DURATION - this.elapsed);
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    const label = this.timeUp ? "TIME UP!" : `Time: ${m}:${String(s).padStart(2, "0")}`;
    const color = this.timeUp ? "#ff3c3c" : remaining > 60 ? "#64ff64" : remaining > 30 ? "#ffc832" : "#ff3c3c";
    ctx.textAlign = "center";
    ctx.font = "700 42px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#000000";
    ctx.fillText(label, LOGICAL_W / 2 + 2, 44 + 2);
    ctx.fillStyle = color;
    ctx.fillText(label, LOGICAL_W / 2, 44);
  }

  _hudCard(text, x, y, fill) {
    const ctx = this.ctx;
    ctx.font = "700 22px 'Comic Neue', 'Comic Sans MS', sans-serif";
    const w = ctx.measureText(text).width + 20;
    const h = 34;
    ctx.fillStyle = fill;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(text, x + 10, y + 25);
  }

  _drawCleanMessage() {
    const ctx = this.ctx;
    const alpha = clamp(this.cleanMsgTimer / 0.4, 0, 1);
    const t = performance.now() / 1000;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = "700 52px 'Comic Neue', 'Comic Sans MS', sans-serif";
    const msg = "CLEAN ENVIRONMENT UNLOCKED!";
    const y = LOGICAL_H / 2 - 40;
    ctx.fillStyle = "rgba(10,40,10,0.65)";
    roundedRect(ctx, LOGICAL_W / 2 - 430, y - 60, 860, 90, 20);
    ctx.fill();
    ctx.strokeStyle = `rgba(${120 + Math.sin(t * 4) * 60}, 255, ${120 + Math.sin(t * 4) * 40}, ${alpha})`;
    ctx.lineWidth = 4;
    roundedRect(ctx, LOGICAL_W / 2 - 430, y - 60, 860, 90, 20);
    ctx.stroke();
    ctx.fillStyle = "#9fff9f";
    ctx.fillText(msg, LOGICAL_W / 2, y);
    ctx.restore();
  }

  _drawQuiz() {
    const ctx = this.ctx;
    const pw = 720;
    const ph = 440;
    const px = (LOGICAL_W - pw) / 2;
    const py = (LOGICAL_H - ph) / 2;

    // Dim the play area.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Panel
    ctx.fillStyle = "rgba(10,40,10,0.94)";
    roundedRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = "#50c850";
    ctx.lineWidth = 4;
    roundedRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "700 34px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#64ff64";
    ctx.fillText("ECO QUIZ TIME!", px + 22, py + 46);

    ctx.font = "700 28px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffc8";
    this._wrapText(ctx, this.quiz.question, px + 22, py + 92, pw - 44, 34);

    if (this.quizResult === null) {
      this.quizOptionRects = [];
      const labels = ["A", "B", "C"];
      for (let i = 0; i < this.quiz.options.length; i++) {
        const oy = py + 170 + i * 78;
        const rect = { x: px + 40, y: oy, w: pw - 80, h: 60 };
        this.quizOptionRects.push(rect);
        ctx.fillStyle = "#146414";
        roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.strokeStyle = "#50c850";
        ctx.lineWidth = 2.5;
        roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.stroke();

        ctx.fillStyle = "#ffd66b";
        ctx.font = "700 26px 'Comic Neue', 'Comic Sans MS', sans-serif";
        ctx.fillText(labels[i], rect.x + 18, rect.y + 40);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(this.quiz.options[i].replace(/^[A-C]:\s*/, ""), rect.x + 58, rect.y + 40);
      }

      ctx.font = "400 19px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillStyle = "#9a9a9a";
      ctx.textAlign = "center";
      ctx.fillText("Press A / B / C or tap an answer", LOGICAL_W / 2, py + ph - 18);
    } else {
      ctx.textAlign = "left";
      if (this.quizResult === "correct") {
        ctx.font = "700 36px 'Comic Neue', 'Comic Sans MS', sans-serif";
        ctx.fillStyle = "#50ff50";
        ctx.fillText("Correct! +6 bonus points!", px + 40, py + 200);
      } else {
        ctx.font = "700 36px 'Comic Neue', 'Comic Sans MS', sans-serif";
        ctx.fillStyle = "#ff5050";
        ctx.fillText("Not quite!", px + 40, py + 200);
      }

      ctx.font = "400 22px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillStyle = "#ffe664";
      this._wrapText(ctx, this.quiz.hint, px + 40, py + 260, pw - 80, 28);

      ctx.font = "400 19px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillStyle = "#cccccc";
      ctx.textAlign = "center";
      ctx.fillText("Press any key or tap to continue", LOGICAL_W / 2, py + ph - 24);
    }
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  _drawGameOver() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.textAlign = "center";
    ctx.font = "700 58px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#0a0e19";
    ctx.fillText("MISSION OVER", LOGICAL_W / 2 + 3, LOGICAL_H / 2 - 40 + 3);
    ctx.fillStyle = "#ffd66b";
    ctx.fillText("MISSION OVER", LOGICAL_W / 2, LOGICAL_H / 2 - 40);

    const reason = this.timeUp
      ? "Time ran out!"
      : this.lives <= 0
        ? "The planet needs you!"
        : "Keep practicing, Super Kid!";
    ctx.font = "400 30px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(reason, LOGICAL_W / 2, LOGICAL_H / 2 + 14);

    ctx.font = "400 26px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#d8e0ee";
    ctx.fillText(`Final score: ${this.score}`, LOGICAL_W / 2, LOGICAL_H / 2 + 58);

    ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
    if (this.newBest) {
      ctx.fillStyle = "#ffd66b";
      ctx.fillText(`\u2605 NEW BEST! ${this.bestScore}`, LOGICAL_W / 2, LOGICAL_H / 2 + 92);
    } else {
      ctx.fillStyle = "#c9d2e0";
      ctx.fillText(`Best: ${this.bestScore}`, LOGICAL_W / 2, LOGICAL_H / 2 + 92);
    }

    // Play again button
    const bw = 260;
    const bh = 74;
    const bx = LOGICAL_W / 2 - bw / 2;
    const by = LOGICAL_H / 2 + 124;
    this.playAgainRect = { x: bx, y: by, w: bw, h: bh };
    ctx.fillStyle = "#00c800";
    roundedRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    roundedRect(ctx, bx, by, bw, bh, 16);
    ctx.stroke();
    ctx.font = "700 32px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Play Again", LOGICAL_W / 2, by + 48);

    ctx.font = "400 20px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#b8c0d0";
    ctx.fillText("or press ENTER", LOGICAL_W / 2, by + bh + 30);
  }

  _drawWin() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;

    // Sunrise gradient background.
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    grad.addColorStop(0, "#0a1e3c");
    grad.addColorStop(0.5, "#1e8fc9");
    grad.addColorStop(1, "#9fdfea");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Confetti
    for (const p of this.winParticles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.fillRect(-p.size / 2, -p.size, p.size / 2, p.size * 2);
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size / 2);
      }
      ctx.restore();
    }

    // Clean Earth with glow.
    const earth = ASSETS.images.winEarth;
    const eh = LOGICAL_H * 0.46;
    const ew = eh * (earth.width / earth.height);
    const ex = (LOGICAL_W - ew) / 2;
    const ey = LOGICAL_H * 0.07;
    ctx.save();
    ctx.shadowColor = "rgba(80,220,80,0.6)";
    ctx.shadowBlur = 50 + Math.sin(t * 1.8) * 14;
    ctx.drawImage(earth, ex, ey, ew, eh);
    ctx.restore();

    // Headline
    ctx.textAlign = "center";
    const shimmer = Math.round(Math.sin(t * 3) * 30);
    ctx.font = "700 56px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#143c14";
    ctx.fillText("CONGRATULATIONS, SUPERKID!", LOGICAL_W / 2 + 3, ey + eh + 58 + 3);
    ctx.fillStyle = `rgb(${80 + shimmer}, 255, ${80 + shimmer})`;
    ctx.fillText("CONGRATULATIONS, SUPERKID!", LOGICAL_W / 2, ey + eh + 58);

    // Win lines (staggered fade in)
    const elapsed = this.winElapsed;
    let lineY = ey + eh + 98;
    WIN_LINES.forEach((line, i) => {
      const alpha = clamp((elapsed - i * 0.3) / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "700 28px 'Comic Neue', 'Comic Sans MS', sans-serif";
      ctx.fillStyle = i === 0 ? "#ffdc3c" : "#e6f5ff";
      ctx.fillText(line, LOGICAL_W / 2, lineY);
      ctx.restore();
      lineY += 36;
    });

    // Score summary
    ctx.font = "700 30px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Final score: ${this.score}`, LOGICAL_W / 2, lineY + 18);

    ctx.font = "700 24px 'Comic Neue', 'Comic Sans MS', sans-serif";
    if (this.newBest) {
      ctx.fillStyle = "#ffdc3c";
      ctx.fillText(`\u2605 NEW BEST! ${this.bestScore}`, LOGICAL_W / 2, lineY + 50);
    } else {
      ctx.fillStyle = "#dff2f8";
      ctx.fillText(`Best: ${this.bestScore}`, LOGICAL_W / 2, lineY + 50);
    }

    // Play again button
    const bw = 260;
    const bh = 74;
    const bx = LOGICAL_W / 2 - bw / 2;
    const by = lineY + 78;
    this.playAgainRect = { x: bx, y: by, w: bw, h: bh };
    ctx.fillStyle = "#00b33c";
    roundedRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    roundedRect(ctx, bx, by, bw, bh, 16);
    ctx.stroke();
    ctx.font = "700 32px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Play Again", LOGICAL_W / 2, by + 48);

    const pulse = 0.7 + 0.3 * Math.sin(t * 3.2);
    ctx.font = "400 20px 'Comic Neue', 'Comic Sans MS', sans-serif";
    ctx.fillStyle = `rgba(${200 * pulse}, 255, ${200 * pulse}, 1)`;
    ctx.fillText("or press ENTER", LOGICAL_W / 2, by + bh + 30);
  }
}

/* ------------------------------ Bootstrap ------------------------------ */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const game = new Game(canvas);
  game.init().catch((err) => {
    console.error(err);
    // If assets fail, still show a friendly error on the canvas.
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#10142a";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Could not load game assets.", LOGICAL_W / 2, LOGICAL_H / 2);
  });
});
