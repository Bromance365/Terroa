import { getLocale, getTranslations } from "next-intl/server";
import type { Product } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** Three price modes (HANDOFF.md 9.3): hidden, from, exact. Unknown prices render the bracketed placeholder. */
export async function PriceLine({ product, className }: { product: Product; className?: string }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const key = product.kind === "panel" ? "common.pricePerPanel" : "common.pricePerSqft";
  const price = product.price_cad === null ? t("price.placeholder") : formatNumber(product.price_cad, locale, 2);
  if (product.price_mode === "hidden") return <p className={className}>{t("price.onRequest")}</p>;
  const line = t(key, { price });
  return <p className={`num ${className ?? ""}`}>{product.price_mode === "from" ? t("price.from", { price: line }) : line}</p>;
}
