import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CategoryPage } from "@/components/catalog/CategoryPage";
import { bothLocales, pageMetadata } from "@/lib/seo";
import { getCategory, imgSrc } from "@/lib/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({
    locale,
    hrefs: bothLocales("/acoustic-panels"),
    title: t("categoryUi.metaTitlePanels"),
    description: t("meta.siteDescription"),
    image: imgSrc(getCategory("panels")!.image),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CategoryPage categoryId="panels" locale={locale} />;
}
