/* ------------------------------------------------------------------ *
 * Flowforest hero — animated contours.
 *
 * Canvas contour field behind the hero, adapted from
 * r&d/hero-animated.html. The values below are the ones chosen in the
 * prototype control panel; there is no panel here, so they are fixed
 * constants. The pointer warps the field and leaves a decaying wake.
 *
 * Hero overlay text, header, and layout live in the Astro layout and page;
 * this script only paints the background canvas.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const REF = 900;             // reference size, matches the generator
  const MAX_SAMPLES = 70000;   // hard ceiling on stipple samples per rebuild
  const BUCKETS = 4;           // dot radius buckets -> 4 fill() calls per frame

  // --- panel settings (from the r&d prototype) -------------------------
  const P = {
    seed: 7,
    curves: 3,
    freq: 0.8,
    amp: 116,
    drift: 0.65,
    angle: 90,
    sigma: 34,
    dens: 70000,
    dot: 0.7,
    gam: 1.0,
    bg: '#ffffff',
    dotColor: '#141414',
    lineColor: '#0c0c0c',
    oneside: true,
    stroke: true,
    instr: false,
    speed: 0.10,
    strength: 6,
    radius: 60,
    swirl: 0.00,
    ripple: 2.00
  };

  const host = document.querySelector('.hero');
  if (!host) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-contours';
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, host.firstChild);

  const ctx = canvas.getContext('2d', { alpha: false });

  const view = {
    W: 0, H: 0, unit: 1, fieldW: 0, fieldH: 0,
    cosA: 1, sinA: 0, w2: 0, h2: 0, fw2: 0, fh2: 0
  };
  let lines = [];
  let groups = [];
  let dotRInv = 1;
  const buf = [];
  const counts = new Int32Array(BUCKETS);
  let T = 0;                  // animation clock (seconds, scaled by P.speed)
  let tw = 0;                 // wall clock (seconds, always runs)
  let paused = reduceMotion;
  let lastTs = 0;
  let running = false;

  const pointer = { active: false, fx: 0, fy: 0, sx: 0, sy: 0, lastFx: 0, lastFy: 0, lastT: 0, tRipple: -99, rippleAmp: 0 };
  const disp = { x: 0, y: 0, f: 0 };

  /* ------------- deterministic PRNG (mulberry32) ------------- */
  let rngState = 1;
  function randomSeed(s) { rngState = (s | 0) || 1; }
  function random(a, b) {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    if (a === undefined) return v;
    if (b === undefined) return v * a;
    return a + v * (b - a);
  }

  /* ---------------------- field geometry ---------------------- */
  function updateField() {
    const th = (P.angle * Math.PI) / 180;
    view.cosA = Math.cos(th);
    view.sinA = Math.sin(th);
    view.fieldW = Math.abs(view.W * view.cosA) + Math.abs(view.H * view.sinA);
    view.fieldH = Math.abs(view.W * view.sinA) + Math.abs(view.H * view.cosA);
    view.w2 = view.W / 2; view.h2 = view.H / 2;
    view.fw2 = view.fieldW / 2; view.fh2 = view.fieldH / 2;
  }
  const toFieldX = (px, py) => (px - view.w2) * view.cosA + (py - view.h2) * view.sinA + view.fw2;
  const toFieldY = (px, py) => -(px - view.w2) * view.sinA + (py - view.h2) * view.cosA + view.fh2;
  const toCanvasX = (fx, fy) => (fx - view.fw2) * view.cosA - (fy - view.fh2) * view.sinA + view.w2;
  const toCanvasY = (fx, fy) => (fx - view.fw2) * view.sinA + (fy - view.fh2) * view.cosA + view.h2;

  /* --------------------------- curves ------------------------- */
  function buildLines() {
    randomSeed(P.seed);
    lines = [];
    const unit = view.unit;
    const margin = 120 * unit, span = view.fieldW - margin * 1.2;
    for (let i = 0; i < P.curves; i++) {
      lines.push({
        baseX: margin + (span * (i + 0.5)) / P.curves + random(-30, 30) * unit,
        amp: P.amp * unit * (0.7 + random() * 0.6),
        freq: P.freq * (0.85 + random() * 0.3),
        phase: random(TAU),
        drift: random(-P.drift, P.drift),
        side: P.oneside ? (random() < 0.5 ? -1 : 1) : 0,
        rate: (0.45 + random() * 0.9) * (random() < 0.5 ? -1 : 1),
        bPhase: random(TAU),
        bRate: 0.12 + random() * 0.18
      });
    }
  }
  const curveX = (L, y, t) =>
    L.baseX + L.amp * (1 + 0.06 * Math.sin(t * L.bRate + L.bPhase)) *
    Math.sin(((L.freq + L.drift) * TAU / view.fieldH) * y + L.phase + L.rate * t);
  const curveSlope = (L, y) =>
    L.amp * Math.cos(((L.freq + L.drift) * TAU / view.fieldH) * y + L.phase) *
    (L.freq + L.drift) * (TAU / view.fieldH);

  /* -------------------------- stipple ------------------------- */
  function buildDots() {
    const { W, H, unit } = view;
    const wanted = Math.round(P.dens * (W * H) / (REF * REF));
    const samples = Math.min(MAX_SAMPLES, wanted);

    randomSeed(P.seed);
    const acc = lines.map(() => []);
    for (let n = 0; n < samples; n++) {
      const px = random(W), py = random(H);
      const fx = toFieldX(px, py), fy = toFieldY(px, py);
      let best = 1e9, bestSigned = 0, bestIdx = -1, bestSide = 0;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const dxh = fx - curveX(L, fy, 0);
        const m = curveSlope(L, fy);
        const perp = Math.abs(dxh) / Math.sqrt(1 + m * m);
        if (perp < best) { best = perp; bestSigned = dxh; bestIdx = i; bestSide = L.side; }
      }
      if (bestSide !== 0 && bestSigned * bestSide <= 0) continue;   // one-sided rejection
      let prob = Math.exp(-best / (P.sigma * unit));
      prob = Math.pow(prob, P.gam);
      if (random() < prob) {
        const cx0 = curveX(lines[bestIdx], fy, 0);
        acc[bestIdx].push(fx - cx0, fy, P.dot * unit * (0.6 + random() * 0.8));
      }
    }

    groups = [];
    let total = 0;
    for (let i = 0; i < lines.length; i++) {
      const a = acc[i], n = a.length / 3;
      if (!n) { groups.push(null); continue; }
      const off = new Float32Array(n), fy = new Float32Array(n), size = new Float32Array(n);
      for (let k = 0; k < n; k++) { off[k] = a[k * 3]; fy[k] = a[k * 3 + 1]; size[k] = a[k * 3 + 2]; }
      groups.push({ off, fy, size, n });
      total += n;
    }

    dotRInv = 1 / Math.max(0.35, P.dot * unit * 1.4 * 0.5 * 1.7);
    for (let b = 0; b < BUCKETS; b++) buf[b] = new Float32Array(Math.max(1, total) * 3);
  }

  /* ------------------------ warp field ------------------------ */
  function fieldDisp(fx, fy) {
    disp.x = 0; disp.y = 0; disp.f = 0;
    if (!pointer.active) return disp;

    const R = P.radius;
    const dx = fx - pointer.sx, dy = fy - pointer.sy;
    const d2 = dx * dx + dy * dy;

    let age = 0, ripple = 0, reach = R * 3;
    if (pointer.rippleAmp > 0.5) {
      age = tw - pointer.tRipple;
      ripple = pointer.rippleAmp * Math.exp(-age * 1.6);
      if (ripple > 0.5) reach = Math.max(reach, age * 620 + R * 1.4);
      else ripple = 0;
    }
    if (d2 > reach * reach) return disp;

    const d = Math.sqrt(d2) + 1e-6;
    const f = Math.exp(-d2 / (R * R));
    disp.f = f;

    const ux = dx / d, uy = dy / d;
    const c = Math.cos(P.swirl), s = Math.sin(P.swirl);
    const wx = ux * c - uy * s, wy = ux * s + uy * c;

    const mag = P.strength * f;
    disp.x = mag * wx;
    disp.y = mag * wy * 0.75;

    if (ripple > 0) {
      const band = Math.abs(d - age * 620);
      const w = R * 0.4;
      if (band < w * 3) {
        const rf = Math.exp(-(band * band) / (2 * w * w)) * ripple;
        disp.x += rf * wx;
        disp.y += rf * wy * 0.75;
      }
    }
    return disp;
  }

  /* -------------------------- render -------------------------- */
  function render() {
    const { W, H, cosA, sinA, fw2, fh2, w2, h2 } = view;

    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    counts.fill(0);
    for (let li = 0; li < lines.length; li++) {
      const g = groups[li];
      if (!g) continue;
      const L = lines[li];
      const offA = g.off, fyA = g.fy, szA = g.size, n = g.n;
      const k = ((L.freq + L.drift) * TAU) / view.fieldH;
      const amp = L.amp * (1 + 0.06 * Math.sin(T * L.bRate + L.bPhase));
      const ph = L.phase + L.rate * T;
      const baseX = L.baseX;

      for (let i = 0; i < n; i++) {
        const fy = fyA[i];
        const cx = baseX + amp * Math.sin(k * fy + ph) + offA[i];
        const d = fieldDisp(cx, fy);
        const fx2 = cx + d.x, fy2 = fy + d.y;
        const px = (fx2 - fw2) * cosA - (fy2 - fh2) * sinA + w2;
        if (px < -2 || px > W + 2) continue;
        const py = (fx2 - fw2) * sinA + (fy2 - fh2) * cosA + h2;
        if (py < -2 || py > H + 2) continue;

        const r = szA[i] * 0.5 * (1 + 0.7 * d.f);
        let b = (r * dotRInv * BUCKETS) | 0;
        if (b < 0) b = 0; else if (b >= BUCKETS) b = BUCKETS - 1;
        const arr = buf[b], c = counts[b] * 3;
        arr[c] = px; arr[c + 1] = py; arr[c + 2] = r;
        counts[b]++;
      }
    }

    ctx.fillStyle = P.dotColor;
    for (let b = 0; b < BUCKETS; b++) {
      const arr = buf[b], cnt = counts[b];
      if (!cnt) continue;
      ctx.beginPath();
      for (let i = 0; i < cnt; i++) {
        const c = i * 3, x = arr[c], y = arr[c + 1], r = arr[c + 2];
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }

    if (P.stroke) {
      ctx.strokeStyle = P.lineColor;
      ctx.lineWidth = Math.max(0.6, 1.1 * view.unit);
      ctx.lineJoin = 'round';
      const y0 = -4 * view.unit, y1 = view.fieldH + 4 * view.unit;
      const steps = Math.ceil((y1 - y0) / 2);
      for (const L of lines) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const y = y0 + (i * (y1 - y0)) / steps;
          const cx = curveX(L, y, T);
          const d = fieldDisp(cx, y);
          const px = toCanvasX(cx + d.x, y + d.y);
          const py = toCanvasY(cx + d.x, y + d.y);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }

  /* --------------------------- loop --------------------------- */
  function tick(ts) {
    if (!running) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
    lastTs = ts;
    if (!paused) T += dt * P.speed;
    tw += dt;

    const k = 1 - Math.exp(-dt * 14);
    pointer.sx += (pointer.fx - pointer.sx) * k;
    pointer.sy += (pointer.fy - pointer.sy) * k;

    render();
    requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = 0;
    requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
  }

  /* --------------------------- build -------------------------- */
  function regen() {
    updateField();
    buildLines();
    buildDots();
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;   // layout not ready yet
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    view.W = Math.max(1, Math.round(rect.width));
    view.H = Math.max(1, Math.round(rect.height));
    // hero.png is 16:9 and shown with background-size: cover — match that scale
    view.unit = Math.max(view.W / (REF * 16 / 9), view.H / REF);
    canvas.width = Math.round(view.W * dpr);
    canvas.height = Math.round(view.H * dpr);
    canvas.style.width = view.W + 'px';
    canvas.style.height = view.H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    regen();

    // the canvas measures the hero box, so a resize changes the field
    if (running) start();
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  /* -------------------------- pointer ------------------------- */
  function onMove(clientX, clientY) {
    const rect = host.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) {
      pointer.active = false;
      return;
    }
    const fx = toFieldX(px, py);
    const fy = toFieldY(px, py);
    const now = performance.now() / 1000;
    if (!pointer.active) {
      pointer.active = true;
      pointer.sx = fx; pointer.sy = fy;
      pointer.lastFx = fx; pointer.lastFy = fy; pointer.lastT = now;
    }
    pointer.fx = fx; pointer.fy = fy;

    const dt = Math.max(1 / 240, now - pointer.lastT);
    const v = Math.hypot(fx - pointer.lastFx, fy - pointer.lastFy) / dt;   // field px/s
    pointer.lastFx = fx; pointer.lastFy = fy; pointer.lastT = now;

    const norm = Math.min(1, v / 1600);
    if (norm > 0.04) {
      pointer.tRipple = tw;
      pointer.rippleAmp = P.strength * P.ripple * norm;
    }
  }
  window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('blur', () => { pointer.active = false; });

  /* --------------------------- life --------------------------- */
  // only animate while the hero is on screen, so the rest of the page stays cheap
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start(); else stop();
      }
    }, { threshold: 0 }).observe(host);
  } else {
    start();
  }

  start();   // IntersectionObserver fires on the next frame; start now for first paint

  // the stylesheet and fonts settle after this script runs, so measure again
  requestAnimationFrame(() => resize());
  window.addEventListener('load', () => resize());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => resize());

  // expose a tiny hook so a future control surface can regenerate the field
  window.__flowforestHero = {
    settings: P,
    regenerate: () => resize(),
    pause: () => { paused = true; },
    play: () => { paused = false; }
  };
})();
