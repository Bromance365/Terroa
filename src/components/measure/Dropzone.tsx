"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

/**
 * Empty state: drag and drop, a real file input behind a button (keyboard path), and on phones the camera first.
 * Type, size and magic bytes are checked by loadPlanFile (validatePlanFile), not here.
 */
export function Dropzone({ onFile, loading }: { onFile: (file: File) => void; loading: boolean }) {
  const t = useTranslations();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile(file);
  };
  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      aria-busy={loading || undefined}
      className={cx(
        "flex min-h-[320px] flex-col items-stretch justify-center gap-3 rounded-lg border-2 p-6 sm:items-center sm:gap-4 sm:p-10",
        dragging ? "border-solid border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-raised))]" : "border-dashed border-border-strong bg-surface-raised",
      )}
    >
      <Icon name="upload" size={40} className="hidden self-center text-accent sm:block" />
      <h2 className="text-[24px] leading-[30px] sm:text-center">{loading ? t("measure.loading") : dragging ? t("planUi.dropActive") : t("measure.emptyTitle")}</h2>
      <p className="max-w-md text-ink-muted sm:text-center">{t("measure.emptyText")}</p>

      <Button variant="primary" size="lg" icon="camera" block disabled={loading} onClick={() => cameraRef.current?.click()} className="sm:hidden">
        {t("planReader.takePhoto")}
      </Button>
      <Button variant="secondary" size="lg" icon="upload" block disabled={loading} onClick={() => fileRef.current?.click()} className="sm:hidden">
        {t("planReader.chooseFile")}
      </Button>
      <Button variant="primary" size="lg" icon="upload" disabled={loading} onClick={() => fileRef.current?.click()} className="hidden sm:inline-flex">
        {t("planReader.chooseFile")}
      </Button>
      <p className="small text-center text-ink-muted">{t("planReader.fileRules")}</p>

      <input ref={cameraRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}
