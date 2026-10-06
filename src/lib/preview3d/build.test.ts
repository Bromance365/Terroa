import { describe, expect, it } from "vitest";
import {
  buildScene,
  cleanPolygon,
  clampWallHeight,
  fitCamera,
  polygonArea,
  textureTileFt,
  triangulate,
  trianglesArea,
  WALL_THICKNESS_FT,
  type PreviewRoom,
} from "./build";
import { sampleRooms } from "./sample";

const rect = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 10 },
  { x: 0, y: 10 },
];
const L = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 8 },
  { x: 8, y: 8 },
  { x: 8, y: 20 },
  { x: 0, y: 20 },
];
const info = (id: string) => (id === "panel" ? ({ kind: "panel", format: "panel" } as const) : ({ kind: "floor", format: "plank" } as const));

describe("triangulation", () => {
  it("rectangle: 2 triangles, area 200", () => {
    const pts = cleanPolygon(rect)!;
    const tris = triangulate(pts)!;
    expect(tris.length / 3).toBe(2);
    expect(trianglesArea(pts, tris)).toBeCloseTo(200);
    expect(polygonArea(pts)).toBeCloseTo(200);
  });

  it("L shape (either winding): n-2 triangles and exact area 20*8 + 8*12 = 256", () => {
    for (const ring of [L, [...L].reverse()]) {
      const pts = cleanPolygon(ring)!;
      const tris = triangulate(pts)!;
      expect(tris.length / 3).toBe(pts.length - 2);
      expect(trianglesArea(pts, tris)).toBeCloseTo(256);
    }
  });

  it("floor indices face up (+Y) for any input winding", () => {
    for (const ring of [rect, [...rect].reverse(), L]) {
      const f = buildScene([{ id: "a", name: "A", points: ring, productId: null }]).floors[0]!;
      for (let i = 0; i < f.indices.length; i += 3) {
        const v = (k: number) => [f.positions[f.indices[i + k]! * 3]!, f.positions[f.indices[i + k]! * 3 + 2]!] as [number, number];
        const [a, b, c] = [v(0), v(1), v(2)];
        const ny = -((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
        expect(ny).toBeGreaterThan(0);
      }
    }
  });

  it("degenerate polygons are skipped and never throw", () => {
    const bad: PreviewRoom[] = [
      { id: "line", name: "Line", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], productId: null },
      { id: "two", name: "Two", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], productId: null },
      { id: "nan", name: "NaN", points: [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 4, y: 4 }, { x: 0, y: 4 }], productId: null },
      { id: "tiny", name: "Tiny", points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }], productId: null },
      { id: "bow", name: "Bowtie", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }], productId: null },
      { id: "ok", name: "Ok", points: rect, productId: null },
    ];
    let scene!: ReturnType<typeof buildScene>;
    expect(() => (scene = buildScene(bad))).not.toThrow();
    expect(scene.floors.map((f) => f.roomId)).toContain("ok");
    expect(scene.skipped).toEqual(expect.arrayContaining(["line", "two", "tiny"]));
    expect(() => buildScene(undefined as unknown as PreviewRoom[])).not.toThrow();
  });
});

describe("scene", () => {
  it("builds one wall per edge with clamped height and thickness", () => {
    const s = buildScene([{ id: "a", name: "A", points: rect, productId: null }], { wallHeightFt: 99 });
    expect(s.walls).toHaveLength(4);
    expect(s.wallHeightFt).toBe(12);
    expect(s.walls[0]!.thickness).toBe(WALL_THICKNESS_FT);
    expect(s.walls.every((w) => w.height === 12)).toBe(true);
  });

  it("walls sit outside the floor", () => {
    const s = buildScene([{ id: "a", name: "A", points: rect, productId: null }]);
    for (const w of s.walls) {
      const inside = w.cx > 0 && w.cx < 20 && w.cz > 0 && w.cz < 10;
      expect(inside).toBe(false);
    }
  });

  it("clamps wall height", () => {
    expect(clampWallHeight(undefined)).toBe(8);
    expect(clampWallHeight(NaN)).toBe(8);
    expect(clampWallHeight(3)).toBe(7);
    expect(clampWallHeight(30)).toBe(12);
    expect(clampWallHeight(9)).toBe(9);
  });

  it("panel products become slats on the longest wall, not a floor texture", () => {
    const s = buildScene([{ id: "a", name: "A", points: rect, productId: "panel" }], { productInfo: info });
    expect(s.panels).toHaveLength(1);
    expect(s.panels[0]!.slats.length).toBe(40); // 20 ft / 0.5 ft
    // longest wall is y=0 or y=10 edge (20 ft); slats are inside the room
    for (const p of s.panels[0]!.slats) expect(p.z > 0 && p.z < 10).toBe(true);
    expect(buildScene([{ id: "a", name: "A", points: rect, productId: "x" }], { productInfo: info }).panels).toHaveLength(0);
  });

  it("texture scale: plank tile is about 4 ft", () => {
    expect(textureTileFt({ kind: "floor", format: "plank" })).toBe(4);
    const f = buildScene([{ id: "a", name: "A", points: rect, productId: "x" }], { productInfo: info }).floors[0]!;
    expect(f.uvs.slice(0, 6)).toEqual([0, 0, 5, 0, 5, 2.5]);
  });

  it("picks the biggest room and keeps its interior point inside the L shape", () => {
    const s = buildScene(sampleRooms);
    expect(s.biggest?.roomId).toBe("r1");
    const l = buildScene([{ id: "l", name: "L", points: L, productId: null }]);
    const c = l.biggest!.center;
    const inArm = (c.x > 0 && c.x < 20 && c.y > 0 && c.y < 8) || (c.x > 0 && c.x < 8 && c.y > 0 && c.y < 20);
    expect(inArm).toBe(true);
  });
});

describe("camera fit", () => {
  it("fits a wide plan by width and a tall plan by depth", () => {
    const wide = buildScene([{ id: "a", name: "A", points: rect, productId: null }]).bounds;
    const f = fitCamera(wide, 1.6);
    expect(f.orthoHalfHeight).toBeGreaterThanOrEqual((wide.width / 2 / 1.6) * 1.1);
    const tall = buildScene([{ id: "a", name: "A", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 40 }, { x: 0, y: 40 }], productId: null }]).bounds;
    expect(fitCamera(tall, 1.6).orthoHalfHeight).toBeGreaterThanOrEqual((tall.depth / 2) * 1.1);
    expect(f.center.x).toBeCloseTo(wide.cx);
  });

  it("is safe for empty scenes and bad aspect", () => {
    const b = buildScene([]).bounds;
    expect(b.width).toBe(10);
    const f = fitCamera(b, NaN);
    expect(Number.isFinite(f.perspectiveDistance)).toBe(true);
  });
});
