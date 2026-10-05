import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold no-underline select-none transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed aria-busy:cursor-progress";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent border border-transparent hover:text-on-accent hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--ink))]",
  secondary:
    "bg-surface-raised text-ink border border-border-strong hover:text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-raised))]",
  ghost: "bg-transparent text-accent border border-transparent underline underline-offset-4 hover:text-ink",
  danger:
    "bg-surface-raised text-danger border border-danger hover:text-danger hover:bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface-raised))]",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-4 text-[16px] leading-6",
  lg: "min-h-[52px] px-6 text-[16px] leading-6",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}) {
  return cx(base, variants[variant], sizes[size], block && "w-full", className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  icon,
  block,
  loading,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: CommonProps & { loading?: boolean; loadingLabel?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && !loading ? <Icon name={icon} /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/** Renders an <a> (never a button inside a link). Uses the localized router Link. */
export function LinkButton({
  variant,
  size,
  icon,
  block,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

/** Plain <a> for external, tel: or mailto: targets. */
export function AnchorButton({
  variant,
  size,
  icon,
  block,
  className,
  children,
  ...rest
}: CommonProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </a>
  );
}

export function IconButton({
  label,
  icon,
  variant = "outline",
  className,
  ...rest
}: { label: string; icon: IconName; variant?: "outline" | "ghost" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed",
        variant === "outline"
          ? "border border-border-strong bg-surface-raised hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-raised))]"
          : "border border-transparent hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
