import type { Locale } from "@/i18n/routing";
import type { QuoteLine } from "@/lib/quote-store";
import { LIMITS, ceilToStep, parsePositiveDecimal } from "@/lib/quantities";
import type { AnalysisResult } from "./analyzer";
import type { Extraction, PlanImport, UiRoom } from "./types";

/**
 * Pure maths for the plan reader. Areas always come from the dimensions (length x width in feet);
 * whatever area the model may have written is never used.
 */

/** Same default as the calculator. Boxes added from the plan include this waste. */
export const PLAN_WASTE_PCT = 10;
export const MAX_BOXES = 9999;

const EPSILON = 1e-9;

/**
 * Net area of one room in whole sq ft, rounded half up with floor math: floor(l x w + 0.5)
 * (18 pi 2 po x 14 pi = 254.33 -> 254; 9 pi 10 po x 14 pi = 137.67 -> 138, as on the artboard).
 * Each dimension is clamped to LIMITS.maxDimensionFt and the area to LIMITS.maxAreaSqft.
 * Returns null when a dimension is missing, not finite or not positive.
 */
export function roomAreaSqft(lengthFt: number | null | undefined, widthFt: number | null | undefined): number | null {
  if (typeof lengthFt !== "number" || typeof widthFt !== "number") return null;
  if (!Number.isFinite(lengthFt) || !Number.isFinite(widthFt) || lengthFt <= 0 || widthFt <= 0) return null;
  const l = Math.min(lengthFt, LIMITS.maxDimensionFt);
  const w = Math.min(widthFt, LIMITS.maxDimensionFt);
  const area = Math.floor(l * w + 0.5 + EPSILON);
  return Math.min(LIMITS.maxAreaSqft, Math.max(1, area));
}

export const uiRoomArea = (room: Pick<UiRoom, "lengthFt" | "widthFt">) => roomAreaSqft(room.lengthFt, room.widthFt);

export type DimensionInput = { value: number | null; error: "empty" | "invalid" | "too-large" | null };

/** Parses a dimension typed in feet ("12,5" or "12.5"). */
export function parseDimensionInput(text: string): DimensionInput {
  if (text.trim() === "") return { value: null, error: "empty" };
  const value = parsePositiveDecimal(text);
  if (value === null) return { value: null, error: "invalid" };
  if (value > LIMITS.maxDimensionFt) return { value: null, error: "too-large" };
  return { value, error: null };
}

/** Total of the included rooms that have a usable area, capped at LIMITS.maxAreaSqft. */
export function includedAreaSqft(rooms: readonly UiRoom[]): number {
  let total = 0;
  for (const r of rooms) {
    if (!r.included) continue;
    total += uiRoomArea(r) ?? 0;
  }
  return Math.min(total, LIMITS.maxAreaSqft);
}

export const countedRooms = (rooms: readonly UiRoom[]) => rooms.filter((r) => r.included && uiRoomArea(r) !== null);

/** Boxes for a planned area: ceil(area x (1 + waste) / coverage), using the shared rounding of src/lib/quantities. */
export function boxesForArea(areaSqft: number, coveragePerBox: number | null | undefined, wastePct = PLAN_WASTE_PCT): number | null {
  if (!coveragePerBox || !Number.isFinite(coveragePerBox) || coveragePerBox <= 0 || areaSqft <= 0) return null;
  const orderArea = ceilToStep(areaSqft * (1 + wastePct / 100), 1);
  return Math.min(MAX_BOXES, Math.max(1, Math.ceil(orderArea / coveragePerBox - EPSILON)));
}

export interface FlooringGroup {
  productId: string;
  rooms: UiRoom[];
  areaSqft: number;
  /** Null when the product has no coverage per box. */
  boxes: number | null;
}

export interface Grouping {
  groups: FlooringGroup[];
  /** Included rooms with an area but no flooring chosen. */
  unassigned: UiRoom[];
  unassignedAreaSqft: number;
}

/** Groups the counted rooms by flooring product (order of first appearance). */
export function groupByFlooring(
  rooms: readonly UiRoom[],
  coverageOf: (productId: string) => number | null | undefined,
  wastePct = PLAN_WASTE_PCT,
): Grouping {
  const map = new Map<string, FlooringGroup>();
  const unassigned: UiRoom[] = [];
  let unassignedAreaSqft = 0;
  for (const room of countedRooms(rooms)) {
    const area = uiRoomArea(room) ?? 0;
    if (!room.productId) {
      unassigned.push(room);
      unassignedAreaSqft += area;
      continue;
    }
    const group = map.get(room.productId) ?? { productId: room.productId, rooms: [], areaSqft: 0, boxes: null };
    group.rooms.push(room);
    group.areaSqft += area;
    map.set(room.productId, group);
  }
  const groups = [...map.values()].map((g) => {
    const areaSqft = Math.min(g.areaSqft, LIMITS.maxAreaSqft);
    return { ...g, areaSqft, boxes: boxesForArea(areaSqft, coverageOf(g.productId), wastePct) };
  });
  return { groups, unassigned, unassignedAreaSqft: Math.min(unassignedAreaSqft, LIMITS.maxAreaSqft) };
}

/**
 * One quote line per flooring product: boxes from the product coverage, planned area and room names.
 * Rooms without flooring are NOT turned into lines (a line needs a product): see HANDOFF 7.6 gap.
 * A product without coverage falls back to a line in sq ft (unit "area").
 */
export function planQuoteLines(groups: readonly FlooringGroup[], sourceLabel: string): Omit<QuoteLine, "id">[] {
  return groups.map((g) => ({
    productId: g.productId,
    unit: g.boxes === null ? ("area" as const) : ("box" as const),
    quantity: g.boxes ?? Math.min(MAX_BOXES, Math.max(1, Math.ceil(g.areaSqft))),
    rooms: g.rooms.map((r) => r.name.slice(0, 60)).slice(0, LIMITS.maxRooms),
    plannedAreaSqft: g.areaSqft,
    source: "plan" as const,
    sourceLabel: sourceLabel.slice(0, 80),
  }));
}

/** Payload for the calculator (`terroa.planImport.v1`): included rooms with a usable area only. */
export function calculatorImport(rooms: readonly UiRoom[], fileName: string): PlanImport {
  return {
    file: fileName.slice(0, 80),
    rooms: countedRooms(rooms).map((r) => ({
      name: r.name.slice(0, 60),
      lengthFt: r.lengthFt as number,
      widthFt: r.widthFt as number,
    })),
  };
}

// Room list ------------------------------------------------------------------

const ROOM_NAMES: Record<string, { fr: string; en: string }> = {
  SALON: { fr: "Salon", en: "Living room" },
  CUISINE: { fr: "Cuisine", en: "Kitchen" },
  CHPRINC: { fr: "Chambre principale", en: "Primary bedroom" },
  CHAMBREPRINCIPALE: { fr: "Chambre principale", en: "Primary bedroom" },
  CORRIDOR: { fr: "Corridor", en: "Hallway" },
  SDB: { fr: "Salle de bain", en: "Bathroom" },
  SALLEDEBAIN: { fr: "Salle de bain", en: "Bathroom" },
  ENTREE: { fr: "Entrée", en: "Entrance" },
  BUREAU: { fr: "Bureau", en: "Office" },
  SALLEAMANGER: { fr: "Salle à manger", en: "Dining room" },
  SAM: { fr: "Salle à manger", en: "Dining room" },
  BUANDERIE: { fr: "Buanderie", en: "Laundry room" },
  GARDEROBE: { fr: "Garde-robe", en: "Closet" },
  SALLEFAMILIALE: { fr: "Salle familiale", en: "Family room" },
};

const roomKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const sentenceCase = (s: string) => {
  const lower = s.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
};

/** Display name for a printed label: known rooms are translated, others are put in sentence case. Max 40 chars. */
export function roomDisplayName(label: string, locale: Locale): string {
  const known = ROOM_NAMES[roomKey(label)];
  const name = known ? known[locale] : sentenceCase(label.trim());
  return name.slice(0, 40);
}

const TO_DECIMAL_DIGITS = 4;

export function buildUiRooms(result: Pick<AnalysisResult, "extraction" | "hints">, locale: Locale): UiRoom[] {
  const { extraction, hints } = result;
  return extraction.rooms.slice(0, LIMITS.maxRooms).map((r, i) => {
    const lengthFt = r.lengthFt === null ? null : Number(r.lengthFt.toFixed(TO_DECIMAL_DIGITS));
    const widthFt = r.widthFt === null ? null : Number(r.widthFt.toFixed(TO_DECIMAL_DIGITS));
    const usable = roomAreaSqft(lengthFt, widthFt) !== null;
    // Unreadable rooms are excluded by default, and a room we cannot measure can never be included.
    const included = usable && r.confidence !== "illegible" && (hints?.included[i] ?? true);
    return {
      id: `room-${i + 1}`,
      n: i + 1,
      label: r.label,
      name: roomDisplayName(r.label, locale),
      page: r.page,
      confidence: usable ? r.confidence : "illegible",
      reason: r.reason ?? "",
      bbox: r.bbox,
      lengthFt,
      widthFt,
      lengthDraft: null,
      widthDraft: null,
      productId: hints?.productId[i] ?? null,
      included,
    };
  });
}

export const isReadable = (e: Extraction) => e.readable && e.rooms.length > 0;

/** "18 pi 2 po" / "18 ft 2 in", rounded to the nearest inch. */
export function formatFeetInches(feet: number, locale: Locale): string {
  const totalInches = Math.round(feet * 12);
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches - ft * 12;
  return locale === "fr" ? `${ft} pi ${inch} po` : `${ft} ft ${inch} in`;
}

/** File name without control characters or extension, for the quote line origin note ("plan RDC"). */
export function baseFileName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
  return (cleaned || "plan").slice(0, 60);
}
