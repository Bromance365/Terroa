import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export interface ResultModel {
  /** "Boîtes à commander" / "Panneaux à commander" */
  label: string;
  /** "52 boîtes", or an em dash when nothing can be computed yet. */
  big: string;
  rows: ReadonlyArray<{ label: string; value: string }>;
  note: string;
  /** Mobile bar second line, e.g. "1 039 pi² · 20 pi² par boîte". */
  barSummary: string;
}

/**
 * Desktop result card. The big number is the one copper use on the calculator screen.
 * Hidden below 640 px, where ResultBar takes over (both are never visible together).
 */
export function CalculatorResult({
  model,
  ariaLabel,
  actions,
  className,
}: {
  model: ResultModel;
  ariaLabel: string;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <aside aria-label={ariaLabel} className={cx("panel hidden self-start p-6 sm:block lg:sticky lg:top-[88px]", className)}>
      <div aria-live="polite" aria-atomic="true">
        <p className="label">{model.label}</p>
        <p className="num mt-3 font-display text-[56px] font-semibold leading-[60px] text-copper">{model.big}</p>
      </div>
      <dl className="mt-6 border-t border-line">
        {model.rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
            <dt className="text-ink-muted">{r.label}</dt>
            <dd className="num text-right font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="small mt-4 text-ink-muted">{model.note}</p>
      <div className="mt-6 flex flex-col gap-3">{actions}</div>
    </aside>
  );
}

/** Sticky bottom bar on mobile: "52 boîtes", "1 039 pi² · 20 pi² par boîte", then the action. */
export function ResultBar({ model, action }: { model: ResultModel; action: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-[var(--gutter)] flex items-center gap-4 border-t border-line bg-surface-raised px-[var(--gutter)] pb-4 pt-3 sm:hidden">
      <div aria-live="polite" aria-atomic="true" className="flex min-w-0 flex-1 flex-col">
        <span className="num font-display text-[24px] font-semibold leading-[30px] text-copper">{model.big}</span>
        <span className="small num text-ink-muted">{model.barSummary}</span>
      </div>
      {action}
    </div>
  );
}
