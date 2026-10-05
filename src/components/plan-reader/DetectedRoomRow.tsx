"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/controls";
import { Select, TextField } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { LIMITS } from "@/lib/quantities";
import { formatFeetInches, parseDimensionInput, uiRoomArea } from "@/lib/plan-reader/compute";
import type { UiRoom } from "@/lib/plan-reader/types";
import { formatNumber, formatSqft } from "@/lib/format";
import { productName, type Product } from "@/lib/catalog";
import type { Locale } from "@/i18n/routing";

export type RoomPatch = Partial<Pick<UiRoom, "included" | "productId" | "lengthFt" | "widthFt" | "lengthDraft" | "widthDraft">>;

/**
 * One detected room: include checkbox, marker number, name, printed dimensions, recomputed area,
 * confidence badge (icon + word), flooring select, reason. Rooms that are not "high" can be corrected
 * (length x width, in feet); illegible ones are excluded until both are valid.
 */
export function DetectedRoomRow({ room, floors, onChange }: { room: UiRoom; floors: Product[]; onChange: (patch: RoomPatch) => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const id = useId();
  const area = uiRoomArea(room);
  const editable = room.confidence !== "high";
  const included = room.included && area !== null;

  const badge = {
    high: { kind: "high", label: t("planReader.confidenceHigh") },
    check: { kind: "check", label: t("planReader.confidenceCheck") },
    illegible: { kind: "illegible", label: t("planReader.confidenceIllegible") },
  } as const;
  const b = badge[room.confidence];

  const reason = room.confidence === "high" ? "" : room.reason || t(room.confidence === "check" ? "planUi.reasonCheck" : "planUi.reasonIllegible");
  const marker = !included ? "bg-ink-muted text-surface" : room.confidence === "check" ? "bg-ink text-surface" : "bg-accent text-on-accent";

  const dimension = (which: "length" | "width") => {
    const feet = which === "length" ? room.lengthFt : room.widthFt;
    const draft = which === "length" ? room.lengthDraft : room.widthDraft;
    const value = draft ?? (feet === null ? "" : formatNumber(feet, locale, 2));
    const parsed = parseDimensionInput(value);
    const error =
      draft !== null && parsed.error === "invalid"
        ? t("planUi.dimInvalid")
        : parsed.error === "too-large"
          ? t("planUi.dimTooLarge", { max: formatNumber(LIMITS.maxDimensionFt, locale, 0) })
          : null;
    return {
      label: which === "length" ? t("planUi.length") : t("planUi.width"),
      value,
      error,
      onInput: (text: string) => {
        const next = parseDimensionInput(text);
        const other = which === "length" ? room.widthFt : room.lengthFt;
        const patch: RoomPatch =
          which === "length" ? { lengthDraft: text, lengthFt: next.value } : { widthDraft: text, widthFt: next.value };
        // A room we cannot measure cannot stay included.
        if (next.value === null || other === null) patch.included = false;
        onChange(patch);
      },
    };
  };

  return (
    <li className={cx("border-t border-line py-3", !included && "text-ink-muted")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className={cx("flex h-11 w-11 flex-none items-center justify-center", area === null ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
          <input
            type="checkbox"
            className="h-5 w-5 cursor-[inherit] accent-[var(--accent)]"
            checked={included}
            disabled={area === null}
            aria-label={t("planReader.include", { room: room.name })}
            aria-describedby={reason ? `${id}-reason` : undefined}
            onChange={(e) => onChange({ included: e.target.checked })}
          />
        </label>
        <span aria-hidden="true" className={cx("flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] font-semibold", marker)}>
          {room.n}
        </span>
        <div className="min-w-[7rem] flex-[1_1_9rem]">
          <p className={cx("truncate font-semibold", included && "text-ink")} title={room.name}>
            {room.name}
          </p>
          <p className="small num">
            {room.lengthFt !== null && room.widthFt !== null ? `${formatFeetInches(room.lengthFt, locale)} × ${formatFeetInches(room.widthFt, locale)}` : "—"}
          </p>
        </div>
        <p className={cx("num min-w-[4.5rem] text-right font-semibold", included && "text-ink")}>{area === null ? "—" : formatSqft(area, locale)}</p>
        <Badge kind={b.kind}>{b.label}</Badge>
        <Select
          label={<span className="sr-only">{t("planReader.flooringFor", { room: room.name })}</span>}
          value={room.productId ?? ""}
          onChange={(e) => onChange({ productId: e.target.value || null })}
          fieldClassName="w-full sm:w-[200px]"
        >
          <option value="">{t("planReader.toChoose")}</option>
          {floors.map((p) => (
            <option key={p.id} value={p.id}>
              {productName(p, locale)}
            </option>
          ))}
        </Select>
      </div>

      {reason ? (
        <p id={`${id}-reason`} className="small mt-1 sm:pl-14">
          {reason}
        </p>
      ) : null}

      {editable ? (
        <div className="mt-2 flex flex-wrap gap-3 sm:pl-14">
          {(["length", "width"] as const).map((which) => {
            const d = dimension(which);
            return (
              <TextField
                key={which}
                label={d.label}
                suffix={t("planUi.feetSuffix")}
                inputMode="decimal"
                autoComplete="off"
                value={d.value}
                error={d.error}
                onChange={(e) => d.onInput(e.target.value)}
                fieldClassName="w-[9.5rem]"
                helper={undefined}
              />
            );
          })}
          {area === null ? <p className="small w-full text-ink-muted">{t("planUi.dimsNeeded")}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
