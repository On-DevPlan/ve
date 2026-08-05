// shared/canvas-engine.ts —— Mœbius sky 2D ink engine.
//
// Port of the ink engine from apps/showcase/temp/moebius-login (11).html:
// volumetric cumulus clouds (cel-shaded), red-crowned cranes, the Mœbius
// line-drawn sea, and a lone traveler. All ink is hand-drawn in one
// deterministic "Mœbius" style, no dependencies.
//
// startCanvas(canvas) takes ownership of the canvas, starts the rAF loop
// (or renders a single static frame under `prefers-reduced-motion: reduce`),
// and returns { destroy() } for teardown.
//
// Environments without a 2d context (jsdom, SSR) return a no-op engine so the
// host never has to special-case canvas support.

interface Pt {
  x: number;
  y: number;
}
type Runs = Pt[][];

interface Puff {
  x: number;
  y: number;
  r: number;
}

interface CloudSprite {
  cv: HTMLCanvasElement;
  ref: number;
  dpr: number;
  w: number;
  h: number;
}

interface CloudShape {
  puffs: Puff[];
  shadow: Puff[];
  width: number;
  bbox: { x: number; y: number; w: number; h: number };
  outline: Runs;
  terminator: Runs;
  _spr?: CloudSprite;
}

interface Cloud {
  shape: CloudShape;
  x: number;
  y: number;
  d: number;
  size: number;
  a: number;
  drift: number;
  bob: number;
  bobSp: number;
  born: number;
  target: number;
}

interface Bird {
  x: number;
  y: number;
  d: number;
  s: number;
  sp: number;
  flap: number;
  ph: number;
  bob: number;
  bobSp: number;
  dir: number;
}

interface Ripple {
  x: number;
  y: number;
  d: number;
  t: number;
}

interface Streak {
  x: number;
  y: number;
  len: number;
  sp: number;
  life: number;
  max: number;
}

interface BandPattern {
  total: number;
  h: (x: number) => number;
  amp: number;
  baseR: number;
  curls: Array<{ x: number; s: number; dir: number }>;
  dashes: Array<{ x: number; y: number; len: number; a: number }>;
  _tkey?: string;
  _tile?: { cv: HTMLCanvasElement; ht: number; hb: number; w: number; h: number; fill: number };
}

export function startCanvas(canvas: HTMLCanvasElement): { destroy(): void } {
  const ctx0 = canvas.getContext('2d');
  if (!ctx0) {
    // jsdom / SSR:no canvas support → no-op engine
    return { destroy() {} };
  }
  let ctx: CanvasRenderingContext2D = ctx0;

  const INK = '44,44,43';
  let W = 0;
  let H = 0;
  let DPR = 1;
  let horizon = 0;
  let S = 52; // px per world unit at depth 1, zoom 1
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- deterministic noise ---------- */
  function prng(seed: number): () => number {
    let s = (seed * 2654435761) >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------- ink helpers ---------- */
  function ink(alpha: number, width: number): void {
    ctx.strokeStyle = `rgba(${INK},${alpha})`;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  /* =========================================================
     Volumetric cumulus, cel-shaded(三渲二)。
     A cloud is a cluster of spheres. We boolean-union their
     silhouettes to get one clean contour(no cartoon scallops),
     fill it flat white, drop ONE hard-edged shadow tone from a
     fixed key light, and ink only the visible outline + the
     terminator — exactly how a toon-shaded 3D render reads.
     ========================================================= */
  const LIGHT = { x: -0.34, y: -0.4 }; // key light direction(upper-left)

  /* boolean union of circles -> list of visible contour polylines */
  function unionArcs(cs: Puff[], jitterSeed: number): Runs {
    const out: Runs = [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const steps = Math.max(40, Math.round(38 + c.r * 46));
      let run: Pt[] | null = null;
      for (let k = 0; k <= steps; k++) {
        const a = (-Math.PI * 2 * k) / steps; // ccw so the fill winds cleanly
        const px = c.x + Math.cos(a) * c.r;
        const py = c.y + Math.sin(a) * c.r;
        let hidden = false;
        for (let j = 0; j < cs.length; j++) {
          if (j === i) continue;
          const o = cs[j];
          const dx = px - o.x;
          const dy = py - o.y;
          if (dx * dx + dy * dy < o.r * o.r * 0.9985) {
            hidden = true;
            break;
          }
        }
        if (hidden) {
          if (run && run.length > 1) out.push(run);
          run = null;
          continue;
        }
        /* tiny hand-drawn wobble baked in once, so contours never look vector-perfect */
        const w1 =
          Math.sin(k * 0.9 + i * 3.1 + jitterSeed) * 0.012 +
          Math.sin(k * 2.7 + jitterSeed * 1.7) * 0.007;
        if (!run) run = [];
        run.push({ x: px + Math.cos(a) * w1, y: py + Math.sin(a) * w1 });
      }
      if (run && run.length > 1) out.push(run);
    }
    return out;
  }

  function buildCloud(seed: number): CloudShape {
    const r = prng(seed);
    const n = 5 + Math.floor(r() * 4); // 5..8 spheres
    const puffs: Puff[] = [];
    let span = 0;

    /* main row:a bell-shaped chain sitting on a common base line */
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const bell = 0.4 + 0.6 * Math.sin(Math.PI * t);
      const rad = bell * (0.62 + 0.34 * r());
      puffs.push({ x: 0, y: -rad * (0.3 + 0.26 * r()), r: rad });
      span += rad * 1.32;
    }
    let x = -span / 2 + puffs[0].r * 0.2;
    for (let i = 0; i < n; i++) {
      puffs[i].x = x + puffs[i].r;
      x += puffs[i].r * 1.3;
    }
    const width = x + puffs[n - 1].r - -span / 2;

    /* crown:1-2 smaller spheres stacked on the tallest, cauliflower style */
    let big = 0;
    let bi = 0;
    for (let i = 0; i < n; i++) if (puffs[i].r > big) { big = puffs[i].r; bi = i; }
    const crowns = 1 + Math.floor(r() * 2);
    for (let i = 0; i < crowns; i++) {
      const cr = big * (0.44 + 0.24 * r());
      puffs.push({
        x: puffs[bi].x + (r() - 0.5) * big * 1.1,
        y: puffs[bi].y - big * (0.52 + 0.22 * r()),
        r: cr,
      });
    }

    /* shadow volume = the same cluster pushed away from the light */
    const off = 0.3;
    const shadow: Puff[] = [];
    for (let i = 0; i < puffs.length; i++) {
      shadow.push({
        x: puffs[i].x + LIGHT.x * off * puffs[i].r * 1.5,
        y: puffs[i].y + LIGHT.y * off * puffs[i].r * 1.5,
        r: puffs[i].r * 0.985,
      });
    }

    /* bounding box in world units — needed to bake the cloud into a sprite */
    let minX = 1e9;
    let minY = 1e9;
    let maxX = -1e9;
    let maxY = -1e9;
    for (let i = 0; i < puffs.length; i++) {
      if (puffs[i].x - puffs[i].r < minX) minX = puffs[i].x - puffs[i].r;
      if (puffs[i].x + puffs[i].r > maxX) maxX = puffs[i].x + puffs[i].r;
      if (puffs[i].y - puffs[i].r < minY) minY = puffs[i].y - puffs[i].r;
      if (puffs[i].y + puffs[i].r > maxY) maxY = puffs[i].y + puffs[i].r;
    }

    return {
      puffs,
      shadow,
      width,
      bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      outline: unionArcs(puffs, seed),
      terminator: unionArcs(shadow, seed * 1.7 + 4),
    };
  }

  function puffPath(cs: Puff[]): void {
    for (let i = 0; i < cs.length; i++) {
      ctx.moveTo(cs[i].x + cs[i].r, cs[i].y);
      ctx.arc(cs[i].x, cs[i].y, cs[i].r, 0, Math.PI * 2);
    }
  }

  function strokeRuns(runs: Runs, alpha: number, lw: number): void {
    ink(alpha, lw);
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      ctx.beginPath();
      ctx.moveTo(run[0].x, run[0].y);
      for (let k = 1; k < run.length; k++) ctx.lineTo(run[k].x, run[k].y);
      ctx.stroke();
    }
  }

  /* paints one cloud in WORLD units into whatever ctx currently points at.
     Called once per sprite bake — never per frame. */
  function paintCloud(shape: CloudShape, ref: number, alpha: number, lw: number): void {
    const L = lw / ref;

    /* 1. flat base colour inside the unioned silhouette */
    ctx.beginPath();
    puffPath(shape.puffs);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fill();

    /* 2. cel shading:one hard shadow band, one soft occlusion at the base */
    ctx.save();
    ctx.beginPath();
    puffPath(shape.puffs);
    ctx.clip();

    ctx.fillStyle = `rgba(${INK},${0.13 * alpha + 0.03})`;
    ctx.fillRect(-shape.width, -shape.width, shape.width * 2.4, shape.width * 2.6);
    ctx.beginPath();
    puffPath(shape.shadow);
    ctx.fillStyle = 'rgba(255,255,255,0.99)';
    ctx.fill();

    /* deeper core shadow hugging the underside */
    const gy = ctx.createLinearGradient(0, -shape.width * 0.2, 0, shape.width * 0.55);
    gy.addColorStop(0, `rgba(${INK},0)`);
    gy.addColorStop(1, `rgba(${INK},${0.1 * alpha})`);
    ctx.fillStyle = gy;
    ctx.fillRect(-shape.width, -shape.width, shape.width * 2.4, shape.width * 2.6);

    /* Mœbius hatching inside the shadow only */
    ink(alpha * 0.22, L * 0.7);
    const step = Math.max(0.11, shape.width * 0.055);
    for (let hx = -shape.width * 0.5; hx < shape.width * 0.6; hx += step) {
      ctx.beginPath();
      ctx.moveTo(hx, 0.06);
      ctx.lineTo(hx + 0.16, 0.3);
      ctx.stroke();
    }
    /* the terminator:inked edge between lit and shadowed volume */
    strokeRuns(shape.terminator, alpha * 0.34, L * 0.85);
    ctx.restore();

    /* 3. the silhouette contour, drawn last and heaviest */
    strokeRuns(shape.outline, alpha, L);
  }

  /* ---------- sprite cache:每朵云只画一次,之后整帧只是一次 drawImage ---------- */
  const CLOUD_PAD = 6;
  const SPRITE_A = 0.9;

  function cloudSprite(shape: CloudShape, sc: number, lw: number): CloudSprite {
    const existing = shape._spr;
    if (existing && existing.dpr === DPR && sc / existing.ref > 0.6 && sc / existing.ref < 1.55) {
      return existing;
    }

    const ref = Math.max(20, Math.min(320, sc));
    const b = shape.bbox;
    const cw = Math.max(2, Math.ceil((b.w * ref + CLOUD_PAD * 2) * DPR));
    const ch = Math.max(2, Math.ceil((b.h * ref * 0.8 + CLOUD_PAD * 2) * DPR));
    const cvs = document.createElement('canvas');
    cvs.width = cw;
    cvs.height = ch;
    const g = cvs.getContext('2d')!;
    const old = ctx;
    ctx = g; // ink()/puffPath() draw into the sprite
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.translate(CLOUD_PAD - b.x * ref, CLOUD_PAD - b.y * ref * 0.8);
    g.scale(ref, ref * 0.8);
    paintCloud(shape, ref, SPRITE_A, lw);
    ctx = old;

    const s: CloudSprite = { cv: cvs, ref, dpr: DPR, w: cw / DPR, h: ch / DPR };
    shape._spr = s;
    return s;
  }

  function drawCloud(shape: CloudShape, sx: number, sy: number, sc: number, alpha: number, lw: number): void {
    if (sc <= 0.01) return;
    const b = shape.bbox;
    /* cull anything fully off-screen before touching the GPU */
    const x0 = sx + b.x * sc;
    const x1 = x0 + b.w * sc;
    if (x1 < -40 || x0 > W + 40) return;
    const s = cloudSprite(shape, sc, lw);
    const k = sc / s.ref;
    ctx.save();
    ctx.globalAlpha = Math.max(0.04, Math.min(1, alpha / SPRITE_A));
    ctx.drawImage(s.cv, x0 - CLOUD_PAD * k, sy + b.y * sc * 0.8 - CLOUD_PAD * k, s.w * k, s.h * k);
    ctx.restore();
  }

  /* ---------- world state ---------- */
  const cam = { x: 0, y: 0, tx: 0, ty: 0 };
  let zoom = 1;
  let zoomTarget = 1;
  let wind = 0.38;
  const clouds: Cloud[] = [];
  const birds: Bird[] = [];
  const ripples: Ripple[] = [];
  const streaks: Streak[] = [];
  let shakeAmt = 0;
  const focusTarget = 0;
  let focusOffset = 0;
  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let seedCounter = 1;

  function addCloud(wx: number, wy: number, depth: number, size: number, alpha: number): void {
    const c: Cloud = {
      shape: buildCloud(seedCounter++),
      x: wx,
      y: wy,
      d: depth,
      size,
      a: Math.min(0.9, alpha),
      drift: 0.6 + Math.random() * 0.9,
      bob: Math.random() * 6.28,
      bobSp: 0.25 + Math.random() * 0.4,
      born: performance.now(),
      target: size,
    };
    clouds.push(c);
    if (clouds.length > 42) clouds.shift();
    clouds.sort((a, b) => a.d - b.d);
    updateCounts();
  }

  function addBird(wx: number, wy: number, depth: number, scale: number): void {
    birds.push({
      x: wx,
      y: wy,
      d: depth,
      s: scale,
      sp: 0.5 + Math.random() * 0.9,
      flap: 4.5 + Math.random() * 3.5,
      ph: Math.random() * 6.28,
      bob: Math.random() * 6.28,
      bobSp: 0.5 + Math.random() * 0.7,
      dir: Math.random() < 0.82 ? 1 : -1,
    });
    if (birds.length > 30) birds.shift();
    updateCounts();
  }

  function randomBird(): void {
    const d = 0.5 + Math.random() * 0.7;
    addBird((Math.random() - 0.5) * 22, -(1.5 + Math.random() * 5.5), d, 0.5 + Math.random() * 0.8);
  }

  /* ---------- projection ---------- */
  function sxOf(o: { x: number; y: number; d: number }): number {
    return W * 0.5 + (o.x * S - cam.x) * o.d * zoom;
  }
  function syOf(o: { x: number; y: number; d: number }): number {
    return horizon + (o.y * S - cam.y) * o.d * zoom + focusOffset * o.d;
  }
  function scOf(o: { x: number; y: number; d: number }): number {
    return o.d * zoom;
  }
  function unproject(mx: number, my: number, d: number): Pt {
    return {
      x: ((mx - W * 0.5) / (d * zoom) + cam.x) / S,
      y: ((my - horizon - focusOffset * d) / (d * zoom) + cam.y) / S,
    };
  }

  /* ---------- static furniture:the traveler ---------- */
  function drawTraveler(t: number): void {
    const o = { x: 6.6, y: 2.2, d: 1.0 };
    const sx = sxOf(o);
    const sy = syOf(o) - 4;
    const sc = Math.max(0.55, scOf(o)) * 0.9;
    const bob = reduce ? 0 : Math.sin(t * 0.9) * 2 * sc;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(sc, sc);
    /* small floating rock */
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.quadraticCurveTo(-16, -7, 4, -6);
    ctx.quadraticCurveTo(24, -5, 30, 1);
    ctx.quadraticCurveTo(14, 16, -4, 14);
    ctx.quadraticCurveTo(-20, 12, -26, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fill();
    ink(0.68, 1.5);
    ctx.stroke();
    ink(0.26, 1.0);
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-8, 11);
    ctx.moveTo(2, 7);
    ctx.lineTo(9, 12);
    ctx.stroke();
    /* lone figure with a staff */
    ink(0.78, 1.6);
    ctx.beginPath();
    ctx.arc(0, -24, 3.2, 0, 6.2832);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -20.5);
    ctx.lineTo(0, -9);
    ctx.moveTo(0, -9);
    ctx.lineTo(-4, -1);
    ctx.moveTo(0, -9);
    ctx.lineTo(4.5, -1);
    ctx.moveTo(0, -17);
    ctx.lineTo(-5.5, -11);
    ctx.moveTo(0, -17);
    ctx.lineTo(6, -13);
    ctx.stroke();
    ink(0.5, 1.3);
    ctx.beginPath();
    ctx.moveTo(6.5, -26);
    ctx.lineTo(6.5, -1);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- the sea:Mœbius line-drawn swell. Clouds stay white; only the
     water below the horizon carries colour. ---------- */
  let bandOff1 = 0;
  let bandOff2 = 0;
  const bandPat = new Map<string, BandPattern>();

  const SEA_RGB = [81, 170, 213];
  const SEA_DEEP = [46, 112, 152];
  function mixWhite(c: number[], m: number): string {
    return (
      'rgb(' +
      Math.round(255 + (c[0] - 255) * m) +
      ',' +
      Math.round(255 + (c[1] - 255) * m) +
      ',' +
      Math.round(255 + (c[2] - 255) * m) +
      ')'
    );
  }
  function seaColors(strokeA: number): { lit: string; mid: string; shade: string } {
    const m = 0.34 + strokeA * 0.72; // far water pale, near water saturated
    return {
      lit: mixWhite(SEA_RGB, m * 0.34),
      mid: mixWhite(SEA_RGB, m * 0.74),
      shade: mixWhite(SEA_DEEP, m * 1.0),
    };
  }

  /* One seamless period of swell. Only integer harmonics are used, so the
     profile repeats exactly and the baked tile can be blitted edge to edge. */
  function pattern(seed: number, baseR: number): BandPattern {
    const key = seed + '|' + Math.round(baseR);
    const cached = bandPat.get(key);
    if (cached) return cached;
    const r = prng(seed);

    /* long, low swell:water reads flat, not like a mountain range */
    const total = Math.max(280, Math.round(baseR * 13));
    const harm = [
      { n: 1, a: baseR * 0.44, ph: r() * 6.2832 },
      { n: 2, a: baseR * 0.27, ph: r() * 6.2832 },
      { n: 3, a: baseR * 0.17, ph: r() * 6.2832 },
      { n: 5, a: baseR * 0.1, ph: r() * 6.2832 },
      { n: 9, a: baseR * 0.05, ph: r() * 6.2832 },
    ];
    function h(x: number): number {
      let s = 0;
      for (let j = 0; j < harm.length; j++) s += harm[j].a * Math.sin((6.2832 * harm[j].n * x) / total + harm[j].ph);
      return s;
    }

    /* crests tall enough to break get a curl of foam */
    const curls: Array<{ x: number; s: number; dir: number }> = [];
    const step = Math.max(3, Math.round(baseR * 0.22));
    for (let i = step; i < total - step; i += step) {
      if (h(i) > h(i - step) && h(i) > h(i + step) && h(i) > baseR * 0.18 && r() < 0.6) {
        curls.push({ x: i, s: baseR * (0.16 + 0.14 * r()), dir: r() < 0.5 ? 1 : -1 });
      }
    }

    /* flat drift lines lying on the water:the Mœbius signature */
    const dashes: Array<{ x: number; y: number; len: number; a: number }> = [];
    const n = Math.max(3, Math.round(total / (baseR * 1.1)));
    for (let i = 0; i < n; i++) {
      dashes.push({
        x: r() * total,
        y: baseR * (0.42 + 1.05 * r()),
        len: baseR * (0.7 + 1.9 * r()),
        a: 0.3 + 0.45 * r(),
      });
    }

    const p: BandPattern = { total, h, amp: baseR * 1.05, curls, dashes, baseR };
    bandPat.set(key, p);
    return p;
  }

  /* One period is baked into a tile image, then blitted. Per frame this costs a
     handful of drawImage calls instead of rebuilding the whole wave path. */
  function bandTile(p: BandPattern, baseR: number, fillA: number, strokeA: number, lw: number) {
    const key = baseR + '|' + fillA + '|' + strokeA + '|' + lw + '|' + DPR;
    if (p._tile && p._tkey === key) return p._tile;

    const ht = Math.ceil(p.amp) + 8;
    const hb = Math.ceil(baseR * 1.5);
    const cvs = document.createElement('canvas');
    cvs.width = Math.ceil(p.total * DPR);
    cvs.height = Math.ceil((ht + hb) * DPR);
    const g = cvs.getContext('2d')!;
    const old = ctx;
    ctx = g;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.translate(0, ht); // y = 0 is the mean water line
    g.lineJoin = 'round';
    g.lineCap = 'round';

    const col = seaColors(strokeA);
    const stepX = Math.max(2, Math.round(baseR * 0.09));

    /* the surface, drawn a period either side so the seam joins invisibly */
    function surface(dy: number, squash: number): void {
      g.beginPath();
      g.moveTo(-p.total, -p.h(-p.total) * squash + dy);
      for (let x = -p.total + stepX; x <= p.total * 2; x += stepX) g.lineTo(x, -p.h(x) * squash + dy);
    }
    function body(dy: number, squash: number): void {
      surface(dy, squash);
      g.lineTo(p.total * 2, hb + 8);
      g.lineTo(-p.total, hb + 8);
      g.closePath();
    }

    g.globalAlpha = fillA;

    /* three flat cel steps:lit crests, mid water, deep water */
    body(0, 1);
    g.fillStyle = col.lit;
    g.fill();
    body(baseR * 0.45, 0.78);
    g.fillStyle = col.mid;
    g.fill();
    body(baseR * 1.0, 0.5);
    g.fillStyle = col.shade;
    g.fill();

    /* contour lines along each step, lightest at depth */
    surface(baseR * 1.0, 0.5);
    ink(strokeA * 0.3, lw * 0.7);
    g.stroke();
    surface(baseR * 0.45, 0.78);
    ink(strokeA * 0.4, lw * 0.8);
    g.stroke();

    /* the water line itself */
    surface(0, 1);
    ink(strokeA, lw);
    g.stroke();

    /* a thin white glint riding just under the crests */
    surface(baseR * 0.12, 0.96);
    g.strokeStyle = 'rgba(255,255,255,' + (0.3 + strokeA * 0.35) + ')';
    g.lineWidth = lw * 0.9;
    g.stroke();

    /* breaking curls */
    for (let i = 0; i < p.curls.length; i++) {
      const c = p.curls[i];
      const cy = -p.h(c.x);
      const s = c.s;
      const d = c.dir;
      ink(strokeA * 0.9, lw * 0.85);
      g.beginPath();
      g.moveTo(c.x - d * s * 1.5, cy + s * 0.55);
      g.quadraticCurveTo(c.x - d * s * 0.2, cy - s * 0.55, c.x + d * s * 1.0, cy + s * 0.15);
      g.quadraticCurveTo(c.x + d * s * 0.4, cy + s * 0.3, c.x + d * s * 0.1, cy + s * 0.05);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = lw * 0.8;
      g.beginPath();
      g.moveTo(c.x - d * s * 1.1, cy + s * 0.34);
      g.quadraticCurveTo(c.x - d * s * 0.1, cy - s * 0.2, c.x + d * s * 0.8, cy + s * 0.22);
      g.stroke();
    }

    /* drift lines lying flat on the water */
    for (let i = 0; i < p.dashes.length; i++) {
      const dsh = p.dashes[i];
      const dy = -p.h(dsh.x) * 0.7 + dsh.y;
      ink(strokeA * dsh.a * 0.8, lw * 0.7);
      g.beginPath();
      g.moveTo(dsh.x, dy);
      g.quadraticCurveTo(dsh.x + dsh.len * 0.5, dy - baseR * 0.05, dsh.x + dsh.len, dy);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(dsh.x + dsh.len * 0.12, dy - lw * 0.9);
      g.quadraticCurveTo(dsh.x + dsh.len * 0.5, dy - baseR * 0.05 - lw * 0.9, dsh.x + dsh.len * 0.9, dy - lw * 0.9);
      g.stroke();
    }

    ctx = old;

    const tile = { cv: cvs, ht, hb, w: p.total, h: ht + hb, fill: fillA };
    p._tkey = key;
    p._tile = tile;
    return tile;
  }

  function drawBand(seed: number, offset: number, y: number, baseR: number, fillA: number, strokeA: number, lw: number): void {
    const p = pattern(seed, baseR);
    const tile = bandTile(p, baseR, fillA, strokeA, lw);
    const top = Math.round(y) - tile.ht;

    /* deep water carries on below the tile */
    const by = Math.round(y) + tile.hb - 1;
    const bh = H - by + 40;
    const col = seaColors(strokeA);
    ctx.save();
    ctx.globalAlpha = fillA;
    ctx.fillStyle = col.shade;
    ctx.fillRect(0, by, W, bh);
    ctx.restore();

    const startX = -tile.w - (Math.round(offset) % tile.w);
    for (let x = startX; x < W + tile.w; x += tile.w) ctx.drawImage(tile.cv, x, top, tile.w, tile.h);
  }

  /* ---------- 丹顶鹤 red-crowned crane ---------- */
  function drawBird(b: Bird, t: number): void {
    const sx = sxOf(b);
    const sy = syOf(b);
    const sc = b.s * scOf(b) * 82;
    if (sc < 1) return;
    const f = reduce ? 0.15 : Math.sin(t * b.flap + b.ph); // -1 down .. 1 up
    let a = 0.34 + 0.52 * Math.min(1, b.d);
    a = Math.min(1, a * (sc < 78 ? 1.35 : 1.05));
    const u = sc / 26;
    const detail = sc > 70;

    const PLUME = 'rgba(255,255,255,0.99)';
    const BLACK = 'rgba(' + INK + ',' + Math.min(1, a * 0.86) + ')';
    const SHADE = 'rgba(150,171,187,' + a * 0.22 + ')';
    const RED = 'rgba(201,56,44,' + Math.min(1, a * 1.35) + ')';

    ctx.save();
    ctx.translate(sx, sy + (reduce ? 0 : Math.sin(t * b.bobSp + b.bob) * 4));
    ctx.scale(b.dir * u, u);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    /* ---- one wing, sampled from a spine ---- */
    function wing(side: number, lift: number, near: boolean): void {
      const wristY = -0.5 - lift * 7.2;
      const tipY = -1.4 - lift * 15.0;
      const P0 = [-1.4, -1.0];
      const P1 = [5.0, wristY - 1.0];
      const P2 = [11.4, wristY];
      const P3 = [22.4, tipY];

      const N = 26;
      const lead: number[][] = [];
      const trail: number[][] = [];
      function at(s: number): number[] {
        const m = 1 - s;
        return [
          m * m * m * P0[0] + 3 * m * m * s * P1[0] + 3 * m * s * s * P2[0] + s * s * s * P3[0],
          m * m * m * P0[1] + 3 * m * m * s * P1[1] + 3 * m * s * s * P2[1] + s * s * s * P3[1],
        ];
      }
      function chord(s: number): number {
        // full at the arm, drawn out to a fine point at the primaries
        return 6.3 * Math.pow(1 - s, 0.52) * (0.52 + 0.48 * Math.min(1, s * 5));
      }
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const p = at(s);
        const q = at(Math.min(1, s + 0.01));
        const tx2 = q[0] - p[0];
        const ty2 = q[1] - p[1];
        const len = Math.hypot(tx2, ty2) || 1;
        const nx = -ty2 / len;
        const ny = tx2 / len; // points "below" the spine
        const w = chord(s);
        lead.push([side * (p[0] - nx * w * 0.4), p[1] - ny * w * 0.4]);
        trail.push([side * (p[0] + nx * w * 0.6), p[1] + ny * w * 0.6]);
      }

      function wingPath(): void {
        ctx.beginPath();
        ctx.moveTo(lead[0][0], lead[0][1]);
        for (let i = 1; i <= N; i++) ctx.lineTo(lead[i][0], lead[i][1]);
        for (let i = N; i >= 0; i--) ctx.lineTo(trail[i][0], trail[i][1]);
        ctx.closePath();
      }
      /* outline without the straight root seam — the root melts into the back */
      function wingEdge(): void {
        ctx.beginPath();
        ctx.moveTo(lead[3][0], lead[3][1]);
        for (let i = 4; i <= N; i++) ctx.lineTo(lead[i][0], lead[i][1]);
        for (let i = N; i >= 3; i--) ctx.lineTo(trail[i][0], trail[i][1]);
      }

      wingPath();
      ctx.fillStyle = PLUME;
      ctx.fill();

      ctx.save();
      ctx.clip();

      /* black secondaries + tertials hugging the inner trailing edge */
      const K = Math.round(N * 0.52);
      ctx.beginPath();
      ctx.moveTo(trail[0][0], trail[0][1]);
      for (let i = 1; i <= K; i++) ctx.lineTo(trail[i][0], trail[i][1]);
      for (let i = K; i >= 0; i--) {
        const g = 0.3 - 0.16 * (i / K); // band tapers as it runs out
        ctx.lineTo(lead[i][0] * g + trail[i][0] * (1 - g), lead[i][1] * g + trail[i][1] * (1 - g));
      }
      ctx.closePath();
      ctx.fillStyle = BLACK;
      ctx.fill();

      if (detail) {
        /* soft cel shadow just under the leading edge */
        ctx.beginPath();
        ctx.moveTo(lead[2][0], lead[2][1]);
        for (let i = 3; i < N; i++) ctx.lineTo(lead[i][0], lead[i][1]);
        for (let i = N - 1; i >= 2; i--) {
          ctx.lineTo(lead[i][0] * 0.74 + trail[i][0] * 0.26, lead[i][1] * 0.74 + trail[i][1] * 0.26);
        }
        ctx.closePath();
        ctx.fillStyle = SHADE;
        ctx.fill();
      }
      ctx.restore();

      wingEdge();
      ink(near ? Math.min(1, a * 1.3) : Math.min(1, a * 0.72), 1.35 / u);
      ctx.stroke();

      if (detail) {
        /* separated primaries out at the tip */
        ink(a * 0.34, 0.85 / u);
        ctx.beginPath();
        for (let i = Math.round(N * 0.62); i < N; i += 3) {
          ctx.moveTo(lead[i][0] * 0.45 + trail[i][0] * 0.55, lead[i][1] * 0.45 + trail[i][1] * 0.55);
          ctx.lineTo(trail[Math.min(N, i + 3)][0], trail[Math.min(N, i + 3)][1]);
        }
        ctx.stroke();
        /* one covert line along the arm */
        ink(a * 0.22, 0.75 / u);
        ctx.beginPath();
        for (let i = 2; i <= Math.round(N * 0.66); i++) {
          const cx2 = lead[i][0] * 0.6 + trail[i][0] * 0.4;
          const cy2 = lead[i][1] * 0.6 + trail[i][1] * 0.4;
          if (i === 2) ctx.moveTo(cx2, cy2);
          else ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
      }
    }

    /* ---- far wing:foreshortened and paler ---- */
    ctx.save();
    ctx.transform(1, 0, 0, 0.64, 0, -1.8);
    ctx.globalAlpha = 0.85;
    wing(-1, 0.32 + f * 0.44, false);
    ctx.restore();

    /* ---- legs trailing straight behind ---- */
    ink(Math.min(1, a * 0.95), 1.05 / u);
    ctx.beginPath();
    ctx.moveTo(-5.4, 1.0);
    ctx.quadraticCurveTo(-11.6, 1.5, -17.4, 1.7);
    ctx.moveTo(-5.4, 1.4);
    ctx.quadraticCurveTo(-11.6, 2.1, -16.8, 2.4);
    ctx.stroke();
    if (detail) {
      ink(Math.min(1, a * 0.75), 0.9 / u);
      ctx.beginPath();
      ctx.moveTo(-17.4, 1.7);
      ctx.lineTo(-19.2, 1.5);
      ctx.moveTo(-16.8, 2.4);
      ctx.lineTo(-18.5, 2.3);
      ctx.stroke();
    }

    /* ---- black tertials draping over the short tail ---- */
    ctx.beginPath();
    ctx.moveTo(-4.8, -1.6);
    ctx.quadraticCurveTo(-10.4, -1.6, -14.6, 0.1);
    ctx.quadraticCurveTo(-10.2, 1.3, -5.0, 1.2);
    ctx.closePath();
    ctx.fillStyle = BLACK;
    ctx.fill();

    /* ---- body ---- */
    function bodyPath(): void {
      ctx.beginPath();
      ctx.moveTo(-6.4, 0.0);
      ctx.bezierCurveTo(-4.8, -2.5, -0.4, -3.0, 3.8, -2.2);
      ctx.quadraticCurveTo(6.4, -1.7, 7.9, -0.7);
      ctx.quadraticCurveTo(6.0, 1.7, -0.2, 2.3);
      ctx.quadraticCurveTo(-4.0, 2.6, -6.4, 0.0);
      ctx.closePath();
    }
    bodyPath();
    ctx.fillStyle = PLUME;
    ctx.fill();
    if (detail) {
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-9, 1.2);
      ctx.quadraticCurveTo(-1.0, 2.1, 9, 0.4);
      ctx.lineTo(9, 5);
      ctx.lineTo(-9, 5);
      ctx.closePath();
      ctx.fillStyle = SHADE;
      ctx.fill();
      ctx.restore();
      bodyPath();
    }
    ink(Math.min(1, a * 1.15), 1.2 / u);
    ctx.stroke();
    if (detail) {
      // breast line
      ink(a * 0.25, 0.75 / u);
      ctx.beginPath();
      ctx.moveTo(6.6, -1.4);
      ctx.quadraticCurveTo(4.6, 0.6, 1.2, 1.6);
      ctx.stroke();
    }

    /* ---- neck:long, slender, black, with a white nape stripe ---- */
    function neckPath(): void {
      ctx.beginPath();
      ctx.moveTo(5.0, -2.0);
      ctx.bezierCurveTo(8.8, -3.8, 13.3, -5.6, 17.4, -6.9); // upper(nape) edge
      ctx.lineTo(17.9, -5.6);
      ctx.bezierCurveTo(13.8, -4.2, 9.6, -2.5, 6.2, -0.9); // lower(throat) edge
      ctx.closePath();
    }
    neckPath();
    ctx.fillStyle = BLACK;
    ctx.fill();
    if (detail) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = PLUME;
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(5.8, -2.3);
      ctx.bezierCurveTo(9.2, -4.0, 13.5, -5.8, 17.6, -7.1);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.restore();
    }
    neckPath();
    ink(Math.min(1, a * 1.0), 0.95 / u);
    ctx.stroke();

    /* ---- head ---- */
    ctx.beginPath();
    ctx.ellipse(18.6, -6.9, 1.78, 1.32, -0.16, 0, 6.2832);
    ctx.fillStyle = PLUME;
    ctx.fill();
    ctx.save();
    ctx.clip(); // black throat wraps up
    ctx.beginPath();
    ctx.moveTo(16.2, -6.4);
    ctx.quadraticCurveTo(17.8, -5.7, 20.0, -6.3);
    ctx.lineTo(20.0, -4.4);
    ctx.lineTo(16.2, -4.4);
    ctx.closePath();
    ctx.fillStyle = BLACK;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(18.6, -6.9, 1.78, 1.32, -0.16, 0, 6.2832);
    ink(Math.min(1, a * 1.1), 1.0 / u);
    ctx.stroke();

    ctx.beginPath(); // 丹顶
    ctx.ellipse(18.7, -7.9, 1.02, 0.56, -0.2, 0, 6.2832);
    ctx.fillStyle = RED;
    ctx.fill();

    ink(Math.min(1, a * 1.05), 1.0 / u); // long straight bill
    ctx.beginPath();
    ctx.moveTo(20.2, -6.9);
    ctx.lineTo(26.4, -7.3);
    ctx.stroke();

    if (detail) {
      ctx.beginPath();
      ctx.arc(19.5, -7.0, 0.27, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + INK + ',' + Math.min(1, a * 0.8) + ')';
      ctx.fill();
    }

    /* ---- near wing last, seated on the back ---- */
    ctx.save();
    ctx.translate(-0.4, -1.9);
    wing(1, 0.48 + f * 0.5, true);
    ctx.restore();

    ctx.restore();
  }

  /* ---------- wind streaks:explicit feedback for the wind slider ---------- */
  function spawnStreak(): void {
    streaks.push({
      x: -60 - Math.random() * 120,
      y: horizon - 60 - Math.random() * (horizon * 0.85),
      len: 40 + Math.random() * 140,
      sp: 180 + Math.random() * 420,
      life: 0,
      max: 1.1 + Math.random() * 0.8,
    });
  }
  function drawStreaks(dt: number): void {
    if (!reduce && wind > 0.1 && Math.random() < wind * 0.55) spawnStreak();
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.life += dt;
      s.x += s.sp * (0.25 + wind * 1.5) * dt;
      const p = s.life / s.max;
      if (p >= 1 || s.x > W + 200) {
        streaks.splice(i, 1);
        continue;
      }
      const a = 0.22 * Math.sin(Math.PI * p) * (0.3 + wind);
      ink(Math.min(0.3, a), 1.1);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + s.len * 0.5, s.y - 4, s.x + s.len, s.y);
      ctx.stroke();
    }
  }

  /* ---------- populate the sky ---------- */
  function populate(): void {
    clouds.length = 0;
    birds.length = 0;
    seedCounter = 1;
    for (let i = 0; i < 4; i++) addCloud(-16 + i * 11 + Math.random() * 4, -(7.5 + Math.random() * 4), 0.3 + Math.random() * 0.1, 1.7 + Math.random() * 0.8, 0.44);
    for (let i = 0; i < 3; i++) addCloud(-14 + i * 13 + Math.random() * 5, -(4.6 + Math.random() * 3), 0.56 + Math.random() * 0.14, 1.5 + Math.random() * 0.9, 0.66);
    for (let i = 0; i < 2; i++) addCloud(-9 + i * 17 + Math.random() * 4, -(2.2 + Math.random() * 2.2), 0.92 + Math.random() * 0.2, 1.1 + Math.random() * 0.7, 0.86);
    for (let i = 0; i < 2; i++) randomBird();
    clouds.forEach((c) => {
      c.born = 0;
    });
  }

  function updateCounts(): void {
    const cc = document.getElementById('cloud-count');
    const bc = document.getElementById('bird-count');
    if (cc) cc.textContent = String(clouds.length);
    if (bc) bc.textContent = String(birds.length);
  }

  function resize(): void {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5); // capped:the ink look needs no retina density
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    horizon = H * 0.62;
    S = Math.max(38, Math.min(64, W / 24));
  }

  /* ---------- interaction ---------- */
  function onPointerMove(e: MouseEvent): void {
    pointer.x = (e.clientX / W - 0.5) * 2;
    pointer.y = (e.clientY / H - 0.5) * 2;
  }

  let dragging = false;
  let last: Pt | null = null;
  let moved = 0;
  function down(x: number, y: number): void {
    dragging = true;
    moved = 0;
    last = { x, y };
    canvas.classList.add('dragging');
  }
  function move(x: number, y: number): void {
    if (!dragging) return;
    const dx = x - last!.x;
    const dy = y - last!.y;
    moved += Math.abs(dx) + Math.abs(dy);
    cam.tx -= dx / zoom;
    cam.ty = Math.max(-260, Math.min(260, cam.ty - dy / zoom));
    last = { x, y };
  }
  function up(): void {
    dragging = false;
    canvas.classList.remove('dragging');
  }
  function onDragMove(e: MouseEvent): void {
    move(e.clientX, e.clientY);
  }
  function onMouseDown(e: MouseEvent): void {
    down(e.clientX, e.clientY);
  }
  function onTouchStart(e: TouchEvent): void {
    down(e.touches[0].clientX, e.touches[0].clientY);
  }
  function onTouchMove(e: TouchEvent): void {
    move(e.touches[0].clientX, e.touches[0].clientY);
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    zoomTarget = Math.max(0.6, Math.min(2.2, zoomTarget - e.deltaY * 0.0012));
  }
  function ripple(x: number, y: number, d: number): void {
    ripples.push({ x, y, d, t: 0 });
  }
  function onClick(e: MouseEvent): void {
    if (moved > 6) return;
    const d = 0.85 + Math.random() * 0.25;
    const p = unproject(e.clientX, e.clientY, d);
    addCloud(p.x, p.y, d, 0.85 + Math.random() * 0.9, 0.66);
    ripple(e.clientX, e.clientY, d);
    if (Math.random() < 0.06) randomBird();
  }

  /* =========================================================
     DOM-aware ink chrome — the HTML form is inked INTO the scene.
     Every frame we read the live geometry of the real <input>s and
     <button>s and draw their frames and underlines onto the canvas,
     so the form belongs to the drawing instead of floating above it
     as a card.
     ========================================================= */
  const ui = {
    card: null as HTMLFormElement | null,
    fields: [] as Array<{ el: HTMLInputElement | null; box: HTMLElement | null }>,
    primary: null as HTMLButtonElement | null,
    hover: null as HTMLElement | null,
  };

  function bindUI(): void {
    ui.card = document.querySelector('.sl-sl-card');
    const boxes = document.querySelectorAll('.sl-sl-field');
    ui.fields = [
      { el: document.getElementById('login-email') as HTMLInputElement | null, box: boxes[0] as HTMLElement | null },
      { el: document.getElementById('login-pwd') as HTMLInputElement | null, box: boxes[1] as HTMLElement | null },
    ];
    ui.primary = document.querySelector('.sl-sl-btn-primary');
  }
  function onOver(e: MouseEvent): void {
    const t = e.target as HTMLElement | null;
    ui.hover = t && t.closest ? (t.closest('button') as HTMLElement | null) : null;
  }
  function onOut(e: MouseEvent): void {
    if (!e.relatedTarget) ui.hover = null;
  }

  /* deterministic per-frame "boiling" wobble, like animated ink */
  function wob(seed: number, i: number): number {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * 2;
  }
  function inkSeg(x1: number, y1: number, x2: number, y2: number, seed: number, amp: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.round(len / 16));
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const o = i === 0 || i === steps ? 0 : wob(seed + i, i) * amp;
      const px = x1 + dx * t + nx * o;
      const py = y1 + dy * t + ny * o;
      ctx.lineTo(px, py);
    }
  }
  function inkBoxPath(x: number, y: number, w: number, h: number, seed: number, amp: number): void {
    ctx.moveTo(x, y);
    inkSeg(x, y, x + w, y, seed, amp);
    inkSeg(x + w, y, x + w, y + h, seed + 11, amp);
    inkSeg(x + w, y + h, x, y + h, seed + 23, amp);
    inkSeg(x, y + h, x, y, seed + 37, amp);
  }
  function inkBox(x: number, y: number, w: number, h: number, seed: number, amp: number, alpha: number, lw: number, fill?: string): void {
    ctx.beginPath();
    inkBoxPath(x, y, w, h, seed, amp);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ink(alpha, lw);
    ctx.stroke();
  }
  function inkUnderline(x1: number, x2: number, y: number, seed: number, amp: number, alpha: number, lw: number, color: string): void {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    inkSeg(x1, y, x2, y, seed, amp);
    ctx.strokeStyle = color || 'rgba(' + INK + ',' + alpha + ')';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* paints the inked chrome once into a layer;never called per frame */
  function paintUI(boil: number, cr: DOMRect): void {
    ctx.save();

    /* --- 1. the sky opens up:soft mist so the ink drawing reads behind text --- */
    const mx = cr.left + cr.width / 2;
    const my = cr.top + cr.height / 2;
    const R = Math.max(cr.width, cr.height) * 0.92;
    const mist = ctx.createRadialGradient(mx, my - cr.height * 0.05, R * 0.16, mx, my, R);
    mist.addColorStop(0, 'rgba(255,255,255,0.94)');
    mist.addColorStop(0.55, 'rgba(255,255,255,0.84)');
    mist.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(mx - R, my - R, R * 2, R * 2);

    /* --- 3. inked field underlines, drawn under the real inputs --- */
    for (let f = 0; f < ui.fields.length; f++) {
      const fd = ui.fields[f];
      if (!fd.el || !fd.box) continue;
      const r2 = fd.el.getBoundingClientRect();
      const bad = fd.box.classList.contains('bad');
      const focused = document.activeElement === fd.el;
      const col = bad ? 'rgba(229,100,88,0.9)' : focused ? 'rgba(39,131,222,0.95)' : 'rgba(' + INK + ',0.42)';
      const lw2 = bad || focused ? 2.2 : 1.4;
      inkUnderline(r2.left, r2.right, r2.bottom + 2, boil + f * 5, focused ? 1.3 : 0.9, 0.42, lw2, col);
      /* focus caret ticks at both ends */
      if (focused) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r2.left, r2.bottom - 4);
        ctx.lineTo(r2.left, r2.bottom + 6);
        ctx.moveTo(r2.right, r2.bottom - 4);
        ctx.lineTo(r2.right, r2.bottom + 6);
        ctx.stroke();
      }
    }

    /* --- 4. hand-inked button frames around the real buttons --- */
    if (ui.primary) {
      const pr = ui.primary.getBoundingClientRect();
      const pHot = ui.hover === ui.primary;
      inkBox(pr.left, pr.top, pr.width, pr.height, boil + 41, pHot ? 1.5 : 1.0, pHot ? 0.85 : 0.6, pHot ? 2.3 : 1.7, pHot ? 'rgba(' + INK + ',0.07)' : 'rgba(255,255,255,0.55)');
      if (pHot) {
        ink(0.3, 1.1);
        ctx.beginPath();
        inkBoxPath(pr.left - 4, pr.top - 4, pr.width + 8, pr.height + 8, boil + 53, 1.2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* The chrome only changes a few times a second, so it is cached in its own
     layer. Per frame we do ONE drawImage — no getBoundingClientRect, no
     getComputedStyle, no re-inking. */
  let uiLayer: HTMLCanvasElement | null = null;
  let uiCtx2: CanvasRenderingContext2D | null = null;
  let uiKey = '';
  let uiRect: DOMRect | null = null;
  let uiFade = 1;

  function drawUI(t: number): void {
    if (!ui.card) {
      bindUI();
      if (!ui.card) return;
    }
    const gone = ui.card.classList.contains('gone');
    uiFade += (gone ? 0 : 1 - uiFade) * 0.12;
    if (uiFade < 0.02) return;

    const boil = Math.floor(t * 3); // 3fps line boil
    const act = document.activeElement ? document.activeElement.id : '';
    const hov = ui.hover ? ui.hover.id || 'alt' : '';
    const bad = (ui.fields[0]?.box?.className ?? '') + (ui.fields[1]?.box?.className ?? '');
    const key = boil + '|' + W + '|' + H + '|' + act + '|' + hov + '|' + bad;

    if (key !== uiKey) {
      const cr0 = ui.card.getBoundingClientRect();
      if (cr0.width < 40) return;
      const pw = Math.ceil(W * DPR);
      const ph = Math.ceil(H * DPR);
      if (!uiLayer || uiLayer.width !== pw || uiLayer.height !== ph) {
        uiLayer = document.createElement('canvas');
        uiLayer.width = pw;
        uiLayer.height = ph;
        uiCtx2 = uiLayer.getContext('2d')!;
      }
      if (!uiCtx2) return;
      uiCtx2.setTransform(DPR, 0, 0, DPR, 0, 0);
      uiCtx2.clearRect(0, 0, W, H);
      const old = ctx;
      ctx = uiCtx2;
      paintUI(boil, cr0);
      ctx = old;
      uiKey = key;
      uiRect = cr0;
    }
    if (!uiLayer) return;

    ctx.save();
    ctx.globalAlpha = uiFade;
    if (uiFade < 0.995 && uiRect) {
      // mirror the card's exit transform
      const q = 1 - uiFade;
      const mx2 = uiRect.left + uiRect.width / 2;
      const my2 = uiRect.top + uiRect.height / 2;
      ctx.translate(mx2, my2 - 14 * q);
      ctx.scale(1 - 0.03 * q, 1 - 0.03 * q);
      ctx.translate(-mx2, -my2);
    }
    ctx.drawImage(uiLayer, 0, 0, W, H);
    ctx.restore();
  }

  /* ---------- main loop ---------- */
  let prev = performance.now();
  let rafId = 0;
  function renderStep(now: number): void {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    const t = now / 1000;

    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;
    focusOffset += (focusTarget - focusOffset) * 0.06;

    zoom += (zoomTarget - zoom) * 0.07;
    cam.x += (cam.tx + smooth.x * 30 - cam.x) * 0.06;
    cam.y += (cam.ty + smooth.y * 16 - cam.y) * 0.06;

    const shx = (Math.random() - 0.5) * shakeAmt;
    const shy = (Math.random() - 0.5) * shakeAmt;
    shakeAmt *= 0.88;

    /* --- clear + sky wash --- */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.62, '#FCFCFB');
    g.addColorStop(1, '#F1F0EE');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(shx, shy);

    /* the wind breathes on its own now that the control panel is gone */
    if (!reduce) wind = 0.34 + 0.13 * Math.sin(t * 0.11) + 0.08 * Math.sin(t * 0.31 + 1.4);
    const speed = (reduce ? 0.12 : 1) * (0.35 + wind * 3.6);

    /* far + mid clouds */
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      if (c.d > 0.6) continue;
      c.x += speed * c.drift * dt * 0.6;
      const sx = sxOf(c);
      if (sx > W + 420) c.x -= (W + 840) / (c.d * zoom) / S;
      const sy = syOf(c) + (reduce ? 0 : Math.sin(t * c.bobSp + c.bob) * 5 * c.d);
      const grow = c.born ? Math.min(1, (now - c.born) / 850) : 1;
      const k = 1 - Math.pow(1 - grow, 3);
      const sc = c.size * scOf(c) * (0.12 + 0.88 * k) * S * 0.95;
      drawCloud(c.shape, sx, sy, sc, c.a, 1.5);
    }

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      if (c.d <= 0.6) continue;
      c.x += speed * c.drift * dt;
      const sx = sxOf(c);
      if (sx > W + 520) c.x -= (W + 1040) / (c.d * zoom) / S;
      const sy = syOf(c) + (reduce ? 0 : Math.sin(t * c.bobSp + c.bob) * 6 * c.d);
      const grow = c.born ? Math.min(1, (now - c.born) / 850) : 1;
      const k = 1 - Math.pow(1 - grow, 3);
      const sc = c.size * scOf(c) * (0.12 + 0.88 * k) * S * 0.95;
      drawCloud(c.shape, sx, sy, sc, c.a, 2.1);
    }

    /* birds */
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      b.x += (0.5 + wind * 2.6) * b.sp * b.dir * dt * (reduce ? 0.15 : 1);
      const bsx = sxOf(b);
      if (bsx > W + 160) b.x -= (W + 320) / (b.d * zoom) / S;
      if (bsx < -160) b.x += (W + 320) / (b.d * zoom) / S;
      drawBird(b, t);
    }

    /* ripples from clicks */
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.t += dt;
      const p = rp.t / 1.3;
      if (p >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      ink(0.34 * (1 - p), 1.2);
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 14 + p * 130, 0, 6.2832);
      ctx.stroke();
    }

    drawStreaks(dt);

    /* the sea */
    if (!reduce) {
      bandOff1 += speed * 26 * dt;
      bandOff2 += speed * 46 * dt;
    }
    drawBand(7, bandOff1, H * 0.87 - cam.y * 0.35, Math.max(26, W / 34), 0.72, 0.22, 1.0);
    drawBand(23, bandOff2, H * 0.96 - cam.y * 0.5, Math.max(38, W / 22), 0.96, 0.52, 1.5);

    drawTraveler(t);
    drawUI(t);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function frame(now: number): void {
    renderStep(now);
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  resize();
  populate();

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', up);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('click', onClick);
  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('resize', resize);

  if (reduce) {
    // prefers-reduced-motion:render one static frame,no rAF loop
    renderStep(performance.now());
  } else {
    rafId = requestAnimationFrame(frame);
  }

  function destroy(): void {
    cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', up);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', up);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('click', onClick);
    document.removeEventListener('mouseover', onOver);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('resize', resize);
  }

  return { destroy };
}
