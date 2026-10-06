import { FT_TO_M, LIMITS } from "@/lib/quantities";
import type { PlanScale, Point } from "./types";

/** Pure geometry and scale maths for the measuring tool. No DOM, no I/O. */

const EPSILON = 1e-9;
/** Polygons with more vertices than this are rejected (also bounds the O(n^2) self-intersection check). */
export const MAX_POLYGON_POINTS = 400;
/** Below this length in pixels a calibration line is a click, not a measurement. */
export const MIN_CALIBRATION_PX = 8;

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Signed shoelace area (positive when the vertices run clockwise on a y-down screen). */
export function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as Point;
    const q = points[(i + 1) % points.length] as Point;
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

export const polygonArea = (points: readonly Point[]) => Math.abs(signedArea(points));

export function perimeter(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) sum += distance(points[i] as Point, points[(i + 1) % points.length] as Point);
  return sum;
}

/** Area centroid; falls back to the mean of the vertices for a degenerate polygon. */
export function centroid(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const a = signedArea(points);
  if (Math.abs(a) < EPSILON) {
    const n = points.length;
    return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as Point;
    const q = points[(i + 1) % points.length] as Point;
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Ray casting. Points exactly on an edge may fall either side. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i] as Point;
    const pj = polygon[j] as Point;
    if (pi.y > point.y !== pj.y > point.y && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x) inside = !inside;
  }
  return inside;
}

export function boundingBox(points: readonly Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

const orient = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** True when the two segments cross or touch. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  const within = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, q.x) - EPSILON <= r.x && r.x <= Math.max(p.x, q.x) + EPSILON && Math.min(p.y, q.y) - EPSILON <= r.y && r.y <= Math.max(p.y, q.y) + EPSILON;
  if (Math.abs(o1) < EPSILON && within(a, b, c)) return true;
  if (Math.abs(o2) < EPSILON && within(a, b, d)) return true;
  if (Math.abs(o3) < EPSILON && within(c, d, a)) return true;
  if (Math.abs(o4) < EPSILON && within(c, d, b)) return true;
  return false;
}

/** Simple check: no two non-adjacent edges touch. Adjacent edges only share their common vertex. */
export function isSimplePolygon(points: readonly Point[]): boolean {
  const n = points.length;
  if (n < 3) return false;
  if (n > MAX_POLYGON_POINTS) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i] as Point;
    const b = points[(i + 1) % n] as Point;
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      const c = points[j] as Point;
      const d = points[(j + 1) % n] as Point;
      if (adjacent) {
        // Adjacent edges may only meet at the shared vertex: reject a fold-back (collinear overlap).
        const shared = j === i + 1 ? b : a;
        const other1 = j === i + 1 ? a : b;
        const other2 = j === i + 1 ? d : c;
        if (Math.abs(orient(other1, shared, other2)) < EPSILON) {
          const dot = (other1.x - shared.x) * (other2.x - shared.x) + (other1.y - shared.y) * (other2.y - shared.y);
          if (dot > 0) return false;
        }
        continue;
      }
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

export type PolygonProblem = "too-few" | "too-many" | "not-finite" | "self-intersecting" | "too-small";

/** Polygon validity: at least 3 finite points, at most MAX_POLYGON_POINTS, simple, and a minimum area (in the same unit as the points). */
export function validatePolygon(points: readonly Point[], minArea = 100): { ok: true } | { ok: false; problem: PolygonProblem } {
  if (points.length < 3) return { ok: false, problem: "too-few" };
  if (points.length > MAX_POLYGON_POINTS) return { ok: false, problem: "too-many" };
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { ok: false, problem: "not-finite" };
  if (!isSimplePolygon(points)) return { ok: false, problem: "self-intersecting" };
  if (polygonArea(points) < minArea) return { ok: false, problem: "too-small" };
  return { ok: true };
}

export function rectanglePolygon(a: Point, b: Point): Point[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

// Scale ------------------------------------------------------------------------

export const feetFromUnit = (value: number, unit: "ft" | "m") => (unit === "m" ? value / FT_TO_M : value);
export const unitFromFeet = (feet: number, unit: "ft" | "m") => (unit === "m" ? feet * FT_TO_M : feet);

/** Scale from a calibration line of known real length. Null when the line is too short or the length is not usable. */
export function makeScale(a: Point, b: Point, realLength: number, unit: "ft" | "m"): PlanScale | null {
  const px = distance(a, b);
  if (!Number.isFinite(px) || px < MIN_CALIBRATION_PX) return null;
  if (!Number.isFinite(realLength) || realLength <= 0) return null;
  const feet = feetFromUnit(realLength, unit);
  if (feet > LIMITS.maxDimensionFt) return null;
  return { pxPerFt: px / feet, unit };
}

export const pxToFeet = (px: number, scale: PlanScale) => px / scale.pxPerFt;
export const feetToPx = (feet: number, scale: PlanScale) => feet * scale.pxPerFt;
/** Unrounded area in sq ft from an area in square pixels. */
export const pxAreaToSqft = (areaPx: number, scale: PlanScale) => areaPx / (scale.pxPerFt * scale.pxPerFt);

/**
 * Whole sq ft, rounded half up (same semantics as roomAreaSqft in plan-reader/compute.ts:
 * floor(x + 0.5)), at least 1, capped at LIMITS.maxAreaSqft. Null when not a positive finite number.
 */
export function roundAreaSqft(rawSqft: number | null | undefined): number | null {
  if (typeof rawSqft !== "number" || !Number.isFinite(rawSqft) || rawSqft <= 0) return null;
  const area = Math.floor(rawSqft + 0.5 + EPSILON);
  return Math.min(LIMITS.maxAreaSqft, Math.max(1, area));
}

/** Area of a polygon in plan pixels as whole sq ft, or null when the scale is missing or the polygon is not valid. */
export function polygonAreaSqft(points: readonly Point[], scale: PlanScale | null): number | null {
  if (!scale) return null;
  if (!validatePolygon(points, 1).ok) return null;
  return roundAreaSqft(pxAreaToSqft(polygonArea(points), scale));
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * A length/width pair (feet) whose product rounds to the same whole sq ft as `areaSqft`
 * (width = sqrt(area), length = area / width). Used where a form needs a rectangle (calculator, quote line).
 */
export function equivalentDimensions(areaSqft: number): { lengthFt: number; widthFt: number } {
  const widthFt = round4(Math.sqrt(areaSqft));
  const lengthFt = round4(areaSqft / widthFt);
  return { lengthFt, widthFt };
}
