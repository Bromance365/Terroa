"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/controls";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { DeleteDialog } from "@/components/plan-reader/DeleteDialog";
import { getProduct, getProducts } from "@/lib/catalog";
import { formatNumber, formatSqft } from "@/lib/format";
import { addToQuote, showToast } from "@/lib/quote-store";
import { LIMITS } from "@/lib/quantities";
import { calculatorImport, groupByFlooring, includedAreaSqft, planQuoteLines } from "@/lib/plan-reader/compute";
import { PLAN_IMPORT_KEY, planImportSchema } from "@/lib/plan-reader/types";
import { detectRoomInWalls, prepareWalls, type DetectFailure, type Mask } from "@/lib/measure/detect";
import { distance, makeScale, rectanglePolygon, validatePolygon } from "@/lib/measure/geometry";
import { loadPlanFile, PlanLoadFailure, type LoadedPlan } from "@/lib/measure/load-plan";
import { toPreviewRooms } from "@/lib/measure/preview";
import { cleanRoomName, toUiRooms, withAreas } from "@/lib/measure/rooms";
import type { MeasuredRoom, Point, PreviewRoom, RoomSource } from "@/lib/measure/types";
import { downscaleRatio } from "@/lib/measure/view";
import type { Locale } from "@/i18n/routing";
import { AddRoomForm } from "./AddRoomForm";
import { Dropzone } from "./Dropzone";
import { PlanCanvas, type CanvasLine, type PlanCanvasHandle, type Tool } from "./PlanCanvas";
import { RoomList, type RoomPatch } from "./RoomList";
import { ScalePanel } from "./ScalePanel";
import { Summary, type MeasureNotice } from "./Summary";
import { Toolbar } from "./Toolbar";

/** Long side of the bitmap used for detection (the plan itself can be up to 3000 px). */
const DETECT_SIDE = 1600;
/** Doorways up to about 3.5 ft are bridged when the scale is known. */
const DOOR_HALF_FT = 1.75;
/** Smallest traced room, in plan pixels squared. */
const MIN_ROOM_PX2 = 64;

const HINT_KEY = { select: "hintSelect", scale: "hintScale", detect: "hintDetect", trace: "hintTrace", rect: "hintRect", pan: "hintPan" } as const;
const TOOL_KEY = { select: "toolSelect", scale: "toolScale", detect: "toolDetect", trace: "toolTrace", rect: "toolRect", pan: "toolPan" } as const;
const FAIL_KEY: Record<DetectFailure, "detectFail" | "detectLeak" | "detectNone" | "detectBlank" | "detectLarge"> = {
  "bad-image": "detectFail",
  blank: "detectBlank",
  "no-seed": "detectNone",
  blocked: "detectNone",
  leak: "detectLeak",
  tiny: "detectNone",
  "too-large": "detectLarge",
  budget: "detectFail",
  "no-contour": "detectFail",
};

type Notice = { kind: "error" | "info"; text: string } | null;
interface Calibration {
  a: Point;
  b: Point;
  length: number;
  unit: "ft" | "m";
}

const nextTick = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

/**
 * "Mesurer sur le plan". The plan and the rooms live in memory only: nothing is uploaded, stored or logged.
 * The room list is the accessible source of truth; the canvas is an enhancement. Areas are whole sq ft, recomputed
 * from the geometry and the scale on every render (never taken from a stored number).
 * `onRoomsChange` receives the rooms for the 3D preview (feet, y down, origin at the minimum corner).
 */
export function MeasureTool({ title, lead, onRoomsChange }: { title: ReactNode; lead: ReactNode; onRoomsChange?: (rooms: PreviewRoom[]) => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [loaded, setLoaded] = useState<LoadedPlan | null>(null);
  const [raster, setRaster] = useState<HTMLCanvasElement | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<MeasuredRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [unit, setUnit] = useState<"ft" | "m">("ft");
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [pending, setPending] = useState<{ a: Point; b: Point } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [orthogonal, setOrthogonal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [summaryNotice, setSummaryNotice] = useState<MeasureNotice>(null);
  const [added, setAdded] = useState<{ sig: string; lines: number; area: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const canvasApi = useRef<PlanCanvasHandle>(null);
  const loadedRef = useRef<LoadedPlan | null>(null);
  const walls = useRef<{ raster: HTMLCanvasElement; ratio: number; mask: Mask | null } | null>(null);
  const seq = useRef(0);
  const onRoomsRef = useRef(onRoomsChange);
  useEffect(() => {
    onRoomsRef.current = onRoomsChange;
  });

  useEffect(
    () => () => {
      loadedRef.current?.destroy();
    },
    [],
  );

  // Derived: the scale, the areas and everything built on them are recomputed, never stored.
  const scale = useMemo(() => (calibration ? makeScale(calibration.a, calibration.b, calibration.length, calibration.unit) : null), [calibration]);
  const measured = useMemo(() => withAreas(rooms, scale), [rooms, scale]);
  const uiRooms = useMemo(() => toUiRooms(measured, scale), [measured, scale]);
  const grouping = useMemo(() => groupByFlooring(uiRooms, (id) => getProduct(id)?.coverage_sqft_per_box), [uiRooms]);
  const includedArea = useMemo(() => includedAreaSqft(uiRooms), [uiRooms]);
  const floors = useMemo(() => getProducts().filter((p) => p.kind === "floor"), []);
  const preview = useMemo(() => toPreviewRooms(measured, scale), [measured, scale]);
  useEffect(() => {
    onRoomsRef.current?.(preview);
  }, [preview]);

  const signature = useMemo(() => JSON.stringify(planQuoteLines(grouping.groups, "").map((l) => [l.productId, l.quantity, l.plannedAreaSqft, l.rooms])), [grouping]);
  const addedNow = added && added.sig === signature ? added : null;
  const equivalent = measured.some((r) => r.included && r.areaSqft !== null && !r.dimsFt);

  const roomLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of measured) out[r.id] = r.areaSqft === null ? r.name : `${r.name} · ${formatSqft(r.areaSqft, locale)}`;
    return out;
  }, [measured, locale]);
  const canvasRooms = useMemo(() => measured.filter((r) => r.points.length >= 3), [measured]);

  const info = (text: string) => setNotice({ kind: "info", text });
  const fail = (text: string) => setNotice({ kind: "error", text });

  const lengthLabel = useCallback(
    (length: number, u: "ft" | "m") => `${formatNumber(length, locale, 2)} ${t(u === "ft" ? "measure.unitFt" : "measure.unitM")}`,
    [locale, t],
  );

  // Plan loading ---------------------------------------------------------------------------------

  const clearPlanWork = useCallback(() => {
    setRooms((all) => all.filter((r) => r.dimsFt));
    setCalibration(null);
    setPending(null);
    setDraft([]);
    setSelectedId(null);
    setTool("select");
    walls.current = null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setNotice(null);
      setLoading(true);
      try {
        const plan = await loadPlanFile(file);
        loadedRef.current?.destroy();
        loadedRef.current = plan;
        clearPlanWork();
        setLoaded(plan);
        setRaster(plan.canvas);
        setPage(1);
        setAdded(null);
        setTool("scale");
        info(t("measure.hintScale"));
      } catch (e) {
        const code = e instanceof PlanLoadFailure ? e.code : "decode";
        fail(
          code === "type"
            ? t("errors.fileType")
            : code === "size"
              ? t("errors.fileTooLarge")
              : code === "heic"
                ? t("planUi.errorHeic")
                : code === "pdf-password"
                  ? t("measure.errorPassword")
                  : code === "too-large"
                    ? t("measure.errorTooLarge")
                    : t("measure.errorLoad"),
        );
      } finally {
        setLoading(false);
      }
    },
    [clearPlanWork, t],
  );

  const changePage = useCallback(
    async (n: number) => {
      if (!loaded) return;
      setLoading(true);
      try {
        const canvas = await loaded.renderPage(n);
        const hadWork = rooms.some((r) => !r.dimsFt) || calibration !== null;
        clearPlanWork();
        setPage(n);
        setRaster(canvas);
        if (hadWork) info(t("measure.pageChanged"));
      } catch {
        fail(t("measure.errorLoad"));
      } finally {
        setLoading(false);
      }
    },
    [loaded, rooms, calibration, clearPlanWork, t],
  );

  const removePlan = () => {
    setConfirmRemove(false);
    loadedRef.current?.destroy();
    loadedRef.current = null;
    setLoaded(null);
    setRaster(null);
    setPage(1);
    clearPlanWork();
    setNotice(null);
    showToast(t("planUi.deleted"));
  };

  // Rooms ----------------------------------------------------------------------------------------

  const roomCount = rooms.length;
  const atLimit = roomCount >= LIMITS.maxRooms;
  const newId = () => `m-${Date.now().toString(36)}-${++seq.current}`;

  const addRoom = useCallback(
    (room: Omit<MeasuredRoom, "id" | "areaSqft" | "included" | "productId" | "name"> & { name?: string }) => {
      if (roomCount >= LIMITS.maxRooms) {
        fail(t("calcUi.limitRooms", { max: LIMITS.maxRooms }));
        return null;
      }
      const name = cleanRoomName(room.name ?? "") || t("measure.roomDefault", { n: roomCount + 1 });
      const created: MeasuredRoom = { ...room, id: newId(), name, areaSqft: null, productId: null, included: true };
      setRooms((all) => [...all, created]);
      setAdded(null);
      setSummaryNotice(null);
      return created;
    },
    [roomCount, t],
  );

  const addPolygon = (points: Point[], source: RoomSource) => {
    const ok = validatePolygon(points, MIN_ROOM_PX2);
    if (!ok.ok) {
      fail(ok.problem === "too-few" ? t("measure.traceFew") : source === "rectangle" ? t("measure.rectSmall") : t("measure.traceInvalid"));
      return false;
    }
    const created = addRoom({ points, source });
    if (created) {
      setSelectedId(created.id);
      info(t("measure.roomAdded", { name: created.name }));
    }
    return Boolean(created);
  };

  const updateRoom = (id: string, patch: RoomPatch) => {
    setAdded(null);
    setSummaryNotice(null);
    setRooms((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteRoom = (id: string) => {
    const room = rooms.find((r) => r.id === id);
    setRooms((all) => all.filter((r) => r.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setAdded(null);
    if (room) info(t("measure.roomRemoved", { name: room.name }));
  };

  const addTyped = (input: { name: string; lengthFt: number; widthFt: number }) => {
    const created = addRoom({ name: input.name, points: [], dimsFt: { lengthFt: input.lengthFt, widthFt: input.widthFt }, source: "typed" });
    if (created) info(t("measure.roomAdded", { name: created.name }));
  };

  // Canvas actions -------------------------------------------------------------------------------

  const closeTrace = () => {
    if (draft.length < 3) {
      fail(t("measure.traceFew"));
      return;
    }
    if (addPolygon(draft, "trace")) setDraft([]);
  };

  const cancelWork = () => {
    setDraft([]);
    setPending(null);
    setNotice(null);
  };

  const chooseTool = (next: Tool) => {
    setTool(next);
    if (next !== "trace") setDraft([]);
    if (next !== "scale") setPending(null);
    setNotice(null);
  };

  const onLine = (a: Point, b: Point) => {
    if (distance(a, b) < 8) {
      fail(t("measure.scaleShort"));
      return;
    }
    setPending({ a, b });
    setNotice(null);
  };

  const applyScale = (length: number): "short" | "invalid" | null => {
    if (!pending) return "invalid";
    if (!makeScale(pending.a, pending.b, length, unit)) return distance(pending.a, pending.b) < 8 ? "short" : "invalid";
    setCalibration({ a: pending.a, b: pending.b, length, unit });
    setPending(null);
    setTool("select");
    setAdded(null);
    info(t("measure.scaleDone"));
    return null;
  };

  const onRect = (a: Point, b: Point) => {
    addPolygon(rectanglePolygon(a, b), "rectangle");
  };

  const onDetect = async (seed: Point) => {
    if (!raster || busy) return;
    setBusy(true);
    setNotice(null);
    await nextTick();
    try {
      let cache = walls.current;
      if (!cache || cache.raster !== raster) {
        const ratio = downscaleRatio(raster.width, raster.height, DETECT_SIDE);
        const small = document.createElement("canvas");
        small.width = Math.max(3, Math.round(raster.width * ratio));
        small.height = Math.max(3, Math.round(raster.height * ratio));
        const ctx = small.getContext("2d", { willReadFrequently: true });
        let mask: Mask | null = null;
        if (ctx) {
          ctx.drawImage(raster, 0, 0, small.width, small.height);
          const prepared = prepareWalls(ctx.getImageData(0, 0, small.width, small.height));
          mask = prepared?.walls ?? null;
        }
        cache = { raster, ratio, mask };
        walls.current = cache;
      }
      if (!cache.mask) {
        fail(t("measure.detectFail"));
        return;
      }
      const gapRadius = scale ? Math.min(72, Math.max(3, Math.ceil(DOOR_HALF_FT * scale.pxPerFt * cache.ratio))) : undefined;
      const outcome = detectRoomInWalls(cache.mask, { x: seed.x * cache.ratio, y: seed.y * cache.ratio }, { gapRadius, orthogonal });
      if (!outcome.ok) {
        fail(t(`measure.${FAIL_KEY[outcome.reason]}`));
        return;
      }
      const points = outcome.room.points.map((p) => ({ x: p.x / cache.ratio, y: p.y / cache.ratio }));
      if (addPolygon(points, "detect")) info(t("measure.detectDone"));
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = () => {
    if (selectedId && tool === "select") deleteRoom(selectedId);
  };

  // Outputs --------------------------------------------------------------------------------------

  const handleAdd = () => {
    if (addedNow) return;
    if (grouping.groups.length === 0) {
      setSummaryNotice("nothing");
      return;
    }
    const lines = planQuoteLines(grouping.groups, t("measure.quoteLabel"));
    lines.forEach((l) => addToQuote(l));
    const area = grouping.groups.reduce((n, g) => n + g.areaSqft, 0);
    setSummaryNotice(null);
    setAdded({ sig: signature, lines: lines.length, area });
    showToast(t("toast.added"), t("planUi.addedDetail", { lines: lines.length, area: formatSqft(area, locale) }));
  };

  const openCalculator = () => {
    const payload = calculatorImport(uiRooms, t(equivalent ? "measure.calculatorLabel" : "measure.quoteLabel"));
    if (payload.rooms.length === 0 || !planImportSchema.safeParse(payload).success) {
      setSummaryNotice("noRooms");
      return;
    }
    try {
      window.sessionStorage.setItem(PLAN_IMPORT_KEY, JSON.stringify(payload));
    } catch {
      // Storage blocked: the calculator opens empty and the rooms can be retyped.
    }
    router.push("/calculator");
  };

  // Render ---------------------------------------------------------------------------------------

  const line: CanvasLine | null = pending
    ? { a: pending.a, b: pending.b }
    : calibration
      ? { a: calibration.a, b: calibration.b, label: lengthLabel(calibration.length, calibration.unit) }
      : null;
  const toolName = t(`measure.${TOOL_KEY[tool]}`);
  const replaceInput = useRef<HTMLInputElement>(null);

  return (
    <div className="container-page section-y">
      <div className="min-w-0 max-w-3xl">
        {title}
        {lead}
        <p className="mt-3 text-[15px] leading-[22px]">
          {t("measure.readerHint")}{" "}
          <Link href="/plan-reader" className="font-semibold">
            {t("measure.readerLink")}
          </Link>
        </p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div aria-live="polite" role="status">
            {busy ? <p className="small">{t("measure.detectBusy")}</p> : notice?.kind === "info" ? <p className="small">{notice.text}</p> : null}
          </div>
          {notice?.kind === "error" ? (
            <Alert kind="danger" role="alert">
              {notice.text}
            </Alert>
          ) : null}

          {raster && loaded ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                {loaded.pageCount > 1 ? (
                  <Select
                    label={<span className="sr-only">{t("measure.pagePicker")}</span>}
                    value={String(page)}
                    disabled={loading}
                    onChange={(e) => void changePage(Number(e.target.value))}
                    fieldClassName="w-44"
                  >
                    {Array.from({ length: loaded.pageCount }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {t("measure.pageOption", { page: i + 1, count: loaded.pageCount })}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Button variant="secondary" icon="upload" onClick={() => replaceInput.current?.click()}>
                  {t("planReader.replace")}
                </Button>
                <Button variant="danger" icon="trash" onClick={() => setConfirmRemove(true)}>
                  {t("planReader.delete")}
                </Button>
                <input
                  ref={replaceInput}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleFile(file);
                  }}
                />
              </div>
              {loaded.truncated ? <p className="small text-ink-muted">{t("measure.pageLimit", { max: loaded.pageCount })}</p> : null}

              <Toolbar tool={tool} onTool={chooseTool} onFit={() => canvasApi.current?.fit()} onZoom={(f) => canvasApi.current?.zoomBy(f)} />

              <div className="flex flex-col gap-2">
                <p className="small text-[15px] leading-[22px]">
                  <strong className="font-semibold">{toolName}.</strong> {t(`measure.${HINT_KEY[tool]}`)}
                </p>
                {tool === "detect" ? (
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                    <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={orthogonal} onChange={(e) => setOrthogonal(e.target.checked)} />
                    <span>{t("measure.orthogonal")}</span>
                  </label>
                ) : null}
                {tool === "trace" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="small num" aria-live="polite">
                      {t("measure.traceCount", { count: draft.length })}
                    </p>
                    <Button variant="secondary" disabled={draft.length === 0} onClick={() => setDraft((d) => d.slice(0, -1))}>
                      {t("measure.traceUndo")}
                    </Button>
                    <Button variant="secondary" disabled={draft.length < 3} onClick={closeTrace}>
                      {t("measure.traceClose")}
                    </Button>
                    <Button variant="ghost" disabled={draft.length === 0} onClick={() => setDraft([])}>
                      {t("measure.traceCancel")}
                    </Button>
                  </div>
                ) : null}
              </div>

              <PlanCanvas
                ref={canvasApi}
                plan={raster}
                tool={tool}
                rooms={canvasRooms}
                roomLabels={roomLabels}
                selectedId={selectedId}
                draft={draft}
                line={line}
                label={t("measure.canvasLabel")}
                describedBy="measure-canvas-desc"
                onSelect={setSelectedId}
                onLine={onLine}
                onRect={onRect}
                onDetect={(seed) => void onDetect(seed)}
                onDraft={setDraft}
                onCloseTrace={closeTrace}
                onCancel={cancelWork}
                onDeleteSelected={deleteSelected}
              />
              <p id="measure-canvas-desc" className="sr-only">
                {t("measure.canvasDescription", { count: canvasRooms.length })} {t("measure.toolActive", { tool: toolName })}
              </p>
              <p className="small text-ink-muted">{t("measure.keyboardHelp")}</p>
            </>
          ) : (
            <Dropzone onFile={(f) => void handleFile(f)} loading={loading} />
          )}
        </div>

        <aside aria-label={t("measure.roomsTitle")} className="panel flex min-w-0 flex-col gap-6 p-5 sm:p-6 lg:sticky lg:top-24">
          <ScalePanel
            unit={unit}
            onUnit={setUnit}
            hasPlan={Boolean(raster)}
            hasScale={scale !== null}
            scaleLabel={calibration ? lengthLabel(calibration.length, calibration.unit) : ""}
            pending={pending !== null}
            onApply={applyScale}
            onCancel={() => setPending(null)}
            onRedo={() => chooseTool("scale")}
          />

          <section aria-labelledby="measure-rooms-title" className="flex flex-col gap-4 border-t border-line pt-6">
            <h2 id="measure-rooms-title" className="text-[20px] leading-7">
              {t("measure.roomsTitle")} <span className="small font-normal text-ink-muted">({t("planUi.roomsCount", { count: roomCount })})</span>
            </h2>
            <RoomList rooms={measured} floors={floors} unit={unit} selectedId={selectedId} onChange={updateRoom} onDelete={deleteRoom} onSelect={setSelectedId} />
            <AddRoomForm unit={unit} disabled={atLimit} onAdd={addTyped} />
          </section>

          <div className="border-t border-line pt-6">
            <Summary
              includedArea={includedArea}
              roomCount={roomCount}
              grouping={grouping}
              notice={summaryNotice}
              added={addedNow}
              onAdd={handleAdd}
              onOpenCalculator={openCalculator}
              equivalent={equivalent}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <aside aria-label={t("footer.privacy")} className="flex gap-3 rounded-md border border-line bg-surface-raised p-4">
              <Icon name="info" className="mt-0.5 flex-none text-accent" />
              <p className="small text-[15px] leading-[22px]">
                {t("measure.privacy")} <Link href="/privacy">{t("footer.privacy")}</Link>
              </p>
            </aside>
            <p className="small text-ink-muted">{t("measure.disclaimer")}</p>
          </div>
        </aside>
      </div>

      <DeleteDialog open={confirmRemove} onConfirm={removePlan} onCancel={() => setConfirmRemove(false)} />
    </div>
  );
}
