"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { centroid, distance, pointInPolygon, polygonArea } from "@/lib/measure/geometry";
import type { MeasuredRoom, Point } from "@/lib/measure/types";
import { fitView, panBy, pinchView, planToScreen, screenToPlan, zoomAt, zoomLimits, type View } from "@/lib/measure/view";
import { cx } from "@/components/ui/cx";

export type Tool = "select" | "scale" | "detect" | "trace" | "rect" | "pan";

export interface PlanCanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
}

export interface CanvasLine {
  a: Point;
  b: Point;
  label?: string;
}

interface Props {
  /** The rendered plan page. */
  plan: HTMLCanvasElement;
  tool: Tool;
  rooms: readonly MeasuredRoom[];
  /** Label drawn on each room (name and area), by room id. */
  roomLabels: Readonly<Record<string, string>>;
  selectedId: string | null;
  draft: readonly Point[];
  /** The calibration line, pending or applied. */
  line: CanvasLine | null;
  label: string;
  describedBy: string;
  onSelect: (id: string | null) => void;
  onLine: (a: Point, b: Point) => void;
  onRect: (a: Point, b: Point) => void;
  onDetect: (seed: Point) => void;
  onDraft: (points: Point[]) => void;
  onCloseTrace: () => void;
  onCancel: () => void;
  onDeleteSelected: () => void;
  ref?: Ref<PlanCanvasHandle>;
}

/** Screen pixels a pointer may move before a press stops being a click and becomes a pan. */
const SLOP = 6;
/** Screen pixels around the first trace point that close the shape. */
const CLOSE_RADIUS = 14;
const KEY_PAN = 60;

type Gesture =
  | { type: "press"; id: number; start: Point; last: Point; moved: boolean; pan: boolean }
  | { type: "drag"; id: number; a: Point; b: Point } // scale line or rectangle, in plan pixels
  | { type: "pinch"; ids: [number, number]; prev: [Point, Point] }
  | null;

export function PlanCanvas(props: Props) {
  const { ref } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ zoom: 1, x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>(null);
  const hover = useRef<Point | null>(null);
  const frame = useRef(0);
  const latest = useRef(props);
  const fitZoom = useRef(1);

  const limits = () => zoomLimits(fitZoom.current);

  const draw = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = latest.current;
    const { w, h, dpr } = size.current;
    if (w === 0 || h === 0) return;
    const css = getComputedStyle(canvas);
    const color = (name: string) => css.getPropertyValue(name).trim() || css.color;
    const surface = color("--surface");
    const raised = color("--surface-raised");
    const ink = color("--ink");
    const muted = color("--ink-muted");
    const accent = color("--accent");
    const v = view.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    // Plan raster
    ctx.save();
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.x, dpr * v.y);
    ctx.imageSmoothingEnabled = v.zoom * dpr < 3;
    ctx.drawImage(p.plan, 0, 0);
    ctx.restore();

    const S = (pt: Point) => planToScreen(v, pt);
    const fontFamily = css.fontFamily;
    const trace = (pts: readonly Point[], close: boolean) => {
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const s = S(pt);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      if (close) ctx.closePath();
    };

    // Rooms
    for (const room of p.rooms) {
      if (room.points.length < 3) continue;
      const selected = room.id === p.selectedId;
      trace(room.points, true);
      ctx.globalAlpha = selected ? 0.3 : room.included ? 0.16 : 0.06;
      ctx.fillStyle = room.included ? accent : muted;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.strokeStyle = room.included ? accent : muted;
      ctx.setLineDash(room.included ? [] : [6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (selected) {
        ctx.fillStyle = raised;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        for (const pt of room.points) {
          const s = S(pt);
          ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
          ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
        }
      }
    }
    // Labels on top of every outline
    ctx.font = `600 13px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const room of p.rooms) {
      const text = p.roomLabels[room.id];
      if (!text || room.points.length < 3) continue;
      const screenPts = room.points.map(S);
      const xs = screenPts.map((s) => s.x);
      if (Math.max(...xs) - Math.min(...xs) < 70) continue;
      const c = S(pointInPolygon(centroid(room.points), room.points) ? centroid(room.points) : (room.points[0] as Point));
      const width = ctx.measureText(text).width + 14;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = raised;
      ctx.fillRect(c.x - width / 2, c.y - 11, width, 22);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.fillText(text, c.x, c.y);
    }

    const stroke = (pts: Point[], dashed: boolean) => {
      trace(pts, false);
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.setLineDash(dashed ? [6, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const dot = (pt: Point, r: number, fill: string) => {
      const s = S(pt);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke();
    };

    // Trace in progress
    if (p.draft.length > 0) {
      stroke([...p.draft], false);
      const last = p.draft[p.draft.length - 1] as Point;
      if (hover.current && p.tool === "trace") stroke([last, hover.current], true);
      p.draft.forEach((pt, i) => dot(pt, i === 0 && p.draft.length >= 3 ? 7 : 4, i === 0 ? raised : accent));
    }

    // Calibration line (pending or applied) and in-progress drag
    const g = gesture.current;
    const line: CanvasLine | null = g?.type === "drag" && p.tool === "scale" ? { a: g.a, b: g.b } : p.line;
    if (line) {
      const a = S(line.a);
      const b = S(line.b);
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / len) * 8;
      const ny = ((b.x - a.x) / len) * 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x - nx, a.y - ny);
      ctx.lineTo(a.x + nx, a.y + ny);
      ctx.moveTo(b.x - nx, b.y - ny);
      ctx.lineTo(b.x + nx, b.y + ny);
      ctx.stroke();
      if (line.label) {
        ctx.font = `600 13px ${fontFamily}`;
        const width = ctx.measureText(line.label).width + 14;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 18;
        ctx.fillStyle = raised;
        ctx.fillRect(mx - width / 2, my - 11, width, 22);
        ctx.fillStyle = ink;
        ctx.fillText(line.label, mx, my);
      }
    }
    if (g?.type === "drag" && p.tool === "rect") {
      const a = S(g.a);
      const b = S(g.b);
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
    }
  }, []);

  const invalidate = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    latest.current = props;
    invalidate();
  });

  const doFit = useCallback(() => {
    const { w, h } = size.current;
    const { plan } = latest.current;
    if (w === 0 || h === 0) return;
    view.current = fitView(plan.width, plan.height, w, h);
    fitZoom.current = view.current.zoom;
    invalidate();
  }, [invalidate]);

  const zoomCentre = useCallback(
    (factor: number) => {
      const { w, h } = size.current;
      view.current = zoomAt(view.current, factor, w / 2, h / 2, limits());
      invalidate();
    },
    [invalidate],
  );

  useImperativeHandle(ref, () => ({ fit: doFit, zoomBy: zoomCentre }), [doFit, zoomCentre]);

  // Size, device pixel ratio, and fit on first size or when another page or plan is loaded.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const first = size.current.w === 0;
      size.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (first) doFit();
      else {
        fitZoom.current = fitView(latest.current.plan.width, latest.current.plan.height, rect.width, rect.height).zoom;
        invalidate();
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [doFit, invalidate]);

  useEffect(() => {
    doFit();
  }, [props.plan, doFit]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const k = e.ctrlKey ? 0.01 : 0.0015;
      view.current = zoomAt(view.current, Math.exp(-e.deltaY * unit * k), e.clientX - rect.left, e.clientY - rect.top, limits());
      invalidate();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [invalidate]);

  const rel = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const hitRoom = (pt: Point): string | null => {
    let best: { id: string; area: number } | null = null;
    for (const room of latest.current.rooms) {
      if (room.points.length < 3 || !pointInPolygon(pt, room.points)) continue;
      const area = polygonArea(room.points);
      if (!best || area < best.area) best = { id: room.id, area };
    }
    return best?.id ?? null;
  };

  const click = (screen: Point) => {
    const p = latest.current;
    const plan = screenToPlan(view.current, screen);
    if (p.tool === "select") p.onSelect(hitRoom(plan));
    else if (p.tool === "detect") p.onDetect(plan);
    else if (p.tool === "trace") {
      const first = p.draft[0];
      if (first && p.draft.length >= 3 && distance(planToScreen(view.current, first), screen) <= CLOSE_RADIUS) {
        p.onCloseTrace();
        return;
      }
      const last = p.draft[p.draft.length - 1];
      if (last && distance(planToScreen(view.current, last), screen) < 4) return;
      p.onDraft([...p.draft, plan]);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.pointerType === "mouse" && e.button > 1) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = rel(e);
    pointers.current.set(e.pointerId, pt);
    if (pointers.current.size === 2) {
      const entries = [...pointers.current.entries()];
      const [a, b] = entries as [[number, Point], [number, Point]];
      gesture.current = { type: "pinch", ids: [a[0], b[0]], prev: [a[1], b[1]] };
      invalidate();
      return;
    }
    if (pointers.current.size > 2) return;
    const tool = latest.current.tool;
    if ((tool === "scale" || tool === "rect") && e.button === 0) {
      const plan = screenToPlan(view.current, pt);
      gesture.current = { type: "drag", id: e.pointerId, a: plan, b: plan };
    } else {
      gesture.current = { type: "press", id: e.pointerId, start: pt, last: pt, moved: false, pan: tool === "pan" || e.button === 1 };
    }
    canvas.focus({ preventScroll: true });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = rel(e);
    if (e.pointerType === "mouse" || pointers.current.size === 0) {
      hover.current = screenToPlan(view.current, pt);
      if (latest.current.tool === "trace" && latest.current.draft.length > 0) invalidate();
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pinch") {
      const [i, j] = g.ids;
      const a = pointers.current.get(i);
      const b = pointers.current.get(j);
      if (!a || !b) return;
      view.current = pinchView(view.current, g.prev, [a, b], limits());
      g.prev = [a, b];
      invalidate();
      return;
    }
    if (g.id !== e.pointerId) return;
    if (g.type === "drag") {
      g.b = screenToPlan(view.current, pt);
      invalidate();
      return;
    }
    if (!g.moved && distance(g.start, pt) > SLOP) g.moved = true;
    if (g.moved || g.pan) {
      view.current = panBy(view.current, pt.x - g.last.x, pt.y - g.last.y);
      g.last = pt;
      invalidate();
    }
  };

  const release = (e: ReactPointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g?.type === "pinch") {
      // Leaving a pinch never turns into a click or a drawing: wait for all fingers to lift.
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (cancelled) {
      invalidate();
      return;
    }
    if (g.type === "drag") {
      const p = latest.current;
      const long = distance(planToScreen(view.current, g.a), planToScreen(view.current, g.b));
      if (long > SLOP) {
        if (p.tool === "scale") p.onLine(g.a, g.b);
        else p.onRect(g.a, g.b);
      }
      invalidate();
      return;
    }
    if (!g.moved && !g.pan) click(g.start);
    invalidate();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const p = latest.current;
    const step = e.shiftKey ? KEY_PAN * 3 : KEY_PAN;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
        view.current = panBy(view.current, step, 0);
        break;
      case "ArrowRight":
        view.current = panBy(view.current, -step, 0);
        break;
      case "ArrowUp":
        view.current = panBy(view.current, 0, step);
        break;
      case "ArrowDown":
        view.current = panBy(view.current, 0, -step);
        break;
      case "+":
      case "=":
        zoomCentre(1.25);
        break;
      case "-":
      case "_":
        zoomCentre(0.8);
        break;
      case "0":
        doFit();
        break;
      case "Delete":
        p.onDeleteSelected();
        break;
      case "Backspace":
        if (p.tool === "trace" && p.draft.length > 0) p.onDraft(p.draft.slice(0, -1));
        else handled = false;
        break;
      case "Escape":
        gesture.current = null;
        p.onCancel();
        break;
      case "Enter":
        if (p.tool === "trace") p.onCloseTrace();
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      invalidate();
    }
  };

  const cursor = props.tool === "pan" ? "cursor-grab active:cursor-grabbing" : props.tool === "select" ? "cursor-default" : "cursor-crosshair";

  return (
    <div ref={wrapRef} className="relative h-[56vh] min-h-[320px] w-full overflow-hidden rounded-md border border-border-strong bg-surface-raised sm:h-[62vh] sm:max-h-[760px]">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="group"
        aria-label={props.label}
        aria-describedby={props.describedBy}
        className={cx("absolute inset-0 h-full w-full touch-none select-none", cursor)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, false)}
        onPointerCancel={(e) => release(e, true)}
        onPointerLeave={() => {
          hover.current = null;
          invalidate();
        }}
        onDoubleClick={() => {
          if (latest.current.tool === "trace" && latest.current.draft.length >= 3) latest.current.onCloseTrace();
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
