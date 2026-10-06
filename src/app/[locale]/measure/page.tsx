import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { MeasureWithPreview } from "@/components/measure/MeasureWithPreview";
import { bothLocales, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "measure" });
  return pageMetadata({ locale, hrefs: bothLocales("/measure"), title: t("title"), description: t("lead") });
}

/** Server wrapper: metadata, H1 and lead render on the server; the client tool owns the plan, the canvas and the rooms. */
export default async function MeasurePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <MeasureWithPreview
      title={<h1>{t("measure.title")}</h1>}
      lead={<p className="mt-3 max-w-2xl text-[18px] leading-7 text-ink-muted">{t("measure.lead")}</p>}
    />
  );
}
