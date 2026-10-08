"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/controls";
import { parsePositiveDecimal } from "@/lib/quantities";


/** Mounted only while a line is pending, so its state starts empty each time and the length field takes focus. */
function ScaleForm({ unit, onApply, onCancel }: { unit: "ft" | "m"; onApply: (length: number) => "short" | "invalid" | null; onCancel: () => void }) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.getElementById("measure-scale-length")?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const length = parsePositiveDecimal(value);
    if (length === null) {
      setError(t("measure.scaleInvalid"));
      return;
    }
    const problem = onApply(length);
    setError(problem === "short" ? t("measure.scaleShort") : problem === "invalid" ? t("measure.scaleInvalid") : null);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-md border border-line p-4">
      <TextField
        id="measure-scale-length"
        label={t("measure.scaleLength")}
        suffix={t(unit === "ft" ? "measure.unitFt" : "measure.unitM")}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        error={error}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{t("measure.scaleApply")}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {t("measure.scaleCancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Units (pi / m) and scale status. After the person drags a line on the plan, the form asks for its real length.
 * The status always carries an icon and a sentence, never colour alone.
 */
export function ScalePanel({
  unit,
  onUnit,
  hasPlan,
  hasScale,
  scaleLabel,
  pending,
  onApply,
  onCancel,
  onRedo,
}: {
  unit: "ft" | "m";
  onUnit: (u: "ft" | "m") => void;
  hasPlan: boolean;
  hasScale: boolean;
  /** "25 pi" / "7,6 m": the real length of the calibration line. */
  scaleLabel: string;
  pending: boolean;
  onApply: (length: number) => "short" | "invalid" | null;
  onCancel: () => void;
  onRedo: () => void;
}) {
  const t = useTranslations();
  return (
    <section aria-labelledby="measure-scale-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="measure-scale-title" className="text-[18px]">
          {t("measure.scaleTitle")}
        </h3>
        <SegmentedControl
          label={t("measure.unitsLabel")}
          value={unit}
          onChange={onUnit}
          options={[
            { value: "ft", label: t("measure.unitFt") },
            { value: "m", label: t("measure.unitM") },
          ]}
        />
      </div>

      {hasPlan && !pending ? (
        <div className="flex gap-2.5">
          <Icon name={hasScale ? "checkCircle" : "alert"} className={hasScale ? "mt-0.5 flex-none text-success" : "mt-0.5 flex-none"} />
          <div className="small min-w-0 text-[15px] leading-[22px]">
            <p>{hasScale ? t("measure.scaleSet", { length: scaleLabel }) : t("measure.scaleNone")}</p>
            {hasScale ? <p className="text-ink-muted">{t("measure.scaleCheck")}</p> : null}
            <Button variant="ghost" onClick={onRedo} className="min-h-[44px] px-0">
              {hasScale ? t("measure.scaleRedo") : t("measure.scaleStart")}
            </Button>
          </div>
        </div>
      ) : null}

      {pending ? <ScaleForm unit={unit} onApply={onApply} onCancel={onCancel} /> : null}
    </section>
  );
}
