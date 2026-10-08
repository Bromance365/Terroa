import { describe, expect, it } from "vitest";
import { groupByFlooring, planQuoteLines, calculatorImport } from "@/lib/plan-reader/compute";
import { planImportSchema } from "@/lib/plan-reader/types";
import { lineSchema } from "@/lib/quote-schema";
import { cleanRoomName, measuredAreaSqft, measuredTotalSqft, toUiRooms, withAreas } from "./rooms";
import { toPreviewRooms } from "./preview";
import { rectanglePolygon } from "./geometry";
import type { MeasuredRoom, PlanScale } from "./types";

const scale: PlanScale = { pxPerFt: 10, unit: "ft" };
const make = (over: Partial<MeasuredRoom> & { id: string }): MeasuredRoom => ({
  name: "Salon",
  points: rectanglePolygon({ x: 0, y: 0 }, { x: 160, y: 150 }),
  areaSqft: null,
  productId: null,
  included: true,
  source: "rectangle",
  ...over,
});

describe("areas", () => {
  it("polygon areas need the scale, typed rooms do not", () => {
    const poly = make({ id: "a" });
    const typed = make({ id: "b", points: [], dimsFt: { lengthFt: 18 + 2 / 12, widthFt: 14 }, source: "typed" });
    expect(measuredAreaSqft(poly, null)).toBeNull();
    expect(measuredAreaSqft(poly, scale)).toBe(240);
    expect(measuredAreaSqft(typed, null)).toBe(254); // 18 pi 2 po x 14 pi = 254.33
  });
  it("withAreas refreshes areas when the scale changes and keeps identity otherwise", () => {
    const rooms = [make({ id: "a" })];
    const first = withAreas(rooms, scale);
    expect(first[0]!.areaSqft).toBe(240);
    expect(withAreas(first, scale)[0]).toBe(first[0]);
    expect(withAreas(first, { pxPerFt: 20, unit: "ft" })[0]!.areaSqft).toBe(60);
    expect(withAreas(first, null)[0]!.areaSqft).toBeNull();
  });
  it("total counts included rooms with an area only", () => {
    const rooms = withAreas([make({ id: "a" }), make({ id: "b", included: false }), make({ id: "c", points: [], source: "typed", dimsFt: { lengthFt: 10, widthFt: 10 } })], scale);
    expect(measuredTotalSqft(rooms)).toBe(340);
    expect(measuredTotalSqft(withAreas(rooms, null))).toBe(100);
  });
});

describe("hand-off to the quote and calculator", () => {
  const rooms = withAreas(
    [
      make({ id: "a", name: "Salon", productId: "p1" }),
      make({ id: "b", name: "Cuisine", productId: "p1", points: rectanglePolygon({ x: 0, y: 0 }, { x: 137, y: 119 }) }),
      make({ id: "c", name: "Bureau", productId: null, points: [], source: "typed", dimsFt: { lengthFt: 12, widthFt: 11 } }),
      make({ id: "d", name: "Garage", included: false, productId: "p2" }),
    ],
    scale,
  );
  it("groups by flooring with whole sq ft and the same area as the list", () => {
    const ui = toUiRooms(rooms, scale);
    const grouping = groupByFlooring(ui, () => 20);
    expect(rooms.map((r) => r.areaSqft)).toEqual([240, 163, 132, 240]);
    expect(grouping.groups).toHaveLength(1);
    expect(grouping.groups[0]!.areaSqft).toBe(403);
    expect(grouping.groups[0]!.rooms.map((r) => r.name)).toEqual(["Salon", "Cuisine"]);
    expect(grouping.unassigned.map((r) => r.name)).toEqual(["Bureau"]);
    const lines = planQuoteLines(grouping.groups, "mesure");
    expect(lines[0]).toMatchObject({ productId: "p1", source: "plan", sourceLabel: "mesure", plannedAreaSqft: 403, unit: "box" });
    expect(lines[0]!.quantity).toBe(23); // ceil(403 x 1.1 / 20) = 23
  });
  it("calculator payload passes the shared schema and keeps the areas", () => {
    const ui = toUiRooms(rooms, scale);
    const payload = calculatorImport(ui, "mesure · surfaces équivalentes");
    expect(planImportSchema.safeParse(payload).success).toBe(true);
    expect(payload.rooms).toHaveLength(3);
    for (const r of payload.rooms) expect(Math.round(r.lengthFt * r.widthFt)).toBe(Math.round(rooms.find((x) => x.name === r.name)!.areaSqft!));
  });
  it("rooms without an area are never counted", () => {
    const ui = toUiRooms(withAreas(rooms, null), null);
    expect(ui.find((r) => r.name === "Salon")!.included).toBe(false);
    expect(ui.find((r) => r.name === "Bureau")!.included).toBe(true);
    expect(planImportSchema.safeParse(calculatorImport(ui, "mesure")).success).toBe(true);
  });
  it("a produced quote line is accepted by the quote schema", () => {
    const grouping = groupByFlooring(toUiRooms(rooms, scale), () => 20);
    const line = planQuoteLines(grouping.groups, "mesure")[0]!;
    expect(lineSchema.safeParse({ productId: line.productId, quantity: line.quantity, unit: line.unit, rooms: line.rooms, plannedAreaSqft: line.plannedAreaSqft }).success).toBe(true);
  });
});

describe("room names", () => {
  it("cleans control characters and falls back to a number", () => {
    expect(cleanRoomName("  Salon\u202e\n  double ")).toBe("Salon double");
    expect(cleanRoomName("x".repeat(100))).toHaveLength(60);
    const ui = toUiRooms([make({ id: "z", name: "  \u200b " })], scale);
    expect(ui[0]!.name).toBe("#1");
  });
});

describe("toPreviewRooms", () => {
  it("converts to feet, y down, origin at the minimum corner", () => {
    const rooms = withAreas(
      [
        make({ id: "a", points: rectanglePolygon({ x: 100, y: 50 }, { x: 200, y: 150 }), productId: "p1" }),
        make({ id: "b", name: "Cuisine", points: rectanglePolygon({ x: 200, y: 50 }, { x: 300, y: 100 }) }),
      ],
      scale,
    );
    const out = toPreviewRooms(rooms, scale);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: "a",
      name: "Salon",
      productId: "p1",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    });
    expect(out[1]!.points[0]).toEqual({ x: 10, y: 0 });
    expect(out[1]!.points[2]).toEqual({ x: 20, y: 5 });
    for (const r of out) for (const p of r.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });
  it("skips excluded rooms and traced rooms without a scale, places typed rooms to the right", () => {
    const traced = make({ id: "a", points: rectanglePolygon({ x: 0, y: 0 }, { x: 100, y: 100 }) });
    const typed = make({ id: "t", name: "Bureau", points: [], source: "typed", dimsFt: { lengthFt: 12, widthFt: 8 } });
    const off = make({ id: "x", included: false });
    expect(toPreviewRooms([traced, off], null)).toEqual([]);
    const out = toPreviewRooms([traced, typed, off], scale);
    expect(out.map((r) => r.id)).toEqual(["a", "t"]);
    expect(out[1]!.points[0]!.x).toBeGreaterThan(10);
    const onlyTyped = toPreviewRooms([typed], null);
    expect(onlyTyped[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ]);
  });
});
