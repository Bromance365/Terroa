import { defineRouting } from "next-intl/routing";

/**
 * French is served at `/` (no prefix), English under `/en`.
 * Internal keys are English; each locale has its own localized slug.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames: {
    "/": "/",
    "/flooring/vinyl": { fr: "/planchers/vinyle", en: "/flooring/vinyl" },
    "/flooring/vinyl/[slug]": { fr: "/planchers/vinyle/[slug]", en: "/flooring/vinyl/[slug]" },
    "/acoustic-panels": { fr: "/panneaux-acoustiques", en: "/acoustic-panels" },
    "/acoustic-panels/[slug]": { fr: "/panneaux-acoustiques/[slug]", en: "/acoustic-panels/[slug]" },
    "/floor-coverings": { fr: "/revetements", en: "/floor-coverings" },
    "/quote": { fr: "/soumission", en: "/quote" },
    "/calculator": { fr: "/calculateur", en: "/calculator" },
    "/plan-reader": { fr: "/lecteur-de-plans", en: "/plan-reader" },
    "/projects": { fr: "/realisations", en: "/projects" },
    "/privacy": { fr: "/confidentialite", en: "/privacy" },
    "/terms": { fr: "/conditions", en: "/terms" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathname = keyof typeof routing.pathnames;

/** Pathnames without dynamic segments (safe to pass straight to Link). */
export type StaticPathname = Exclude<Pathname, `${string}[slug]`>;
