import { LIMITS } from "@/lib/quantities";
import { equivalentDimensions, polygonAreaSqft, roundAreaSqft } from "./geometry";
import type { MeasuredRoom, PlanScale } from "./types";
import type { UiRoom } from "@/lib/plan-reader/types";

const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

/** Room name safe for a quote line: control and bidi characters become spaces, trimmed, at most 60 characters. */
export const cleanRoomName = (name: string) => name.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/** Recomputed area of a room: typed rooms from length x width, traced rooms from the polygon and the scale. */
export function measuredAreaSqft(room: Pick<MeasuredRoom, "points" | "dimsFt">, scale: PlanScale | null): number | null {
  if (room.dimsFt) return roundAreaSqft(room.dimsFt.lengthFt * room.dimsFt.widthFt);
  return polygonAreaSqft(room.points, scale);
}

/** Refreshes `areaSqft` on every room (call after the scale or a polygon changes). Keeps identity when nothing changed. */
export function withAreas(rooms: readonly MeasuredRoom[], scale: PlanScale | null): MeasuredRoom[] {
  return rooms.map((r) => {
    const areaSqft = measuredAreaSqft(r, scale);
    return areaSqft === r.areaSqft ? r : { ...r, areaSqft };
  });
}

/** Total of the included rooms with an area, capped like the rest of the site. */
export function measuredTotalSqft(rooms: readonly MeasuredRoom[]): number {
  let total = 0;
  for (const r of rooms) if (r.included && r.areaSqft !== null) total += r.areaSqft;
  return Math.min(total, LIMITS.maxAreaSqft);
}

/**
 * UiRoom-compatible rooms for groupByFlooring / planQuoteLines / the calculator import.
 * A traced room becomes a rectangle with the same whole sq ft (width = sqrt(area)); typed rooms keep their own dimensions.
 * Rooms without an area are left out (`included` false, no dimensions): they can never be counted.
 */
export function toUiRooms(rooms: readonly MeasuredRoom[], scale: PlanScale | null): UiRoom[] {
  return rooms.slice(0, LIMITS.maxRooms).map((r, i) => {
    const area = measuredAreaSqft(r, scale);
    const dims = r.dimsFt ?? (area !== null ? equivalentDimensions(area) : null);
    return {
      id: r.id,
      n: i + 1,
      label: cleanRoomName(r.name) || `#${i + 1}`,
      name: cleanRoomName(r.name) || `#${i + 1}`,
      page: 1,
      confidence: "high" as const,
      reason: "",
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      lengthFt: dims?.lengthFt ?? null,
      widthFt: dims?.widthFt ?? null,
      lengthDraft: null,
      widthDraft: null,
      productId: r.productId,
      included: r.included && area !== null,
    };
  });
}

/** True when the room is a traced polygon (its calculator dimensions are equivalent, not real). */
export const isEquivalentRoom = (r: Pick<MeasuredRoom, "dimsFt">) => !r.dimsFt;
