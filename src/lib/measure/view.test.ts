import { describe, expect, it } from "vitest";
import { downscaleRatio, fitView, panBy, pinchView, planToScreen, screenToPlan, zoomAt, zoomLimits } from "./view";

describe("view maths", () => {
  it("round trips plan and screen points", () => {
    const v = { zoom: 2.5, x: 40, y: -12 };
    const p = { x: 123, y: 77 };
    const back = screenToPlan(v, planToScreen(v, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
  it("fits and centres", () => {
    const v = fitView(2000, 1000, 800, 600, 0);
    expect(v.zoom).toBeCloseTo(0.4, 9);
    expect(v.x).toBeCloseTo(0, 9);
    expect(v.y).toBeCloseTo(100, 9);
  });
  it("zoom keeps the point under the cursor fixed and respects limits", () => {
    const v = fitView(2000, 1000, 800, 600);
    const limits = zoomLimits(v.zoom);
    const before = screenToPlan(v, { x: 300, y: 200 });
    const z = zoomAt(v, 2, 300, 200, limits);
    const after = screenToPlan(z, { x: 300, y: 200 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomAt(v, 1e6, 0, 0, limits).zoom).toBe(limits.max);
    expect(zoomAt(v, 1e-6, 0, 0, limits).zoom).toBe(limits.min);
  });
  it("pinch zooms about the midpoint and follows the fingers", () => {
    const v = { zoom: 1, x: 0, y: 0 };
    const limits = { min: 0.1, max: 50 };
    const out = pinchView(v, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 90, y: 110 }, { x: 290, y: 110 }], limits);
    expect(out.zoom).toBeCloseTo(2, 9);
    // The plan point that was under the old midpoint is under the new midpoint.
    const p = screenToPlan(v, { x: 150, y: 100 });
    const s = planToScreen(out, p);
    expect(s.x).toBeCloseTo(190, 6);
    expect(s.y).toBeCloseTo(110, 6);
  });
  it("pan and downscale", () => {
    expect(panBy({ zoom: 1, x: 5, y: 5 }, 3, -2)).toEqual({ zoom: 1, x: 8, y: 3 });
    expect(downscaleRatio(3000, 2000, 1500)).toBe(0.5);
    expect(downscaleRatio(800, 600, 1500)).toBe(1);
  });
});
