/* UI: everything that lives in the DOM (HUD, start / pause / game-over screens, buttons).
 * It never touches game rules; it just reports button presses through callbacks. */
(function (TB) {
  'use strict';

  var MESSAGES = [
    'Dosa got you this time!',
    'One more crispy round?',
    'Abhinav, fly past the dosa!',
    'So close! Give it another go.',
    'Every great engineer fails a few tests.',
    'The derivative of failure is progress!'
  ];

  function byId(id) { return document.getElementById(id); }

  function create(callbacks) {
    var ids = ['shell', 'stage', 'hudBest', 'hudScore', 'pauseBtn', 'soundBtn', 'startScreen', 'pauseScreen', 'overScreen',
               'startBest', 'startBtn', 'resumeBtn', 'pauseRestartBtn', 'restartBtn', 'overScore', 'overBest',
               'overMessage', 'newBest', 'flash'];
    var el = {};
    for (var i = 0; i < ids.length; i++) {
      el[ids[i]] = byId(ids[i]);
      if (!el[ids[i]]) throw new Error('Missing element #' + ids[i]);
    }

    // Preview image: fall back to the emoji bird if friend.png is missing.
    var face = byId('previewFace');
    if (face) {
      face.addEventListener('error', function () { face.parentNode.classList.add('no-img'); });
      if (face.complete && face.naturalWidth === 0) face.parentNode.classList.add('no-img');
    }

    function onButton(btn, handler) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.blur();              // so Space afterwards flaps instead of "clicking" this button again
        handler();
      });
      // Keep button presses from ever being treated as a tap on the playfield.
      btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    }

    onButton(el.startBtn, callbacks.onStart);
    onButton(el.restartBtn, callbacks.onRestart);
    onButton(el.pauseRestartBtn, callbacks.onRestart);
    onButton(el.pauseBtn, callbacks.onPause);
    onButton(el.resumeBtn, callbacks.onResume);
    onButton(el.soundBtn, callbacks.onToggleSound);

    function show(node, visible) { node.classList.toggle('is-hidden', !visible); }

    var api = {
      setState: function (state) {
        el.shell.setAttribute('data-state', state);
        show(el.startScreen, state === 'ready');
        show(el.pauseScreen, state === 'paused');
        show(el.overScreen, state === 'over');
      },
      setScore: function (score, animate) {
        el.hudScore.textContent = String(score);
        if (animate) {
          el.hudScore.classList.remove('pop');
          void el.hudScore.offsetWidth;        // restart the CSS animation
          el.hudScore.classList.add('pop');
        }
      },
      setBest: function (best) {
        el.hudBest.textContent = String(best);
        el.startBest.textContent = String(best);
      },
      setMuted: function (muted) {
        el.soundBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        el.soundBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
      },
      showGameOver: function (score, best, isNewBest) {
        el.overScore.textContent = String(score);
        el.overBest.textContent = String(best);
        el.overMessage.textContent = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        show(el.newBest, isNewBest);
        api.setState('over');
      },
      shake: function () {
        el.stage.classList.remove('shake');
        el.flash.classList.remove('go');
        void el.stage.offsetWidth;
        el.stage.classList.add('shake');
        el.flash.classList.add('go');
      }
    };
    return api;
  }

  TB.UI = { create: create };
})(window.TapBird = window.TapBird || {});
