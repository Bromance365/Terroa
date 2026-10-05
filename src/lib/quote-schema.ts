import { z } from "zod";
import { getProduct } from "@/lib/catalog";
import { ceilToStep } from "@/lib/quantities";

/**
 * Quote request contract, shared by the browser form (display and early validation)
 * and POST /api/quotes (the authoritative check). Client totals are never trusted:
 * `recomputeQuote` rebuilds them from the catalogue.
 */

export const PROJECT_TYPES = ["residential", "multiunit", "commercial", "office"] as const;
export const START_WINDOWS = ["month", "quarter", "later", "unknown"] as const;
export const RECEPTIONS = ["delivery", "pickup"] as const;
export const ROLES = ["contractor", "designer", "architect", "manager", "owner"] as const;
export const LINE_UNITS = ["box", "panel", "area"] as const;
export const MAX_LINES = 100;
export const MAX_QUANTITY = 9999;
export const MAX_NOTES = 2000;

// Control characters (except tab, LF and CR) have no place in names, cities or notes.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !CONTROL.test(v));

/** Optional free text: absent, or a non-empty trimmed string. */
const optionalText = (max: number) => text(1, max).optional();

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+()\d\s.\-x]+$/)
  .refine((v) => v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15);

export const lineSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
    unit: z.enum(LINE_UNITS),
    rooms: z.array(text(1, 60)).max(60).optional(),
    plannedAreaSqft: z.number().positive().max(100000).optional(),
  })
  .strict();

export const projectSchema = z
  .object({
    name: optionalText(120),
    type: z.enum(PROJECT_TYPES),
    city: text(2, 80),
    startWindow: z.enum(START_WINDOWS),
    reception: z.enum(RECEPTIONS),
    notes: z.string().trim().max(MAX_NOTES).refine((v) => !CONTROL.test(v)).optional(),
  })
  .strict();

export const contactSchema = z
  .object({
    name: text(2, 100),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    company: optionalText(120),
    phone: phone.optional(),
    role: z.enum(ROLES),
  })
  .strict();

export const quoteRequestSchema = z
  .object({
    lines: z.array(lineSchema).min(1).max(MAX_LINES),
    project: projectSchema,
    contact: contactSchema,
    marketingOptIn: z.boolean(),
    locale: z.enum(["fr", "en"]),
    /** Honeypot. Humans never see it; a non-empty value means a bot. */
    website: z.string().max(200).default(""),
  })
  .strict();

export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;
export type QuoteRequest = z.output<typeof quoteRequestSchema>;
export type QuoteLineInput = z.infer<typeof lineSchema>;

export interface QuoteTotals {
  products: number;
  boxes: number;
  panels: number;
  areaSqft: number;
}

export type RecomputeError =
  | { code: "unknown-product"; index: number }
  | { code: "unit-mismatch"; index: number }
  | { code: "no-coverage"; index: number };

export type RecomputeResult =
  | { ok: true; totals: QuoteTotals; lines: Array<{ productId: string; unit: "box" | "panel"; quantity: number }> }
  | { ok: false; error: RecomputeError };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rebuilds the totals from the catalogue. Every product must exist and be published.
 * - floor products: `box` lines count as boxes; `area` lines carry sq ft and become
 *   ceil(area / coverage) boxes, which needs a coverage on the product.
 * - panel products: `panel` lines only.
 * Planned area is taken from `plannedAreaSqft`, or from the line quantity for `area` lines.
 */
export function recomputeQuote(lines: ReadonlyArray<QuoteLineInput>): RecomputeResult {
  let boxes = 0;
  let panels = 0;
  let areaSqft = 0;
  const out: Array<{ productId: string; unit: "box" | "panel"; quantity: number }> = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const product = getProduct(line.productId);
    if (!product) return { ok: false, error: { code: "unknown-product", index } };

    if (product.kind === "panel") {
      if (line.unit !== "panel") return { ok: false, error: { code: "unit-mismatch", index } };
      panels += line.quantity;
      out.push({ productId: product.id, unit: "panel", quantity: line.quantity });
      if (line.plannedAreaSqft) areaSqft += line.plannedAreaSqft;
      continue;
    }

    if (line.unit === "panel") return { ok: false, error: { code: "unit-mismatch", index } };
    if (line.unit === "box") {
      boxes += line.quantity;
      out.push({ productId: product.id, unit: "box", quantity: line.quantity });
      if (line.plannedAreaSqft) areaSqft += line.plannedAreaSqft;
      continue;
    }
    // unit === "area": quantity is sq ft, convert to whole boxes with the product coverage.
    const coverage = product.coverage_sqft_per_box;
    if (!coverage || coverage <= 0) return { ok: false, error: { code: "no-coverage", index } };
    const lineBoxes = Math.max(1, ceilToStep(line.quantity / coverage, 1));
    boxes += lineBoxes;
    out.push({ productId: product.id, unit: "box", quantity: lineBoxes });
    areaSqft += line.plannedAreaSqft ?? line.quantity;
  }

  return { ok: true, totals: { products: lines.length, boxes, panels, areaSqft: round1(areaSqft) }, lines: out };
}
