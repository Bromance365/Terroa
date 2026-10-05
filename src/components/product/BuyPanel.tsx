"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/controls";
import { TextField } from "@/components/ui/Field";
import { useStickySlot } from "@/components/ui/useSlot";
import { boxesForArea, parsePositiveDecimal } from "@/lib/quantities";
import { formatNumber } from "@/lib/format";
import { useAddToQuote } from "@/lib/useAddToQuote";
import { getProduct } from "@/lib/catalog";

const WASTE = 10; // default waste, HANDOFF 7.3

/** Quantity panel: area → boxes (waste 10 %, rounded up) for floors; panel count for acoustic panels. */
export function BuyPanel({ productId, coverage }: { productId: string; coverage: number | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const add = useAddToQuote();
  const slot = useStickySlot();
  const product = getProduct(productId)!;
  const isPanel = product.kind === "panel";

  const [area, setArea] = useState("");
  const [qty, setQty] = useState(1);
  const [areaError, setAreaError] = useState<string | null>(null);

  const est = boxesForArea(area, WASTE, coverage);
  const unit = isPanel ? "panel" : "box";

  const onArea = (v: string) => {
    setArea(v);
    const r = boxesForArea(v, WASTE, coverage);
    if (r) {
      setQty(Math.min(9999, r.boxes));
      setAreaError(null);
    } else {
      setAreaError(v.trim() === "" ? null : t("productUi.areaInvalid"));
    }
  };

  const submit = () => add({ productId, unit, quantity: qty, source: "catalogue", ...(est && !isPanel ? { plannedAreaSqft: est.orderArea } : {}) });
  const calcHref = isPanel ? ({ pathname: "/calculator", query: { mode: "panels", product: productId } } as const) : ({ pathname: "/calculator", query: { product: productId } } as const);

  const helper =
    !isPanel && est
      ? `${t("product.boxesHelp", { area: formatNumber(parsePositiveDecimal(area) ?? 0, locale, 1), waste: WASTE })}`
      : isPanel
        ? t("productUi.hintPanels")
        : t("productUi.hint");

  const stepper = (
    <QuantityStepper
      value={qty}
      onChange={setQty}
      decreaseLabel={isPanel ? t("productUi.decreasePanel") : t("product.decreaseBox")}
      increaseLabel={isPanel ? t("productUi.increasePanel") : t("product.increaseBox")}
      inputLabel={isPanel ? t("productUi.panelsLabel") : t("product.boxes")}
    />
  );

  return (
    <>
      <div className="panel p-5 sm:p-6">
        {!isPanel ? (
          <TextField
            label={t("product.areaToCover")}
            suffix="pi²"
            inputMode="decimal"
            autoComplete="off"
            value={area}
            onChange={(e) => onArea(e.target.value)}
            error={areaError}
            fieldClassName="mb-4"
          />
        ) : null}
        <p className="label mb-1.5">{isPanel ? t("productUi.panelsLabel") : t("product.boxes")}</p>
        {stepper}
        <p className="small mt-3 text-ink-muted" aria-live="polite">
          {helper}{" "}
          <Link href={calcHref as never} className="font-semibold">
            {isPanel ? t("productUi.calculateWalls") : t("product.calculateByRoom")}
          </Link>
        </p>
        <div className="mt-5">
          <Button size="lg" block icon="plus" onClick={submit}>
            {t("common.addToQuote")}
          </Button>
        </div>
      </div>

      {slot
        ? createPortal(
            <div
              className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-raised px-4 pt-3 sm:hidden"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center gap-3">
                {stepper}
                <Button size="lg" className="min-w-0 flex-1" onClick={submit}>
                  {t("common.addToQuote")}
                </Button>
              </div>
            </div>,
            slot,
          )
        : null}
    </>
  );
}
