"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/controls";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { getProduct, productName } from "@/lib/catalog";
import { formatSqft } from "@/lib/format";
import { PLAN_WASTE_PCT, type Grouping } from "@/lib/plan-reader/compute";
import type { Locale } from "@/i18n/routing";

export type SummaryNotice = "nothing" | "noRooms" | null;

/**
 * Summary aside: included area (the one copper element on the page, in a polite live region),
 * totals by flooring, rooms without flooring, and the two actions.
 */
export function PlanSummary({
  includedArea,
  grouping,
  roomCount,
  notice,
  added,
  onAdd,
  onOpenCalculator,
}: {
  includedArea: number;
  grouping: Grouping;
  roomCount: number;
  notice: SummaryNotice;
  added: { lines: number; area: number } | null;
  onAdd: () => void;
  onOpenCalculator: () => void;
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
    <aside aria-labelledby="pr-summary-label" className="panel p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4" aria-live="polite" aria-atomic="true">
        <h3 id="pr-summary-label" className="label">
          {t("planReader.includedArea")}
          <span className="sr-only"> · {t("planUi.roomsCount", { count: roomCount })}</span>
        </h3>
        <p className="num font-display text-[40px] font-semibold leading-[44px] text-copper sm:text-[44px]">{formatSqft(includedArea, locale)}</p>
      </div>

      <ul className="mt-4 border-b border-line">
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
              {g.boxes !== null ? (
                <p className="small text-ink-muted">{t("planUi.boxesWithWaste", { boxes: t("common.box", { count: g.boxes }), waste: PLAN_WASTE_PCT })}</p>
              ) : null}
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

      {unassignedText ? (
        <div className="mt-4 flex gap-2.5">
          <Icon name="alert" className="mt-0.5" />
          <p className="small text-[15px] leading-[22px]">
            {unassignedText} <span className="text-ink-muted">{t("planUi.unassignedNotAdded")}</span>
          </p>
        </div>
      ) : null}

      {notice ? (
        <Alert kind="danger" role="alert" className="mt-4">
          {t(notice === "nothing" ? "planUi.nothingToAdd" : "planUi.noRoomsIncluded")}
        </Alert>
      ) : null}
      {added ? (
        <Alert kind="success" role="status" title={t("planUi.addedTitle")} className="mt-4">
          {t("planUi.addedDetail", { lines: added.lines, area: formatSqft(added.area, locale) })}{" "}
          <LinkButton href="/quote" variant="ghost" className="min-h-[44px] px-1">
            {t("planUi.viewQuote")}
          </LinkButton>
        </Alert>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onAdd} className="sm:flex-[1_1_0]">
          {addCount > 0 ? t("planReader.addRooms", { count: addCount }) : t("common.addToQuote")}
        </Button>
        <Button size="lg" variant="secondary" onClick={onOpenCalculator} className="sm:flex-[1_1_0]">
          {t("planReader.openInCalculator")}
        </Button>
      </div>
    </aside>
  );
}
