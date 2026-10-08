/**
 * Types shared by the plan measuring tool ("Mesurer sur le plan").
 * Everything lives in memory: the plan and the rooms are never stored or sent anywhere.
 */

export interface Point {
  x: number;
  y: number;
}

/** How a room was created. Typed rooms have no position on the plan. */
export type RoomSource = "detect" | "trace" | "rectangle" | "typed";

export interface MeasuredRoom {
  id: string;
  name: string;
  /** Vertices in plan pixels (the pixel grid of the rendered plan). Empty for a typed room. */
  points: Point[];
  /** Typed rooms only: length x width in feet (the area comes from these, not from pixels). */
  dimsFt?: { lengthFt: number; widthFt: number };
  /** Whole sq ft, rounded half up; null until the scale is set (typed rooms never need it). Always recomputed from the geometry. */
  areaSqft: number | null;
  productId: string | null;
  included: boolean;
  source: RoomSource;
}

/** Pixels per foot, from a calibration line. */
export interface PlanScale {
  pxPerFt: number;
  /** The unit the person typed the known length in, shown back to them. */
  unit: "ft" | "m";
}

/** One room as the 3D preview consumes it: feet, y down, origin at the minimum corner of all rooms. */
export interface PreviewRoom {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  productId: string | null;
}
