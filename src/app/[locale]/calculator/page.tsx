import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Calculator } from "@/components/calculator/Calculator";
import { bothLocales, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calculator" });
  return pageMetadata({ locale, hrefs: bothLocales("/calculator"), title: t("title"), description: t("lead") });
}

export default async function CalculatorPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("calculator");
  return (
    <div className="container-page section-y">
      <h1>{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-[18px] leading-7 text-ink-muted">{t("lead")}</p>
      <div className="mt-8">
        <Calculator />
      </div>
    </div>
  );
}
