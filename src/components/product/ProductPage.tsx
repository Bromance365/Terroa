import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { PriceLine } from "@/components/catalog/PriceLine";
import { ProjectTile } from "@/components/catalog/Tiles";
import { ProductGallery, type GallerySlide } from "./ProductGallery";
import { BuyPanel } from "./BuyPanel";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";
import {
  categoryName,
  getCategory,
  getProjectsForProduct,
  imgSrc,
  productHref,
  productName,
  productTone,
  siblingProducts,
  type Product,
} from "@/lib/catalog";

export async function ProductPage({ product, locale }: { product: Product; locale: Locale }) {
  const t = await getTranslations();
  const category = getCategory(product.category)!;
  const name = productName(product, locale);
  const isPanel = product.kind === "panel";
  const typeLabel = isPanel ? t("catalog.panelDescriptor") : product.format === "large-tile" ? t("catalog.coveringDescriptor") : t("catalog.floorDescriptor");
  const projects = getProjectsForProduct(product.id).slice(0, 3);
  const siblings = siblingProducts(product).slice(0, 4);

  const slides: GallerySlide[] = [
    { src: imgSrc(product.scene ?? product.image), label: name },
    { src: imgSrc(product.image), label: name },
    { src: null, label: t("productUi.photoDetail") },
    { src: null, label: t("productUi.photoInstall") },
  ];

  const ph = t("productUi.toConfirm");
  const specs: Array<[string, string]> = isPanel
    ? [
        [t("productUi.specPanelSize"), t("productUi.panelFormatPlaceholder")],
        [t("productUi.specMaterial"), ph],
        [t("productUi.specAcoustics"), ph],
        [t("productUi.specFire"), ph],
        [t("productUi.specInstall"), ph],
        [t("productUi.specUsage"), ph],
        [t("productUi.specWarranty"), ph],
      ]
    : [
        [product.format === "large-tile" ? t("productUi.specTile") : t("productUi.specFormat"), ph],
        [t("productUi.specThickness"), ph],
        [t("productUi.specWear"), ph],
        [t("productUi.specInstall"), ph],
        [t("productUi.specUnderlay"), ph],
        [t("productUi.specUsage"), ph],
        [t("productUi.specCoverage"), t("productUi.coveragePlaceholder")],
        [t("productUi.specWarranty"), ph],
      ];

  const docs = [t("productUi.docTech"), t("productUi.docInstall"), t("productUi.docCare"), t("productUi.docWarranty")];
  const keyFacts: Array<[string, ReactNode]> = isPanel
    ? [
        [t("product.format"), t("productUi.panelFormatPlaceholder")],
        [t("product.installation"), ph],
      ]
    : [
        [t("product.format"), t("productUi.formatPlaceholder")],
        [t("product.coverage"), `${t("productUi.coveragePlaceholder")} ${t("product.perBox")}`],
        [t("product.installation"), ph],
      ];

  const sections = [
    { id: "specs", label: t("product.specs") },
    { id: "documents", label: t("product.documents") },
    ...(projects.length ? [{ id: "projects", label: t("nav.projects") }] : []),
  ];

  return (
    <div className={cx("container-page section-y", "pb-28 sm:pb-12")}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: t("nav.home"), url: absoluteUrl(locale, "/") },
            { name: categoryName(category, locale), url: absoluteUrl(locale, category.key) },
            { name, url: absoluteUrl(locale, productHref(product, locale)) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name,
            image: `${site.url}${imgSrc(product.image)}`,
            brand: { "@type": "Brand", name: site.name },
            // No "offers" block until Terroa confirms prices and availability.
          },
        ]}
      />
      <Breadcrumb
        items={[
          { label: t("nav.home"), href: "/" },
          { label: categoryName(category, locale), href: category.key },
          { label: name },
        ]}
      />

      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-8">
        <div className="min-w-0 flex-[999_1_480px]">
          <ProductGallery slides={slides} name={name} />
        </div>

        <div className="min-w-0 flex-[1_1_340px] lg:max-w-[420px]">
          <p className="label">{t("productUi.collectionLine", { type: typeLabel, collection: product.collection })}</p>
          <h1 className="mt-2">{name}</h1>
          <PriceLine product={product} className="mt-2 font-display text-[24px] leading-[30px]" />
          <p className="small mt-1 text-ink-muted">{t("common.taxesExtra")}</p>

          <div className="mt-5">
            <p className="label">{t("productUi.toneLine", { tone: productTone(product, locale) })}</p>
            <ul className="mt-2 flex flex-wrap gap-2.5" aria-label={t("product.otherTones")}>
              {[product, ...siblings].map((p) => {
                const current = p.id === product.id;
                const swatch = (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc(p.image)}
                    alt={productName(p, locale)}
                    width={48}
                    height={48}
                    className={cx("h-12 w-12 rounded-md object-cover", current && "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]")}
                  />
                );
                return (
                  <li key={p.id}>
                    {current ? (
                      <span aria-current="true" className="block">
                        {swatch}
                      </span>
                    ) : (
                      <Link href={productHref(p, locale)} className="block rounded-md">
                        {swatch}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <dl className="mt-5 divide-y divide-line border-y border-line">
            {keyFacts.map(([k, v]) => (
              <div key={k} className="small grid grid-cols-[110px_1fr] gap-3 py-2.5">
                <dt className="text-ink-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <BuyPanel productId={product.id} coverage={product.coverage_sqft_per_box} />
          </div>

          <ul className="small mt-5 space-y-3">
            <li className="flex gap-2.5">
              <Icon name="truck" className="mt-0.5 text-accent" />
              <span>
                {t("product.delivery")} {t("productUi.deliveryZones")}
              </span>
            </li>
            <li className="flex gap-2.5">
              <Icon name="phone" className="mt-0.5 text-accent" />
              <span>
                {t("product.technicalQuestion")} {site.phone}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <nav aria-label={t("productUi.sections")} className="mt-14 border-b border-line">
        <ul className="flex flex-wrap gap-x-6">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cx(
                  "inline-flex min-h-[44px] items-center border-b-2 text-ink no-underline hover:text-accent",
                  i === 0 ? "border-accent font-semibold" : "border-transparent",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 flex flex-wrap gap-x-16 gap-y-12">
        <section id="specs" aria-labelledby="specs-title" className="min-w-0 flex-[1_1_400px]">
          <h2 id="specs-title">{t("product.specs")}</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[1fr_1fr] gap-3 py-3">
                <dt className="text-ink-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section id="documents" aria-labelledby="docs-title" className="min-w-0 flex-[1_1_400px]">
          <h2 id="docs-title">{t("product.documents")}</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {docs.map((d) => (
              <li key={d} className="flex items-center gap-3 py-3">
                <Icon name="file" className="text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{d}</span>
                  <span className="small block text-ink-muted">PDF · {t("productUi.docPending")}</span>
                </span>
                <Icon name="download" className="text-ink-muted" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {projects.length ? (
        <section id="projects" aria-labelledby="projects-title" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="projects-title">{t("product.seenInProjects")}</h2>
            <Link href="/projects" className="inline-flex min-h-[44px] items-center gap-2 font-semibold">
              {t("home.allProjects")}
              <Icon name="arrowRight" />
            </Link>
          </div>
          <div className="mt-6 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {projects.map((p) => (
              <ProjectTile key={p.id} project={p} />
            ))}
          </div>
        </section>
      ) : null}

      {siblings.length ? (
        <section aria-labelledby="others-title" className="mt-16">
          <h2 id="others-title">{t("product.otherTones")}</h2>
          <ul className="mt-6 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
            {siblings.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p, locale)} className="card group block overflow-hidden text-ink no-underline hover:text-ink">
                  <div className="aspect-[4/3] overflow-hidden bg-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgSrc(p.image)} alt="" width={600} height={450} className="img-zoom h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold">{productName(p, locale)}</p>
                    <p className="small text-ink-muted">{productTone(p, locale)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
