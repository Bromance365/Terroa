import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/icons";
import { AnchorButton } from "@/components/ui/Button";
import { ProjectTile } from "@/components/catalog/Tiles";
import { AddProjectProducts, ShareButton } from "@/components/projects/ProjectActions";
import { ProjectsBrowser } from "@/components/projects/ProjectsBrowser";
import { getProduct, getProjects, imgSrc, productHref, productName, projectDesc, projectTitle, type Product } from "@/lib/catalog";
import { bothLocales, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return pageMetadata({ locale, hrefs: bothLocales("/projects"), title: t("title"), description: t("lead"), image: "/images/scene-06.svg" });
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const projects = getProjects();
  const featured = projects.find((p) => p.featured) ?? projects[0];
  const typeLabel = { residential: t("catalog.projectTypeResidential"), commercial: t("catalog.projectTypeCommercial"), office: t("catalog.projectTypeOffice") };
  const featuredProducts = (featured?.products ?? []).map((id) => getProduct(id)).filter((p): p is Product => Boolean(p));

  const items = await Promise.all(
    projects.map(async (p) => ({ id: p.id, type: p.type, node: await ProjectTile({ project: p }) })),
  );

  return (
    <div className="container-page section-y">
      <h1>{t("gallery.title")}</h1>
      <p className="mt-3 max-w-2xl text-[18px] leading-7 text-ink-muted">{t("gallery.lead")}</p>

      {featured ? (
        <section aria-labelledby="featured-title" className="panel mt-10 flex flex-wrap overflow-hidden">
          <div className="min-h-[280px] min-w-0 flex-[999_1_480px] bg-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc(featured.image)} alt="" width={1500} height={1000} className="h-full w-full object-cover" fetchPriority="high" />
          </div>
          <div className="min-w-0 flex-[1_1_340px] p-6 sm:p-8">
            <p className="label">
              {t("gallery.featured")} · {typeLabel[featured.type]}
            </p>
            <h2 id="featured-title" className="mt-3 text-[28px] leading-9">
              {projectTitle(featured, locale)}
            </h2>
            <p className="small mt-1 text-ink-muted">
              {featured.city} · {featured.year}
            </p>
            <p className="mt-3">{projectDesc(featured, locale)}</p>
            <h3 className="label mt-6 [font-family:var(--font-sans-stack)]">{t("gallery.productsUsed")}</h3>
            <ul className="mt-2">
              {featuredProducts.map((p) => (
                <li key={p.id} className="border-t border-line">
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
            <p className="small mt-3 text-ink-muted">
              {t("gallery.contractor")} : [nom] · {t("gallery.design")} : [nom]
            </p>
            <div className="mt-6 space-y-3">
              <AddProjectProducts productIds={featuredProducts.map((p) => p.id)} />
              <ShareButton title={projectTitle(featured, locale)} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-16" aria-label={t("gallery.allProjects")}>
        <ProjectsBrowser items={items} />
      </section>

      <section aria-labelledby="submit-title" className="panel mt-16 flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
        <div className="max-w-xl">
          <h2 id="submit-title" className="text-[24px]">
            {t("gallery.submitTitle")}
          </h2>
          <p className="mt-2 text-ink-muted">{t("gallery.submitText")}</p>
        </div>
        {site.emailHref ? (
          <AnchorButton href={site.emailHref} variant="secondary" icon="camera">
            {t("gallery.submitAction")}
          </AnchorButton>
        ) : (
          <p className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-4 font-semibold">
            <Icon name="camera" />
            {t("gallery.submitAction")} · {site.email}
          </p>
        )}
      </section>
    </div>
  );
}
