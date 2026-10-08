import { boundingBox, pxToFeet, roundAreaSqft, polygonArea, validatePolygon } from "./geometry";
import type { MeasuredRoom, PlanScale, PreviewRoom } from "./types";

/** Gap in feet between typed rooms (which have no position on the plan) when they are laid out in a row. */
export const TYPED_ROOM_GAP_FT = 3;

/**
 * Hand-off of the measured rooms to the 3D preview.
 * Included rooms with a usable area only. Coordinates are feet, y down, the origin is the minimum corner of all rooms
 * together (so the rooms keep their relative layout from the plan). Typed rooms have no place on the plan: they are
 * drawn as rectangles in a row to the right of the traced rooms. A traced room needs the scale; without it, it is left out.
 */
export function toPreviewRooms(rooms: readonly MeasuredRoom[], scale: PlanScale | null): PreviewRoom[] {
  type Raw = { room: MeasuredRoom; pts: { x: number; y: number }[] };
  const traced: Raw[] = [];
  const typed: Raw[] = [];
  for (const room of rooms) {
    if (!room.included) continue;
    if (room.dimsFt) {
      const { lengthFt, widthFt } = room.dimsFt;
      if (roundAreaSqft(lengthFt * widthFt) === null) continue;
      typed.push({
        room,
        pts: [
          { x: 0, y: 0 },
          { x: lengthFt, y: 0 },
          { x: lengthFt, y: widthFt },
          { x: 0, y: widthFt },
        ],
      });
    } else if (scale && validatePolygon(room.points, 1).ok && roundAreaSqft(polygonArea(room.points) / (scale.pxPerFt * scale.pxPerFt)) !== null) {
      traced.push({ room, pts: room.points.map((p) => ({ x: pxToFeet(p.x, scale), y: pxToFeet(p.y, scale) })) });
    }
  }

  let tracedMax = -Infinity;
  for (const t of traced) tracedMax = Math.max(tracedMax, boundingBox(t.pts).maxX);
  let cursor = traced.length > 0 ? tracedMax + TYPED_ROOM_GAP_FT : 0;
  let tracedMinY = 0;
  if (traced.length > 0) tracedMinY = Math.min(...traced.map((t) => boundingBox(t.pts).minY));
  for (const t of typed) {
    const width = boundingBox(t.pts).maxX;
    t.pts = t.pts.map((p) => ({ x: p.x + cursor, y: p.y + tracedMinY }));
    cursor += width + TYPED_ROOM_GAP_FT;
  }

  const all = [...traced, ...typed];
  if (all.length === 0) return [];
  const minX = Math.min(...all.map((r) => boundingBox(r.pts).minX));
  const minY = Math.min(...all.map((r) => boundingBox(r.pts).minY));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return all.map(({ room, pts }) => ({
    id: room.id,
    name: room.name,
    points: pts.map((p) => ({ x: round(p.x - minX), y: round(p.y - minY) })),
    productId: room.productId,
  }));
}
