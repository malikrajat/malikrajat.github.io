/*!
 * webgl-lab.js — the interactive layer around the WebGL renderer.
 *
 * This file owns everything that is NOT the renderer: the DOM, the pointer and
 * keyboard input, the control panel, the live performance readout, and the
 * lifecycle rules (when to render, when to stop, what to do when the GPU goes
 * away).
 *
 * The split matters. `webgl-scene.js` knows about matrices and shaders and
 * nothing about this page; this file knows about the page and drives the scene
 * through a small API. Either can be read, tested or replaced on its own.
 *
 * CONTROLS
 *   move the pointer     steer the cube through the space
 *   drag (mouse)         orbit the camera around the cube
 *   wheel                zoom in and out
 *   click                send the cube spinning
 *   arrows               nudge the cube, for keyboard users
 *   R                    reset the view
 *   space                pause and resume
 */
(function () {
  'use strict';

  var DRAG_SLOP = 4;              /* px of movement still counted as a click */
  var STATS_INTERVAL = 0.25;      /* seconds between panel updates */
  var READOUT_INTERVAL = 0.1;
  var NUDGE = 0.07;               /* keyboard step, in normalised device units */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* Selector-first, like the DOM APIs they wrap: $(selector, scope). */
  function $(selector, scope) {
    var host = scope || document;
    return (host && typeof host.querySelector === 'function') ? host.querySelector(selector) : null;
  }
  function $$(selector, scope) {
    var host = scope || document;
    if (!host || typeof host.querySelectorAll !== 'function') return [];
    return Array.prototype.slice.call(host.querySelectorAll(selector));
  }

  function formatNumber(n) {
    if (n == null) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  function fixed(n, places) {
    return (n < 0 ? '−' : '') + Math.abs(n).toFixed(places);
  }

  /* ========================================================================== *
   *  Controller
   * ========================================================================== */

  function Lab(root) {
    this.root = root;
    this.canvas = $('canvas', root);
    this.stage = root.querySelector('.lab-stage');

    this.scene = null;
    this.running = false;
    this.reduced = false;
    this.failed = false;
    this.paused = false;
    this.rafId = 0;
    this.lastFrameAt = 0;

    /* Pointer state. `dragging` only ever applies to a mouse: a finger steers
     * the cube directly, because that is what a finger on a canvas means. */
    this.pointer = { x: 0, y: 0, ndcX: 0, ndcY: 0, dragging: false, moved: 0, downAt: 0 };
    this.engaged = false;

    /* Measured performance. The buffer keeps a real average instead of showing
     * whatever the last frame happened to cost. */
    this.frames = [];
    this.fps = 0;
    this.frameMs = 0;
    this.statsTimer = 0;
    this.readoutTimer = 0;

    this.lastText = {};
    this.qualityKey = 'sharp';
  }

  /* ------------------------------------------------------------- lifecycle - */

  Lab.prototype.boot = function () {
    if (!this.canvas || !this.stage) return;

    this.reduced = !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var Scene = window.WebGLScene && window.WebGLScene.Scene;
    if (!Scene) {
      this.fail('The renderer failed to load, so the 3D scene is unavailable.');
      return;
    }

    this.scene = new Scene();
    var ok = this.scene.init(this.canvas, {
      preset: this.detectPreset(),
      reducedMotion: this.reduced
    });
    if (!ok) {
      this.fail(this.scene.reason || 'The 3D scene could not start on this device.');
      return;
    }
    this.qualityKey = this.scene.presetKey;

    var self = this;
    this.scene.onContextLost = function () { self.fail('The browser lost the graphics context.'); };

    this.bindInput();
    this.bindPanel();
    this.resize();

    /* The scene is decorative until it is on screen. Watching the section keeps
     * the phone in a pocket from rendering a cube nobody can see. */
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) self.play();
          else self.pauseLoop();
        }
      }, { rootMargin: '120px' });
      this.observer.observe(this.stage);
    } else {
      this.play();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.pauseLoop();
      else if (self.visible) self.play();
    });

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(function () { self.resize(); });
      this.resizeObserver.observe(this.stage);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }

    /* Draw one frame immediately so the stage is never empty, even if the
     * intersection observer is still deciding. */
    this.scene.setEngaged(false);
    this.scene.frame(0.016);
    this.setStatus('ready', 'Live · ' + this.qualityKey + ' quality');
    this.updateStats();
  };

  /* The cheapest sane first guess. The renderer also measures itself and scales
   * its own buffer down if the frame time says the guess was too optimistic, so
   * this only has to pick a sensible ceiling. */
  Lab.prototype.detectPreset = function () {
    var dpr = window.devicePixelRatio || 1;
    var cores = navigator.hardwareConcurrency || 4;
    if (cores <= 3) return 'light';
    if (dpr > 1.75 && cores >= 8) return 'sharp';
    return 'balanced';
  };

  Lab.prototype.play = function () {
    this.visible = true;
    if (this.running || this.failed) return;
    this.running = true;
    this.lastFrameAt = 0;
    var self = this;
    this.rafId = window.requestAnimationFrame(function (now) { self.step(now); });
  };

  Lab.prototype.pauseLoop = function () {
    this.visible = false;
    this.running = false;
    if (this.rafId) window.cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  };

  Lab.prototype.fail = function (message) {
    this.failed = true;
    this.pauseLoop();
    this.stage.classList.add('is-fallback');
    this.setStatus('unavailable', '3D unavailable');
    var note = $('[data-lab-note]', this.root);
    if (note) {
      note.textContent = message;
      note.hidden = false;
    }
  };

  /* ----------------------------------------------------------------- loop - */

  Lab.prototype.step = function (now) {
    var self = this;
    this.rafId = window.requestAnimationFrame(function (next) { self.step(next); });

    var dt = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : 1 / 60;
    this.lastFrameAt = now;
    /* A tab that was hidden, or a long GC pause, must not teleport the cube. */
    dt = clamp(dt, 1 / 240, 0.05);

    var frameStart = now;
    if (!this.paused) {
      this.scene.frame(dt);
    }

    var frameEnd = this.measure(frameStart);
    this.frames.push(frameEnd * 1000);
    if (this.frames.length > 40) this.frames.shift();

    /* Feed the measured interval back to the renderer, which drops its buffer
     * resolution when frames get expensive and walks it back up when they are
     * cheap again. */
    this.scene.adaptScale(this.frameMs || frameEnd * 1000, dt);

    this.statsTimer += dt;
    if (this.statsTimer >= STATS_INTERVAL) {
      this.statsTimer = 0;
      this.updateStats();
    }

    this.readoutTimer += dt;
    if (this.readoutTimer >= READOUT_INTERVAL) {
      this.readoutTimer = 0;
      this.updateReadout();
    }
  };

  /* performance.now() twice around the work gives the CPU cost of the frame.
   * It is not the GPU cost, but it is the number that explains a janky cursor,
   * and it is honest about what it measures. */
  Lab.prototype.measure = function (start) {
    var end = window.performance && window.performance.now ? window.performance.now() : Date.now();
    return end - start;
  };

  /* ---------------------------------------------------------------- input - */

  Lab.prototype.bindInput = function () {
    var self = this;
    var stage = this.stage;

    stage.addEventListener('pointermove', function (event) {
      var rect = stage.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;

      var moved = Math.hypot(x - self.pointer.x, y - self.pointer.y);
      self.pointer.x = x;
      self.pointer.y = y;
      self.pointer.moved += moved;

      /* A mouse drag turns the camera; a finger, or a mouse with no button
       * held, steers the cube. */
      var dragging = self.pointer.dragging && event.pointerType !== 'touch';
      if (dragging) {
        self.scene.orbitBy(event.movementX || 0, -(event.movementY || 0));
        return;
      }

      var ndcX = (x / rect.width) * 2 - 1;
      var ndcY = 1 - (y / rect.height) * 2;
      self.pointer.ndcX = ndcX;
      self.pointer.ndcY = ndcY;
      self.engage();
      self.scene.setPointer(ndcX, ndcY);
    }, { passive: true });

    stage.addEventListener('pointerleave', function () {
      self.pointer.dragging = false;
      self.release();
    });

    stage.addEventListener('pointerdown', function (event) {
      self.pointer.dragging = true;
      self.pointer.moved = 0;
      self.pointer.downAt = Date.now();
      if (event.pointerType !== 'touch') stage.classList.add('is-dragging');
      self.engage();
      if (stage.focus) stage.focus({ preventScroll: true });
    });

    var release = function (event) {
      var wasDragging = self.pointer.dragging;
      self.pointer.dragging = false;
      stage.classList.remove('is-dragging');

      /* A press that did not travel is a click: send the cube spinning. */
      var quick = Date.now() - self.pointer.downAt < 450;
      if (wasDragging && self.pointer.moved < DRAG_SLOP && quick && !self.paused) {
        self.scene.kick();
      }
      /* Touch has no hover state, so lifting a finger releases the cube. */
      if (event.pointerType === 'touch') self.release();
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    stage.addEventListener('wheel', function (event) {
      event.preventDefault();
      self.scene.zoomBy(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY);
    }, { passive: false });

    stage.addEventListener('keydown', function (event) {
      var handled = true;
      switch (event.key) {
        case 'ArrowLeft': self.scene.nudge(-NUDGE, 0); self.engage(); break;
        case 'ArrowRight': self.scene.nudge(NUDGE, 0); self.engage(); break;
        case 'ArrowUp': self.scene.nudge(0, NUDGE); self.engage(); break;
        case 'ArrowDown': self.scene.nudge(0, -NUDGE); self.engage(); break;
        case 'r':
        case 'R': self.scene.resetView(); self.engaged = false; break;
        case ' ':
        case 'Spacebar': self.togglePause(); break;
        default: handled = false;
      }
      if (handled) event.preventDefault();
    });
  };

  Lab.prototype.engage = function () {
    if (this.engaged) return;
    this.engaged = true;
    this.scene.setEngaged(true);
  };

  Lab.prototype.release = function () {
    this.engaged = false;
    this.scene.setEngaged(false);
    this.scene.pointerAway();
  };

  /* ---------------------------------------------------------------- panel - */

  Lab.prototype.bindPanel = function () {
    var self = this;

    $$('[data-toggle]', this.root).forEach(function (button) {
      var key = button.getAttribute('data-toggle');
      button.addEventListener('click', function () {
        var on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        self.scene.setOption(key, on);
      });
    });

    var pause = $('[data-pause]', this.root);
    if (pause) pause.addEventListener('click', function () { self.togglePause(); });

    var quality = $('[data-quality]', this.root);
    if (quality) {
      quality.value = this.qualityKey;
      quality.addEventListener('change', function () {
        if (self.scene.setPreset(quality.value)) {
          self.qualityKey = quality.value;
          self.setStatus(self.paused ? 'paused' : 'ready',
            (self.paused ? 'Paused · ' : 'Live · ') + self.qualityKey + ' quality');
          self.updateStats();
        }
      });
    }

    var reset = $('[data-reset]', this.root);
    if (reset) {
      reset.addEventListener('click', function () {
        self.scene.resetView();
        self.engaged = false;
        self.pointer.ndcX = 0;
        self.pointer.ndcY = 0;
      });
    }
  };

  Lab.prototype.togglePause = function () {
    if (this.failed) return;
    this.paused = !this.paused;
    var pause = $('[data-pause]', this.root);
    if (pause) pause.setAttribute('aria-pressed', this.paused ? 'true' : 'false');
    this.setStatus(this.paused ? 'paused' : 'ready',
      (this.paused ? 'Paused · ' : 'Live · ') + this.qualityKey + ' quality');
  };

  /* ------------------------------------------------------------ chrome I/O - */

  Lab.prototype.setStatus = function (state, message) {
    var node = $('.lab-status', this.root);
    if (node) node.setAttribute('data-state', state);
    this.text('[data-stat-state]', message);
  };

  /* Only touches the DOM when the string actually changed: with a readout that
   * updates ten times a second, that is the difference between a quiet console
   * and a style recalculation every frame.
   *
   * Every match is written, not just the first: the frame rate, draw calls and
   * triangles each appear both as a chip over the canvas and as a row in the
   * panel, and both have to stay in step. */
  Lab.prototype.text = function (selector, value) {
    var last = this.lastText[selector];
    if (last === value) return;
    this.lastText[selector] = value;
    var nodes = $$(selector, this.root);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  };

  Lab.prototype.resize = function () {
    if (!this.scene || !this.scene.ok) return;
    var stage = this.stage;
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    if (this.scene.resize(this.canvas, w, h)) this.updateStats();
  };

  Lab.prototype.updateStats = function () {
    var scene = this.scene;
    if (!scene || !scene.ok) return;
    var stats = scene.stats;

    /* The frame rate comes from the measured frame intervals, not from the CPU
     * cost, so it is the number the reader actually experiences. */
    if (this.frames.length > 4) {
      var total = 0;
      for (var i = 0; i < this.frames.length; i++) total += this.frames[i];
      this.frameMs = total / this.frames.length;
      this.fps = this.frameMs > 0 ? 1000 / this.frameMs : 0;
    } else {
      this.frameMs = 0;
      this.fps = 0;
    }

    if (this.fps) {
      this.text('[data-stat-fps]', Math.round(this.fps) + ' fps');
      /* Below 45 fps is worth flagging: the renderer will also start dropping
       * its resolution at that point. */
      var nodes = $$('[data-stat-fps]', this.root);
      var low = this.fps < 45;
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('is-low', low);
    }

    this.text('[data-stat-frametime]', this.frameMs ? this.frameMs.toFixed(1) + ' ms' : '—');
    this.text('[data-stat-drawcalls]', formatNumber(stats.drawCalls));
    this.text('[data-stat-triangles]', formatNumber(stats.triangles));
    this.text('[data-stat-res]', this.scene.width + ' × ' + this.scene.height);
    this.text('[data-stat-scale]', Math.round(this.scene.scale * 100) + '%');
    this.text('[data-stat-backend]', this.rendererName());
  };

  Lab.prototype.updateReadout = function () {
    var scene = this.scene;
    if (!scene || !scene.ok) return;
    var out = scene.readout();

    this.text('[data-stat-cubetris]', formatNumber(out.mesh.triangles));
    this.text('[data-stat-cubeverts]', formatNumber(out.mesh.vertices));
    this.text('[data-stat-material]', out.material);
    this.text('[data-stat-metal]', out.metal.toFixed(2));
    this.text('[data-stat-rough]', out.rough.toFixed(2));

    this.text('[data-readout-pos]',
      'x ' + fixed(out.position[0], 2)
      + ' · y ' + fixed(out.position[1], 2)
      + ' · z ' + fixed(out.position[2], 2));
    this.text('[data-readout-rot]',
      'yaw ' + fixed(out.rotation[1], 2) + '° · speed ' + fixed(out.speed, 2));

    var posNode = $('[data-readout-pos]', this.root);
    if (posNode) posNode.classList.toggle('is-idle', !out.engaged);
  };

  /* One line of text the reader can trust, rather than a driver string that is
   * either missing or forty characters long. */
  Lab.prototype.rendererName = function () {
    if (!this.sceneName) {
      var name = this.scene.api + ' · zero dependencies';
      var gl = this.scene.gl;
      var debug = gl && gl.getExtension && gl.getExtension('WEBGL_debug_renderer_info');
      if (debug) {
        var raw = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '';
        var clean = raw.replace(/^ANGLE\s*\(|\)$/g, '').split(',')[0].trim();
        if (clean) name = this.scene.api + ' · ' + clean.slice(0, 26);
      }
      this.sceneName = name;
    }
    return this.sceneName;
  };

  /* -------------------------------------------------------------- startup - */

  function start() {
    var root = document.getElementById('webgl-lab');
    if (!root) return;
    var lab = new Lab(root);
    lab.boot();
    /* Handy in the console, and a hook for an end-to-end test. */
    window.WEBGL_LAB = lab;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
