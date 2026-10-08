"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/controls";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { getProduct, productName } from "@/lib/catalog";
import { formatM2, formatSqft } from "@/lib/format";
import { SQFT_TO_M2 } from "@/lib/quantities";
import { PLAN_WASTE_PCT, type Grouping } from "@/lib/plan-reader/compute";
import type { Locale } from "@/i18n/routing";

export type MeasureNotice = "nothing" | "noRooms" | null;

/**
 * Totals and outputs. The included area is the one copper element on the screen, in a polite live region.
 * Rooms without flooring are listed but not added to the quote (a quote line needs a product).
 */
export function Summary({
  includedArea,
  roomCount,
  grouping,
  notice,
  added,
  onAdd,
  onOpenCalculator,
  equivalent,
}: {
  includedArea: number;
  roomCount: number;
  grouping: Grouping;
  notice: MeasureNotice;
  added: { lines: number; area: number } | null;
  onAdd: () => void;
  onOpenCalculator: () => void;
  /** True when a traced room is included: the calculator receives equivalent rectangles. */
  equivalent: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const list = new Intl.ListFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "long", type: "conjunction" });
  const names = (rooms: { name: string }[]) => list.format(rooms.map((r) => r.name));
  const addCount = grouping.groups.reduce((n, g) => n + g.rooms.length, 0);
  const unassignedText =
    grouping.unassigned.length === 0
      ? ""
      : grouping.unassigned.length === 1
        ? t("planUi.unassignedOne", { rooms: grouping.unassigned[0]?.name ?? "" })
        : t("planReader.unassigned", { rooms: names(grouping.unassigned) });

  return (
    <section aria-labelledby="measure-totals-label" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4" aria-live="polite" aria-atomic="true">
        <h3 id="measure-totals-label" className="label">
          {t("planReader.includedArea")}
          <span className="sr-only"> · {t("planUi.roomsCount", { count: roomCount })}</span>
        </h3>
        <p className="num font-display text-[40px] font-semibold leading-[44px] text-copper">{formatSqft(includedArea, locale)}</p>
      </div>
      <p className="small text-right text-ink-muted">{formatM2(includedArea * SQFT_TO_M2, locale)}</p>

      {grouping.groups.length > 0 || grouping.unassigned.length > 0 ? (
        <ul className="border-b border-line">
          {grouping.groups.map((g) => {
            const product = getProduct(g.productId);
            return (
              <li key={g.productId} className="border-t border-line py-2.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="min-w-0">
                    <strong className="font-semibold">{product ? productName(product, locale) : g.productId}</strong>
                    <span className="text-ink-muted"> · {names(g.rooms)}</span>
                  </p>
                  <p className="num flex-none font-semibold">{formatSqft(g.areaSqft, locale)}</p>
                </div>
                {g.boxes !== null ? <p className="small text-ink-muted">{t("planUi.boxesWithWaste", { boxes: t("common.box", { count: g.boxes }), waste: PLAN_WASTE_PCT })}</p> : null}
              </li>
            );
          })}
          {grouping.unassigned.length > 0 ? (
            <li className="border-t border-line py-2.5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0">
                  <strong className="font-semibold">{t("planReader.flooringToChoose")}</strong>
                  <span className="text-ink-muted"> · {names(grouping.unassigned)}</span>
                </p>
                <p className="num flex-none font-semibold">{formatSqft(grouping.unassignedAreaSqft, locale)}</p>
              </div>
            </li>
          ) : null}
        </ul>
      ) : null}

      {unassignedText ? (
        <div className="flex gap-2.5">
          <Icon name="alert" className="mt-0.5 flex-none" />
          <p className="small text-[15px] leading-[22px]">
            {unassignedText} <span className="text-ink-muted">{t("planUi.unassignedNotAdded")}</span>
          </p>
        </div>
      ) : null}

      {notice ? (
        <Alert kind="danger" role="alert">
          {t(notice === "nothing" ? "planUi.nothingToAdd" : "measure.noneIncluded")}
        </Alert>
      ) : null}
      {added ? (
        <Alert kind="success" role="status" title={t("planUi.addedTitle")}>
          {t("planUi.addedDetail", { lines: added.lines, area: formatSqft(added.area, locale) })}{" "}
          <LinkButton href="/quote" variant="ghost" className="min-h-[44px] px-1">
            {t("planUi.viewQuote")}
          </LinkButton>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={onAdd}>
          {addCount > 0 ? t("planReader.addRooms", { count: addCount }) : t("common.addToQuote")}
        </Button>
        <Button size="lg" variant="secondary" onClick={onOpenCalculator}>
          {t("planReader.openInCalculator")}
        </Button>
        {equivalent ? <p className="small text-ink-muted">{t("measure.equivalentNote")}</p> : null}
      </div>
    </section>
  );
}
