import { z } from "zod";
import { LIMITS } from "@/lib/quantities";

/**
 * Plan-reader output contract. Mirrors src/lib/plan-reader/extraction.schema.json.
 * The output of the model is UNTRUSTED (prompt injection, hostile PDFs): validate with
 * `extractionSchema`, fall back to `sanitizeExtraction` (clamps, never throws), and recompute
 * every area from the dimensions (see compute.ts). The model's own arithmetic is never shown.
 */

export const MAX_ROOMS = LIMITS.maxRooms; // 60
export const MAX_LABEL = 60;
export const MAX_REASON = 160;
export const MAX_DIMENSION_TEXT = 40;
export const MAX_SCALE_TEXT = 60;
export const MAX_WARNINGS = 20;
export const MAX_WARNING = 200;
export const MAX_PAGE = 20;

/** Control characters, bidi overrides/isolates, zero-width marks and line separators. */
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;
const hasUnsafeChars = (s: string) => {
  UNSAFE_CHARS.lastIndex = 0;
  return UNSAFE_CHARS.test(s);
};

const safeText = (max: number) => z.string().max(max).refine((s) => !hasUnsafeChars(s), "control characters");

export const confidenceSchema = z.enum(["high", "check", "illegible"]);
export type Confidence = z.infer<typeof confidenceSchema>;

const dimension = z.number().gt(0).max(LIMITS.maxDimensionFt).nullable();
const percent = z.number().min(0).max(100);

export const extractedRoomSchema = z.strictObject({
  label: safeText(MAX_LABEL).min(1),
  page: z.number().int().min(1).max(MAX_PAGE),
  lengthFt: dimension,
  widthFt: dimension,
  dimensionText: safeText(MAX_DIMENSION_TEXT).optional(),
  confidence: confidenceSchema,
  reason: safeText(MAX_REASON).optional(),
  bbox: z.strictObject({ x: percent, y: percent, w: percent, h: percent }),
});

export const extractionSchema = z.strictObject({
  readable: z.boolean(),
  units: z.enum(["imperial", "metric", "unknown"]),
  scaleText: safeText(MAX_SCALE_TEXT).nullable(),
  rooms: z.array(extractedRoomSchema).max(MAX_ROOMS),
  warnings: z.array(safeText(MAX_WARNING)).max(MAX_WARNINGS),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedRoom = z.infer<typeof extractedRoomSchema>;

// Lenient clean-up -----------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** A usable dimension in feet, or null. Out-of-range values are dropped, not clamped to the limit. */
function cleanDimension(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v <= 0 || v > LIMITS.maxDimensionFt) return null;
  return v;
}

const clampPct = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback);

/**
 * Turns anything into a valid Extraction. Unknown fields are dropped, strings are cut and stripped of
 * control characters, lists are capped, impossible dimensions (negative, zero, NaN, above 1 000 ft)
 * become null and the room is downgraded to "illegible" so the person has to type them.
 * Returns null only when the input is not an object at all.
 */
export function sanitizeExtraction(raw: unknown): Extraction | null {
  if (!isRecord(raw)) return null;
  const units = raw.units === "imperial" || raw.units === "metric" ? raw.units : "unknown";
  const scale = cleanText(raw.scaleText, MAX_SCALE_TEXT);
  const rawRooms = Array.isArray(raw.rooms) ? raw.rooms.slice(0, MAX_ROOMS) : [];

  const rooms: ExtractedRoom[] = [];
  rawRooms.forEach((r, i) => {
    if (!isRecord(r)) return;
    const lengthFt = cleanDimension(r.lengthFt);
    const widthFt = cleanDimension(r.widthFt);
    const claimed = confidenceSchema.safeParse(r.confidence);
    const missing = lengthFt === null || widthFt === null;
    const bboxIn = isRecord(r.bbox) ? r.bbox : {};
    const x = clampPct(bboxIn.x);
    const y = clampPct(bboxIn.y);
    const page = typeof r.page === "number" && Number.isFinite(r.page) ? Math.min(MAX_PAGE, Math.max(1, Math.trunc(r.page))) : 1;
    const dimensionText = cleanText(r.dimensionText, MAX_DIMENSION_TEXT);
    const reason = cleanText(r.reason, MAX_REASON);
    rooms.push({
      label: cleanText(r.label, MAX_LABEL) || `#${i + 1}`,
      page,
      lengthFt,
      widthFt,
      ...(dimensionText ? { dimensionText } : {}),
      // A room without two usable dimensions can never be "high" or "check" with confidence in its area.
      confidence: missing ? "illegible" : claimed.success ? claimed.data : "check",
      ...(reason ? { reason } : {}),
      bbox: { x, y, w: Math.min(clampPct(bboxIn.w), 100 - x), h: Math.min(clampPct(bboxIn.h), 100 - y) },
    });
  });

  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .map((w) => cleanText(w, MAX_WARNING))
    .filter(Boolean)
    .slice(0, MAX_WARNINGS);

  const candidate = {
    readable: raw.readable === true,
    units,
    scaleText: scale || null,
    rooms,
    warnings,
  };
  const checked = extractionSchema.safeParse(candidate);
  return checked.success ? checked.data : null;
}

/** Strict validation first; anything that fails is cleaned instead of trusted. Null means unusable. */
export function parseUntrustedExtraction(raw: unknown): Extraction | null {
  const strict = extractionSchema.safeParse(raw);
  return strict.success ? strict.data : sanitizeExtraction(raw);
}

// Shared with the calculator ---------------------------------------------------

/** sessionStorage key written by "Ouvrir dans le calculateur" and read by the calculator page. */
export const PLAN_IMPORT_KEY = "terroa.planImport.v1";

export const planImportSchema = z.strictObject({
  file: z.string().max(80),
  rooms: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(MAX_LABEL),
        lengthFt: z.number().gt(0).max(LIMITS.maxDimensionFt),
        widthFt: z.number().gt(0).max(LIMITS.maxDimensionFt),
      }),
    )
    .max(MAX_ROOMS),
});
export type PlanImport = z.infer<typeof planImportSchema>;

// UI room ------------------------------------------------------------------------

/** A detected room as the person edits it in the verify state. */
export interface UiRoom {
  id: string;
  /** 1-based marker number, matches the overlay. */
  n: number;
  label: string;
  /** Display name (localised mapping of the printed label). */
  name: string;
  page: number;
  confidence: Confidence;
  /** Model-provided note (untrusted text, rendered as text only). Empty when none. */
  reason: string;
  bbox: { x: number; y: number; w: number; h: number };
  /** Feet; null when unreadable or while the typed value is invalid. */
  lengthFt: number | null;
  widthFt: number | null;
  /** Typed text while editing (null = show the value read from the plan). */
  lengthDraft: string | null;
  widthDraft: string | null;
  productId: string | null;
  included: boolean;
}
