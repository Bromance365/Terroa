import { describe, expect, it } from "vitest";
import {
  baseFileName,
  boxesForArea,
  buildUiRooms,
  calculatorImport,
  formatFeetInches,
  groupByFlooring,
  includedAreaSqft,
  parseDimensionInput,
  planQuoteLines,
  roomAreaSqft,
  roomDisplayName,
} from "./compute";
import { mockAnalyzer } from "./analyzer";
import { planImportSchema, type UiRoom } from "./types";
import { quoteLineSchema } from "@/lib/quote-store";

const make = (over: Partial<UiRoom> & { id: string }): UiRoom => ({
  n: 1,
  label: "X",
  name: "Room",
  page: 1,
  confidence: "high",
  reason: "",
  bbox: { x: 0, y: 0, w: 10, h: 10 },
  lengthFt: 10,
  widthFt: 10,
  lengthDraft: null,
  widthDraft: null,
  productId: null,
  included: true,
  ...over,
});

describe("roomAreaSqft", () => {
  it("recomputes from dimensions with floor(x + 0.5)", () => {
    expect(roomAreaSqft(18.1667, 14)).toBe(254);
    expect(roomAreaSqft(9.8333, 14)).toBe(138);
    expect(roomAreaSqft(12, 10)).toBe(120);
  });
  it("returns null for missing or invalid dimensions", () => {
    expect(roomAreaSqft(null, 10)).toBeNull();
    expect(roomAreaSqft(10, undefined)).toBeNull();
    expect(roomAreaSqft(-1, 10)).toBeNull();
    expect(roomAreaSqft(0, 10)).toBeNull();
    expect(roomAreaSqft(Number.NaN, 10)).toBeNull();
    expect(roomAreaSqft(Infinity, 10)).toBeNull();
  });
  it("clamps hostile values to the limits", () => {
    expect(roomAreaSqft(9999, 9999)).toBe(100000);
    expect(roomAreaSqft(0.1, 0.1)).toBe(1);
  });
});

describe("parseDimensionInput", () => {
  it("accepts comma and point, rejects the rest", () => {
    expect(parseDimensionInput("12,5").value).toBe(12.5);
    expect(parseDimensionInput("12.5").value).toBe(12.5);
    expect(parseDimensionInput("").error).toBe("empty");
    expect(parseDimensionInput("-3").error).toBe("invalid");
    expect(parseDimensionInput("1e3").error).toBe("invalid");
    expect(parseDimensionInput("1001").error).toBe("too-large");
  });
});

describe("boxesForArea", () => {
  it("rounds the order area and the boxes up", () => {
    expect(boxesForArea(374, 20)).toBe(21); // 374 * 1.1 = 411.4 -> 412 -> 20.6
    expect(boxesForArea(100, 20)).toBe(6); // 110 / 20 = 5.5
    expect(boxesForArea(200, 20)).toBe(11); // 220.00000000000003 stays 220
  });
  it("returns null without coverage or area", () => {
    expect(boxesForArea(100, null)).toBeNull();
    expect(boxesForArea(100, 0)).toBeNull();
    expect(boxesForArea(0, 20)).toBeNull();
  });
});

describe("grouping", () => {
  const rooms = [
    make({ id: "a", name: "Salon", productId: "p1", lengthFt: 18.1667, widthFt: 14 }),
    make({ id: "b", name: "Cuisine", productId: "p1", lengthFt: 12, widthFt: 10 }),
    make({ id: "c", name: "Chambre", productId: "p2" }),
    make({ id: "d", name: "Corridor", productId: null, lengthFt: 12, widthFt: 4 }),
    make({ id: "e", name: "SDB", productId: "p1", included: false }),
    make({ id: "f", name: "Illisible", productId: "p2", lengthFt: null, widthFt: null, confidence: "illegible" }),
  ];
  const cov = (id: string) => (id === "p1" ? 20 : null);
  const g = groupByFlooring(rooms, cov);

  it("groups included rooms by product and sums recomputed areas", () => {
    expect(g.groups.map((x) => [x.productId, x.areaSqft, x.rooms.map((r) => r.name)])).toEqual([
      ["p1", 374, ["Salon", "Cuisine"]],
      ["p2", 100, ["Chambre"]],
    ]);
  });
  it("computes boxes from coverage, null when unknown", () => {
    expect(g.groups[0].boxes).toBe(21);
    expect(g.groups[1].boxes).toBeNull();
  });
  it("lists rooms without flooring", () => {
    expect(g.unassigned.map((r) => r.name)).toEqual(["Corridor"]);
    expect(g.unassignedAreaSqft).toBe(48);
  });
  it("totals only included rooms with a usable area", () => {
    expect(includedAreaSqft(rooms)).toBe(374 + 100 + 48);
  });
  it("builds valid quote lines (box, or area fallback)", () => {
    const lines = planQuoteLines(g.groups, "Plan RDC");
    expect(lines[0]).toMatchObject({ productId: "p1", unit: "box", quantity: 21, plannedAreaSqft: 374, source: "plan", rooms: ["Salon", "Cuisine"] });
    expect(lines[1]).toMatchObject({ unit: "area", quantity: 100 });
    for (const l of lines) expect(quoteLineSchema.safeParse({ ...l, id: "x" }).success).toBe(true);
  });
  it("builds a calculator payload from counted rooms only", () => {
    const payload = calculatorImport(rooms, "Plan.pdf");
    expect(planImportSchema.safeParse(payload).success).toBe(true);
    expect(payload.rooms.map((r) => r.name)).toEqual(["Salon", "Cuisine", "Chambre", "Corridor"]);
  });
});

describe("buildUiRooms with the mock sample", () => {
  it("builds rooms, excludes illegible ones and applies hints", async () => {
    const result = await mockAnalyzer(new File(["%PDF-1.7"], "x.pdf"), {});
    const rooms = buildUiRooms(result, "fr");
    expect(rooms).toHaveLength(8);
    expect(rooms[0]).toMatchObject({ name: "Salon", productId: "p-chene-naturel", included: true });
    expect(rooms[5]).toMatchObject({ name: "Salle de bain", included: false });
    expect(includedAreaSqft(rooms)).toBe(944);
  }, 10000);
  it("excludes illegible rooms by default and never includes one without dimensions", () => {
    const rooms = buildUiRooms(
      {
        extraction: {
          readable: true,
          units: "imperial",
          scaleText: null,
          warnings: [],
          rooms: [
            { label: "???", page: 1, lengthFt: null, widthFt: null, confidence: "illegible", bbox: { x: 0, y: 0, w: 5, h: 5 } },
            { label: "BUREAU", page: 1, lengthFt: 10, widthFt: 12, confidence: "illegible", bbox: { x: 0, y: 0, w: 5, h: 5 } },
          ],
        },
      },
      "en",
    );
    expect(rooms.map((r) => r.included)).toEqual([false, false]);
    expect(rooms[1].name).toBe("Office");
  });
});

describe("helpers", () => {
  it("names and formats", () => {
    expect(roomDisplayName("CH. PRINC.", "fr")).toBe("Chambre principale");
    expect(roomDisplayName("S.D.B.", "en")).toBe("Bathroom");
    expect(roomDisplayName("ENTRÉE", "fr")).toBe("Entrée");
    expect(roomDisplayName("CHAMBRE 2", "fr")).toBe("Chambre 2");
    expect(roomDisplayName("X".repeat(60), "fr")).toHaveLength(40);
    expect(formatFeetInches(18.1667, "fr")).toBe("18 pi 2 po");
    expect(formatFeetInches(9.9999, "en")).toBe("10 ft 0 in");
    expect(baseFileName("Plan_RDC.pdf")).toBe("Plan_RDC");
  });
});
