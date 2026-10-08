import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/quantities";
import { roomAreaSqft } from "@/lib/plan-reader/compute";
import {
  centroid,
  equivalentDimensions,
  isSimplePolygon,
  makeScale,
  perimeter,
  pointInPolygon,
  polygonArea,
  polygonAreaSqft,
  pxAreaToSqft,
  rectanglePolygon,
  roundAreaSqft,
  signedArea,
  validatePolygon,
} from "./geometry";
import type { Point } from "./types";

const square = (s: number, x = 0, y = 0): Point[] => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];
// L shape: 10x10 square with a 5x5 corner removed -> area 75
const L: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: 10 },
  { x: 0, y: 10 },
];

describe("area, centroid, containment", () => {
  it("shoelace area is orientation independent", () => {
    expect(polygonArea(square(10))).toBe(100);
    expect(polygonArea([...square(10)].reverse())).toBe(100);
    expect(signedArea(square(10))).toBe(100);
    expect(signedArea([...square(10)].reverse())).toBe(-100);
    expect(polygonArea(L)).toBe(75);
    expect(perimeter(square(10))).toBe(40);
  });
  it("centroid of a square and of an L", () => {
    expect(centroid(square(10))).toEqual({ x: 5, y: 5 });
    const c = centroid(L);
    expect(c.x).toBeCloseTo(4.1667, 3);
    expect(c.y).toBeCloseTo(4.1667, 3);
    expect(centroid([])).toEqual({ x: 0, y: 0 });
    expect(centroid([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }])).toEqual({ x: 2, y: 2 });
  });
  it("point in polygon, including the concave notch", () => {
    expect(pointInPolygon({ x: 2, y: 2 }, L)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 8 }, L)).toBe(false);
    expect(pointInPolygon({ x: 8, y: 2 }, L)).toBe(true);
    expect(pointInPolygon({ x: -1, y: 2 }, L)).toBe(false);
  });
});

describe("validity", () => {
  it("accepts simple polygons", () => {
    expect(isSimplePolygon(square(10))).toBe(true);
    expect(isSimplePolygon(L)).toBe(true);
    expect(validatePolygon(L, 50)).toEqual({ ok: true });
  });
  it("rejects too few points, bow-ties, tiny areas and bad numbers", () => {
    expect(validatePolygon([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toEqual({ ok: false, problem: "too-few" });
    const bowtie: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(validatePolygon(bowtie)).toEqual({ ok: false, problem: "self-intersecting" });
    expect(validatePolygon(square(5))).toEqual({ ok: false, problem: "too-small" });
    expect(validatePolygon(square(5), 10)).toEqual({ ok: true });
    expect(validatePolygon([{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 4, y: 4 }])).toEqual({ ok: false, problem: "not-finite" });
  });
  it("rejects a fold-back along the same line and a vertex touching a far edge", () => {
    const fold: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }];
    expect(isSimplePolygon(fold)).toBe(false);
    const touch: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 0 }, { x: 0, y: 10 }];
    expect(isSimplePolygon(touch)).toBe(false);
  });
  it("caps the vertex count", () => {
    const many: Point[] = Array.from({ length: 401 }, (_, i) => ({ x: Math.cos(i) * 100, y: Math.sin(i) * 100 }));
    expect(validatePolygon(many)).toEqual({ ok: false, problem: "too-many" });
  });
  it("rectanglePolygon orders corners whatever the drag direction", () => {
    expect(rectanglePolygon({ x: 10, y: 8 }, { x: 2, y: 3 })).toEqual([
      { x: 2, y: 3 },
      { x: 10, y: 3 },
      { x: 10, y: 8 },
      { x: 2, y: 8 },
    ]);
  });
});

describe("scale", () => {
  it("pixels per foot from a line and a typed length", () => {
    const s = makeScale({ x: 0, y: 0 }, { x: 300, y: 400 }, 25, "ft");
    expect(s?.pxPerFt).toBe(20);
    expect(s?.unit).toBe("ft");
  });
  it("converts metres to feet", () => {
    const s = makeScale({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, "m");
    expect(s?.pxPerFt).toBeCloseTo(100 / (10 / 0.3048), 6);
    expect(s?.unit).toBe("m");
  });
  it("refuses a click, a zero length and an absurd length", () => {
    expect(makeScale({ x: 0, y: 0 }, { x: 2, y: 0 }, 10, "ft")).toBeNull();
    expect(makeScale({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, "ft")).toBeNull();
    expect(makeScale({ x: 0, y: 0 }, { x: 100, y: 0 }, NaN, "ft")).toBeNull();
    expect(makeScale({ x: 0, y: 0 }, { x: 100, y: 0 }, LIMITS.maxDimensionFt + 1, "ft")).toBeNull();
  });
  it("area in sq ft from square pixels", () => {
    const s = { pxPerFt: 10, unit: "ft" as const };
    expect(pxAreaToSqft(25400, s)).toBe(254);
    expect(polygonAreaSqft([{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 150 }, { x: 0, y: 150 }], s)).toBe(240);
    expect(polygonAreaSqft(square(100), null)).toBeNull();
    expect(polygonAreaSqft([{ x: 0, y: 0 }, { x: 1, y: 1 }], s)).toBeNull();
  });
});

describe("rounding matches the plan reader", () => {
  it("half up, whole sq ft, at least 1, capped", () => {
    expect(roundAreaSqft(254.33)).toBe(254);
    expect(roundAreaSqft(137.67)).toBe(138);
    expect(roundAreaSqft(10.5)).toBe(11);
    expect(roundAreaSqft(0.2)).toBe(1);
    expect(roundAreaSqft(1e9)).toBe(LIMITS.maxAreaSqft);
    expect(roundAreaSqft(0)).toBeNull();
    expect(roundAreaSqft(-4)).toBeNull();
    expect(roundAreaSqft(NaN)).toBeNull();
  });
  it("gives the same whole number as roomAreaSqft for the same product", () => {
    const pairs: Array<[number, number]> = [[18 + 2 / 12, 14], [9 + 10 / 12, 14], [12.5, 12.5], [10, 10.05], [0.3, 0.3], [15.25, 11.2], [200, 300]];
    for (const [l, w] of pairs) expect(roundAreaSqft(l * w)).toBe(roomAreaSqft(l, w));
  });
  it("equivalent dimensions reproduce the area through roomAreaSqft", () => {
    for (let area = 1; area <= 3000; area += 7) {
      const { lengthFt, widthFt } = equivalentDimensions(area);
      expect(roomAreaSqft(lengthFt, widthFt)).toBe(area);
    }
    for (const area of [99999, 100000, 54321]) {
      const { lengthFt, widthFt } = equivalentDimensions(area);
      expect(lengthFt).toBeLessThanOrEqual(LIMITS.maxDimensionFt);
      expect(roomAreaSqft(lengthFt, widthFt)).toBe(area);
    }
  });
});
