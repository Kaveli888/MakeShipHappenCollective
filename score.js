/* ============================================================
   score.js — Scoring System (t8)
   Depends on: t1 game.js (emits 'game:start', 'game:over', 'game:point')
               t7 player.js (emits 'player:pass-pipe' or 'player:point')
   DOM hooks (created by t2/peer index.html):
     #score-value   live score
     #best-value    best score
     #final-score   shown in game-over overlay
     #final-best    shown in game-over overlay
     #score-fx      container for floating "+1" popups
     #app           stage root (used to position popups + best banner)
   Public API: window.Score
     Score.add(n=1)      add points + play bump + popup
     Score.set(n)        set absolute score
     Score.get()         current score
     Score.best()        best score
     Score.reset()       zero current score (keeps best)
     Score.commit()      finalize, update best, render game-over numbers
     Score.onChange(fn)  subscribe to (current,best) changes
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'msh.game.bestScore.v1';

  function readBest() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var n = raw == null ? 0 : parseInt(raw, 10);
      return isFinite(n) && n >= 0 ? n : 0;
    } catch (_) {
      return 0;
    }
  }

  function writeBest(n) {
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
  }

  function $(id) { return document.getElementById(id); }

  var state = {
    current: 0,
    best: readBest(),
    sawNewBestThisRound: false,
    subs: []
  };

  function renderLive() {
    var s = $('score-value');
    if (s) {
      s.textContent = String(state.current);
      s.classList.remove('bump');
      // restart animation
      void s.offsetWidth;
      s.classList.add('bump');
    }
    var b = $('best-value');
    if (b) b.textContent = String(state.best);
  }

  function renderFinal() {
    var fs = $('final-score');
    if (fs) fs.textContent = String(state.current);
    var fb = $('final-best');
    if (fb) {
      fb.textContent = String(state.best);
      if (state.sawNewBestThisRound) {
        fb.classList.remove('new');
        void fb.offsetWidth;
        fb.classList.add('new');
      }
    }
  }

  function spawnPopup(text) {
    var host = $('score-fx');
    if (!host) return;
    var canvas = $('game-canvas');
    var hostRect = host.getBoundingClientRect();
    var x = hostRect.width / 2;
    var y = hostRect.height * 0.35;
    if (canvas) {
      var cr = canvas.getBoundingClientRect();
      x = (cr.left - hostRect.left) + cr.width / 2;
      y = (cr.top  - hostRect.top)  + cr.height * 0.32;
    }
    var el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    host.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }

  function spawnBestBanner() {
    var app = $('app');
    if (!app) return;
    var banner = document.createElement('div');
    banner.className = 'best-banner';
    banner.textContent = 'NEW BEST!';
    app.appendChild(banner);
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 1800);
  }

  function notify() {
    for (var i = 0; i < state.subs.length; i++) {
      try { state.subs[i](state.current, state.best); } catch (_) {}
    }
  }

  var Score = {
    add: function (n) {
      var inc = (typeof n === 'number' && isFinite(n)) ? n : 1;
      state.current += inc;
      if (state.current > state.best) {
        state.best = state.current;
        if (!state.sawNewBestThisRound) state.sawNewBestThisRound = true;
      }
      renderLive();
      spawnPopup(inc > 0 ? '+' + inc : String(inc));
      notify();
      return state.current;
    },

    set: function (n) {
      var v = (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.floor(n)) : 0;
      state.current = v;
      if (state.current > state.best) state.best = state.current;
      renderLive();
      notify();
      return state.current;
    },

    get: function ()  { return state.current; },
    best: function () { return state.best; },

    reset: function () {
      state.current = 0;
      state.sawNewBestThisRound = false;
      renderLive();
      notify();
    },

    commit: function () {
      // Persist best, render the game-over numbers
      writeBest(state.best);
      renderFinal();
      if (state.sawNewBestThisRound && state.current > 0) {
        spawnBestBanner();
      }
      notify();
    },

    onChange: function (fn) {
      if (typeof fn === 'function') state.subs.push(fn);
      return function off() {
        var i = state.subs.indexOf(fn);
        if (i !== -1) state.subs.splice(i, 1);
      };
    }
  };

  // ---- Event wiring (peers can dispatch on window or document) ----
  function on(target, evt, fn) {
    target.addEventListener(evt, fn);
  }

  // t1: 'game:start' / 'game:over' control round lifecycle
  on(window, 'game:start',  function () { Score.reset(); });
  on(window, 'game:over',   function () { Score.commit(); });

  // Peer-emitted point events. Detail can carry a numeric amount.
  function onPoint(e) {
    var amt = (e && e.detail && typeof e.detail.amount === 'number') ? e.detail.amount : 1;
    Score.add(amt);
  }
  on(window, 'game:point',         onPoint);
  on(window, 'player:point',       onPoint);
  on(window, 'player:pass-pipe',   onPoint);
  on(window, 'obstacle:cleared',   onPoint);

  // Initial paint
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderLive);
  } else {
    renderLive();
  }

  window.Score = Score;
})();
