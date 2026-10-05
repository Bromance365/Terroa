import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

interface FieldShellProps {
  label: ReactNode;
  optionalText?: string;
  helper?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, optionalText, helper, error, id, children, className }: FieldShellProps) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="label">
        {label}
        {optionalText ? <span className="ml-1 font-normal normal-case tracking-normal text-ink-muted"> {optionalText}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="small flex items-start gap-1.5 text-danger">
          <Icon name="alert" size={16} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
      {helper && !error ? (
        <p id={`${id}-help`} className="small text-ink-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "w-full min-h-[44px] rounded-sm bg-surface-raised px-3 text-[16px] leading-6 text-ink placeholder:text-ink-muted/80 border border-border-strong aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";

function describedBy(id: string, helper: unknown, error: unknown) {
  return error ? `${id}-error` : helper ? `${id}-help` : undefined;
}

type BaseFieldProps = {
  label: ReactNode;
  optionalText?: string;
  helper?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
};

export function TextField({
  label,
  optionalText,
  helper,
  error,
  suffix,
  fieldClassName,
  id: idProp,
  className,
  ...rest
}: BaseFieldProps & { suffix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell {...{ label, optionalText, helper, error, id }} className={fieldClassName}>
      <div className="relative">
        <input
          id={id}
          className={cx(control, suffix && "pr-12", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

export function Select({
  label,
  optionalText,
  helper,
  error,
  fieldClassName,
  id: idProp,
  className,
  children,
  ...rest
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell {...{ label, optionalText, helper, error, id }} className={fieldClassName}>
      <div className="relative">
        <select
          id={id}
          className={cx(control, "appearance-none pr-10", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          {...rest}
        >
          {children}
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
      </div>
    </FieldShell>
  );
}

export function Textarea({
  label,
  optionalText,
  helper,
  error,
  fieldClassName,
  id: idProp,
  className,
  rows = 4,
  ...rest
}: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell {...{ label, optionalText, helper, error, id }} className={fieldClassName}>
      <textarea
        id={id}
        rows={rows}
        className={cx(control, "min-h-[96px] resize-y py-2.5", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        {...rest}
      />
    </FieldShell>
  );
}

export function Checkbox({
  label,
  helper,
  className,
  ...rest
}: { label: ReactNode; helper?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cx("flex min-h-[44px] cursor-pointer items-start gap-3 py-2.5", className)}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[var(--accent)]" {...rest} />
      <span>
        <span className="block">{label}</span>
        {helper ? <span className="small block text-ink-muted">{helper}</span> : null}
      </span>
    </label>
  );
}

export function Radio({
  label,
  className,
  ...rest
}: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cx("flex min-h-[44px] cursor-pointer items-center gap-3 py-2", className)}>
      <input type="radio" className="h-5 w-5 flex-none cursor-pointer accent-[var(--accent)]" {...rest} />
      <span>{label}</span>
    </label>
  );
}
