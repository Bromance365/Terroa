"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { formatNumber } from "@/lib/format";
import { feetFromUnit } from "@/lib/measure/geometry";
import { LIMITS, parsePositiveDecimal } from "@/lib/quantities";
import type { Locale } from "@/i18n/routing";

/** Adds a room by typing length x width: works with no plan loaded and no canvas. */
export function AddRoomForm({
  unit,
  disabled,
  onAdd,
}: {
  unit: "ft" | "m";
  disabled: boolean;
  onAdd: (room: { name: string; lengthFt: number; widthFt: number }) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [name, setName] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suffix = t(unit === "ft" ? "measure.unitFt" : "measure.unitM");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const l = parsePositiveDecimal(length);
    const w = parsePositiveDecimal(width);
    if (l === null || w === null) {
      setError(t("measure.addInvalid"));
      return;
    }
    const lengthFt = Math.round(feetFromUnit(l, unit) * 10000) / 10000;
    const widthFt = Math.round(feetFromUnit(w, unit) * 10000) / 10000;
    if (lengthFt > LIMITS.maxDimensionFt || widthFt > LIMITS.maxDimensionFt) {
      setError(t("planUi.dimTooLarge", { max: formatNumber(LIMITS.maxDimensionFt, locale, 0) }));
      return;
    }
    setError(null);
    onAdd({ name, lengthFt, widthFt });
    setName("");
    setLength("");
    setWidth("");
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-labelledby="measure-add-title">
      <h3 id="measure-add-title" className="text-[18px]">
        {t("measure.addTitle")}
      </h3>
      <TextField label={t("measure.addName")} value={name} maxLength={60} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-3">
        <TextField
          label={t("measure.addLength")}
          suffix={suffix}
          inputMode="decimal"
          autoComplete="off"
          value={length}
          onChange={(e) => setLength(e.target.value)}
          fieldClassName="min-w-0 flex-1"
        />
        <TextField
          label={t("measure.addWidth")}
          suffix={suffix}
          inputMode="decimal"
          autoComplete="off"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          fieldClassName="min-w-0 flex-1"
        />
      </div>
      {error ? (
        <p role="alert" className="small text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" icon="plus" disabled={disabled} className="self-start">
        {t("measure.addButton")}
      </Button>
      {disabled ? <p className="small text-ink-muted">{t("calcUi.limitRooms", { max: LIMITS.maxRooms })}</p> : null}
    </form>
  );
}
