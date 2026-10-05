"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale, Pathname } from "@/i18n/routing";
import type { SlugPair } from "@/lib/slug-pairs";
import { cx } from "@/components/ui/cx";

/** Links to the equivalent page in the other language (never the home page). */
export function useAlternateHref(slugPairs: SlugPair[]) {
  const locale = useLocale() as Locale;
  const pathname = usePathname() as Pathname;
  const params = useParams<{ slug?: string }>();
  const other: Locale = locale === "fr" ? "en" : "fr";
  if (pathname.includes("[slug]")) {
    const current = params.slug ? decodeURIComponent(params.slug) : undefined;
    const pair = slugPairs.find((p) => p[locale] === current);
    return { other, href: { pathname, params: { slug: pair ? pair[other] : (current ?? "") } } as never };
  }
  return { other, href: pathname as never };
}

export function LanguageSwitch({ slugPairs, className, label }: { slugPairs: SlugPair[]; className?: string; label?: string }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const { href } = useAlternateHref(slugPairs);
  const item = "inline-flex min-h-[44px] min-w-[32px] items-center justify-center px-1 no-underline";
  return (
    <nav aria-label={label ?? t("language")} className={cx("flex items-center", className)}>
      <span lang="fr" className={cx(item, "font-semibold", locale === "fr" ? "text-ink underline underline-offset-4" : "")} aria-current={locale === "fr" ? "true" : undefined}>
        {locale === "fr" ? (
          "FR"
        ) : (
          <Link href={href} locale="fr" hrefLang="fr" lang="fr" aria-label="Français" className="text-ink-muted no-underline hover:text-ink">
            FR
          </Link>
        )}
      </span>
      <span lang="en" className={cx(item, "font-semibold", locale === "en" ? "text-ink underline underline-offset-4" : "")} aria-current={locale === "en" ? "true" : undefined}>
        {locale === "en" ? (
          "EN"
        ) : (
          <Link href={href} locale="en" hrefLang="en" lang="en" aria-label="English" className="text-ink-muted no-underline hover:text-ink">
            EN
          </Link>
        )}
      </span>
    </nav>
  );
}
