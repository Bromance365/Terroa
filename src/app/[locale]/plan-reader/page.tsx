import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PlanReader } from "@/components/plan-reader/PlanReader";
import { bothLocales, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planReader" });
  return pageMetadata({ locale, hrefs: bothLocales("/plan-reader"), title: t("title"), description: t("lead"), image: "/images/plan-rdc.svg" });
}

/**
 * Server wrapper: metadata, H1 and lead render on the server. The client component owns the four
 * states (upload, analysing, verify, unreadable) and the step indicator, which follows them.
 */
export default async function PlanReaderPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <PlanReader
      title={<h1>{t("planReader.title")}</h1>}
      lead={
        <>
          <p className="mt-3 max-w-2xl text-[18px] leading-7 text-ink-muted">{t("planReader.lead")}</p>
          <p className="mt-2 max-w-2xl text-[16px] leading-6">
            {t("measure.measureYourself")} <Link href="/measure">{t("measure.navLabel")}</Link>
          </p>
        </>
      }
    />
  );
}
