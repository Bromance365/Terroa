import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/components/ui/icons";
import { AnchorButton, LinkButton } from "@/components/ui/Button";
import { CategoryTile, ProjectTile, ToolCard } from "@/components/catalog/Tiles";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PlanViewer } from "@/components/plan/PlanViewer";
import planSample from "@data/plan-sample.json";
import {
  getCategories,
  getProduct,
  getProjects,
  imgSrc,
  productHref,
  productName,
  type Product,
} from "@/lib/catalog";
import { pageMetadata, bothLocales } from "@/lib/seo";
import { site } from "@/lib/site";
import { JsonLd, organizationLd } from "@/lib/jsonld";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, hrefs: bothLocales("/"), title: t("siteTitle"), description: t("siteDescription"), image: "/images/scene-01.svg" });
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const featured = ["p-chene-naturel", "p-chene-fume", "p-chene-gris", "p-lattes-noyer"]
    .map((id) => getProduct(id))
    .filter((p): p is Product => Boolean(p));
  const heroChips = ["p-chene-naturel", "p-lattes-chene"].map((id) => getProduct(id)).filter((p): p is Product => Boolean(p));
  const overlays = planSample.rooms
    .filter((r) => [1, 2, 4].includes(r.n))
    .map((r) => ({ n: r.n, bbox: r.bbox, state: r.confidence === "check" ? ("check" as const) : ("included" as const) }));

  return (
    <>
      <JsonLd data={organizationLd()} />

      {/* Hero */}
      <section className="container-page section-y" aria-labelledby="hero-title">
        <div className="flex flex-wrap items-center gap-x-16 gap-y-8">
          <div className="min-w-0 flex-1 basis-[min(100%,440px)]">
            <p className="label">{t("home.eyebrow")}</p>
            <h1 id="hero-title" className="display mt-4">
              {t.rich("home.title", { em: (c) => <em className="text-copper">{c}</em> })}
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-7 text-ink-muted">{t("home.lead")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/quote" size="lg">
                {t("common.requestQuote")}
              </LinkButton>
              <LinkButton href="/plan-reader" variant="secondary" size="lg" icon="upload">
                {t("common.uploadPlan")}
              </LinkButton>
            </div>
            <p className="small mt-6 max-w-md text-ink-muted">{t("home.audience")}</p>
          </div>
          <div className="relative min-w-0 flex-1 basis-[min(100%,420px)]">
            <div className="aspect-[4/5] overflow-hidden rounded-lg bg-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc("scene-01.svg")} alt="" width={1000} height={1250} className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-md bg-surface-raised p-4 shadow-[var(--shadow-float)] sm:right-auto sm:w-[320px]">
              <p className="label">{t("home.inThisRoom")}</p>
              <ul className="mt-2">
                {heroChips.map((p) => (
                  <li key={p.id} className="border-t border-line first:border-t-0">
                    <Link href={productHref(p, locale)} className="flex min-h-[56px] items-center gap-3 text-ink no-underline hover:text-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgSrc(p.image)} alt="" width={40} height={40} className="h-10 w-10 flex-none rounded-sm object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{productName(p, locale)}</span>
                        <span className="small block text-ink-muted">{p.kind === "panel" ? t("catalog.panelDescriptor") : t("catalog.floorDescriptor")}</span>
                      </span>
                      <Icon name="arrowRight" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Three ways to start */}
      <section className="container-page section-y" aria-labelledby="start-title">
        <h2 id="start-title">{t("home.startTitle")}</h2>
        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
          <ToolCard icon="layers" title={t("home.startCatalogTitle")} text={t("home.startCatalogText")} href="/flooring/vinyl" action={t("common.seeProducts")} />
          <ToolCard icon="calculator" title={t("common.calculateQuantities")} text={t("home.startCalculatorText")} href="/calculator" action={t("home.openCalculator")} />
          <ToolCard icon="upload" title={t("common.uploadPlan")} text={t("home.startPlanText")} href="/plan-reader" action={t("home.tryPlanReader")} />
        </div>
      </section>

      {/* Categories */}
      <section className="container-page section-y" aria-labelledby="products-title">
        <h2 id="products-title">{t("home.productsTitle")}</h2>
        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
          {getCategories().map((c) => (
            <CategoryTile key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* Selection */}
      <section className="container-page section-y" aria-labelledby="selection-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="selection-title">{t("home.selectionTitle")}</h2>
          <Link href="/flooring/vinyl" className="inline-flex min-h-[44px] items-center gap-2 font-semibold">
            {t("home.seeAllFloors")}
            <Icon name="arrowRight" />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Plan reader band (dark tokens, light plan) */}
      <section className="theme-dark mt-8 bg-surface py-12 text-ink sm:py-16" aria-labelledby="band-title">
        <div className="container-page flex flex-wrap items-center gap-x-16 gap-y-10">
          <div className="min-w-0 flex-1 basis-[min(100%,420px)]">
            <p className="label">{t("home.planBandEyebrow")}</p>
            <h2 id="band-title" className="mt-3 text-[30px] leading-[36px]">
              {t("home.planBandTitle")}
            </h2>
            <p className="mt-4 text-ink-muted">{t("home.planBandText")}</p>
            <ol className="mt-6 space-y-3">
              {[t("home.planStep1"), t("home.planStep2"), t("home.planStep3")].map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span aria-hidden="true" className="num flex h-7 w-7 flex-none items-center justify-center rounded-full border border-border-strong text-[14px] font-semibold">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <LinkButton href="/plan-reader" size="lg">
                {t("home.tryPlanReader")}
              </LinkButton>
            </div>
          </div>
          <div className="min-w-0 flex-1 basis-[min(100%,460px)]">
            <PlanViewer imageUrl={imgSrc("plan-rdc.svg")} alt={t("home.planAlt")} overlays={overlays} />
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="container-page section-y mt-8" aria-labelledby="projects-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="projects-title">{t("home.projectsTitle")}</h2>
          <Link href="/projects" className="inline-flex min-h-[44px] items-center gap-2 font-semibold">
            {t("home.allProjects")}
            <Icon name="arrowRight" />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
          {getProjects()
            .slice(0, 3)
            .map((p) => (
              <ProjectTile key={p.id} project={p} />
            ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-page section-y" aria-labelledby="how-title">
        <h2 id="how-title">{t("home.howTitle")}</h2>
        <ol className="mt-8 grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          {[1, 2, 3].map((n) => (
            <li key={n} className="border-t border-line pt-4">
              <p aria-hidden="true" className="num font-display text-[28px] text-ink-muted">
                {String(n).padStart(2, "0")}
              </p>
              <h3 className="mt-2">{t(`home.how${n}Title`)}</h3>
              <p className="small mt-1 text-ink-muted">{t(`home.how${n}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="container-page section-y" aria-labelledby="cta-title">
        <div className="panel flex flex-wrap items-center justify-between gap-6 p-6 sm:p-10">
          <div className="min-w-0 max-w-xl">
            <h2 id="cta-title" className="text-[28px] leading-9">
              {t("home.ctaTitle")}
            </h2>
            <p className="mt-2 text-ink-muted">{t("home.ctaText")}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <LinkButton href="/quote" size="lg">
              {t("common.requestQuote")}
            </LinkButton>
            {site.phoneHref ? (
              <AnchorButton href={site.phoneHref} variant="secondary" size="lg" icon="phone">
                {site.phone}
              </AnchorButton>
            ) : (
              <span className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-6 font-semibold">
                <Icon name="phone" />
                {site.phone}
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
