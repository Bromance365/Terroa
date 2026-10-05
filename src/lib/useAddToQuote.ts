"use client";

import { useLocale, useTranslations } from "next-intl";
import { addToQuote, showToast, type QuoteLine } from "@/lib/quote-store";
import { getProduct, productName } from "@/lib/catalog";
import type { Locale } from "@/i18n/routing";

/** Adds a line to the basket and announces it with the toast ("Ajouté à la soumission. Chêne naturel, 21 boîtes."). */
export function useAddToQuote() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (input: Omit<QuoteLine, "id">) => {
    const line = addToQuote(input);
    const product = getProduct(input.productId);
    const name = product ? productName(product, locale) : "";
    const qty =
      input.unit === "box"
        ? t("common.box", { count: input.quantity })
        : input.unit === "panel"
          ? t("common.panel", { count: input.quantity })
          : "";
    showToast(t("toast.added"), [name, qty].filter(Boolean).join(", ") + ".");
    return line;
  };
}
