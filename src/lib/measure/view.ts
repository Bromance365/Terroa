import type { Point } from "./types";

/** Pan and zoom maths for the plan canvas. Screen = plan x zoom + offset. Pure, no DOM. */
export interface View {
  zoom: number;
  x: number;
  y: number;
}

export const planToScreen = (v: View, p: Point): Point => ({ x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y });
export const screenToPlan = (v: View, p: Point): Point => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom });

/** Zoom that fits the whole plan in the viewport with a margin; the view is centred. */
export function fitView(planW: number, planH: number, viewW: number, viewH: number, margin = 16): View {
  const zoom = Math.max(0.01, Math.min((viewW - 2 * margin) / planW, (viewH - 2 * margin) / planH));
  return { zoom, x: (viewW - planW * zoom) / 2, y: (viewH - planH * zoom) / 2 };
}

/** Allowed zoom range relative to the fit zoom: half of fit to 40 times fit (at least 1:1 up to 8x on small plans). */
export function zoomLimits(fitZoom: number): { min: number; max: number } {
  return { min: fitZoom * 0.5, max: Math.max(fitZoom * 40, 8) };
}

/** Zooms by `factor` keeping the plan point under (sx, sy) fixed. */
export function zoomAt(v: View, factor: number, sx: number, sy: number, limits: { min: number; max: number }): View {
  const zoom = Math.min(limits.max, Math.max(limits.min, v.zoom * factor));
  const k = zoom / v.zoom;
  return { zoom, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k };
}

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, x: v.x + dx, y: v.y + dy });

/** Two-finger gesture: new view from the previous pair of touch points to the current pair (zoom about the midpoint, pan with it). */
export function pinchView(v: View, prev: [Point, Point], next: [Point, Point], limits: { min: number; max: number }): View {
  const d0 = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
  const d1 = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
  const m0 = { x: (prev[0].x + prev[1].x) / 2, y: (prev[0].y + prev[1].y) / 2 };
  const m1 = { x: (next[0].x + next[1].x) / 2, y: (next[0].y + next[1].y) / 2 };
  const factor = d0 > 1 ? d1 / d0 : 1;
  const zoomed = zoomAt(v, factor, m0.x, m0.y, limits);
  return panBy(zoomed, m1.x - m0.x, m1.y - m0.y);
}

/** Largest plan -> detection-bitmap ratio so the long side stays at or under `maxSide` (never above 1). */
export function downscaleRatio(width: number, height: number, maxSide: number): number {
  return Math.min(1, maxSide / Math.max(width, height));
}
