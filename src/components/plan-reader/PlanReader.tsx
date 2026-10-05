"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/controls";
import { getProduct } from "@/lib/catalog";
import { formatSqft } from "@/lib/format";
import { addToQuote, showToast } from "@/lib/quote-store";
import { analyzePlan, AnalysisAborted, type AnalysisResult } from "@/lib/plan-reader/analyzer";
import {
  baseFileName,
  buildUiRooms,
  calculatorImport,
  groupByFlooring,
  includedAreaSqft,
  isReadable,
  planQuoteLines,
} from "@/lib/plan-reader/compute";
import { PLAN_IMPORT_KEY, type UiRoom } from "@/lib/plan-reader/types";
import { validatePlanFile, type PlanFileProblem } from "@/lib/plan-reader/validate-file";
import type { Locale } from "@/i18n/routing";
import { AnalyzingPanel } from "./AnalyzingPanel";
import { DeleteDialog } from "./DeleteDialog";
import type { RoomPatch } from "./DetectedRoomRow";
import { FileBar } from "./FileBar";
import { StepIndicator } from "./StepIndicator";
import { UnreadablePanel } from "./UnreadablePanel";
import { UploadPanel } from "./UploadPanel";
import { VerifyPanel } from "./VerifyPanel";
import type { SummaryNotice } from "./PlanSummary";

type Phase = "upload" | "analyzing" | "verify" | "unreadable";
type ErrorKind = PlanFileProblem | "analyze";

/**
 * The plan reader. Four states: upload, analysing, verify, unreadable.
 * The file and the extraction live in memory only (no storage, no network in phase 1, no object URL is created:
 * the viewer shows the sample plan image). "Supprimer le plan" clears the file and the extraction.
 */
export function PlanReader({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rooms, setRooms] = useState<UiRoom[]>([]);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [notice, setNotice] = useState<SummaryNotice>(null);
  const [added, setAdded] = useState<{ sig: string; lines: number; area: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Focus moves to the heading of the new state (not on first paint).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [phase]);

  // Cancel any pending reading when leaving the page.
  useEffect(() => () => run.current?.abort(), []);

  const startAnalysis = useCallback(
    async (f: File) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      setError(null);
      setNotice(null);
      setAdded(null);
      setAnalysis(null);
      setRooms([]);
      setFile(f);
      setPhase("analyzing");
      try {
        // Mock only: `?demo=unreadable` forces the unreadable state.
        const demo = new URLSearchParams(window.location.search).get("demo") === "unreadable" ? "unreadable" : null;
        const result = await analyzePlan(f, { signal: controller.signal, demo, locale });
        if (controller.signal.aborted) return;
        setAnalysis(result);
        if (!isReadable(result.extraction)) {
          setPhase("unreadable");
          return;
        }
        setRooms(buildUiRooms(result, locale));
        setPhase("verify");
      } catch (e) {
        if (controller.signal.aborted || e instanceof AnalysisAborted) return;
        setFile(null);
        setError("analyze");
        setPhase("upload");
      }
    },
    [locale],
  );

  const handleFile = useCallback(
    async (f: File) => {
      const check = await validatePlanFile(f);
      if (!check.ok) {
        setError(check.problem);
        return;
      }
      void startAnalysis(f);
    },
    [startAnalysis],
  );

  const reset = useCallback(() => {
    run.current?.abort();
    setFile(null);
    setAnalysis(null);
    setRooms([]);
    setError(null);
    setNotice(null);
    setAdded(null);
    setPhase("upload");
  }, []);

  const deletePlan = () => {
    setConfirmDelete(false);
    reset();
    showToast(t("planUi.deleted"));
  };

  const updateRoom = (id: string, patch: RoomPatch) => {
    setNotice(null);
    setRooms((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // Derived values: areas are always recomputed from the dimensions.
  const grouping = useMemo(() => groupByFlooring(rooms, (id) => getProduct(id)?.coverage_sqft_per_box), [rooms]);
  const includedArea = useMemo(() => includedAreaSqft(rooms), [rooms]);
  const fileLabel = file ? baseFileName(file.name) : "";
  const signature = useMemo(
    () => JSON.stringify(planQuoteLines(grouping.groups, "").map((l) => [l.productId, l.quantity, l.plannedAreaSqft, l.rooms])),
    [grouping],
  );
  const addedNow = added && added.sig === signature ? added : null;

  const handleAdd = () => {
    if (addedNow) return;
    if (grouping.groups.length === 0) {
      setNotice("nothing");
      return;
    }
    // One line per flooring product. Rooms without flooring are listed in the warning only (a quote line needs a product).
    const lines = planQuoteLines(grouping.groups, fileLabel);
    lines.forEach((l) => addToQuote(l));
    const area = grouping.groups.reduce((n, g) => n + g.areaSqft, 0);
    setNotice(null);
    setAdded({ sig: signature, lines: lines.length, area });
    showToast(t("toast.added"), t("planUi.addedDetail", { lines: lines.length, area: formatSqft(area, locale) }));
  };

  const openCalculator = () => {
    const payload = calculatorImport(rooms, fileLabel);
    if (payload.rooms.length === 0) {
      setNotice("noRooms");
      return;
    }
    try {
      window.sessionStorage.setItem(PLAN_IMPORT_KEY, JSON.stringify(payload));
    } catch {
      // Storage blocked: the calculator opens empty and the person can retype the rooms.
    }
    router.push("/calculator");
  };

  const current: 1 | 2 | 3 = phase === "verify" ? (addedNow ? 3 : 2) : 1;
  const steps: [string, string, string] = [t("planReader.stepUpload"), t("planReader.stepVerify"), t("planReader.stepAdd")];
  const errorText =
    error === "type" ? t("errors.fileType") : error === "size" ? t("errors.fileTooLarge") : error === "heic" ? t("planUi.errorHeic") : error === "analyze" ? t("planUi.errorAnalyze") : "";

  return (
    <div className="container-page section-y">
      <p className="label mb-2 sm:hidden">{t("planUi.stepOf", { current, total: 3, name: steps[current - 1] ?? "" })}</p>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-[1_1_420px]">
          {title}
          <div className={phase === "upload" ? "hidden sm:block" : undefined}>{lead}</div>
        </div>
        <StepIndicator current={current} label={t("planReader.steps")} steps={steps} className="hidden sm:block" />
      </div>
      {phase === "upload" ? <p className="mt-3 max-w-2xl text-[18px] leading-7 text-ink-muted sm:hidden">{t("planReader.uploadLead")}</p> : null}

      <div className="mt-8 flex flex-col gap-6">
        {error ? (
          <Alert kind="danger" role="alert" title={t("planUi.errorTitle")} className="mx-auto w-full max-w-3xl">
            {errorText}
          </Alert>
        ) : null}

        {phase === "upload" ? <UploadPanel onFile={handleFile} headingRef={headingRef} /> : null}

        {phase === "analyzing" && file ? (
          <AnalyzingPanel
            key={file.name + file.size + file.lastModified}
            fileName={file.name}
            onCancel={reset}
            headingRef={headingRef}
          />
        ) : null}

        {phase === "unreadable" ? <UnreadablePanel onRetry={reset} headingRef={headingRef} /> : null}

        {phase === "verify" && file && analysis ? (
          <>
            <FileBar
              fileName={file.name}
              pages={analysis.pages}
              readAt={new Date(analysis.readAt)}
              scale={analysis.extraction.scaleText}
              onReplace={handleFile}
              onDelete={() => setConfirmDelete(true)}
            />
            <VerifyPanel
              rooms={rooms}
              grouping={grouping}
              includedArea={includedArea}
              notice={notice}
              added={addedNow}
              headingRef={headingRef}
              onRoomChange={updateRoom}
              onAdd={handleAdd}
              onOpenCalculator={openCalculator}
            />
          </>
        ) : null}
      </div>

      <DeleteDialog open={confirmDelete} onConfirm={deletePlan} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
