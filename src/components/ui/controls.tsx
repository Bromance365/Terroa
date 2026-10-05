"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/** 2–3 options, buttons with aria-pressed. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  stretch = false,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  stretch?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cx("inline-flex rounded-md border border-border-strong bg-surface-raised p-0.5", stretch && "flex w-full", className)}>
      {options.map((o) => {
        const pressed = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-[40px] flex-1 rounded-[8px] px-4 font-semibold transition-colors",
              pressed ? "bg-ink text-surface" : "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChip({
  label,
  pressed,
  onClick,
  removable = false,
  removeLabel,
  className,
}: {
  label: ReactNode;
  pressed?: boolean;
  onClick: () => void;
  removable?: boolean;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={removable ? undefined : pressed}
      aria-label={removable ? removeLabel : undefined}
      className={cx(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 font-semibold transition-colors",
        pressed || removable
          ? "border-ink bg-ink text-surface"
          : "border-border-strong bg-surface-raised text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-raised))]",
        className,
      )}
    >
      {pressed && !removable ? <Icon name="check" size={16} /> : null}
      <span>{label}</span>
      {removable ? <Icon name="close" size={16} /> : null}
    </button>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  unit,
  decreaseLabel,
  increaseLabel,
  inputLabel,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  decreaseLabel: string;
  increaseLabel: string;
  inputLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    setDraft(null);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div className={cx("inline-flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface-raised", className)}>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Icon name="minus" />
      </button>
      <input
        aria-label={inputLabel}
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        className="num w-14 border-x border-border-strong bg-transparent text-center font-semibold"
      />
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 items-center justify-center hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Icon name="plus" />
      </button>
      {unit ? <span className="sr-only">{unit}</span> : null}
    </div>
  );
}

/** Status pill. Always an icon + a word, never colour alone. */
export function Badge({
  kind,
  children,
}: {
  kind: "high" | "check" | "illegible" | "excluded" | "new";
  children: ReactNode;
}) {
  const styles = {
    high: "border-success text-success",
    check: "border-ink text-ink",
    illegible: "border-danger text-danger",
    excluded: "border-line text-ink-muted",
    new: "border-ink bg-ink text-surface",
  } as const;
  const icon = { high: "checkCircle", check: "alert", illegible: "xCircle", excluded: null, new: null } as const;
  const ic = icon[kind];
  return (
    <span className={cx("small inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-semibold", styles[kind])}>
      {ic ? <Icon name={ic} size={14} /> : null}
      {children}
    </span>
  );
}

export function Alert({
  kind = "info",
  title,
  children,
  role,
  className,
}: {
  kind?: "info" | "success" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const styles = {
    info: "border-line text-ink",
    success: "border-success text-ink",
    danger: "border-danger text-ink",
  } as const;
  const icon = { info: "info", success: "checkCircle", danger: "alert" } as const;
  const iconColor = { info: "text-accent", success: "text-success", danger: "text-danger" } as const;
  return (
    <div role={role} className={cx("flex gap-3 rounded-md border bg-surface-raised p-4", styles[kind], className)}>
      <Icon name={icon[kind]} className={cx("mt-0.5", iconColor[kind])} />
      <div className="small min-w-0 text-[15px] leading-[22px]">
        {title ? <strong className="font-semibold">{title} </strong> : null}
        {children}
      </div>
    </div>
  );
}

/** Polite live region toast: ink background, 5 s, pauses on hover and focus. */
export function ToastView({
  message,
  action,
  onDismiss,
}: {
  message: { id: number; text: string; detail?: string } | null;
  action: ReactNode;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const id = message?.id;
  useEffect(() => {
    if (!id || paused) return;
    const t = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(t);
  }, [id, paused, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:justify-end sm:px-8 sm:pb-8"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {message ? (
        <div
          key={message.id}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex w-full max-w-md items-center gap-4 rounded-md bg-ink px-4 py-3 text-surface shadow-[var(--shadow-float)]"
        >
          <p className="small min-w-0 flex-1 text-[15px] leading-[22px]">
            <strong className="font-semibold">{message.text}</strong>
            {message.detail ? <span className="opacity-90"> {message.detail}</span> : null}
          </p>
          {action}
        </div>
      ) : null}
    </div>
  );
}
