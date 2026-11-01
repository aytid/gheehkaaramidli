/* Game: configuration, state machine, input, background, rendering loop.
 * The world is a fixed 480x720 coordinate space that is scaled to the screen, so physics
 * and collisions never change when the window is resized. */
(function (TB) {
  'use strict';

  /* ======= TUNING (edit to change the feel of the game) ======= */
  var CONFIG = {
    world: { width: 480, height: 720, groundHeight: 72 },
    physics: { gravity: 1500, jump: -450, maxFall: 720 },     // pixels per second (and per second squared)
    player: { x: 140, radius: 20, drawHeight: 72, hitboxScale: 0.9 },
    obstacles: { width: 104, spacing: 300, minSegment: 90, maxGapShift: 170 },
    difficulty: {
      maxScore: 35,                                            // difficulty stops increasing here
      speedStart: 150, speedMax: 240,
      gapStart: 205, gapMin: 150
    }
  };
  /* ============================================================ */

  var STORAGE_KEY = 'abhinavTapBird.best';
  var MAX_STEP = 1 / 120;       // physics sub-step, keeps collisions accurate at any frame rate
  var MAX_FRAME = 0.05;         // clamp long frames (tab switches etc.)

  var W = CONFIG.world.width, H = CONFIG.world.height;
  var GROUND_Y = H - CONFIG.world.groundHeight;

  /* roundRect polyfill for older browsers */
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------------- Best score storage ---------------- */
  var memoryBest = 0;
  function loadBest() {
    try {
      var v = parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
      return isNaN(v) || v < 0 ? 0 : v;
    } catch (e) { return memoryBest; }
  }
  function saveBest(v) {
    memoryBest = v;
    try { window.localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------------- Background ---------------- */
  var SYMBOLS = ['🥥', '🥞', '🍃', '🌶️', '🍽️', '🫓', '🍛', '🥥', '🍴', '🥞'];
  var FORMULAS = ['IDLY • DOSA • VADA', 'Coconut chutney', 'Crispy golden dosa', 'Hot sambar', 'Ghee roast special', 'South Indian tiffin'];
  var FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

  var sunGradient = null;
  function wrapX(x, span, margin) { return ((x % span) + span) % span - margin; }

  function drawBackground(ctx, sky, scroll) {
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // sun
    if (!sunGradient) {
      sunGradient = ctx.createRadialGradient(390, 110, 8, 390, 110, 90);
      sunGradient.addColorStop(0, 'rgba(255,244,170,1)'); sunGradient.addColorStop(.35, 'rgba(255,230,120,.85)'); sunGradient.addColorStop(1, 'rgba(255,230,120,0)');
    }
    ctx.fillStyle = sunGradient; ctx.fillRect(290, 10, 200, 200);

    var i, x, y;
    // floating South Indian tiffin decorations
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.font = '700 46px ' + FONT;
    for (i = 0; i < 10; i++) {
      x = wrapX(i * 97 - scroll * 0.12, W + 120, 60);
      y = 70 + ((i * 131) % 430);
      ctx.fillText(SYMBOLS[i], x, y);
    }
    ctx.fillStyle = 'rgba(40,80,150,0.17)';
    ctx.font = '700 17px ' + FONT;
    for (i = 0; i < 6; i++) {
      x = wrapX(i * 190 - scroll * 0.07, W + 300, 150);
      y = 120 + ((i * 97) % 380);
      ctx.fillText(FORMULAS[i], x, y);
    }

    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (i = 0; i < 5; i++) {
      x = wrapX(i * 140 - scroll * 0.22, W + 200, 100);
      y = 60 + ((i * 83) % 220);
      var s = 0.8 + (i % 3) * 0.25;
      ctx.beginPath();
      ctx.ellipse(x, y, 38 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 22 * s, y - 11 * s, 24 * s, 19 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 46 * s, y, 32 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // hills (two parallax layers)
    drawHills(ctx, '#9fe0b6', GROUND_Y - 85, 22, 0.011, scroll * 0.0045, 0.02);
    drawHills(ctx, '#6fcf97', GROUND_Y - 38, 18, 0.016, scroll * 0.0075, 1.5);
  }

  function drawHills(ctx, color, baseY, amp, freq, phase, off) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (var x = 0; x <= W + 12; x += 12) ctx.lineTo(x, baseY + Math.sin(x * freq + phase * 60 + off) * amp + Math.sin(x * freq * 2.3 + off) * amp * 0.35);
    ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill();
  }

  function drawGround(ctx, scroll) {
    var gh = CONFIG.world.groundHeight;
    ctx.fillStyle = '#e9c27b'; ctx.fillRect(0, GROUND_Y, W, gh);
    ctx.fillStyle = '#d9ab5f';
    var off = scroll % 40;
    for (var x = -off - 40; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 14); ctx.lineTo(x + 20, GROUND_Y + 14);
      ctx.lineTo(x + 6, GROUND_Y + gh); ctx.lineTo(x - 14, GROUND_Y + gh);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#6bd05a'; ctx.fillRect(0, GROUND_Y, W, 14);
    ctx.fillStyle = '#4fb340'; ctx.fillRect(0, GROUND_Y + 10, W, 4);
    ctx.fillStyle = '#2f6f2a'; ctx.fillRect(0, GROUND_Y - 2, W, 3);
  }

  /* ---------------- Particles (fixed pool, no allocations in the loop) ---------------- */
  var POOL = 60;
  var particles = [];
  for (var pi = 0; pi < POOL; pi++) particles.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff' });

  function emit(x, y, vx, vy, life, size, color) {
    for (var i = 0; i < POOL; i++) {
      var p = particles[i];
      if (!p.on) { p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color; return; }
    }
  }
  function updateParticles(dt) {
    for (var i = 0; i < POOL; i++) {
      var p = particles[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParticles(ctx) {
    for (var i = 0; i < POOL; i++) {
      var p = particles[i];
      if (!p.on) continue;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * p.life / p.max), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function clearParticles() { for (var i = 0; i < POOL; i++) particles[i].on = false; }

  /* ---------------- Game ---------------- */
  function Game() {
    this.canvas = document.getElementById('gameCanvas');
    this.stage = document.getElementById('stage');
    if (!this.canvas || !this.stage || !this.canvas.getContext) throw new Error('Canvas not available');
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('2D context not available');

    this.state = 'ready';      // ready | playing | paused | over
    this.score = 0;
    this.best = loadBest();
    this.time = 0;
    this.scroll = 0;
    this.lastFrame = 0;
    this.rafId = 0;
    this.overAt = 0;
    this.pixelScale = 1;

    this.sky = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    this.sky.addColorStop(0, '#59b8f5'); this.sky.addColorStop(0.6, '#aee3ff'); this.sky.addColorStop(1, '#fff0c9');

    this.player = new TB.Player(CONFIG);
    this.obstacles = new TB.ObstacleManager(CONFIG);

    var self = this;
    this.ui = TB.UI.create({
      onStart: function () { self.startRun(); },
      onRestart: function () { self.startRun(); },
      onPause: function () { self.pause(); },
      onResume: function () { self.resume(); },
      onToggleSound: function () { self.toggleSound(); }
    });
    TB.Audio.init();
    this.ui.setBest(this.best);
    this.ui.setScore(0, false);
    this.ui.setMuted(TB.Audio.isMuted());
    this.ui.setState('ready');

    this._bindInput();
    this._bindResize();
    this._startLoop();
  }

  /* ----- state changes ----- */
  Game.prototype.startRun = function () {
    this.score = 0;
    this.obstacles.reset();
    clearParticles();
    this.player.reset();
    this.player.flap();
    this.state = 'playing';
    this.ui.setScore(0, false);
    this.ui.setBest(this.best);
    this.ui.setState('playing');
    TB.Audio.startMusic();
    TB.Audio.playFlap();
  };

  Game.prototype.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    TB.Audio.pauseMusic();
    this.ui.setState('paused');
  };

  Game.prototype.resume = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.lastFrame = 0;                  // avoid a big time jump on the next frame
    TB.Audio.resumeMusic();
    this.ui.setState('playing');
  };

  Game.prototype.togglePause = function () {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  };

  Game.prototype.toggleSound = function () {
    this.ui.setMuted(TB.Audio.setMuted(!TB.Audio.isMuted()));
  };

  Game.prototype.flap = function () {
    this.player.flap();
    TB.Audio.playFlap();
    for (var i = 0; i < 4; i++) {
      emit(this.player.x - 18, this.player.y + 10, -60 - Math.random() * 60, (Math.random() - 0.3) * 60, 0.4, 3 + Math.random() * 2, '#ffffff');
    }
  };

  Game.prototype.die = function () {
    if (this.state !== 'playing') return;      // guarantees one death, one game-over sound
    this.state = 'over';
    this.overAt = performance.now();
    var isNewBest = this.score > this.best;
    if (isNewBest) { this.best = this.score; saveBest(this.best); }
    TB.Audio.playGameOver();
    this.ui.setBest(this.best);
    this.ui.showGameOver(this.score, this.best, isNewBest && this.score > 0);
    this.ui.shake();
  };

  /* ----- input ----- */
  Game.prototype.handleFlapInput = function (fromKeyboard) {
    if (this.state === 'ready') this.startRun();
    else if (this.state === 'playing') this.flap();
    else if (this.state === 'over' && fromKeyboard && performance.now() - this.overAt > 600) this.startRun();
  };

  Game.prototype._bindInput = function () {
    var self = this;
    this.stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;     // left button only
      if (e.target.closest && e.target.closest('button')) return;  // UI buttons never make the bird jump
      e.preventDefault();
      self.handleFlapInput(false);
    });
    // Block scroll / pinch gestures on the playfield
    this.stage.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    this.stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('keydown', function (e) {
      var code = e.code;
      if (code === 'Space' || code === 'ArrowUp') {
        e.preventDefault();                                          // no page scroll, no button "click"
        if (!e.repeat) self.handleFlapInput(true);
      } else if ((code === 'KeyP' || code === 'Escape') && !e.repeat) {
        self.togglePause();
      } else if (code === 'KeyM' && !e.repeat) {
        self.toggleSound();
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();   // stops Firefox clicking a focused button
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.pause();
    });
  };

  /* ----- resize (display only; never touches game state) ----- */
  Game.prototype._bindResize = function () {
    var self = this;
    var onResize = function () { self.resizeCanvas(); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(this.stage);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    this.resizeCanvas();
  };

  Game.prototype.resizeCanvas = function () {
    var rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var pw = Math.max(1, Math.round(rect.width * dpr));
    var ph = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    this.pixelScale = pw / W;
    this.render();
  };

  /* ----- loop ----- */
  Game.prototype._startLoop = function () {
    if (this.rafId) return;                     // never run two loops
    var self = this;
    function frame(now) {
      self.rafId = requestAnimationFrame(frame);
      var dt = self.lastFrame ? (now - self.lastFrame) / 1000 : 0;
      self.lastFrame = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;
      try {
        self.update(dt);
        self.render();
      } catch (err) {
        console.error('Game loop error:', err);
      }
    }
    this.rafId = requestAnimationFrame(frame);
  };

  Game.prototype.difficulty = function () {
    var d = CONFIG.difficulty;
    var t = Math.min(this.score / d.maxScore, 1);
    return { speed: lerp(d.speedStart, d.speedMax, t), gap: lerp(d.gapStart, d.gapMin, t) };
  };

  Game.prototype.update = function (dt) {
    if (dt <= 0) return;
    if (this.state === 'ready') {
      this.time += dt;
      this.scroll += 30 * dt;
      this.player.updateIdle(dt, this.time);
      return;
    }
    if (this.state !== 'playing') return;       // paused / over: everything is frozen

    this.time += dt;
    var diff = this.difficulty();
    var steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    var h = dt / steps;
    var hitR = CONFIG.player.radius * CONFIG.player.hitboxScale;

    for (var i = 0; i < steps; i++) {
      this.player.update(h);
      this.obstacles.update(h, diff.speed, diff.gap);
      this.scroll += diff.speed * h;

      var passed = this.obstacles.countPassed(this.player.x);
      if (passed > 0) this.addScore(passed);

      if (this.player.y + hitR >= GROUND_Y || this.obstacles.collides(this.player.x, this.player.y, hitR)) {
        this.die();
        break;
      }
    }
    if (this.state === 'playing') updateParticles(dt);
  };

  Game.prototype.addScore = function (n) {
    this.score += n;
    this.ui.setScore(this.score, true);
    if (this.score > this.best) this.ui.setBest(this.score);   // live best indicator
    TB.Audio.playScore();
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      emit(this.player.x, this.player.y, Math.cos(a) * 120, Math.sin(a) * 120, 0.5, 4, '#ffd23f');
    }
  };

  Game.prototype.render = function () {
    var ctx = this.ctx, k = this.pixelScale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawBackground(ctx, this.sky, this.scroll);
    this.obstacles.draw(ctx);
    drawGround(ctx, this.scroll);
    drawParticles(ctx);
    this.player.draw(ctx);
  };

  /* ---------------- Boot ---------------- */
  function boot() {
    try {
      TB.game = new Game();
      TB.started = true;
      TB.getState = function () { return { state: TB.game.state, score: TB.game.score, best: TB.game.best }; };
    } catch (err) {
      console.error('Abhinav Tap Bird failed to start:', err);
      var fatal = document.getElementById('fatal');
      if (fatal) fatal.classList.remove('is-hidden');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TapBird = window.TapBird || {});
