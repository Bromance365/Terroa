import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale, StaticPathname } from "@/i18n/routing";
import {
  categoryName,
  imgSrc,
  getProduct,
  productName,
  projectTitle,
  type Category,
  type Project,
} from "@/lib/catalog";
import { Icon, type IconName } from "@/components/ui/icons";

export async function CategoryTile({ category }: { category: Category }) {
  const t = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  return (
    <Link href={category.key} className="card group block overflow-hidden text-ink no-underline hover:text-ink">
      <div className="aspect-[16/10] overflow-hidden bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(category.image)} alt="" width={800} height={500} className="img-zoom h-full w-full object-cover" loading="lazy" decoding="async" />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h3 className="font-display text-[22px] leading-7">{categoryName(category, locale)}</h3>
          <p className="small text-ink-muted">{t("seeCollections")}</p>
        </div>
        <Icon name="arrowRight" className="text-accent" />
      </div>
    </Link>
  );
}

export async function ProjectTile({ project, linkHref }: { project: Project; linkHref?: string }) {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const typeLabel = { residential: t("projectTypeResidential"), commercial: t("projectTypeCommercial"), office: t("projectTypeOffice") }[project.type];
  const names = project.products
    .map((id) => getProduct(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => productName(p, locale))
    .join(", ");
  const media = (
    <div className="aspect-[4/3] overflow-hidden rounded-md bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc(project.image)} alt="" width={800} height={600} className="img-zoom h-full w-full object-cover" loading="lazy" decoding="async" />
    </div>
  );
  return (
    <figure className="group m-0 min-w-0">
      {linkHref ? <a href={linkHref}>{media}</a> : media}
      <figcaption className="mt-3">
        <p className="font-semibold">
          {projectTitle(project, locale)} · {project.city}
        </p>
        <p className="small text-ink-muted">
          {typeLabel} · {names}
        </p>
      </figcaption>
    </figure>
  );
}

export function ToolCard({
  icon,
  title,
  text,
  href,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  href: StaticPathname;
  action: ReactNode;
}) {
  return (
    <article className="card flex min-w-0 flex-col gap-3 p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-raised))] text-accent">
        <Icon name={icon} />
      </span>
      <h3 className="font-display text-[22px] leading-7">{title}</h3>
      <p className="text-ink-muted">{text}</p>
      <Link href={href} className="mt-auto inline-flex min-h-[44px] items-center gap-2 pt-2 font-semibold">
        {action}
        <Icon name="arrowRight" />
      </Link>
    </article>
  );
}
