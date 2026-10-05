import { getProducts } from "@/lib/catalog";

/** FR/EN slug pairs so the language switch on a product page lands on the equivalent product. */
export function getSlugPairs() {
  return getProducts().map((p) => ({ fr: p.slug_fr, en: p.slug_en }));
}
export type SlugPair = ReturnType<typeof getSlugPairs>[number];
