"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

export type OverlayState = "included" | "check" | "excluded";
export interface Overlay {
  n: number;
  bbox: { x: number; y: number; w: number; h: number };
  state: OverlayState;
}

const box: Record<OverlayState, string> = {
  included: "border-2 border-solid border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]",
  check: "border-2 border-dashed border-ink bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
  excluded: "border border-solid border-ink-muted/60 bg-transparent",
};
const dot: Record<OverlayState, string> = {
  included: "bg-accent text-on-accent",
  check: "bg-ink text-surface",
  excluded: "bg-ink-muted text-surface",
};

/**
 * Plan image with room overlays positioned from bbox percentages.
 * The room list is the accessible source: overlays and markers are aria-hidden.
 */
export function PlanViewer({
  imageUrl,
  alt,
  overlays,
  zoomable = false,
  zoomInLabel,
  zoomOutLabel,
  className,
  ratio = "1000 / 700",
}: {
  imageUrl: string;
  alt: string;
  overlays: Overlay[];
  zoomable?: boolean;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  className?: string;
  ratio?: string;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className={cx("theme-light relative", className)}>
      <div className="overflow-auto rounded-md border border-line bg-surface-raised" tabIndex={zoom > 1 ? 0 : undefined} role={zoom > 1 ? "region" : undefined} aria-label={zoom > 1 ? alt : undefined}>
        <div className="relative" style={{ width: `${zoom * 100}%`, aspectRatio: ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={alt} className="absolute inset-0 h-full w-full object-contain" width={1000} height={700} />
          {overlays.map((o) => (
            <span key={o.n} aria-hidden="true">
              <span className={cx("absolute", box[o.state])} style={{ left: `${o.bbox.x}%`, top: `${o.bbox.y}%`, width: `${o.bbox.w}%`, height: `${o.bbox.h}%` }} />
              <span
                className={cx("absolute flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold", dot[o.state])}
                style={{ left: `calc(${o.bbox.x}% + 6px)`, top: `calc(${o.bbox.y}% + 6px)` }}
              >
                {o.n}
              </span>
            </span>
          ))}
        </div>
      </div>
      {zoomable ? (
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <IconButton icon="zoomIn" label={zoomInLabel ?? "+"} disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.5))} className="bg-surface-raised shadow-[var(--shadow-float)]" />
          <IconButton icon="zoomOut" label={zoomOutLabel ?? "-"} disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="bg-surface-raised shadow-[var(--shadow-float)]" />
        </div>
      ) : null}
    </div>
  );
}
