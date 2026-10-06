"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { ToolIcon, type ToolIconName } from "./ToolIcon";
import type { Tool } from "./PlanCanvas";

const TOOLS: ReadonlyArray<{ tool: Tool; icon: ToolIconName; key: "toolSelect" | "toolScale" | "toolDetect" | "toolTrace" | "toolRect" | "toolPan" }> = [
  { tool: "select", icon: "select", key: "toolSelect" },
  { tool: "scale", icon: "scale", key: "toolScale" },
  { tool: "detect", icon: "detect", key: "toolDetect" },
  { tool: "trace", icon: "trace", key: "toolTrace" },
  { tool: "rect", icon: "rect", key: "toolRect" },
  { tool: "pan", icon: "pan", key: "toolPan" },
];

const button =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md border px-3 font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45";

/** Tool buttons (aria-pressed marks the active one), then Fit and zoom. Each is at least 44 px and has a visible label. */
export function Toolbar({
  tool,
  onTool,
  onFit,
  onZoom,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  onFit: () => void;
  onZoom: (factor: number) => void;
}) {
  const t = useTranslations();
  const idle = "border-border-strong bg-surface-raised text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-raised))]";
  return (
    <div role="toolbar" aria-label={t("measure.toolsLabel")} className="flex flex-wrap gap-2">
      {TOOLS.map((item) => {
        const pressed = tool === item.tool;
        return (
          <button
            key={item.tool}
            type="button"
            aria-pressed={pressed}
            onClick={() => onTool(item.tool)}
            className={cx(button, pressed ? "border-ink bg-ink text-surface" : idle)}
          >
            <ToolIcon name={item.icon} />
            <span>{t(`measure.${item.key}`)}</span>
          </button>
        );
      })}
      <span className="mx-1 hidden w-px self-stretch bg-line sm:block" aria-hidden="true" />
      <button type="button" onClick={onFit} className={cx(button, idle)}>
        <ToolIcon name="fit" />
        <span>{t("measure.toolFit")}</span>
      </button>
      <button type="button" onClick={() => onZoom(1.25)} aria-label={t("planReader.zoomIn")} title={t("planReader.zoomIn")} className={cx(button, idle)}>
        <Icon name="zoomIn" />
      </button>
      <button type="button" onClick={() => onZoom(0.8)} aria-label={t("planReader.zoomOut")} title={t("planReader.zoomOut")} className={cx(button, idle)}>
        <Icon name="zoomOut" />
      </button>
    </div>
  );
}
