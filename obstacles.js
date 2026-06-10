// obstacles.js — obstacle generation module
// Owner: t5 (frontend)
// Peers integrate via the global `Obstacles` API:
//   Obstacles.init({ canvas, laneCount?, baseSpeed?, spawnIntervalMs?, rng? })
//   Obstacles.update(dtMs)            -> advance positions, spawn/cull
//   Obstacles.draw(ctx)               -> render to a 2D context
//   Obstacles.getAll()                -> live array (collision checks by t1/t7)
//   Obstacles.reset()                 -> clear field (restart, used by t8)
//   Obstacles.setDifficulty(level)    -> 0..n, scales speed + spawn rate
//   Obstacles.onPassed(cb)            -> fires once when player y passes an obstacle (for t8 scoring)
//   Obstacles.setPlayerY(y)           -> tell module where player line is so onPassed can fire

(function (global) {
  'use strict';

  const DEFAULTS = {
    laneCount: 3,
    baseSpeed: 0.25,       // px per ms at difficulty 0
    speedPerLevel: 0.05,
    spawnIntervalMs: 1100, // base spawn cadence at difficulty 0
    spawnFloorMs: 350,     // hard floor so it never gets unplayable
    obstacleWidthRatio: 0.18, // fraction of canvas width per lane
    obstacleHeight: 32,
    palette: ['#ff5577', '#ffb347', '#7ad7ff', '#b388ff'],
  };

  const state = {
    cfg: { ...DEFAULTS },
    canvas: null,
    rng: Math.random,
    items: [],
    timeSinceSpawnMs: 0,
    difficulty: 0,
    playerY: null,
    passedListeners: [],
    nextId: 1,
    running: true,
  };

  function currentSpeed() {
    return state.cfg.baseSpeed + state.cfg.speedPerLevel * state.difficulty;
  }

  function currentSpawnInterval() {
    const decay = Math.pow(0.88, state.difficulty);
    return Math.max(state.cfg.spawnFloorMs, state.cfg.spawnIntervalMs * decay);
  }

  function pickLane() {
    return Math.floor(state.rng() * state.cfg.laneCount);
  }

  function spawn() {
    if (!state.canvas) return;
    const w = state.canvas.width;
    const laneWidth = w / state.cfg.laneCount;
    const obsW = laneWidth * state.cfg.obstacleWidthRatio * (state.cfg.laneCount > 1 ? state.cfg.laneCount : 1);
    const widthPx = Math.min(laneWidth * 0.7, Math.max(28, obsW));
    const lane = pickLane();
    const laneCenterX = lane * laneWidth + laneWidth / 2;
    const obstacle = {
      id: state.nextId++,
      lane,
      x: laneCenterX - widthPx / 2,
      y: -state.cfg.obstacleHeight,
      width: widthPx,
      height: state.cfg.obstacleHeight,
      color: state.cfg.palette[(state.nextId - 1) % state.cfg.palette.length],
      passed: false,
    };
    state.items.push(obstacle);
  }

  function emitPassed(o) {
    for (let i = 0; i < state.passedListeners.length; i++) {
      try { state.passedListeners[i](o); } catch (_) { /* listener error swallowed */ }
    }
  }

  const Obstacles = {
    init(opts) {
      opts = opts || {};
      if (!opts.canvas) throw new Error('Obstacles.init: { canvas } is required');
      state.cfg = { ...DEFAULTS, ...opts };
      state.canvas = opts.canvas;
      state.rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
      state.items.length = 0;
      state.timeSinceSpawnMs = 0;
      state.difficulty = 0;
      state.nextId = 1;
      return Obstacles;
    },

    update(dtMs) {
      if (!state.running || !state.canvas) return;
      const dy = currentSpeed() * dtMs;
      const playerY = state.playerY;
      const h = state.canvas.height;

      for (let i = 0; i < state.items.length; i++) {
        const o = state.items[i];
        o.y += dy;
        if (!o.passed && playerY != null && o.y > playerY) {
          o.passed = true;
          emitPassed(o);
        }
      }

      // cull off-screen
      let writeIdx = 0;
      for (let i = 0; i < state.items.length; i++) {
        const o = state.items[i];
        if (o.y < h + 80) state.items[writeIdx++] = o;
      }
      state.items.length = writeIdx;

      state.timeSinceSpawnMs += dtMs;
      const interval = currentSpawnInterval();
      while (state.timeSinceSpawnMs >= interval) {
        spawn();
        state.timeSinceSpawnMs -= interval;
      }
    },

    draw(ctx) {
      if (!ctx) return;
      for (let i = 0; i < state.items.length; i++) {
        const o = state.items[i];
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.width, o.height);
      }
    },

    getAll() { return state.items; },

    reset() {
      state.items.length = 0;
      state.timeSinceSpawnMs = 0;
      state.difficulty = 0;
    },

    setDifficulty(level) {
      state.difficulty = Math.max(0, level | 0);
    },

    onPassed(cb) {
      if (typeof cb === 'function') state.passedListeners.push(cb);
      return Obstacles;
    },

    setPlayerY(y) { state.playerY = y; },

    pause() { state.running = false; },
    resume() { state.running = true; },

    _state: state, // exposed for tests/peer debugging only
  };

  global.Obstacles = Obstacles;
})(typeof window !== 'undefined' ? window : globalThis);
