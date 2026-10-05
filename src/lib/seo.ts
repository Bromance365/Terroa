import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale, type Pathname } from "@/i18n/routing";
import { site } from "@/lib/site";

type Href = Pathname | { pathname: Pathname; params: Record<string, string> };

export function absoluteUrl(locale: Locale, href: Href) {
  // The cast keeps one helper for static and dynamic keys; the routing config is the source of truth.
  const path = getPathname({ locale, href: href as never });
  return `${site.url}${path === "/" ? "" : path}` || site.url;
}

/** Canonical + hreflang alternates (fr-CA / en-CA / x-default) for one page. */
export function alternatesFor(locale: Locale, hrefs: Record<Locale, Href>): Metadata["alternates"] {
  return {
    canonical: absoluteUrl(locale, hrefs[locale]),
    languages: {
      "fr-CA": absoluteUrl("fr", hrefs.fr),
      "en-CA": absoluteUrl("en", hrefs.en),
      "x-default": absoluteUrl("fr", hrefs.fr),
    },
  };
}

export function pageMetadata({
  locale,
  hrefs,
  title,
  description,
  image,
  noindex = false,
}: {
  locale: Locale;
  hrefs: Record<Locale, Href>;
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(locale, hrefs[locale]);
  return {
    title,
    description,
    alternates: alternatesFor(locale, hrefs),
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: locale === "fr" ? "fr_CA" : "en_CA",
      alternateLocale: locale === "fr" ? "en_CA" : "fr_CA",
      url,
      title,
      description,
      images: image ? [{ url: `${site.url}${image}` }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Same href for both locales (static keys). */
export const bothLocales = (href: Href): Record<Locale, Href> => ({ fr: href, en: href });

export const locales = routing.locales;
