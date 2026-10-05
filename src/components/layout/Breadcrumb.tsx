import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";

export interface Crumb {
  label: ReactNode;
  href?: StaticPathname;
}

export async function Breadcrumb({ items }: { items: Crumb[] }) {
  const t = await getTranslations("nav");
  return (
    <nav aria-label={t("breadcrumb")} className="small text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !last ? (
                <Link href={c.href} className="text-ink-muted hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-ink" : undefined}>
                  {c.label}
                </span>
              )}
              {!last ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
