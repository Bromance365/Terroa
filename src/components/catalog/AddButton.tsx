"use client";

import { useLocale, useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/Button";
import { getProduct, productName } from "@/lib/catalog";
import { useAddToQuote } from "@/lib/useAddToQuote";
import type { Locale } from "@/i18n/routing";

/** Card-level quick add: one box of flooring or one panel. Quantities are refined in the basket. */
export function AddButton({ productId }: { productId: string }) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;
  const add = useAddToQuote();
  const product = getProduct(productId);
  if (!product) return null;
  return (
    <IconButton
      icon="plus"
      label={t("addNamed", { name: productName(product, locale) })}
      onClick={() => add({ productId, unit: product.kind === "panel" ? "panel" : "box", quantity: 1, source: "catalogue" })}
    />
  );
}
