import { describe, expect, it } from "vitest";
import { quoteRequestSchema, recomputeQuote } from "./quote-schema";

const valid = {
  lines: [{ productId: "p-chene-naturel", quantity: 21, unit: "box" as const }],
  project: { type: "residential", city: "Laval", startWindow: "month", reception: "delivery" },
  contact: { name: "Prénom Test", email: "Test@Exemple.ca", role: "contractor" },
  marketingOptIn: false,
  locale: "fr",
};

describe("quoteRequestSchema", () => {
  it("accepts a minimal valid request and normalises the email", () => {
    const r = quoteRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contact.email).toBe("test@exemple.ca");
      expect(r.data.website).toBe("");
    }
  });

  it("rejects short names, bad emails, short cities and empty baskets", () => {
    expect(quoteRequestSchema.safeParse({ ...valid, contact: { ...valid.contact, name: "A" } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, contact: { ...valid.contact, email: "nope" } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, project: { ...valid.project, city: "L" } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, lines: [] }).success).toBe(false);
  });

  it("rejects out-of-range or non-integer quantities and unknown units", () => {
    const line = valid.lines[0];
    for (const bad of [{ quantity: 0 }, { quantity: 10000 }, { quantity: 1.5 }, { unit: "pallet" }]) {
      expect(quoteRequestSchema.safeParse({ ...valid, lines: [{ ...line, ...bad }] }).success).toBe(false);
    }
  });

  it("rejects unknown keys (strict) and invalid enums", () => {
    expect(quoteRequestSchema.safeParse({ ...valid, totals: { boxes: 1 } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, project: { ...valid.project, type: "castle" } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, locale: "de" }).success).toBe(false);
  });

  it("limits notes to 2000 characters and validates phone numbers", () => {
    expect(quoteRequestSchema.safeParse({ ...valid, project: { ...valid.project, notes: "x".repeat(2001) } }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, project: { ...valid.project, notes: "x".repeat(2000) } }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...valid, contact: { ...valid.contact, phone: "514 555-0123" } }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...valid, contact: { ...valid.contact, phone: "abc" } }).success).toBe(false);
  });

  it("rejects control characters in text fields", () => {
    expect(quoteRequestSchema.safeParse({ ...valid, project: { ...valid.project, city: "La\u0000val" } }).success).toBe(false);
  });
});

describe("recomputeQuote", () => {
  it("sums boxes, panels and planned area from the catalogue", () => {
    const r = recomputeQuote([
      { productId: "p-chene-naturel", quantity: 21, unit: "box", plannedAreaSqft: 374 },
      { productId: "p-lattes-noyer", quantity: 6, unit: "panel" },
    ]);
    expect(r).toMatchObject({ ok: true, totals: { products: 2, boxes: 21, panels: 6, areaSqft: 374 } });
  });

  it("converts area lines to whole boxes with the product coverage (20 sq ft per box)", () => {
    const r = recomputeQuote([{ productId: "p-chene-naturel", quantity: 1039, unit: "area" }]);
    expect(r).toMatchObject({ ok: true, totals: { boxes: 52, areaSqft: 1039 } });
  });

  it("does not drift on exact multiples", () => {
    const r = recomputeQuote([{ productId: "p-chene-naturel", quantity: 400, unit: "area" }]);
    expect(r).toMatchObject({ ok: true, totals: { boxes: 20 } });
  });

  it("fails on unknown products and mismatched units", () => {
    expect(recomputeQuote([{ productId: "nope", quantity: 1, unit: "box" }])).toEqual({ ok: false, error: { code: "unknown-product", index: 0 } });
    expect(recomputeQuote([{ productId: "p-lattes-noyer", quantity: 1, unit: "box" }])).toMatchObject({ ok: false, error: { code: "unit-mismatch" } });
    expect(recomputeQuote([{ productId: "p-chene-naturel", quantity: 1, unit: "panel" }])).toMatchObject({ ok: false, error: { code: "unit-mismatch" } });
  });
});
