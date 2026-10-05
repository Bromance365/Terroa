import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { QuoteBasket } from "@/components/quote/QuoteBasket";
import { bothLocales, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quoteForm" });
  // Transactional page: kept out of search results.
  return pageMetadata({ locale, hrefs: bothLocales("/quote"), title: t("metaTitle"), description: t("metaDescription"), noindex: true });
}

export default async function QuotePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "quote" });

  return (
    <QuoteBasket
      heading={
        <>
          <h1 id="quote-title">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-ink-muted">{t("lead")}</p>
        </>
      }
    />
  );
}
