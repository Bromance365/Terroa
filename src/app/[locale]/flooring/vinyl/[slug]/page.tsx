import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPage } from "@/components/product/ProductPage";
import { findProductBySlug, getProductsByCategory, imgSrc, productName, productSlug, categoryName, getCategory } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

const CATEGORY = "vinyl" as const;
const KEY = "/flooring/vinyl/[slug]" as const;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => getProductsByCategory(CATEGORY).map((p) => ({ locale, slug: productSlug(p, locale) })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = findProductBySlug(CATEGORY, locale, slug);
  if (!product) return {};
  const t = await getTranslations({ locale });
  const name = productName(product, locale);
  return pageMetadata({
    locale,
    hrefs: {
      fr: { pathname: KEY, params: { slug: product.slug_fr } },
      en: { pathname: KEY, params: { slug: product.slug_en } },
    },
    title: `${name} · ${categoryName(getCategory(CATEGORY)!, locale)}`,
    description: t("meta.siteDescription"),
    image: imgSrc(product.image),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = findProductBySlug(CATEGORY, locale, slug);
  if (!product) notFound();
  return <ProductPage product={product} locale={locale} />;
}
