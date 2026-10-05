"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Alert, SegmentedControl } from "@/components/ui/controls";
import { Button, LinkButton } from "@/components/ui/Button";
import { Select, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { getProduct, getProducts, productName, type ProductKind } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import {
  LIMITS,
  SQFT_TO_M2,
  floorQuantities,
  panelQuantities,
  parsePositiveDecimal,
  type DimensionError,
  type UnitSystem,
} from "@/lib/quantities";
import { useAddToQuote } from "@/lib/useAddToQuote";
import { CalculatorResult, ResultBar, type ResultModel } from "./CalculatorResult";
import { DimRow, ROW_GRID } from "./DimRow";
import { PLAN_IMPORT_KEY, parsePlanImport } from "./planImport";
import { areaToSqft, computeText, displayText, type Typed, type UnitKind } from "./units";

type Mode = "floor" | "panels";

interface RoomState {
  id: string;
  name: string;
  a: Typed;
  b: Typed;
}

const COLLAPSED_VISIBLE = 3;

const blank = (u: UnitSystem): Typed => ({ v: "", u });

export function Calculator() {
  const t = useTranslations("calculator");
  const tu = useTranslations("calcUi");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const addToQuote = useAddToQuote();
  const uid = useId();
  const sep: "," | "." = locale === "fr" ? "," : ".";

  const nextId = useRef(2);
  const [focusId, setFocusId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("floor");
  const [units, setUnits] = useState<UnitSystem>("imperial");
  const [rooms, setRooms] = useState<RoomState[]>(() => [{ id: "r1", name: `${t("room")} 1`, a: blank("imperial"), b: blank("imperial") }]);
  const [walls, setWalls] = useState<RoomState[]>(() => [{ id: "w1", name: `${t("wall")} 1`, a: blank("imperial"), b: blank("imperial") }]);
  const [waste, setWaste] = useState<number>(10);
  const [coverage, setCoverage] = useState<Typed>(() => blank("imperial"));
  const [panelW, setPanelW] = useState<Typed>(() => blank("imperial"));
  const [panelH, setPanelH] = useState<Typed>(() => blank("imperial"));
  const [floorProductId, setFloorProductId] = useState("");
  const [panelProductId, setPanelProductId] = useState("");
  const [imported, setImported] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>("r1");
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [submitError, setSubmitError] = useState<"product" | "nothing" | null>(null);

  const typedFromNumber = (n: number, u: UnitSystem): Typed => ({ v: String(n).replace(".", sep), u });

  // Deep links (?product=, ?mode=panels) and rooms sent from the plan reader. Read once on mount:
  // the page is statically rendered, so none of this can be known on the server.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const product = getProduct(params.get("product") ?? "");
    let nextMode: Mode = params.get("mode") === "panels" ? "panels" : "floor";
    if (product) nextMode = product.kind === "panel" ? "panels" : "floor";

    let plan: ReturnType<typeof parsePlanImport> = null;
    try {
      plan = parsePlanImport(window.sessionStorage.getItem(PLAN_IMPORT_KEY));
    } catch {
      plan = null;
    }

    /* eslint-disable react-hooks/set-state-in-effect */
    setMode(nextMode);
    if (product?.kind === "floor") {
      setFloorProductId(product.id);
      if (product.coverage_sqft_per_box) setCoverage({ v: String(product.coverage_sqft_per_box).replace(".", sep), u: "imperial" });
    }
    if (product?.kind === "panel") {
      setPanelProductId(product.id);
      if (product.panel_width_in) setPanelW({ v: String(product.panel_width_in).replace(".", sep), u: "imperial" });
      if (product.panel_height_in) setPanelH({ v: String(product.panel_height_in).replace(".", sep), u: "imperial" });
    }
    if (plan) {
      const rows = plan.rooms.map((r, i) => ({
        id: `r${i + 1}`,
        name: r.name || `${t("room")} ${i + 1}`,
        a: { ...r.length, v: r.length.v.replace(".", sep) },
        b: { ...r.width, v: r.width.v.replace(".", sep) },
      }));
      setRooms(rows);
      nextId.current = rows.length + 1;
      setEditingId(null);
      setImported(plan.file);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Mount only: reading the URL and sessionStorage must not re-run on locale or message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLElement>(`[data-row-id="${focusId}"] input`);
    el?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusId(null);
  }, [focusId, rooms, walls]);

  // Units -------------------------------------------------------------------
  const label = {
    len: units === "imperial" ? tu("ft") : tu("m"),
    area: units === "imperial" ? tu("sqft") : tu("m2"),
    small: units === "imperial" ? tu("inch") : tu("mm"),
  };
  const show = (x: Typed, kind: UnitKind) => displayText(x, kind, units, sep);
  const num = (n: number, digits = 1) => formatNumber(n, locale, digits);
  const areaText = (n: number) => `${num(n)} ${label.area}`;
  /** "1 039 pi² (96,5 m²)" with the other unit in brackets. */
  const areaBoth = (n: number) =>
    units === "imperial"
      ? `${num(n)} ${label.area} (${num(n * SQFT_TO_M2)} ${tu("m2")})`
      : `${num(n)} ${tu("m2")} (${num(n / SQFT_TO_M2, 0)} ${tu("sqft")})`;

  // Quantities (reused maths; client numbers are display only) ---------------
  const floor = useMemo(
    () =>
      floorQuantities({
        rooms: rooms.map((r) => ({ id: r.id, name: r.name, length: computeText(r.a, "len", units), width: computeText(r.b, "len", units) })),
        wastePct: waste,
        coveragePerBox: computeText(coverage, "area", units),
        units,
      }),
    [rooms, waste, coverage, units],
  );
  const panelsRes = useMemo(
    () =>
      panelQuantities({
        walls: walls.map((w) => ({ id: w.id, name: w.name, width: computeText(w.a, "len", units), height: computeText(w.b, "len", units) })),
        panelWidth: computeText(panelW, "small", units),
        panelHeight: computeText(panelH, "small", units),
        units,
      }),
    [walls, panelW, panelH, units],
  );

  const coverageValue = parsePositiveDecimal(computeText(coverage, "area", units));
  const dash = "—";

  const errorMessage = (kindA: DimensionError | null, kindB: DimensionError | null, hasInput: boolean, which: "room" | "wall") => {
    if (!hasInput || (!kindA && !kindB)) return null;
    if (kindA === "too-large" || kindB === "too-large") return t("errorTooLarge");
    return which === "room" ? t("errorDimensions") : tu("errorWall");
  };

  // Result models -------------------------------------------------------------
  const floorModel: ResultModel = (() => {
    const hasOrder = floor.orderArea > 0;
    const cov = coverageValue !== null ? areaText(coverageValue) : null;
    return {
      label: t("boxesToOrder"),
      big: floor.boxes !== null && floor.boxes > 0 ? tc("box", { count: floor.boxes }) : dash,
      rows: [
        { label: t("netArea"), value: areaText(floor.netArea) },
        { label: t("wasteLine", { pct: waste }), value: hasOrder ? `+ ${areaText(floor.orderArea - floor.netArea)}` : dash },
        { label: t("toOrder"), value: hasOrder ? areaBoth(floor.orderArea) : dash },
        { label: t("coverage"), value: cov ? tu("perBox", { area: cov }) : tu("emptyValue") },
      ],
      note: coverageValue === null ? t("coverageMissingNote") : t("roundedUp"),
      barSummary: hasOrder ? `${areaText(floor.orderArea)} · ${cov ? tu("perBox", { area: cov }) : `${t("coverage")} ${tu("emptyValue")}`}` : dash,
    };
  })();

  const panelSizeText = panelsRes.panelSizeValid ? `${show(panelW, "small")} × ${show(panelH, "small")} ${label.small}` : tu("emptyValue");
  const validWalls = panelsRes.walls.filter((w) => w.panels !== null).length;
  const panelsModel: ResultModel = {
    label: t("panelsToOrder"),
    big: panelsRes.panels > 0 ? tc("panel", { count: panelsRes.panels }) : dash,
    rows: [
      { label: t("wallArea"), value: panelsRes.wallArea > 0 ? areaBoth(panelsRes.wallArea) : dash },
      { label: tu("format"), value: panelSizeText },
      { label: t("walls"), value: num(validWalls, 0) },
    ],
    note: t("panelsRounded"),
    barSummary: panelsRes.wallArea > 0 ? `${areaText(panelsRes.wallArea)} · ${panelSizeText}` : dash,
  };
  const model = mode === "floor" ? floorModel : panelsModel;

  // Actions ------------------------------------------------------------------
  const productId = mode === "floor" ? floorProductId : panelProductId;
  const submit = () => {
    if (!productId) {
      setSubmitError("product");
      document.getElementById(`${uid}-product-${mode === "floor" ? "floor" : "panel"}`)?.focus();
      return;
    }
    const names = (list: RoomState[], ok: (i: number) => boolean) =>
      list.filter((_, i) => ok(i)).map((r) => r.name.trim().slice(0, 60)).filter(Boolean).slice(0, 60);
    if (mode === "floor") {
      if (floor.boxes === null || floor.boxes < 1) {
        setSubmitError("nothing");
        return;
      }
      setSubmitError(null);
      addToQuote({
        productId,
        unit: "box",
        quantity: floor.boxes,
        plannedAreaSqft: Math.round(areaToSqft(floor.netArea, units) * 10) / 10,
        rooms: names(rooms, (i) => floor.rooms[i]?.area != null),
        source: "calculator",
      });
    } else {
      if (panelsRes.panels < 1) {
        setSubmitError("nothing");
        return;
      }
      setSubmitError(null);
      addToQuote({
        productId,
        unit: "panel",
        quantity: panelsRes.panels,
        rooms: names(walls, (i) => panelsRes.walls[i]?.panels != null),
        source: "calculator",
      });
    }
  };

  // Row helpers --------------------------------------------------------------
  const newRow = (prefix: "r" | "w", count: number): RoomState => {
    const id = `${prefix}${nextId.current++}`;
    return { id, name: `${prefix === "r" ? t("room") : t("wall")} ${count + 1}`, a: blank(units), b: blank(units) };
  };
  const patch = (set: typeof setRooms, id: string, change: Partial<RoomState>) =>
    set((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const addRoom = () => {
    const row = newRow("r", rooms.length);
    setRooms((l) => [...l, row]);
    setEditingId(row.id);
    setFocusId(row.id);
    setShowAllRooms(true);
  };
  const addWall = () => {
    const row = newRow("w", walls.length);
    setWalls((l) => [...l, row]);
    setEditingId(row.id);
    setFocusId(row.id);
  };

  const onProduct = (kind: ProductKind, id: string) => {
    setSubmitError(null);
    const p = getProduct(id);
    if (kind === "floor") {
      setFloorProductId(id);
      if (p) setCoverage(p.coverage_sqft_per_box ? typedFromNumber(p.coverage_sqft_per_box, "imperial") : blank(units));
    } else {
      setPanelProductId(id);
      if (p) {
        setPanelW(p.panel_width_in ? typedFromNumber(p.panel_width_in, "imperial") : blank(units));
        setPanelH(p.panel_height_in ? typedFromNumber(p.panel_height_in, "imperial") : blank(units));
      }
    }
  };

  const productOptions = (kind: ProductKind) => getProducts().filter((p) => p.kind === kind);

  const productSelect = (kind: ProductKind) => (
    <Select
      label={tu("product")}
      helper={tu("productHelp")}
      error={submitError === "product" ? tu("errorNoProduct") : null}
      value={kind === "floor" ? floorProductId : panelProductId}
      onChange={(e) => onProduct(kind, e.target.value)}
      id={`${uid}-product-${kind}`}
    >
      <option value="">{tu("chooseProduct")}</option>
      {productOptions(kind).map((p) => (
        <option key={p.id} value={p.id}>
          {productName(p, locale)}
        </option>
      ))}
    </Select>
  );

  const addButton = (
    <Button size="lg" block icon="plus" onClick={submit}>
      {tc("addToQuote")}
    </Button>
  );
  const uploadButton = (
    <LinkButton href="/plan-reader" variant="secondary" size="lg" block icon="upload">
      {t("uploadInstead")}
    </LinkButton>
  );

  const submitAlert =
    submitError === "nothing" ? (
      <Alert kind="danger" role="alert">
        {tu("errorNothing")}
      </Alert>
    ) : null;

  const wasteName = `${uid}-waste`;
  const roomsAtLimit = rooms.length >= LIMITS.maxRooms;
  const wallsAtLimit = walls.length >= LIMITS.maxWalls;
  const extraRooms = Math.max(0, rooms.length - COLLAPSED_VISIBLE);

  const headerCols = (a: string, b: string, result: string, first: string) => (
    <div aria-hidden="true" className={cx("label hidden gap-3 border-b border-line pb-2 sm:grid", ROW_GRID)}>
      <span>{first}</span>
      <span>{`${a} (${label.len})`}</span>
      <span>{`${b} (${label.len})`}</span>
      <span className="pr-4 text-right">{result}</span>
      <span />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SegmentedControl<Mode>
          label={tu("modeLabel")}
          className="max-sm:flex max-sm:w-full"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSubmitError(null);
          }}
          options={[
            { value: "floor", label: t("floor") },
            {
              value: "panels",
              label: (
                <>
                  <span className="sm:hidden">{tu("panelsShort")}</span>
                  <span className="hidden sm:inline">{t("panels")}</span>
                </>
              ),
            },
          ]}
        />
        <div className="flex items-center gap-3">
          <span className="small text-ink-muted" aria-hidden="true">
            {t("units")}
          </span>
          <SegmentedControl<UnitSystem>
            label={t("units")}
            value={units}
            onChange={setUnits}
            options={[
              { value: "imperial", label: t("imperial") },
              { value: "metric", label: t("metric") },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-10">
          {mode === "floor" ? (
            <>
              <section aria-labelledby={`${uid}-rooms`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id={`${uid}-rooms`}>{t("rooms")}</h2>
                  <span className="small text-ink-muted sm:hidden">{tu("roomCount", { count: rooms.length })}</span>
                </div>
                {imported ? (
                  <p className="small mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-muted">
                    <Icon name="file" size={16} />
                    <span>{t("importedFromPlan", { file: imported })}</span>
                    <span aria-hidden="true">·</span>
                    <Link href="/plan-reader" className="font-semibold">
                      {t("reviewInReader")}
                    </Link>
                  </p>
                ) : null}
                <div className="mt-4">
                  {headerCols(t("length"), t("width"), t("area"), t("room"))}
                  <ul className="flex flex-col gap-2 sm:gap-0">
                    {rooms.map((r, i) => {
                      const res = floor.rooms[i];
                      const hasInput = Boolean(r.a.v.trim() || r.b.v.trim());
                      const error = errorMessage(res?.lengthError ?? null, res?.widthError ?? null, hasInput, "room");
                      return (
                        <DimRow
                          key={r.id}
                          rowId={r.id}
                          name={r.name}
                          a={show(r.a, "len")}
                          b={show(r.b, "len")}
                          onName={(v) => patch(setRooms, r.id, { name: v })}
                          onA={(v) => patch(setRooms, r.id, { a: { v, u: units } })}
                          onB={(v) => patch(setRooms, r.id, { b: { v, u: units } })}
                          labelName={t("roomName")}
                          labelA={`${t("length")} (${label.len})`}
                          labelB={`${t("width")} (${label.len})`}
                          fallbackName={`${t("room")} ${i + 1}`}
                          suffix={label.len}
                          result={res?.area != null ? areaText(res.area) : dash}
                          summary={res?.area != null ? `${show(r.a, "len")} × ${show(r.b, "len")} ${label.len}` : dash}
                          error={error}
                          aInvalid={Boolean(error) && Boolean(res?.lengthError)}
                          bInvalid={Boolean(error) && Boolean(res?.widthError)}
                          removeLabel={t("removeRoom", { room: r.name.trim() || `${t("room")} ${i + 1}` })}
                          editLabel={tu("editRow", { name: r.name.trim() || `${t("room")} ${i + 1}` })}
                          doneLabel={tu("doneRow", { name: r.name.trim() || `${t("room")} ${i + 1}` })}
                          onRemove={() => {
                            setRooms((l) => l.filter((x) => x.id !== r.id));
                            document.getElementById(`${uid}-add-room`)?.focus();
                          }}
                          editing={editingId === r.id}
                          onEdit={() => setEditingId(r.id)}
                          onDone={() => setEditingId(null)}
                          collapsedOnMobile={!showAllRooms && i >= COLLAPSED_VISIBLE && editingId !== r.id && !error}
                        />
                      );
                    })}
                  </ul>
                </div>
                {extraRooms > 0 ? (
                  <button
                    type="button"
                    aria-expanded={showAllRooms}
                    onClick={() => setShowAllRooms((v) => !v)}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-2 font-semibold text-accent sm:hidden"
                  >
                    {showAllRooms ? tu("showFewer") : tu("showOthers", { count: extraRooms })}
                    <Icon name="chevronDown" className={showAllRooms ? "rotate-180" : undefined} />
                  </button>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  <Button id={`${uid}-add-room`} variant="secondary" icon="plus" onClick={addRoom} disabled={roomsAtLimit} aria-describedby={roomsAtLimit ? `${uid}-room-limit` : undefined} className="max-sm:w-full">
                    {t("addRoom")}
                  </Button>
                  <p className="num font-semibold">{t("netTotal", { area: areaText(floor.netArea) })}</p>
                </div>
                {roomsAtLimit ? (
                  <p id={`${uid}-room-limit`} className="small mt-2 text-ink-muted">
                    {tu("limitRooms", { max: LIMITS.maxRooms })}
                  </p>
                ) : null}
                {floor.tooLarge ? (
                  <Alert kind="danger" role="alert" className="mt-4">
                    {tu("errorTotalTooLarge")}
                  </Alert>
                ) : null}
              </section>

              <section aria-labelledby={`${uid}-waste-h`}>
                <h2 id={`${uid}-waste-h`}>{t("wasteAndCoverage")}</h2>
                <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2">
                  <div role="group" aria-labelledby={wasteName} className="flex flex-col gap-1.5">
                    <p id={wasteName} className="label">
                      {t("waste")}
                    </p>
                    <div className="grid grid-cols-3 gap-2 md:max-w-[264px]">
                      {LIMITS.wasteOptions.map((w) => {
                        const on = waste === w;
                        return (
                          <button
                            key={w}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setWaste(w)}
                            className={cx(
                              "num inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border font-semibold",
                              on
                                ? "border-accent bg-surface text-accent shadow-[inset_0_0_0_1px_var(--accent)]"
                                : "border-border-strong bg-transparent text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-raised))]",
                            )}
                          >
                            {on ? <Icon name="check" size={16} /> : null}
                            {num(w, 0)}&nbsp;%
                          </button>
                        );
                      })}
                    </div>
                    <p className="small text-ink-muted">{t("wasteHelp")}</p>
                  </div>
                  <div className="flex flex-col gap-6">
                    {productSelect("floor")}
                    <TextField
                      label={t("coveragePerBox")}
                      helper={t("coverageHelp")}
                      suffix={label.area}
                      className="num pr-16!"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={show(coverage, "area")}
                      onChange={(e) => setCoverage({ v: e.target.value, u: units })}
                    />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <section aria-labelledby={`${uid}-walls`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id={`${uid}-walls`}>{t("walls")}</h2>
                  <span className="small text-ink-muted sm:hidden">{tu("wallCount", { count: walls.length })}</span>
                </div>
                <div className="mt-4">
                  {headerCols(t("width"), t("height"), tu("panelCountColumn"), t("wall"))}
                  <ul className="flex flex-col gap-2 sm:gap-0">
                    {walls.map((w, i) => {
                      const res = panelsRes.walls[i];
                      const hasInput = Boolean(w.a.v.trim() || w.b.v.trim());
                      const error = errorMessage(res?.widthError ?? null, res?.heightError ?? null, hasInput, "wall");
                      const nm = w.name.trim() || `${t("wall")} ${i + 1}`;
                      return (
                        <DimRow
                          key={w.id}
                          rowId={w.id}
                          name={w.name}
                          a={show(w.a, "len")}
                          b={show(w.b, "len")}
                          onName={(v) => patch(setWalls, w.id, { name: v })}
                          onA={(v) => patch(setWalls, w.id, { a: { v, u: units } })}
                          onB={(v) => patch(setWalls, w.id, { b: { v, u: units } })}
                          labelName={tu("wallName")}
                          labelA={`${t("width")} (${label.len})`}
                          labelB={`${t("height")} (${label.len})`}
                          fallbackName={`${t("wall")} ${i + 1}`}
                          suffix={label.len}
                          result={res?.panels != null ? num(res.panels, 0) : dash}
                          summary={res?.panels != null ? `${show(w.a, "len")} × ${show(w.b, "len")} ${label.len}` : dash}
                          error={error}
                          aInvalid={Boolean(error) && Boolean(res?.widthError)}
                          bInvalid={Boolean(error) && Boolean(res?.heightError)}
                          removeLabel={tu("removeWall", { room: nm })}
                          editLabel={tu("editRow", { name: nm })}
                          doneLabel={tu("doneRow", { name: nm })}
                          onRemove={() => {
                            setWalls((l) => l.filter((x) => x.id !== w.id));
                            document.getElementById(`${uid}-add-wall`)?.focus();
                          }}
                          editing={editingId === w.id}
                          onEdit={() => setEditingId(w.id)}
                          onDone={() => setEditingId(null)}
                          collapsedOnMobile={false}
                        />
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-4">
                  <Button id={`${uid}-add-wall`} variant="secondary" icon="plus" onClick={addWall} disabled={wallsAtLimit} aria-describedby={wallsAtLimit ? `${uid}-wall-limit` : undefined} className="max-sm:w-full">
                    {t("addWall")}
                  </Button>
                  {wallsAtLimit ? (
                    <p id={`${uid}-wall-limit`} className="small mt-2 text-ink-muted">
                      {tu("limitWalls", { max: LIMITS.maxWalls })}
                    </p>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby={`${uid}-format`}>
                <h2 id={`${uid}-format`}>{t("panelFormat")}</h2>
                <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2">
                  {productSelect("panel")}
                </div>
                <div className="mt-6 grid max-w-[560px] grid-cols-2 gap-x-4 gap-y-3">
                  <TextField
                    label={t("panelWidth")}
                    suffix={label.small}
                    className="num"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={show(panelW, "small")}
                    error={panelSizeProblem(panelW, panelH, panelsRes.panelSizeValid) ? tu("errorPanelSize") : null}
                    onChange={(e) => setPanelW({ v: e.target.value, u: units })}
                  />
                  <TextField
                    label={t("panelHeight")}
                    suffix={label.small}
                    className="num"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={show(panelH, "small")}
                    onChange={(e) => setPanelH({ v: e.target.value, u: units })}
                  />
                </div>
                <p className="small mt-3 text-ink-muted">{t("panelHelp")}</p>
              </section>
            </>
          )}

          {/* Mobile: secondary action stays in the flow, the primary one lives in the bottom bar. */}
          <div className="sm:hidden">{uploadButton}</div>
          {submitAlert ? <div className="sm:hidden">{submitAlert}</div> : null}
        </div>

        <CalculatorResult
          className="flex-[1_1_320px]"
          model={model}
          ariaLabel={tu("resultLabel")}
          actions={
            <>
              {addButton}
              {uploadButton}
              {submitAlert}
            </>
          }
        />
      </div>

      <ResultBar
        model={model}
        action={
          <Button size="lg" onClick={submit}>
            {tu("addShort")}
          </Button>
        }
      />
    </div>
  );
}

/** A panel size error is shown only once something was typed, so the empty starting state stays calm. */
function panelSizeProblem(w: Typed, h: Typed, valid: boolean) {
  return !valid && Boolean(w.v.trim() || h.v.trim());
}
