"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const control =
  "w-full min-h-[44px] rounded-sm bg-surface-raised px-3 text-[16px] leading-6 text-ink border border-border-strong aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";

/** Shared grid template: header row and data rows must line up. */
export const ROW_GRID = "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_96px_44px]";

export interface DimRowProps {
  /** Stable id of the row; used to build DOM ids (focus management, aria-describedby). */
  rowId: string;
  name: string;
  /** Text of the two dimension inputs, already converted for the active unit. */
  a: string;
  b: string;
  onName: (v: string) => void;
  onA: (v: string) => void;
  onB: (v: string) => void;
  /** Visible labels on mobile, screen-reader labels on desktop (the column header shows them there). */
  labelName: string;
  labelA: string;
  labelB: string;
  /** Name used in accessible labels when the person has not named the row. */
  fallbackName: string;
  suffix: string;
  /** Computed value (area or panel count), already formatted. */
  result: string;
  /** Second line of the collapsed mobile card, e.g. "18,2 × 14 pi". */
  summary: string;
  error: string | null;
  aInvalid: boolean;
  bInvalid: boolean;
  removeLabel: string;
  editLabel: string;
  doneLabel: string;
  onRemove: () => void;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  /** On mobile only: hide this row (collapsed list). Desktop always shows every row. */
  collapsedOnMobile: boolean;
}

function Pencil() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function Labelled({ htmlFor, text, srOnlyTail, children }: { htmlFor: string; text: string; srOnlyTail: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:block">
      <label htmlFor={htmlFor} className="label sm:sr-only">
        {text}
        <span className="sr-only">, {srOnlyTail}</span>
      </label>
      {children}
    </div>
  );
}

/** One room or wall: name, two dimensions, computed value, remove. Card on mobile, table row on desktop. */
export function DimRow(p: DimRowProps) {
  const uid = useId();
  const nameId = `${uid}-name`;
  const aId = `${uid}-a`;
  const bId = `${uid}-b`;
  const errId = `${uid}-err`;
  const shownName = p.name.trim() || p.fallbackName;
  const describedBy = p.error ? errId : undefined;

  return (
    <li className={cx("sm:border-b sm:border-line sm:py-3", p.collapsedOnMobile && "hidden sm:block")} data-row-id={p.rowId}>
      {/* Mobile collapsed card */}
      <div
        className={cx(
          "items-center gap-3 rounded-md border border-line bg-surface-raised py-3 pl-4 pr-1",
          p.editing ? "hidden" : "flex sm:hidden",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold" title={shownName}>
            {shownName}
          </span>
          <span className="small num truncate text-ink-muted">{p.summary}</span>
        </span>
        <span className="num font-semibold">{p.result}</span>
        <button
          type="button"
          aria-label={p.editLabel}
          title={p.editLabel}
          onClick={p.onEdit}
          className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-md text-ink hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
        >
          <Pencil />
        </button>
      </div>

      {/* Fields: always visible on desktop, on mobile only while editing */}
      <div
        className={cx(
          "gap-3 rounded-md sm:grid sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0",
          ROW_GRID,
          p.editing ? "grid grid-cols-2 border border-line bg-surface-raised p-4" : "hidden",
        )}
      >
        <div className="col-span-2 sm:col-span-1">
          <Labelled htmlFor={nameId} text={p.labelName} srOnlyTail={shownName}>
            <input
              id={nameId}
              type="text"
              value={p.name}
              maxLength={40}
              autoComplete="off"
              title={shownName}
              onChange={(e) => p.onName(e.target.value)}
              className={cx(control, "truncate")}
            />
          </Labelled>
        </div>
        <Labelled htmlFor={aId} text={p.labelA} srOnlyTail={shownName}>
          <div className="relative">
            <input
              id={aId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={p.a}
              aria-invalid={p.aInvalid ? true : undefined}
              aria-describedby={p.aInvalid ? describedBy : undefined}
              onChange={(e) => p.onA(e.target.value)}
              className={cx(control, "num pr-10")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted" aria-hidden="true">
              {p.suffix}
            </span>
          </div>
        </Labelled>
        <Labelled htmlFor={bId} text={p.labelB} srOnlyTail={shownName}>
          <div className="relative">
            <input
              id={bId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={p.b}
              aria-invalid={p.bInvalid ? true : undefined}
              aria-describedby={p.bInvalid ? describedBy : undefined}
              onChange={(e) => p.onB(e.target.value)}
              className={cx(control, "num pr-10")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted" aria-hidden="true">
              {p.suffix}
            </span>
          </div>
        </Labelled>
        <p className="num font-semibold sm:pr-4 sm:text-right">{p.result}</p>
        <div className="flex items-center justify-end gap-1">
          <IconButton variant="ghost" icon="check" label={p.doneLabel} onClick={p.onDone} className="sm:hidden" />
          <IconButton variant="ghost" icon="trash" label={p.removeLabel} onClick={p.onRemove} />
        </div>
      </div>

      {p.error ? (
        <p id={errId} className="small mt-2 flex items-start gap-1.5 text-danger">
          <Icon name="alert" size={16} className="mt-0.5" />
          <span>{p.error}</span>
        </p>
      ) : null}
    </li>
  );
}
