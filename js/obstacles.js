/* Obstacles: South Indian tiffin-themed dosa pillars drawn in Canvas. */
(function (TB) {
  'use strict';

  /* ======= SOUTH INDIAN TIFFIN THEME ======= */
  var SUBJECTS = {
    IDLY: { name: 'Soft Idly', color: '#fff4d6', dark: '#d8b98a', topics: ['Steamy Idly', 'Mini Idly', 'Ghee Podi Idly'] },
    MASALA: { name: 'Masala Dosa', color: '#d78b28', dark: '#8d4d17', topics: ['Masala Dosa', 'Crispy Dosa', 'Ghee Roast'] },
    PLAIN: { name: 'Plain Dosa', color: '#e7b45c', dark: '#a76521', topics: ['Plain Dosa', 'Paper Dosa', 'Set Dosa'] },
    VADA: { name: 'Medu Vada', color: '#b86a27', dark: '#713c16', topics: ['Medu Vada', 'Sambar Vada', 'Crispy Vada'] },
    CHUTNEY: { name: 'Chutney', color: '#4d8b45', dark: '#28552b', topics: ['Coconut Chutney', 'Tomato Chutney', 'Mint Chutney'] }
  };
  /* ========================================= */

  var SUBJECT_CODES = Object.keys(SUBJECTS);
  var FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
  var IMAGE_FILES = []; // Tiffin obstacles are drawn in-game for a consistent style.

  var measureCtx = null;
  function getMeasureCtx() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    return measureCtx;
  }

  function randomInt(n) { return Math.floor(Math.random() * n); }

  /* Wrap a topic into at most 3 lines, shrinking the font until every word fits. */
  function layoutLabel(topic, maxWidth) {
    var ctx = getMeasureCtx();
    var words = topic.split(' ');
    for (var size = 13; size >= 8; size--) {
      ctx.font = '700 ' + size + 'px ' + FONT;
      var lines = [], line = '', fits = true;
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width <= maxWidth) { line = test; }
        else {
          if (!line) { fits = false; break; }        // a single word is too wide at this size
          lines.push(line); line = words[i];
          if (ctx.measureText(line).width > maxWidth) { fits = false; break; }
        }
      }
      if (!fits) continue;
      lines.push(line);
      if (lines.length <= 3) return { lines: lines, size: size };
    }
    ctx.font = '700 8px ' + FONT;   // last resort: tiny text, squeezed to width when drawn
    return { lines: words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [topic], size: 8 };
  }

  /* Optional sprite helper for custom vertical food assets. */
  function makeSprite(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement('canvas');
    var cx;
    if (w > h) {            // horizontal artwork (e.g. a ruler) -> rotate 90 degrees
      c.width = h; c.height = w;
      cx = c.getContext('2d');
      cx.translate(h / 2, w / 2);
      cx.rotate(Math.PI / 2);
      cx.drawImage(img, -w / 2, -h / 2);
    } else {                // already vertical (or square)
      c.width = w; c.height = h;
      cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
    }
    return { canvas: c, aspect: c.height / c.width };
  }

  function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
    var nx = cx < rx ? rx : (cx > rx + rw ? rx + rw : cx);
    var ny = cy < ry ? ry : (cy > ry + rh ? ry + rh : cy);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function ObstacleManager(config) {
    this.cfg = config;
    this.list = [];
    this.sprites = [];
    this.recentTopics = [];
    this.lastSubject = '';
    this.lastGapY = config.world.height * 0.4;
    this._loadSprites();
  }

  ObstacleManager.prototype._loadSprites = function () {
    var self = this;
    IMAGE_FILES.forEach(function (src) {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          try { self.sprites.push(makeSprite(img)); } catch (e) { /* unusable image: keep fallback */ }
        }
      };
      img.onerror = function () { /* missing image: built-in books are used */ };
      img.src = src;
    });
  };

  ObstacleManager.prototype.reset = function () {
    this.list.length = 0;
    this.recentTopics.length = 0;
    this.lastSubject = '';
    this.lastGapY = this.cfg.world.height * 0.4;
  };

  ObstacleManager.prototype._pickTopic = function () {
    var code, topic, tries = 0;
    do {
      code = SUBJECT_CODES[randomInt(SUBJECT_CODES.length)];
      var topics = SUBJECTS[code].topics;
      topic = topics[randomInt(topics.length)];
      tries++;
    } while (tries < 30 && (code === this.lastSubject || this.recentTopics.indexOf(topic) !== -1));
    this.lastSubject = code;
    this.recentTopics.push(topic);
    if (this.recentTopics.length > 6) this.recentTopics.shift();
    return { code: code, topic: topic };
  };

  ObstacleManager.prototype.spawn = function (gap) {
    var world = this.cfg.world, ocfg = this.cfg.obstacles;
    var groundY = world.height - world.groundHeight;
    var minSeg = ocfg.minSegment;
    var lo = minSeg + gap / 2, hi = groundY - minSeg - gap / 2;
    // Never ask for a vertical jump the player cannot make between two pillars.
    var from = Math.max(lo, this.lastGapY - ocfg.maxGapShift);
    var to = Math.min(hi, this.lastGapY + ocfg.maxGapShift);
    var gapY = from + Math.random() * (to - from);
    this.lastGapY = gapY;

    var pick = this._pickTopic();
    var w = ocfg.width;
    this.list.push({
      x: world.width + 60, w: w, gapY: gapY, gap: gap,
      subject: pick.code, topic: pick.topic,
      label: layoutLabel(pick.topic, w - 20),
      sprite: this.sprites.length ? this.sprites[randomInt(this.sprites.length)] : null,
      passed: false
    });
  };

  /* Advance obstacles; spawn new ones at a fixed distance apart. */
  ObstacleManager.prototype.update = function (dt, speed, gap) {
    var ocfg = this.cfg.obstacles, worldW = this.cfg.world.width;
    var list = this.list, i;
    for (i = 0; i < list.length; i++) list[i].x -= speed * dt;
    for (i = list.length - 1; i >= 0; i--) if (list[i].x + list[i].w < -20) list.splice(i, 1);
    var last = list.length ? list[list.length - 1] : null;
    if (!last || last.x <= worldW + 60 - ocfg.spacing) this.spawn(gap);
  };

  /* Returns how many obstacles were newly passed (each is counted once). */
  ObstacleManager.prototype.countPassed = function (playerX) {
    var n = 0;
    for (var i = 0; i < this.list.length; i++) {
      var o = this.list[i];
      if (!o.passed && o.x + o.w < playerX) { o.passed = true; n++; }
    }
    return n;
  };

  ObstacleManager.prototype.collides = function (cx, cy, r) {
    var groundY = this.cfg.world.height - this.cfg.world.groundHeight;
    for (var i = 0; i < this.list.length; i++) {
      var o = this.list[i];
      if (cx + r < o.x || cx - r > o.x + o.w) continue;
      if (circleHitsRect(cx, cy, r, o.x, -2000, o.w, o.gapY - o.gap / 2 + 2000)) return true;
      if (circleHitsRect(cx, cy, r, o.x, o.gapY + o.gap / 2, o.w, groundY - (o.gapY + o.gap / 2))) return true;
    }
    return false;
  };

  /* ---------------- Drawing ---------------- */

  ObstacleManager.prototype.draw = function (ctx) {
    var groundY = this.cfg.world.height - this.cfg.world.groundHeight;
    for (var i = 0; i < this.list.length; i++) {
      var o = this.list[i];
      var gapTop = o.gapY - o.gap / 2, gapBottom = o.gapY + o.gap / 2;
      this._drawSegment(ctx, o, 0, gapTop, true);
      this._drawSegment(ctx, o, gapBottom, groundY, false);
      this._drawLabel(ctx, o, 0, gapTop);
      this._drawLabel(ctx, o, gapBottom, groundY);
    }
  };

  ObstacleManager.prototype._drawSegment = function (ctx, o, y0, y1, isTop) {
    var h = y1 - y0;
    if (h <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x, y0, o.w, h); ctx.clip();
    this._drawDosaPillar(ctx, o, y0, y1, isTop);
    ctx.restore();
  };

  /* Sprite tiles keep their aspect ratio; they start flush at the gap edge and run outward. */
  ObstacleManager.prototype._drawSpriteTiles = function (ctx, o, y0, y1, isTop) {
    var tileH = o.w * o.sprite.aspect, y;
    if (isTop) { for (y = y1 - tileH; y > y0 - tileH; y -= tileH) ctx.drawImage(o.sprite.canvas, o.x, y, o.w, tileH); }
    else { for (y = y0; y < y1; y += tileH) ctx.drawImage(o.sprite.canvas, o.x, y, o.w, tileH); }
  };

  /* Cartoon dosa pillars: golden folded dosas with crisp toasted edges. */
  ObstacleManager.prototype._drawDosaPillar = function (ctx, o, y0, y1, isTop) {
    var h = y1 - y0;
    if (h <= 0) return;
    var x = o.x, w = o.w;
    ctx.fillStyle = 'rgba(80,42,12,.18)'; ctx.fillRect(x + 3, y0, w - 6, h);
    var grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#b96b20'); grad.addColorStop(.18, '#e8a83d');
    grad.addColorStop(.52, '#ffd779'); grad.addColorStop(.82, '#e8a23a'); grad.addColorStop(1, '#a95b18');
    ctx.fillStyle = grad; ctx.fillRect(x + 2, y0, w - 4, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y0, w - 6, h); ctx.clip();
    for (var yy = Math.floor(y0 / 23) * 23 + 8; yy < y1; yy += 23) {
      for (var xx = x + 10; xx < x + w - 7; xx += 17) {
        var seed = Math.abs(Math.sin(xx * 12.31 + yy * 4.7 + o.subject.length * 9));
        ctx.fillStyle = seed > .5 ? 'rgba(141,76,22,.35)' : 'rgba(255,239,176,.55)';
        ctx.beginPath(); ctx.ellipse(xx + seed * 4, yy, 2 + seed * 2, 1.5 + seed, seed, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    var edgeY = isTop ? y1 - 12 : y0;
    ctx.fillStyle = '#8e4816'; ctx.fillRect(x - 3, edgeY, w + 6, 13);
    ctx.fillStyle = '#ffe39a'; ctx.fillRect(x - 2, edgeY + 2, w + 4, 4);
    ctx.strokeStyle = '#9b551b'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y0, w - 4, h);
  };

  ObstacleManager.prototype._drawLabel = function (ctx, o, y0, y1) {
    var L = o.label, subj = SUBJECTS[o.subject];
    var lineH = L.size + 3;
    var panelW = o.w - 8;
    var panelH = 36 + L.lines.length * lineH;
    if (y1 - y0 < panelH + 16) return;                 // segment too short: the other one carries the label
    var px = o.x + 4, py = (y0 + y1) / 2 - panelH / 2;

    ctx.save();
    ctx.fillStyle = subj.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = subj.dark;                         // darker header strip behind the code
    ctx.beginPath(); ctx.roundRect(px + 3, py + 3, panelW - 6, 25, 7); ctx.fill();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.font = '900 21px ' + FONT;
    ctx.fillText(o.subject, px + panelW / 2, py + 16);
    ctx.font = '700 ' + L.size + 'px ' + FONT;
    for (var i = 0; i < L.lines.length; i++) {
      ctx.fillText(L.lines[i], px + panelW / 2, py + 32 + (i + 0.5) * lineH, panelW - 8);
    }
    ctx.restore();
  };

  TB.SUBJECTS = SUBJECTS;
  TB.ObstacleManager = ObstacleManager;
})(window.TapBird = window.TapBird || {});
