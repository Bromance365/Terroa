import type { MetadataRoute } from "next";
import { getProducts, productSlug } from "@/lib/catalog";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale, type StaticPathname } from "@/i18n/routing";
import { site } from "@/lib/site";

const STATIC: StaticPathname[] = ["/", "/flooring/vinyl", "/floor-coverings", "/acoustic-panels", "/calculator", "/plan-reader", "/projects", "/privacy", "/terms"];

const url = (locale: Locale, href: unknown) => {
  const p = getPathname({ locale, href: href as never });
  return `${site.url}${p === "/" ? "" : p}`;
};

/** One entry per page and language, each with hreflang alternates. The quote basket is transactional and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const href of STATIC) {
    for (const locale of routing.locales) {
      entries.push({
        url: url(locale, href),
        alternates: { languages: { "fr-CA": url("fr", href), "en-CA": url("en", href) } },
      });
    }
  }
  const productKey = { vinyl: "/flooring/vinyl/[slug]", coverings: "/floor-coverings/[slug]", panels: "/acoustic-panels/[slug]" } as const;
  for (const p of getProducts()) {
    const hrefFor = (l: Locale) => ({ pathname: productKey[p.category], params: { slug: productSlug(p, l) } });
    for (const locale of routing.locales) {
      entries.push({
        url: url(locale, hrefFor(locale)),
        alternates: { languages: { "fr-CA": url("fr", hrefFor("fr")), "en-CA": url("en", hrefFor("en")) } },
      });
    }
  }
  return entries;
}
