"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FilterChip } from "@/components/ui/controls";
import type { ProjectType } from "@/lib/catalog";

export interface ProjectItem {
  id: string;
  type: ProjectType;
  node: ReactNode;
}

const TYPES: Array<"all" | ProjectType> = ["all", "residential", "commercial", "office"];

export function ProjectsBrowser({ items }: { items: ProjectItem[] }) {
  const t = useTranslations();
  const [type, setType] = useState<"all" | ProjectType>("all");
  const labels = {
    all: t("gallery.all"),
    residential: t("catalog.projectTypeResidential"),
    commercial: t("catalog.projectTypeCommercial"),
    office: t("catalog.projectTypeOffice"),
  };
  const shown = items.filter((i) => type === "all" || i.type === type);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2>{t("gallery.allProjects")}</h2>
        <div role="group" aria-label={t("gallery.filterByType")} className="flex flex-wrap items-center gap-2">
          <span className="small mr-1 text-ink-muted">{t("gallery.filterByType")}</span>
          {TYPES.map((k) => (
            <FilterChip key={k} label={labels[k]} pressed={type === k} onClick={() => setType(k)} />
          ))}
        </div>
      </div>
      <p className="small mt-4 text-ink-muted" aria-live="polite">
        {t("gallery.count", { count: shown.length })}
      </p>
      <ul className="mt-6 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        {shown.map((i) => (
          <li key={i.id}>{i.node}</li>
        ))}
      </ul>
    </div>
  );
}
