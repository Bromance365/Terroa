import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

/** Three steps: upload, verify, add to the quote. Status is a number, a check icon and a bold word, never colour alone. */
export function StepIndicator({
  current,
  label,
  steps,
  className,
}: {
  current: 1 | 2 | 3;
  label: string;
  steps: [string, string, string];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {steps.map((name, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={name} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[14px] font-semibold",
                  active ? "border-accent bg-accent text-on-accent" : "border-border-strong text-ink-muted",
                )}
              >
                {done ? <Icon name="check" size={14} /> : n}
              </span>
              <span className={cx("small", active ? "font-semibold text-ink" : "text-ink-muted")}>{name}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
