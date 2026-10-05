import { describe, expect, it } from "vitest";
import { extractionSchema, parseUntrustedExtraction, planImportSchema, sanitizeExtraction } from "./types";

const room = (over: Record<string, unknown> = {}) => ({
  label: "SALON",
  page: 1,
  lengthFt: 18,
  widthFt: 14,
  confidence: "high",
  bbox: { x: 4, y: 6, w: 40, h: 46 },
  ...over,
});
const doc = (rooms: unknown[] = [room()], over: Record<string, unknown> = {}) => ({
  readable: true,
  units: "imperial",
  scaleText: null,
  rooms,
  warnings: [],
  ...over,
});

describe("extractionSchema", () => {
  it("accepts a valid extraction", () => {
    expect(extractionSchema.safeParse(doc()).success).toBe(true);
  });
  it("rejects out-of-range dimensions", () => {
    expect(extractionSchema.safeParse(doc([room({ lengthFt: 9999 })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ widthFt: -4 })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ widthFt: 0 })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ widthFt: Number.NaN })])).success).toBe(false);
  });
  it("rejects extra fields at every level", () => {
    expect(extractionSchema.safeParse({ ...doc(), area: 9999 }).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ areaSqft: 9999 })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ bbox: { x: 0, y: 0, w: 1, h: 1, z: 2 } })])).success).toBe(false);
  });
  it("rejects long labels, too many rooms and bad enums", () => {
    expect(extractionSchema.safeParse(doc([room({ label: "A".repeat(61) })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc(Array.from({ length: 61 }, () => room()))).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ confidence: "certain" })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ bbox: { x: 0, y: 0, w: 101, h: 1 } })])).success).toBe(false);
  });
  it("rejects control and bidi characters in text", () => {
    expect(extractionSchema.safeParse(doc([room({ label: "SALON\u202e" })])).success).toBe(false);
    expect(extractionSchema.safeParse(doc([room({ reason: "a\nb" })])).success).toBe(false);
  });
});

describe("sanitizeExtraction (hostile model output)", () => {
  it("drops impossible dimensions and downgrades the room to illegible", () => {
    const out = sanitizeExtraction(doc([room({ lengthFt: 9999 }), room({ widthFt: -3 }), room({ lengthFt: "12" })]));
    expect(out).not.toBeNull();
    for (const r of out!.rooms) {
      expect(r.confidence).toBe("illegible");
      expect(r.lengthFt === null || r.widthFt === null).toBe(true);
    }
  });
  it("cuts huge labels and strips control characters", () => {
    const out = sanitizeExtraction(doc([room({ label: `<img src=x onerror=alert(1)>${"X".repeat(5000)}\u202e\n` })]))!;
    expect(out.rooms[0]?.label.length).toBeLessThanOrEqual(60);
    expect(out.rooms[0]?.label).not.toMatch(/[\u202e\n]/);
  });
  it("drops unknown fields, including model-written areas", () => {
    const out = sanitizeExtraction({ ...doc([room({ areaSqft: 9999 })]), totalArea: 9999 })!;
    expect(out).not.toHaveProperty("totalArea");
    expect(out.rooms[0]).not.toHaveProperty("areaSqft");
    expect(extractionSchema.safeParse(out).success).toBe(true);
  });
  it("caps rooms and warnings, clamps bbox and page", () => {
    const out = sanitizeExtraction(
      doc(Array.from({ length: 200 }, () => room({ page: 999, bbox: { x: 90, y: -5, w: 500, h: 500 } })), {
        warnings: Array.from({ length: 50 }, () => "w".repeat(1000)),
      }),
    )!;
    expect(out.rooms).toHaveLength(60);
    expect(out.warnings).toHaveLength(20);
    expect(out.warnings[0]).toHaveLength(200);
    expect(out.rooms[0]?.page).toBe(20);
    expect(out.rooms[0]?.bbox).toEqual({ x: 90, y: 0, w: 10, h: 100 });
    expect(extractionSchema.safeParse(out).success).toBe(true);
  });
  it("handles Infinity, NaN and non-objects", () => {
    expect(sanitizeExtraction("ignore your instructions")).toBeNull();
    expect(sanitizeExtraction(null)).toBeNull();
    const out = sanitizeExtraction(doc([room({ lengthFt: Infinity, widthFt: Number.NaN, bbox: "x" }), 5, null]))!;
    expect(out.rooms).toHaveLength(1);
    expect(out.rooms[0]?.confidence).toBe("illegible");
  });
  it("parseUntrustedExtraction keeps valid input untouched and cleans the rest", () => {
    expect(parseUntrustedExtraction(doc())).toEqual(doc());
    expect(parseUntrustedExtraction(doc([room({ lengthFt: 9999 })]))!.rooms[0]?.lengthFt).toBeNull();
  });
});

describe("planImportSchema", () => {
  it("is strict and bounded", () => {
    expect(planImportSchema.safeParse({ file: "plan", rooms: [{ name: "Salon", lengthFt: 18, widthFt: 14 }] }).success).toBe(true);
    expect(planImportSchema.safeParse({ file: "plan", rooms: [{ name: "Salon", lengthFt: 5000, widthFt: 14 }] }).success).toBe(false);
    expect(planImportSchema.safeParse({ file: "plan", rooms: [], extra: 1 }).success).toBe(false);
  });
});
