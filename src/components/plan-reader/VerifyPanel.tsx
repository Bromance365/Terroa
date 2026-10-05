"use client";

import { useTranslations } from "next-intl";
import { PlanViewer, type Overlay } from "@/components/plan/PlanViewer";
import { Alert } from "@/components/ui/controls";
import { getProducts } from "@/lib/catalog";
import type { Grouping } from "@/lib/plan-reader/compute";
import type { UiRoom } from "@/lib/plan-reader/types";
import { DetectedRoomRow, type RoomPatch } from "./DetectedRoomRow";
import { PlanSummary, type SummaryNotice } from "./PlanSummary";
import { PrivacyNotice } from "./PrivacyNotice";
import { uiRoomArea } from "@/lib/plan-reader/compute";
import type { RefObject } from "react";

/**
 * Phase 1 shows the sample plan image for every file (PDFs cannot be drawn without a renderer, and the
 * mock bounding boxes belong to the sample). Phase 3: pass the uploaded page image from the server
 * (or an object URL for JPEG/PNG) together with the bboxes the server returns for it.
 */
const SAMPLE_PLAN_IMAGE = "/images/plan-rdc.svg";

function Swatch({ kind }: { kind: "included" | "check" | "excluded" }) {
  const cls = {
    included: "border-2 border-solid border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]",
    check: "border-2 border-dashed border-ink bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
    excluded: "border border-solid border-ink-muted/60",
  } as const;
  return <span aria-hidden="true" className={`inline-block h-4 w-6 flex-none ${cls[kind]}`} />;
}

export function VerifyPanel({
  rooms,
  grouping,
  includedArea,
  notice,
  added,
  demo,
  planImage,
  headingRef,
  onRoomChange,
  onAdd,
  onOpenCalculator,
}: {
  rooms: UiRoom[];
  grouping: Grouping;
  includedArea: number;
  notice: SummaryNotice;
  added: { lines: number; area: number } | null;
  demo: boolean;
  planImage: { url: string; ratio: string } | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRoomChange: (id: string, patch: RoomPatch) => void;
  onAdd: () => void;
  onOpenCalculator: () => void;
}) {
  const t = useTranslations();
  const floors = getProducts().filter((p) => p.kind === "floor" && p.published);
  const includedCount = rooms.filter((r) => r.included && uiRoomArea(r) !== null).length;

  const overlays: Overlay[] = rooms.map((r) => ({
    n: r.n,
    bbox: r.bbox,
    state: !(r.included && uiRoomArea(r) !== null) ? "excluded" : r.confidence === "check" ? "check" : "included",
  }));

  const [leadSentence, ...restSentence] = t("planReader.autoReading").split(". ");

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-8 lg:gap-x-12">
      <section aria-labelledby="pr-plan-title" className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 lg:self-start">
        <h2 id="pr-plan-title">{t("planReader.plan")}</h2>
        {demo || planImage ? (
          <PlanViewer
            imageUrl={demo ? SAMPLE_PLAN_IMAGE : (planImage?.url ?? SAMPLE_PLAN_IMAGE)}
            ratio={demo ? undefined : planImage?.ratio}
            alt={t("planUi.viewerAlt", { count: rooms.length })}
            overlays={overlays}
            zoomable
            zoomInLabel={t("planReader.zoomIn")}
            zoomOutLabel={t("planReader.zoomOut")}
          />
        ) : (
          <Alert kind="info">{t("planUi.pdfNoPreview")}</Alert>
        )}
        <ul aria-label={t("planUi.legend")} className="small flex flex-wrap gap-x-5 gap-y-2 text-ink-muted">
          <li className="flex items-center gap-2">
            <Swatch kind="included" />
            {t("planReader.legendIncluded")}
          </li>
          <li className="flex items-center gap-2">
            <Swatch kind="check" />
            {t("planReader.legendCheck")}
          </li>
          <li className="flex items-center gap-2">
            <Swatch kind="excluded" />
            {t("planReader.legendExcluded")}
          </li>
        </ul>
        {demo ? <p className="small text-ink-muted">{t("planUi.sampleNote")}</p> : null}
        <PrivacyNotice />
      </section>

      <section aria-labelledby="pr-rooms-title" className="flex min-w-0 flex-[1.5_1_480px] flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="pr-rooms-title" ref={headingRef} tabIndex={-1} className="outline-none">
            {t("planReader.detected")}
          </h2>
          <p className="small text-ink-muted">{t("planReader.includedCount", { included: includedCount, total: rooms.length })}</p>
        </div>
        <Alert kind="info" title={restSentence.length ? `${leadSentence}.` : undefined}>
          {restSentence.length ? restSentence.join(". ") : leadSentence}
        </Alert>
        <ul aria-label={t("planUi.roomList")} className="border-b border-line">
          {rooms.map((room) => (
            <DetectedRoomRow key={room.id} room={room} floors={floors} onChange={(patch) => onRoomChange(room.id, patch)} />
          ))}
        </ul>
        <PlanSummary
          includedArea={includedArea}
          grouping={grouping}
          roomCount={includedCount}
          notice={notice}
          added={added}
          onAdd={onAdd}
          onOpenCalculator={onOpenCalculator}
        />
      </section>
    </div>
  );
}
