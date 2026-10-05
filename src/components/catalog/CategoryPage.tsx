import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Breadcrumb, type Crumb } from "@/components/layout/Breadcrumb";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PlanPromo, ProductBrowser, type BrowserItem, type Facet } from "@/components/catalog/ProductBrowser";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { absoluteUrl } from "@/lib/seo";
import { getCategory, getProductsByCategory, categoryName, imgSrc, type CategoryId } from "@/lib/catalog";

const TONE_RANK = { pale: 0, grey: 1, medium: 2, dark: 3 } as const;
const TONE_SWATCH = { pale: "mat-frene-blanchi.svg", medium: "mat-chene-naturel.svg", dark: "mat-noyer.svg", grey: "mat-chene-gris.svg" } as const;

export async function CategoryPage({ categoryId, locale }: { categoryId: CategoryId; locale: Locale }) {
  const t = await getTranslations();
  const category = getCategory(categoryId)!;
  const products = getProductsByCategory(categoryId);
  const name = categoryName(category, locale);

  const items: BrowserItem[] = products.map((p, order) => ({
    id: p.id,
    order,
    isNew: p.is_new,
    toneRank: TONE_RANK[p.tone],
    facets: { tone: [p.tone], format: [p.format], install: [p.install], usage: p.usage },
  }));

  const toneLabel = (v: string) => t(`catalog.tone${v[0]!.toUpperCase()}${v.slice(1)}`);
  const formatLabel = (v: string) => t(`catalog.format${v === "large-tile" ? "LargeTile" : v[0]!.toUpperCase() + v.slice(1)}`);
  const installLabel = (v: string) => t(`catalog.install${v[0]!.toUpperCase()}${v.slice(1)}`);
  const usageLabel = (v: string) => t(`catalog.usage${v.split("-").map((x) => x[0]!.toUpperCase() + x.slice(1)).join("")}`);

  const distinct = (pick: (it: BrowserItem) => string[]) => [...new Set(items.flatMap(pick))];
  const facets: Facet[] = (
    [
      { key: "tone", title: t("product.tone"), values: distinct((i) => i.facets.tone), label: toneLabel, swatch: true },
      { key: "format", title: t("categoryUi.facetFormat"), values: distinct((i) => i.facets.format), label: formatLabel, swatch: false },
      { key: "install", title: t("categoryUi.facetInstall"), values: distinct((i) => i.facets.install), label: installLabel, swatch: false },
      { key: "usage", title: t("categoryUi.facetUsage"), values: distinct((i) => i.facets.usage), label: usageLabel, swatch: false },
    ] as const
  )
    .filter((f) => f.values.length > 1) // a facet with a single value filters nothing
    .map((f) => ({
      key: f.key,
      title: f.title,
      options: f.values.map((v) => ({
        value: v,
        label: f.label(v),
        swatch: f.swatch ? imgSrc(TONE_SWATCH[v as keyof typeof TONE_SWATCH]) : undefined,
      })),
    }));

  const cardEntries = await Promise.all(products.map(async (p, i) => [p.id, await ProductCard({ product: p, priority: i < 3 })] as const));
  const cards = Object.fromEntries(cardEntries);

  const lead =
    categoryId === "panels" ? t("categoryUi.leadPanels") : categoryId === "coverings" ? t("categoryUi.leadCoverings") : t("category.lead");
  const isFloor = category.kind === "floor";
  const crumbs: Crumb[] = [
    { label: t("nav.home"), href: "/" },
    ...(isFloor && categoryId !== "coverings" ? [{ label: t("categoryUi.floorsCrumb"), href: "/floor-coverings" as const }] : []),
    { label: name },
  ];

  const promo = (
    <PlanPromo
      title={t("category.planPromoTitle")}
      text={t("category.planPromoText")}
      action={t("common.uploadPlan")}
      image={imgSrc("plan-rdc.svg")}
      alt=""
    />
  );

  const fallback = (
    <ul className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
      {products.map((p) => (
        <li key={p.id}>{cards[p.id]}</li>
      ))}
    </ul>
  );

  return (
    <div className="container-page section-y">
      <JsonLd
        data={breadcrumbLd([
          { name: t("nav.home"), url: absoluteUrl(locale, "/") },
          { name, url: absoluteUrl(locale, category.key) },
        ])}
      />
      <Breadcrumb items={crumbs} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="max-w-3xl">
          <h1>{name}</h1>
          <p className="mt-3 text-[18px] leading-7 text-ink-muted">{lead}</p>
        </div>
        <p className="small flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
          <span>{t("category.needQuantities")}</span>
          <Link href="/calculator" className="inline-flex min-h-[44px] items-center font-semibold">
            {t("nav.calculator")}
          </Link>
          <Link href="/plan-reader" className="inline-flex min-h-[44px] items-center font-semibold">
            {t("nav.planReader")}
          </Link>
        </p>
      </div>
      <div className="mt-8">
        <Suspense fallback={fallback}>
          <ProductBrowser items={items} cards={cards} facets={facets} promo={promo} />
        </Suspense>
      </div>
    </div>
  );
}
