import { site } from "@/lib/site";

/** Renders a JSON-LD block. Content is built server-side from our own data; `<` is escaped. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  areaServed: { "@type": "AdministrativeArea", name: "Québec" },
  // Contact points, legal name and logo are added once Terroa supplies them.
});

export const breadcrumbLd = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
});
