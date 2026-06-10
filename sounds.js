// Sound effects module
// Exposes window.SFX with: jump, score, hit, gameOver, start, setMuted, isMuted
(function () {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx && AudioCtx) ctx = new AudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.2, sweepTo = null, delay = 0 }) {
    if (muted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + duration);
    }
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const SFX = {
    jump() {
      tone({ freq: 320, sweepTo: 720, type: 'square', duration: 0.12, gain: 0.18 });
    },
    score() {
      tone({ freq: 880, type: 'triangle', duration: 0.08, gain: 0.2 });
      tone({ freq: 1320, type: 'triangle', duration: 0.1, gain: 0.18, delay: 0.07 });
    },
    hit() {
      tone({ freq: 220, sweepTo: 60, type: 'sawtooth', duration: 0.25, gain: 0.25 });
    },
    gameOver() {
      tone({ freq: 440, sweepTo: 220, type: 'square', duration: 0.18, gain: 0.22 });
      tone({ freq: 330, sweepTo: 110, type: 'square', duration: 0.28, gain: 0.22, delay: 0.18 });
      tone({ freq: 220, sweepTo: 55, type: 'square', duration: 0.4, gain: 0.22, delay: 0.45 });
    },
    start() {
      tone({ freq: 523, type: 'triangle', duration: 0.08, gain: 0.18 });
      tone({ freq: 659, type: 'triangle', duration: 0.08, gain: 0.18, delay: 0.08 });
      tone({ freq: 784, type: 'triangle', duration: 0.12, gain: 0.2, delay: 0.16 });
    },
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
  };

  // Resume audio on first user gesture (browser autoplay policy).
  function unlock() {
    ensureCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  }
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  window.SFX = SFX;
})();
