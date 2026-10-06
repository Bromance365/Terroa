"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { Select, TextField } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { formatAreaBoth, formatNumber } from "@/lib/format";
import { productName, type Product } from "@/lib/catalog";
import { cleanRoomName } from "@/lib/measure/rooms";
import { unitFromFeet } from "@/lib/measure/geometry";
import type { MeasuredRoom } from "@/lib/measure/types";
import type { Locale } from "@/i18n/routing";

export type RoomPatch = Partial<Pick<MeasuredRoom, "name" | "productId" | "included">>;

const SOURCE_KEY = { detect: "sourceDetect", trace: "sourceTrace", rectangle: "sourceRectangle", typed: "sourceTyped" } as const;

function RoomRow({
  room,
  n,
  floors,
  unit,
  selected,
  onChange,
  onDelete,
  onSelect,
}: {
  room: MeasuredRoom;
  n: number;
  floors: Product[];
  unit: "ft" | "m";
  selected: boolean;
  onChange: (patch: RoomPatch) => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const id = useId();
  const hasArea = room.areaSqft !== null;
  const included = room.included && hasArea;
  const [draft, setDraft] = useState<string | null>(null);
  const shownName = draft ?? room.name;
  const unitLabel = t(unit === "ft" ? "measure.unitFt" : "measure.unitM");
  const dims = room.dimsFt
    ? t("measure.roomDims", {
        length: `${formatNumber(unitFromFeet(room.dimsFt.lengthFt, unit), locale, 2)} ${unitLabel}`,
        width: `${formatNumber(unitFromFeet(room.dimsFt.widthFt, unit), locale, 2)} ${unitLabel}`,
      })
    : null;

  return (
    <li aria-current={selected ? "true" : undefined} className={cx("border-t border-line py-3", selected && "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]")}>
      <div className="flex items-end gap-2">
        <label className={cx("flex h-11 w-11 flex-none items-center justify-center", hasArea ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="h-5 w-5 cursor-[inherit] accent-[var(--accent)]"
            checked={included}
            disabled={!hasArea}
            aria-label={t("planReader.include", { room: room.name })}
            onChange={(e) => onChange({ included: e.target.checked })}
          />
        </label>
        <TextField
          label={<span className="sr-only">{t("measure.roomName", { n })}</span>}
          value={shownName}
          maxLength={60}
          onFocus={() => setDraft(room.name)}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange({ name: e.target.value });
          }}
          onBlur={() => {
            if (cleanRoomName(room.name) === "") onChange({ name: t("measure.roomDefault", { n }) });
            setDraft(null);
          }}
          fieldClassName="min-w-0 flex-1"
        />
        <IconButton label={t("measure.roomDelete", { room: room.name || t("measure.roomDefault", { n }) })} icon="trash" onClick={onDelete} />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-[52px]">
        <p className={cx("num font-semibold", included ? "text-ink" : "text-ink-muted")}>
          <span className="sr-only">{t("measure.roomAreaLabel")} : </span>
          {hasArea ? formatAreaBoth(room.areaSqft as number, locale) : t("measure.scaleNeeded")}
        </p>
        <p className="small text-ink-muted">
          {t(`measure.${SOURCE_KEY[room.source]}`)}
          {dims ? ` · ${dims}` : ""}
        </p>
        {selected ? (
          <p className="small inline-flex items-center gap-1 font-semibold">
            <Icon name="check" size={16} />
            {t("measure.roomSelected")}
          </p>
        ) : room.points.length >= 3 ? (
          <Button variant="ghost" onClick={onSelect} aria-label={t("measure.roomSelect", { room: room.name })} className="min-h-[44px] px-1">
            {t("measure.toolSelect")}
          </Button>
        ) : null}
      </div>

      <div className="mt-1 pl-[52px]" id={`${id}-flooring`}>
        <Select
          label={<span className="sr-only">{t("planReader.flooringFor", { room: room.name })}</span>}
          value={room.productId ?? ""}
          onChange={(e) => onChange({ productId: e.target.value || null })}
        >
          <option value="">{t("planReader.toChoose")}</option>
          {floors.map((p) => (
            <option key={p.id} value={p.id}>
              {productName(p, locale)}
            </option>
          ))}
        </Select>
      </div>
    </li>
  );
}

/** The accessible source of truth: every room, with its name, area, flooring, inclusion and delete. */
export function RoomList({
  rooms,
  floors,
  unit,
  selectedId,
  onChange,
  onDelete,
  onSelect,
}: {
  rooms: readonly MeasuredRoom[];
  floors: Product[];
  unit: "ft" | "m";
  selectedId: string | null;
  onChange: (id: string, patch: RoomPatch) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations();
  if (rooms.length === 0) return <p className="text-ink-muted">{t("measure.roomsEmpty")}</p>;
  return (
    <ul className="border-b border-line">
      {rooms.map((room, i) => (
        <RoomRow
          key={room.id}
          room={room}
          n={i + 1}
          floors={floors}
          unit={unit}
          selected={room.id === selectedId}
          onChange={(patch) => onChange(room.id, patch)}
          onDelete={() => onDelete(room.id)}
          onSelect={() => onSelect(room.id)}
        />
      ))}
    </ul>
  );
}
