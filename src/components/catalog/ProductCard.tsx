import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { imgSrc, productHref, productName, productTone, type Product } from "@/lib/catalog";
import { Badge } from "@/components/ui/controls";
import { AddButton } from "./AddButton";
import { PriceLine } from "./PriceLine";

export async function descriptorFor(product: Product) {
  const t = await getTranslations("catalog");
  const base = product.kind === "panel" ? t("panelDescriptor") : product.format === "large-tile" ? t("coveringDescriptor") : t("floorDescriptor");
  return base;
}

export async function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const name = productName(product, locale);
  const descriptor = await descriptorFor(product);
  return (
    <article className="card group flex min-w-0 flex-col overflow-hidden">
      <Link href={productHref(product, locale)} className="relative block overflow-hidden text-ink no-underline hover:text-ink" aria-label={t("seeProduct", { name })}>
        <div className="aspect-square overflow-hidden bg-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc(product.image)}
            alt=""
            width={600}
            height={600}
            className="img-zoom h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
        {product.is_new ? (
          <span className="absolute left-3 top-3">
            <Badge kind="new">{t("new")}</Badge>
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col justify-between gap-2 p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-[16px] leading-5 sm:text-[18px] sm:leading-6">
            <Link href={productHref(product, locale)} className="text-ink no-underline hover:text-accent">
              {name}
            </Link>
          </h3>
          <p className="small mt-0.5 text-ink-muted">
            {descriptor} · {productTone(product, locale).toLowerCase()}
          </p>
          <PriceLine product={product} className="small mt-2 text-ink" />
        </div>
        <AddButton productId={product.id} />
      </div>
    </article>
  );
}
