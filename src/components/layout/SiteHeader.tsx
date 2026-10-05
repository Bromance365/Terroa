"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import type { SlugPair } from "@/lib/slug-pairs";
import { useQuote } from "@/lib/quote-store";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/Button";
import { LanguageSwitch } from "./LanguageSwitch";
import { SearchDialog, type SearchItem } from "./SearchDialog";

const NAV: Array<{ href: StaticPathname; key: "floors" | "acousticPanels" | "projects" | "calculator" | "planReader"; match: string[] }> = [
  { href: "/flooring/vinyl", key: "floors", match: ["/flooring/vinyl", "/flooring/vinyl/[slug]", "/floor-coverings", "/floor-coverings/[slug]"] },
  { href: "/acoustic-panels", key: "acousticPanels", match: ["/acoustic-panels", "/acoustic-panels/[slug]"] },
  { href: "/projects", key: "projects", match: ["/projects"] },
  { href: "/calculator", key: "calculator", match: ["/calculator"] },
  { href: "/plan-reader", key: "planReader", match: ["/plan-reader"] },
];

export function SiteHeader({ slugPairs, searchItems }: { slugPairs: SlugPair[]; searchItems: SearchItem[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const quote = useQuote();
  const count = quote.lines.length;
  const menuRef = useRef<HTMLDialogElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close the sheet after navigation.
  useEffect(() => {
    menuRef.current?.close();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex min-h-[64px] items-center gap-4 lg:gap-6">
        <Link href="/" className="font-display text-[24px] font-semibold leading-none text-ink no-underline hover:text-ink" aria-label={`${t("common.brand")} — ${t("nav.home")}`}>
          {t("common.brand")}
        </Link>

        <nav aria-label={t("nav.main")} className="hidden min-[900px]:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => {
              const current = n.match.includes(pathname);
              return (
                <li key={n.key}>
                  <Link
                    href={n.href}
                    aria-current={current ? "page" : undefined}
                    className={cx(
                      "relative inline-flex min-h-[44px] items-center px-2.5 no-underline hover:text-accent",
                      current ? "font-semibold text-ink after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:bg-accent" : "text-ink",
                    )}
                  >
                    {t(`nav.${n.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <IconButton label={t("common.search")} icon="search" variant="ghost" onClick={() => setSearchOpen(true)} aria-haspopup="dialog" />
          <LanguageSwitch slugPairs={slugPairs} className="hidden min-[900px]:flex" />
          <Link
            href="/quote"
            aria-label={t("common.quoteCount", { count })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent no-underline hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--ink))] hover:text-on-accent sm:px-4"
          >
            <Icon name="clipboard" />
            <span className="hidden sm:inline">{t("common.quote")}</span>
            {count > 0 ? (
              <span aria-hidden="true" className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-on-accent px-1.5 text-[13px] font-semibold text-accent">
                {count}
              </span>
            ) : null}
          </Link>
          <IconButton
            label={t("common.openMenu")}
            icon="menu"
            variant="ghost"
            className="min-[900px]:hidden"
            onClick={() => menuRef.current?.showModal()}
            aria-haspopup="dialog"
          />
        </div>
      </div>

      <dialog
        ref={menuRef}
        aria-label={t("nav.main")}
        className="m-0 ml-auto h-dvh max-h-none w-[min(360px,100vw)] max-w-none bg-surface p-0 text-ink backdrop:bg-ink/40"
        onClick={(e) => {
          if (e.target === menuRef.current) menuRef.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="font-display text-[24px] font-semibold">{t("common.brand")}</span>
          <IconButton label={t("common.closeMenu")} icon="close" variant="ghost" onClick={() => menuRef.current?.close()} />
        </div>
        <nav aria-label={t("nav.main")} className="p-4">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.key} className="border-b border-line">
                <Link href={n.href} className="flex min-h-[52px] items-center justify-between text-[18px] text-ink no-underline" aria-current={n.match.includes(pathname) ? "page" : undefined}>
                  {t(`nav.${n.key}`)}
                  <Icon name="arrowRight" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-4">
          <LanguageSwitch slugPairs={slugPairs} />
        </div>
      </dialog>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} />
    </header>
  );
}
