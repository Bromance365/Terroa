"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { SlugPair } from "@/lib/slug-pairs";
import { site } from "@/lib/site";
import { categoryName, getCategories } from "@/lib/catalog";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitch } from "./LanguageSwitch";

export function SiteFooter({ slugPairs }: { slugPairs: SlugPair[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const full = pathname === "/";
  const linkCls = "text-ink no-underline hover:text-accent hover:underline";

  return (
    <footer className="mt-16 border-t border-line">
      <div className="container-page">
        {full ? (
          <div className="flex flex-wrap gap-x-12 gap-y-8 py-12">
            <div className="max-w-xs flex-1 basis-64">
              <p className="font-display text-[24px] font-semibold">{t("common.brand")}</p>
              <p className="small mt-2 text-ink-muted">{t("footer.tagline")}</p>
            </div>
            <nav aria-label={t("footer.products")} className="min-w-40 flex-1">
              <h2 className="label">{t("footer.products")}</h2>
              <ul className="mt-3 space-y-1">
                {getCategories().map((c) => (
                  <li key={c.id}>
                    <Link className={`${linkCls} inline-flex min-h-[32px] items-center`} href={c.key}>
                      {categoryName(c, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={t("footer.tools")} className="min-w-40 flex-1">
              <h2 className="label">{t("footer.tools")}</h2>
              <ul className="mt-3 space-y-1">
                <li><Link className={`${linkCls} inline-flex min-h-[32px] items-center`} href="/calculator">{t("calculator.title")}</Link></li>
                <li><Link className={`${linkCls} inline-flex min-h-[32px] items-center`} href="/plan-reader">{t("nav.planReader")}</Link></li>
                <li><Link className={`${linkCls} inline-flex min-h-[32px] items-center`} href="/measure">{t("measure.navLabel")}</Link></li>
                <li><Link className={`${linkCls} inline-flex min-h-[32px] items-center`} href="/quote">{t("footer.myQuote")}</Link></li>
              </ul>
            </nav>
            <div className="min-w-40 flex-1">
              <h2 className="label">{t("footer.contact")}</h2>
              <ul className="small mt-3 space-y-1 text-ink">
                <li>{site.address}</li>
                <li>{site.phone}</li>
                <li>{site.email}</li>
                <li>{site.hours}</li>
              </ul>
            </div>
          </div>
        ) : null}
        <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6 ${full ? "border-t border-line" : ""}`}>
          {full ? (
            <p className="small text-ink-muted">© {new Date().getFullYear()} {t("common.brand")}</p>
          ) : (
            <p className="font-display text-[24px] font-semibold">{t("common.brand")}</p>
          )}
          <nav aria-label={t("footer.legal")}>
            <ul className="small flex flex-wrap gap-x-5">
              <li><Link className={`${linkCls} inline-flex min-h-[44px] items-center text-accent underline`} href="/privacy">{t("footer.privacy")}</Link></li>
              <li><Link className={`${linkCls} inline-flex min-h-[44px] items-center text-accent underline`} href="/terms">{t("footer.terms")}</Link></li>
            </ul>
          </nav>
          <p className="small text-ink-muted">{t("footer.privacyOfficer")}</p>
          <LanguageSwitch slugPairs={slugPairs} label={t("footer.language")} />
        </div>
      </div>
    </footer>
  );
}
