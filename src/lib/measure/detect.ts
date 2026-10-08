import type { Point } from "./types";

/**
 * Room detection on a raster plan, ported in spirit from the PlanScope experiment and rewritten:
 * grey -> Otsu threshold -> wall mask -> strip thin annotations -> bridge doorways (dilate) ->
 * flood fill from a click -> grow back onto the real wall faces -> contour -> RDP -> optional squaring.
 *
 * Pure functions over plain arrays, so they run in node tests. Every loop is bounded (visited-pixel budget,
 * step guards): blank, huge or hostile bitmaps return null instead of hanging. The result is a suggestion:
 * the person verifies it and the area is always recomputed from the polygon.
 */

export interface Bitmap {
  /** RGBA, 4 bytes per pixel (same layout as ImageData). */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Largest bitmap (pixels) the detector accepts. The UI works on a downscaled copy. */
export const MAX_DETECT_PIXELS = 12_000_000;
const MIN_ROOM_PIXELS = 400;

// Grey, threshold, mask -----------------------------------------------------------

/** Luminance 0-255. Transparent pixels count as paper (white). */
export function toGray(img: Bitmap): Uint8Array {
  const n = img.width * img.height;
  const gray = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = (img.data[i + 3] ?? 255) / 255;
    const lum = (img.data[i] ?? 0) * 0.299 + (img.data[i + 1] ?? 0) * 0.587 + (img.data[i + 2] ?? 0) * 0.114;
    gray[p] = Math.round(255 - (255 - lum) * a);
  }
  return gray;
}

/** Otsu: the cut that best separates the histogram into ink and paper. */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i] as number] = (hist[gray[i] as number] as number) + 1;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * (hist[t] as number);
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t] as number;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * (hist[t] as number);
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

export interface WallMask {
  mask: Mask;
  threshold: number;
  /** Share of pixels read as wall (0-1). Near 0 or very high means the threshold cannot separate ink from paper. */
  wallFraction: number;
}

/**
 * Wall mask: pixels darker than the threshold. The default threshold is Otsu nudged toward the paper side
 * (anti-aliased wall edges) and clamped away from the extremes.
 */
export function buildMask(img: Bitmap, threshold?: number): WallMask | null {
  const { width, height } = img;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) return null;
  if (width * height > MAX_DETECT_PIXELS || img.data.length < width * height * 4) return null;
  const gray = toGray(img);
  const t = threshold ?? Math.max(40, Math.min(235, Math.round(otsuThreshold(gray) * 1.05)));
  const data = new Uint8Array(width * height);
  let on = 0;
  for (let p = 0; p < data.length; p++) {
    if ((gray[p] as number) <= t) {
      data[p] = 1;
      on++;
    }
  }
  return { mask: { data, width, height }, threshold: t, wallFraction: on / data.length };
}

// Morphology (box windows through an integral image, O(n)) ------------------------

function windowSums(mask: Mask, r: number, keep: (sum: number, area: number) => boolean): Mask {
  const { width: w, height: h } = mask;
  const stride = w + 1;
  const integral = new Int32Array(stride * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask.data[y * w + x] as number;
      integral[(y + 1) * stride + x + 1] = (integral[y * stride + x + 1] as number) + row;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum =
        (integral[(y1 + 1) * stride + x1 + 1] as number) -
        (integral[y0 * stride + x1 + 1] as number) -
        (integral[(y1 + 1) * stride + x0] as number) +
        (integral[y0 * stride + x0] as number);
      out[y * w + x] = keep(sum, (y1 - y0 + 1) * (x1 - x0 + 1)) ? 1 : 0;
    }
  }
  return { data: out, width: w, height: h };
}

/** Square dilation: a pixel is on when anything within r pixels is on. Closes gaps up to 2r wide. */
export const dilate = (mask: Mask, r: number): Mask => (r <= 0 ? mask : windowSums(mask, Math.floor(r), (sum) => sum > 0));
/** Square erosion: a pixel stays on only when its whole window is on. */
export const erode = (mask: Mask, r: number): Mask => (r <= 0 ? mask : windowSums(mask, Math.floor(r), (sum, area) => sum === area));
/** Opening removes marks thinner than 2r+1 and keeps thicker walls as they are. */
export const openMask = (mask: Mask, r: number): Mask => (r <= 0 ? mask : dilate(erode(mask, r), r));

export function countOn(mask: Mask): number {
  let c = 0;
  for (let i = 0; i < mask.data.length; i++) c += mask.data[i] as number;
  return c;
}

/**
 * Drops text, dimension lines and door arcs (thin linework) and keeps the walls. Tries a strong opening first and
 * backs off when the walls themselves would go (a plan drawn with hairline walls keeps its raw mask).
 */
export function stripAnnotation(mask: Mask): Mask {
  const total = countOn(mask);
  if (!total) return mask;
  for (const r of [2, 1]) {
    const opened = openMask(mask, r);
    if (countOn(opened) > total * 0.35) return opened;
  }
  return mask;
}

// Flood fill ------------------------------------------------------------------------

export type FloodFailure = "no-seed" | "blocked" | "leak" | "tiny" | "too-large" | "budget" | "no-contour";

export type FloodOutcome = { ok: true; points: Point[]; areaPx: number; pixels: number; visited: number } | { ok: false; reason: FloodFailure; visited: number };

export interface FloodOptions {
  /** Bridging radius in pixels: doorways up to twice this wide are treated as walls. 0 = none. */
  gapRadius?: number;
  /** Square the outline to horizontal and vertical edges (default true). */
  orthogonal?: boolean;
  /** RDP tolerance in pixels (default 2.2). */
  tolerance?: number;
  /** Reject regions covering more than this share of the bitmap (default 0.5: the margin and whole-page fills). */
  maxFraction?: number;
  /** Pre-computed dilated walls for this radius (the sweep caches them). */
  dilated?: Mask;
  /** Visited-pixel budget for this call. */
  budget?: number;
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Nearest free pixel to the seed within `radius`, ring by ring. Null when there is none. */
function snapSeed(m: Mask, sx: number, sy: number, radius: number): { x: number; y: number } | null {
  const { width: w, height: h } = m;
  if (!m.data[sy * w + sx]) return { x: sx, y: sy };
  for (let rad = 1; rad <= radius; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (!m.data[y * w + x]) return { x, y };
      }
    }
  }
  return null;
}

/** 4-connected fill. Stops at once when it reaches the bitmap border. */
function fill(blocked: Mask, sx: number, sy: number, limit?: Mask, budget = Infinity): { region: Uint8Array; count: number; leak: boolean; over: boolean; visited: number } {
  const { width: w, height: h } = blocked;
  const region = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  stack[top++] = sy * w + sx;
  region[sy * w + sx] = 1;
  let count = 0;
  while (top > 0) {
    const p = stack[--top] as number;
    count++;
    if (count > budget) return { region, count, leak: false, over: true, visited: count };
    const x = p % w;
    const y = (p - x) / w;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return { region, count, leak: true, over: false, visited: count };
    for (const [dx, dy] of NEIGHBOURS) {
      const q = (y + dy) * w + (x + dx);
      if (region[q] || blocked.data[q] || (limit && !limit.data[q])) continue;
      region[q] = 1;
      stack[top++] = q;
    }
  }
  return { region, count, leak: false, over: false, visited: count };
}

/**
 * Outer boundary of a 4-connected region by crack following: vertices sit on pixel corners, so the polygon area
 * equals the pixel count exactly. Returns the corner vertices (direction changes only).
 */
export function traceContour(region: Uint8Array, w: number, h: number): Point[] {
  let x0 = -1;
  let y0 = -1;
  for (let i = 0; i < region.length; i++) {
    if (region[i]) {
      x0 = i % w;
      y0 = (i - x0) / w;
      break;
    }
  }
  if (x0 < 0) return [];
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && region[y * w + x] === 1;
  // Heading: 0 right, 1 down, 2 left, 3 up. The region stays on the right-hand side.
  const ahead = (x: number, y: number, d: number): [boolean, boolean] => {
    switch (d) {
      case 0:
        return [on(x, y - 1), on(x, y)];
      case 1:
        return [on(x, y), on(x - 1, y)];
      case 2:
        return [on(x - 1, y), on(x - 1, y - 1)];
      default:
        return [on(x - 1, y - 1), on(x, y - 1)];
    }
  };
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const pts: Point[] = [];
  let x = x0;
  let y = y0;
  let d = 0;
  pts.push({ x, y });
  const guard = 4 * w * h + 16;
  for (let step = 0; step < guard; step++) {
    const [left, right] = ahead(x, y, d);
    let nd = d;
    if (!right) nd = (d + 1) % 4;
    else if (left) nd = (d + 3) % 4;
    if (nd !== d) {
      d = nd;
      pts.push({ x, y });
    }
    x += DX[d] as number;
    y += DY[d] as number;
    // The start corner (top-left of the first pixel in scan order) is visited once: arriving closes the ring.
    if (x === x0 && y === y0) break;
  }
  return pts;
}

/** Ramer-Douglas-Peucker on a closed ring (split at the two farthest vertices so the seam is not special). */
export function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 4) return [...points];
  const segDist = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const open = (pts: readonly Point[]): Point[] => {
    if (pts.length < 3) return [...pts];
    const a = pts[0] as Point;
    const b = pts[pts.length - 1] as Point;
    let idx = -1;
    let max = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = segDist(pts[i] as Point, a, b);
      if (dist > max) {
        max = dist;
        idx = i;
      }
    }
    if (max > epsilon && idx > 0) return [...open(pts.slice(0, idx + 1)), ...open(pts.slice(idx)).slice(1)];
    return [a, b];
  };
  // Split the ring at vertex 0 and the vertex farthest from it.
  const first = points[0] as Point;
  let far = 0;
  let farD = -1;
  points.forEach((p, i) => {
    const dist = Math.hypot(p.x - first.x, p.y - first.y);
    if (dist > farD) {
      farD = dist;
      far = i;
    }
  });
  const left = open(points.slice(0, far + 1));
  const right = open([...points.slice(far), first]);
  return [...left, ...right.slice(1, -1)];
}

/** Snaps near-horizontal and near-vertical edges (within 14 degrees) onto the axis, closing edge included. */
export function orthogonalize(points: readonly Point[], toleranceDeg = 14): Point[] {
  const out = points.map((p) => ({ ...p }));
  const n = out.length;
  if (n < 3) return out;
  const tol = (toleranceDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = out[i] as Point;
    const b = out[(i + 1) % n] as Point;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const horizontal = Math.min(Math.abs(ang), Math.abs(Math.PI - Math.abs(ang)));
    const vertical = Math.abs(Math.abs(ang) - Math.PI / 2);
    if (horizontal < tol) {
      const y = (a.y + b.y) / 2;
      a.y = y;
      b.y = y;
    } else if (vertical < tol) {
      const x = (a.x + b.x) / 2;
      a.x = x;
      b.x = x;
    }
  }
  return out;
}

/** Removes repeated vertices (closer than `minDist`) and vertices that sit on a straight line. */
export function dedupe(points: readonly Point[], minDist = 1.5): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > minDist) out.push({ ...p });
  }
  if (out.length > 2) {
    const a = out[0] as Point;
    const b = out[out.length - 1] as Point;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= minDist) out.pop();
  }
  let i = 0;
  while (out.length > 3 && i < out.length) {
    const prev = out[(i - 1 + out.length) % out.length] as Point;
    const cur = out[i] as Point;
    const nxt = out[(i + 1) % out.length] as Point;
    const cross = (cur.x - prev.x) * (nxt.y - cur.y) - (cur.y - prev.y) * (nxt.x - cur.x);
    if (Math.abs(cross) < 1e-6) out.splice(i, 1);
    else i++;
  }
  return out;
}

const shoelace = (pts: readonly Point[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] as Point;
    const q = pts[(i + 1) % pts.length] as Point;
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s / 2);
};

/**
 * One flood from a seed at one bridging radius.
 * `walls` is the stripped wall mask (undilated); the bridged fill is grown back by the radius and re-flooded
 * against the real walls, so the outline lies on the wall faces and doorway notches are reclaimed.
 */
export function floodRoom(walls: Mask, seed: Point, options: FloodOptions = {}): FloodOutcome {
  const { width: w, height: h } = walls;
  const gap = Math.max(0, Math.floor(options.gapRadius ?? 0));
  const budget = options.budget ?? w * h * 4;
  let visited = 0;
  if (!Number.isFinite(seed.x) || !Number.isFinite(seed.y)) return { ok: false, reason: "no-seed", visited };
  const sx0 = Math.round(seed.x);
  const sy0 = Math.round(seed.y);
  if (sx0 < 0 || sy0 < 0 || sx0 >= w || sy0 >= h) return { ok: false, reason: "no-seed", visited };

  // A click on a wall or a leftover mark moves to the nearest free pixel (on the real walls, not the bridged ones).
  const snapped = snapSeed(walls, sx0, sy0, 12);
  if (!snapped) return { ok: false, reason: "blocked", visited };
  const bridged = gap > 0 ? (options.dilated ?? dilate(walls, gap)) : walls;
  if (bridged.data[snapped.y * w + snapped.x]) return { ok: false, reason: "blocked", visited };

  const first = fill(bridged, snapped.x, snapped.y, undefined, budget);
  visited += first.visited;
  if (first.over) return { ok: false, reason: "budget", visited };
  if (first.leak) return { ok: false, reason: "leak", visited };
  if (first.count < MIN_ROOM_PIXELS) return { ok: false, reason: "tiny", visited };
  if (first.count > (options.maxFraction ?? 0.5) * w * h) return { ok: false, reason: "too-large", visited };

  let region = first.region;
  let pixels = first.count;
  if (gap > 0) {
    const envelope = dilate({ data: first.region, width: w, height: h }, gap);
    const second = fill(walls, snapped.x, snapped.y, envelope, budget);
    visited += second.visited;
    // Keep the regrown region when it did not escape and did not shrink.
    if (!second.over && !second.leak && second.count >= first.count) {
      region = second.region;
      pixels = second.count;
    }
  }

  const ring = traceContour(region, w, h);
  if (ring.length < 4) return { ok: false, reason: "no-contour", visited };
  let pts = rdp(ring, options.tolerance ?? 2.2);
  if (options.orthogonal !== false) pts = orthogonalize(pts);
  pts = dedupe(pts);
  if (pts.length < 3) return { ok: false, reason: "no-contour", visited };
  const areaPx = shoelace(pts);
  // A ring-shaped fill (the margin inside a drawing frame) has few pixels but a page-sized outline.
  if (areaPx > (options.maxFraction ?? 0.5) * w * h) return { ok: false, reason: "too-large", visited };
  return { ok: true, points: pts, areaPx, pixels, visited };
}

// Detection from a click --------------------------------------------------------------

export type DetectFailure = "bad-image" | "blank" | "no-seed" | "blocked" | "leak" | "tiny" | "too-large" | "budget" | "no-contour";

export interface DetectedRoom {
  points: Point[];
  areaPx: number;
  gapRadius: number;
}

export type DetectOutcome = { ok: true; room: DetectedRoom } | { ok: false; reason: DetectFailure };

export interface DetectOptions {
  /** Fixed bridging radius (pixels). When omitted the radius is swept and the stable answer wins. */
  gapRadius?: number;
  orthogonal?: boolean;
  tolerance?: number;
  maxFraction?: number;
  /** Total visited-pixel budget across the sweep (default 24 full bitmaps). */
  budget?: number;
  /** Precomputed stripped walls (call `prepareWalls` once per plan and reuse it for every click). */
  walls?: Mask;
}

/** Wall mask ready for repeated clicks: threshold, mask, annotation strip. Null for an unusable bitmap. */
export function prepareWalls(img: Bitmap, threshold?: number): { walls: Mask; threshold: number; wallFraction: number } | null {
  const built = buildMask(img, threshold);
  if (!built) return null;
  return { walls: stripAnnotation(built.mask), threshold: built.threshold, wallFraction: built.wallFraction };
}

export const SWEEP_RADII: readonly number[] = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48];

/**
 * Detects the room around a click. With `gapRadius` it is one flood (the UI derives it from the scale). Without it
 * the radius grows while the doorways seal and the last stable plateau wins (see below); an opening wider than
 * about 8 ft never seals, and then the merged space is returned: the person verifies it or traces by hand.
 * Never loops forever: the sweep is bounded by SWEEP_RADII and a visited-pixel budget, and a bitmap with almost no
 * walls returns "blank" immediately.
 */
export function detectRoomOutcome(img: Bitmap, seed: Point, options: DetectOptions = {}): DetectOutcome {
  const walls = options.walls ?? prepareWalls(img)?.walls;
  if (!walls) return { ok: false, reason: "bad-image" };
  return detectRoomInWalls(walls, seed, options);
}

/** Same as `detectRoomOutcome` on a wall mask from `prepareWalls` (compute it once per plan, reuse it for every click). */
export function detectRoomInWalls(walls: Mask, seed: Point, options: DetectOptions = {}): DetectOutcome {
  const total = walls.width * walls.height;
  if (countOn(walls) < Math.max(20, total * 0.0005)) return { ok: false, reason: "blank" };

  const base = { orthogonal: options.orthogonal, tolerance: options.tolerance, maxFraction: options.maxFraction };
  if (options.gapRadius !== undefined) {
    const r = Math.max(0, Math.floor(options.gapRadius));
    const one = floodRoom(walls, seed, { ...base, gapRadius: r, budget: options.budget });
    return one.ok ? { ok: true, room: { points: one.points, areaPx: one.areaPx, gapRadius: r } } : { ok: false, reason: one.reason };
  }

  let budget = options.budget ?? total * 24;
  const found: Array<{ r: number; room: DetectedRoom }> = [];
  let lastFailure: DetectFailure = "leak";
  for (const r of SWEEP_RADII) {
    if (budget <= 0) {
      lastFailure = "budget";
      break;
    }
    const res = floodRoom(walls, seed, { ...base, gapRadius: r, budget });
    budget -= Math.max(res.visited, 1);
    if (!res.ok) {
      lastFailure = res.reason;
      // Seed swallowed by the bridged walls: bigger radii only get worse.
      if (res.reason === "blocked" || res.reason === "tiny" || res.reason === "no-seed") break;
      continue;
    }
    found.push({ r, room: { points: res.points, areaPx: res.areaPx, gapRadius: r } });
  }
  // Doorways seal one after another, so the area steps down and then holds. The answer is the start of the LAST
  // plateau (two or more consecutive radii agreeing within 3 %) with a compact outline: the room closed off.
  const agree = (x: number, y: number) => Math.abs(x - y) <= 0.03 * Math.max(x, y);
  for (let i = found.length - 2; i >= 0; i--) {
    const a = found[i] as (typeof found)[number];
    const b = found[i + 1] as (typeof found)[number];
    if (!agree(a.room.areaPx, b.room.areaPx) || a.room.points.length > 24) continue;
    let start = i;
    while (start > 0 && agree((found[start - 1] as (typeof found)[number]).room.areaPx, a.room.areaPx)) start--;
    return { ok: true, room: (found[start] as (typeof found)[number]).room };
  }
  return { ok: false, reason: found.length > 0 ? "leak" : lastFailure };
}

/** `detectRoomOutcome` reduced to the room or null. */
export function detectRoom(img: Bitmap, seed: Point, options: DetectOptions = {}): DetectedRoom | null {
  const outcome = detectRoomOutcome(img, seed, options);
  return outcome.ok ? outcome.room : null;
}
