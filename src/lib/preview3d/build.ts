/**
 * Pure geometry for the 3D flooring preview. No DOM, no WebGL, no three.js import:
 * the component turns these plain arrays into BufferGeometry, so this module is
 * unit-testable in node and keeps three.js out of every other bundle.
 *
 * Coordinates: plan feet, x right, y down. In 3D, X = plan x, Z = plan y, Y is up
 * (a top-down view therefore shows the plan with the same orientation as the 2D tool).
 *
 * Walls are INDICATIVE only: they follow each room's edges, openings (doors, windows)
 * are not modelled, and thickness/height are display values, not measurements.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface PreviewRoom {
  id: string;
  name: string;
  /** Feet, y down. */
  points: Pt[];
  productId: string | null;
}

export interface ProductInfo {
  kind: "floor" | "panel";
  format: "plank" | "large-tile" | "panel";
}

export const WALL_HEIGHT_DEFAULT_FT = 8;
export const WALL_HEIGHT_MIN_FT = 7;
export const WALL_HEIGHT_MAX_FT = 12;
export const WALL_THICKNESS_FT = 0.4;
/** Below this the polygon is treated as degenerate and skipped. */
export const MIN_ROOM_AREA_SQFT = 0.5;
export const EYE_HEIGHT_FT = 5.5;
/** Display pitch of the wall slat panels (ft). Indicative, not a product spec. */
export const SLAT_PITCH_FT = 0.5;

const EPS = 1e-9;
// Index helpers: the indices are always in range by construction.
const P = (a: readonly Pt[], i: number): Pt => a[i] as Pt;
const N = (a: readonly number[], i: number): number => a[i] as number;

export function clampWallHeight(v: number | undefined | null): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return WALL_HEIGHT_DEFAULT_FT;
  return Math.min(WALL_HEIGHT_MAX_FT, Math.max(WALL_HEIGHT_MIN_FT, v));
}

/** Shoelace area. Positive when the polygon runs counter-clockwise in (x, y) maths orientation. */
export function signedArea(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = P(pts, i);
    const b = P(pts, (i + 1) % pts.length);
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const polygonArea = (pts: readonly Pt[]) => Math.abs(signedArea(pts));

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/**
 * Drops non-finite points, repeated points (including a closing duplicate) and collinear
 * vertices, then orients the ring so signedArea > 0. Returns null when the room is degenerate.
 */
export function cleanPolygon(input: readonly Pt[]): Pt[] | null {
  if (!Array.isArray(input)) return null;
  let pts = input.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y }));
  const dedup: Pt[] = [];
  for (const p of pts) {
    const last = P(dedup, dedup.length - 1);
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) dedup.push(p);
  }
  while (dedup.length > 1 && Math.hypot(P(dedup, 0).x - P(dedup, dedup.length - 1).x, P(dedup, 0).y - P(dedup, dedup.length - 1).y) <= 1e-6) dedup.pop();
  pts = dedup;
  // Remove collinear vertices (repeat until stable).
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = P(pts, (i + pts.length - 1) % pts.length);
      const next = P(pts, (i + 1) % pts.length);
      if (Math.abs(cross(prev, P(pts, i), next)) < 1e-7) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (pts.length < 3) return null;
  const area = signedArea(pts);
  if (!Number.isFinite(area) || Math.abs(area) < MIN_ROOM_AREA_SQFT) return null;
  return area < 0 ? pts.reverse() : pts;
}

function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  return d1 >= -EPS && d2 >= -EPS && d3 >= -EPS;
}

/**
 * Ear-clipping triangulation of a simple polygon (convex or concave, e.g. an L shape).
 * Input must be counter-clockwise (signedArea > 0), as returned by cleanPolygon.
 * Returns index triples that are all counter-clockwise, or null if the ring is not
 * triangulable (self-intersecting). Never throws.
 */
export function triangulate(pts: readonly Pt[]): number[] | null {
  const n = pts.length;
  if (n < 3) return null;
  const idx = Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  let guard = n * n + 10;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = N(idx, (k + idx.length - 1) % idx.length);
      const ib = N(idx, k);
      const ic = N(idx, (k + 1) % idx.length);
      const a = P(pts, ia);
      const b = P(pts, ib);
      const c = P(pts, ic);
      if (cross(a, b, c) <= EPS) continue; // reflex or flat
      let ear = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const p = P(pts, j);
        // Ignore vertices coincident with a triangle corner (touching rings).
        if ((p.x === a.x && p.y === a.y) || (p.x === b.x && p.y === b.y) || (p.x === c.x && p.y === c.y)) continue;
        if (inTriangle(p, a, b, c)) {
          ear = false;
          break;
        }
      }
      if (!ear) continue;
      out.push(ia, ib, ic);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) return null;
  }
  if (idx.length === 3) out.push(N(idx, 0), N(idx, 1), N(idx, 2));
  else return null;
  return out;
}

/** Sum of triangle areas, for correctness checks. */
export function trianglesArea(pts: readonly Pt[], tris: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < tris.length; i += 3) s += Math.abs(cross(P(pts, N(tris, i)), P(pts, N(tris, i + 1)), P(pts, N(tris, i + 2)))) / 2;
  return s;
}

/** Visual repeat length of one texture tile in feet. Indicative only (a display scale, not a spec). */
export function textureTileFt(info: ProductInfo | null | undefined): number {
  if (!info) return 4;
  if (info.kind === "panel") return 1.5;
  return info.format === "large-tile" ? 3 : 4;
}

export interface FloorMesh {
  roomId: string;
  name: string;
  productId: string | null;
  areaSqFt: number;
  /** xyz triplets, y = 0. */
  positions: number[];
  /** uv pairs in tile units (feet / tileFt). */
  uvs: number[];
  /** Triangle indices, wound to face up (+Y). */
  indices: number[];
  tileFt: number;
}

export interface WallSegment {
  roomId: string;
  /** Box centre in 3D (X, Z). */
  cx: number;
  cz: number;
  /** Box dimensions: length along the edge (extended by thickness to close corners), height, thickness. */
  length: number;
  height: number;
  thickness: number;
  /** Rotation about Y, radians. */
  rotationY: number;
}

export interface SlatPanel {
  roomId: string;
  productId: string;
  /** Slat centres (X, Z) along the longest wall, on its inside face. */
  slats: { x: number; z: number }[];
  rotationY: number;
  width: number;
  height: number;
  depth: number;
  /** Centre height above the floor. */
  cy: number;
  tileFt: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  width: number;
  depth: number;
}

export interface PreviewScene {
  floors: FloorMesh[];
  walls: WallSegment[];
  panels: SlatPanel[];
  bounds: Bounds;
  wallHeightFt: number;
  /** Room ids that were degenerate and skipped. */
  skipped: string[];
  /** Largest valid room, used for the interior view. */
  biggest: { roomId: string; center: Pt; width: number; depth: number } | null;
}

export interface BuildOptions {
  wallHeightFt?: number;
  /** Resolves a product id to its kind and format. Unknown ids are treated as plain floors. */
  productInfo?: (productId: string) => ProductInfo | null | undefined;
}

function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = P(poly, i);
    const b = P(poly, j);
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Area centroid, falling back to the centroid of the largest triangle if it falls outside (concave rooms). */
export function interiorPoint(pts: readonly Pt[], tris: readonly number[]): Pt {
  let cxs = 0;
  let cys = 0;
  let a2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = P(pts, i);
    const q = P(pts, (i + 1) % pts.length);
    const w = p.x * q.y - q.x * p.y;
    a2 += w;
    cxs += (p.x + q.x) * w;
    cys += (p.y + q.y) * w;
  }
  if (Math.abs(a2) > EPS) {
    const c = { x: cxs / (3 * a2), y: cys / (3 * a2) };
    if (pointInPolygon(c, pts)) return c;
  }
  let best: Pt = P(pts, 0);
  let bestA = -1;
  for (let i = 0; i < tris.length; i += 3) {
    const a = P(pts, N(tris, i));
    const b = P(pts, N(tris, i + 1));
    const c = P(pts, N(tris, i + 2));
    const ar = Math.abs(cross(a, b, c));
    if (ar > bestA) {
      bestA = ar;
      best = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    }
  }
  return best;
}

export function buildScene(rooms: readonly PreviewRoom[], opts: BuildOptions = {}): PreviewScene {
  const wallHeightFt = clampWallHeight(opts.wallHeightFt);
  const floors: FloorMesh[] = [];
  const walls: WallSegment[] = [];
  const panels: SlatPanel[] = [];
  const skipped: string[] = [];
  let biggest: PreviewScene["biggest"] = null;
  let biggestArea = -1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const half = WALL_THICKNESS_FT;

  for (const room of rooms ?? []) {
    let pts: Pt[] | null = null;
    let tris: number[] | null = null;
    try {
      pts = cleanPolygon(room?.points ?? []);
      tris = pts ? triangulate(pts) : null;
    } catch {
      pts = null;
      tris = null;
    }
    if (!pts || !tris) {
      skipped.push(String(room?.id ?? ""));
      continue;
    }
    const info = room.productId ? (opts.productInfo?.(room.productId) ?? null) : null;
    const isPanel = info?.kind === "panel";
    const tileFt = textureTileFt(isPanel ? { kind: "floor", format: "plank" } : info);
    const area = polygonArea(pts);

    const positions: number[] = [];
    const uvs: number[] = [];
    for (const p of pts) {
      positions.push(p.x, 0, p.y);
      uvs.push(p.x / tileFt, p.y / tileFt);
    }
    // Triangulation is CCW in (x, y); with Z = y the face normal points down, so flip to face up.
    const indices: number[] = [];
    for (let i = 0; i < tris.length; i += 3) indices.push(N(tris, i), N(tris, i + 2), N(tris, i + 1));
    floors.push({ roomId: room.id, name: room.name, productId: room.productId, areaSqFt: area, positions, uvs, indices, tileFt });

    let longest = { i: 0, len: -1 };
    for (let i = 0; i < pts.length; i++) {
      const a = P(pts, i);
      const b = P(pts, (i + 1) % pts.length);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > longest.len) longest = { i, len };
      // Ring is CCW in (x, y): the inside is to the left of the edge, normal n = (-dy, dx) / len.
      const nx = -dy / len;
      const ny = dx / len;
      // Wall centred half a thickness outside the edge so the floor area stays whole.
      walls.push({
        roomId: room.id,
        cx: (a.x + b.x) / 2 - (nx * WALL_THICKNESS_FT) / 2,
        cz: (a.y + b.y) / 2 - (ny * WALL_THICKNESS_FT) / 2,
        length: len + WALL_THICKNESS_FT,
        height: wallHeightFt,
        thickness: WALL_THICKNESS_FT,
        rotationY: -Math.atan2(dy, dx),
      });
    }

    if (isPanel && room.productId && longest.len > SLAT_PITCH_FT * 2) {
      const a = P(pts, longest.i);
      const b = P(pts, (longest.i + 1) % pts.length);
      const dx = (b.x - a.x) / longest.len;
      const dy = (b.y - a.y) / longest.len;
      const nx = -dy;
      const ny = dx;
      const depth = 0.1;
      const count = Math.max(1, Math.floor(longest.len / SLAT_PITCH_FT));
      const pitch = longest.len / count;
      const slats = Array.from({ length: count }, (_, k) => {
        const t = (k + 0.5) * pitch;
        return { x: a.x + dx * t + nx * (depth / 2 + 0.02), z: a.y + dy * t + ny * (depth / 2 + 0.02) };
      });
      const height = wallHeightFt * 0.7;
      panels.push({
        roomId: room.id,
        productId: room.productId,
        slats,
        rotationY: -Math.atan2(dy, dx),
        width: pitch * 0.78,
        height,
        depth,
        cy: 1 + height / 2,
        tileFt: textureTileFt(info),
      });
    }

    for (const p of pts) {
      minX = Math.min(minX, p.x - half);
      maxX = Math.max(maxX, p.x + half);
      minZ = Math.min(minZ, p.y - half);
      maxZ = Math.max(maxZ, p.y + half);
    }
    if (area > biggestArea) {
      biggestArea = area;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      biggest = {
        roomId: room.id,
        center: interiorPoint(pts, tris),
        width: Math.max(...xs) - Math.min(...xs),
        depth: Math.max(...ys) - Math.min(...ys),
      };
    }
  }

  if (!floors.length) {
    minX = -5;
    maxX = 5;
    minZ = -5;
    maxZ = 5;
  }
  const bounds: Bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
  return { floors, walls, panels, bounds, wallHeightFt, skipped, biggest };
}

export interface CameraFit {
  /** Orthographic half-height so the whole plan is visible for the given aspect (width / height). */
  orthoHalfHeight: number;
  /** Perspective distance for a vertical fov (degrees) that fits the plan from above. */
  perspectiveDistance: number;
  center: { x: number; z: number };
}

export function fitCamera(bounds: Bounds, aspect: number, fovDeg = 45, margin = 1.12): CameraFit {
  const a = Number.isFinite(aspect) && aspect > 0.1 ? aspect : 1.6;
  const halfNeeded = Math.max(bounds.depth / 2, bounds.width / 2 / a) * margin;
  const tan = Math.tan((Math.min(120, Math.max(10, fovDeg)) * Math.PI) / 360);
  return { orthoHalfHeight: halfNeeded, perspectiveDistance: halfNeeded / tan, center: { x: bounds.cx, z: bounds.cz } };
}

/** Starting orbit for the eye-level view inside the biggest room. */
export function interiorOrbit(scene: PreviewScene) {
  const b = scene.biggest;
  const c = b?.center ?? { x: scene.bounds.cx, y: scene.bounds.cz };
  const span = b ? Math.min(b.width, b.depth) : Math.min(scene.bounds.width, scene.bounds.depth);
  const radius = Math.max(4, span * 0.35);
  return { target: { x: c.x, y: EYE_HEIGHT_FT - 1, z: c.y }, radius, minDistance: 2, maxDistance: radius * 1.6 };
}
