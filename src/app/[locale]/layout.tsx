import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { dmSans, fraunces } from "../fonts";
import "../globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ToastHost } from "@/components/layout/ToastHost";
import { getProducts, productHref, productName, productTone, imgSrc } from "@/lib/catalog";
import { getSlugPairs } from "@/lib/slug-pairs";
import { alternatesFor, bothLocales } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f4",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(site.url),
    title: { default: t("siteTitle"), template: `%s · ${site.name}` },
    description: t("siteDescription"),
    alternates: alternatesFor(locale, bothLocales("/")),
    applicationName: site.name,
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  const l = locale as Locale;
  // Server-only namespaces never reach the client bundle.
  const all = (await getMessages()) as Record<string, unknown>;
  const SERVER_ONLY = new Set(["home", "legal", "meta", "notFound", "price", "_meta"]);
  const clientMessages = Object.fromEntries(Object.entries(all).filter(([k]) => !SERVER_ONLY.has(k)));
  const searchItems = getProducts().map((p) => ({
    id: p.id,
    name: productName(p, l),
    descriptor: `${productTone(p, l)}`,
    href: getPathname({ locale: l, href: productHref(p, l) as never }),
    image: imgSrc(p.image),
  }));

  return (
    <html lang={locale} className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <a href="#main" className="skip-link">
            {t("skipToContent")}
          </a>
          <SiteHeader slugPairs={getSlugPairs()} searchItems={searchItems} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <div id="sticky-slot" />
          <SiteFooter slugPairs={getSlugPairs()} />
          <ToastHost />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
