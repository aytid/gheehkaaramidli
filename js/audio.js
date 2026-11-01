/* Audio: background music, game-over sound and tiny synthesized effects.
 * Every call is wrapped so that missing files or browser autoplay blocks can never stop the game. */
(function (TB) {
  'use strict';

  var FILES = { music: 'assets/gameplay.mp3', over: 'assets/gameover.mp3' };
  var MUTE_KEY = 'abhinavTapBird.muted';

  var muted = false;
  var musicWanted = false;   // true while the game is in the "playing" state
  var music = null;
  var overSound = null;
  var audioCtx = null;

  try { muted = window.sessionStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage unavailable */ }

  function createTrack(src, loop, volume) {
    var track = { el: null, failed: false };
    try {
      var el = new Audio();
      el.preload = 'auto';
      el.loop = loop;
      el.volume = volume;
      el.addEventListener('error', function () { track.failed = true; });
      el.src = src;
      track.el = el;
    } catch (e) {
      track.failed = true;
    }
    return track;
  }

  function init() {
    if (music) return;
    music = createTrack(FILES.music, true, 0.45);
    overSound = createTrack(FILES.over, false, 0.7);
  }

  function safePlay(track) {
    if (!track || !track.el || track.failed) return;
    try {
      var p = track.el.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay blocked: ignore */ });
    } catch (e) { /* ignore */ }
  }

  function safePause(track) {
    if (!track || !track.el) return;
    try { track.el.pause(); } catch (e) { /* ignore */ }
  }

  function rewind(track) {
    if (!track || !track.el) return;
    try { track.el.currentTime = 0; } catch (e) { /* not seekable yet */ }
  }

  /* ---- Music ---- */
  function startMusic() {          // new run
    init();
    musicWanted = true;
    safePause(overSound); rewind(overSound);
    rewind(music);
    if (!muted) safePlay(music);
  }
  function pauseMusic() {          // pause screen
    musicWanted = false;
    safePause(music);
  }
  function resumeMusic() {
    musicWanted = true;
    if (!muted) safePlay(music);
  }
  function stopMusic() {           // game over / back to menu
    musicWanted = false;
    safePause(music);
    rewind(music);
  }

  /* ---- One-shots ---- */
  function playGameOver() {
    init();
    stopMusic();
    if (muted) return;
    rewind(overSound);
    safePlay(overSound);
  }

  function getCtx() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  function blip(freq, endFreq, duration, type, gain) {
    if (muted) return;
    var ctx = getCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      var t = ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + duration + 0.02);
    } catch (e) { /* ignore */ }
  }

  function playFlap() { blip(380, 620, 0.09, 'triangle', 0.12); }
  function playScore() { blip(700, 1050, 0.14, 'square', 0.07); }

  /* ---- Mute ---- */
  function setMuted(value) {
    muted = !!value;
    try { window.sessionStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (muted) {
      safePause(music);
      safePause(overSound);
    } else if (musicWanted) {
      safePlay(music);
    }
    return muted;
  }
  function isMuted() { return muted; }

  TB.Audio = {
    init: init, startMusic: startMusic, pauseMusic: pauseMusic, resumeMusic: resumeMusic, stopMusic: stopMusic,
    playGameOver: playGameOver, playFlap: playFlap, playScore: playScore,
    setMuted: setMuted, isMuted: isMuted
  };
})(window.TapBird = window.TapBird || {});
