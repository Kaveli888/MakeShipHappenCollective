/*
 * UI controller (task t4 — frontend).
 *
 * Owns: screen state (menu / playing / game-over), HUD, overlays, input dispatch,
 *       sound toggle, persistent best-score in localStorage.
 *
 * Does NOT own: game loop, physics, rendering, obstacles, audio playback.
 *
 * Integration contract — peers populate `window.Game`:
 *   Game.init(canvas)              t1 — wire game to the canvas element
 *   Game.start()                   t1 — begin a new run
 *   Game.stop()                    t1 — halt current run
 *   Game.input(action)             t1/t7 — receive 'primary' from UI on tap/space/click
 *   Game.setMuted(bool)            t3 — UI sound toggle
 *
 * UI subscribes to events the game emits:
 *   window.dispatchEvent(new CustomEvent('game:score', { detail: { score } }))   t8
 *   window.dispatchEvent(new CustomEvent('game:over',  { detail: { score } }))   t1
 *   window.dispatchEvent(new CustomEvent('game:ready'))                          t1 — optional
 */

(function () {
  'use strict';

  const State = { MENU: 'menu', PLAYING: 'playing', GAMEOVER: 'gameover' };
  const BEST_KEY = 'game.best';
  const MUTE_KEY = 'game.muted';

  const el = {
    canvas: document.getElementById('game-canvas'),
    hud: document.getElementById('hud'),
    score: document.getElementById('score-value'),
    best: document.getElementById('best-value'),
    startOverlay: document.getElementById('start-overlay'),
    gameoverOverlay: document.getElementById('gameover-overlay'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    menuBtn: document.getElementById('menu-btn'),
    finalScore: document.getElementById('final-score'),
    finalBest: document.getElementById('final-best'),
    playHint: document.getElementById('play-hint'),
    soundToggle: document.getElementById('sound-toggle'),
  };

  const ui = {
    state: State.MENU,
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0),
    muted: localStorage.getItem(MUTE_KEY) === '1',
  };

  /* ---------- canvas sizing ---------- */
  function fitCanvas() {
    // Maintain a portrait playfield, fit within viewport with margin.
    const margin = 32;
    const targetRatio = 480 / 720;
    const maxW = window.innerWidth - margin;
    const maxH = window.innerHeight - margin;
    let w = maxH * targetRatio;
    let h = maxH;
    if (w > maxW) { w = maxW; h = maxW / targetRatio; }
    el.canvas.style.width = Math.floor(w) + 'px';
    el.canvas.style.height = Math.floor(h) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  /* ---------- state transitions ---------- */
  function setState(next) {
    ui.state = next;
    el.startOverlay.classList.toggle('visible', next === State.MENU);
    el.gameoverOverlay.classList.toggle('visible', next === State.GAMEOVER);
    el.hud.classList.toggle('visible', next === State.PLAYING);
    el.playHint.style.opacity = next === State.PLAYING ? '0.45' : '0';
  }

  function renderBest() {
    el.best.textContent = String(ui.best);
    el.finalBest.textContent = String(ui.best);
  }

  function renderScore() {
    el.score.textContent = String(ui.score);
  }

  /* ---------- actions ---------- */
  function startGame() {
    ui.score = 0;
    renderScore();
    setState(State.PLAYING);
    if (window.Game && typeof window.Game.start === 'function') {
      try { window.Game.start(); }
      catch (err) { console.error('[ui] Game.start threw:', err); }
    } else {
      console.warn('[ui] window.Game.start not implemented yet (peer t1).');
    }
  }

  function endGame(finalScore) {
    if (typeof finalScore === 'number') ui.score = finalScore;
    if (ui.score > ui.best) {
      ui.best = ui.score;
      localStorage.setItem(BEST_KEY, String(ui.best));
    }
    el.finalScore.textContent = String(ui.score);
    renderBest();
    setState(State.GAMEOVER);
  }

  function backToMenu() {
    if (window.Game && typeof window.Game.stop === 'function') {
      try { window.Game.stop(); } catch (_) { /* noop */ }
    }
    setState(State.MENU);
  }

  function sendInput() {
    if (ui.state !== State.PLAYING) return;
    if (window.Game && typeof window.Game.input === 'function') {
      window.Game.input('primary');
    }
  }

  /* ---------- sound toggle ---------- */
  function applyMute() {
    el.soundToggle.textContent = ui.muted ? '♫̸' : '♫';
    el.soundToggle.style.opacity = ui.muted ? '0.45' : '1';
    if (window.Game && typeof window.Game.setMuted === 'function') {
      try { window.Game.setMuted(ui.muted); } catch (_) { /* noop */ }
    }
  }
  function toggleMute() {
    ui.muted = !ui.muted;
    localStorage.setItem(MUTE_KEY, ui.muted ? '1' : '0');
    applyMute();
  }

  /* ---------- input ---------- */
  el.startBtn.addEventListener('click', startGame);
  el.restartBtn.addEventListener('click', startGame);
  el.menuBtn.addEventListener('click', backToMenu);
  el.soundToggle.addEventListener('click', toggleMute);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (ui.state === State.MENU) startGame();
      else if (ui.state === State.GAMEOVER) startGame();
      else sendInput();
    } else if (e.code === 'Escape') {
      if (ui.state === State.PLAYING) backToMenu();
    } else if (e.code === 'KeyM') {
      toggleMute();
    }
  });

  // Pointer input on the canvas only; overlay buttons handle their own clicks.
  el.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (ui.state === State.PLAYING) sendInput();
  });

  /* ---------- game event subscriptions ---------- */
  window.addEventListener('game:score', (e) => {
    const s = e && e.detail && typeof e.detail.score === 'number' ? e.detail.score : null;
    if (s == null) return;
    ui.score = s;
    renderScore();
  });

  window.addEventListener('game:over', (e) => {
    const s = e && e.detail && typeof e.detail.score === 'number' ? e.detail.score : ui.score;
    endGame(s);
  });

  window.addEventListener('game:ready', () => {
    // optional: peer t1 can signal readiness; UI is already at MENU by default
  });

  /* ---------- boot ---------- */
  renderBest();
  renderScore();
  applyMute();
  setState(State.MENU);

  if (window.Game && typeof window.Game.init === 'function') {
    try { window.Game.init(el.canvas); }
    catch (err) { console.error('[ui] Game.init threw:', err); }
  } else {
    // Peers may not have loaded yet; expose a deferred init for them to call when ready.
    window.__uiAwaitingGame = true;
    Object.defineProperty(window, 'Game', {
      configurable: true,
      set(value) {
        Object.defineProperty(window, 'Game', { value, writable: true, configurable: true });
        if (value && typeof value.init === 'function') {
          try { value.init(el.canvas); }
          catch (err) { console.error('[ui] deferred Game.init threw:', err); }
        }
      },
      get() { return undefined; },
    });
  }
})();
