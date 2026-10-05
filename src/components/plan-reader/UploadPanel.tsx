"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { PrivacyNotice } from "./PrivacyNotice";

/**
 * State 1. Desktop: drag-and-drop zone with a real file input behind a button (keyboard path).
 * Mobile: camera first ("Prendre une photo du plan"), then a plain file picker.
 * Type, size and magic bytes are checked by the parent (validatePlanFile), not here.
 */
export function UploadPanel({ onFile, headingRef }: { onFile: (file: File) => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = useTranslations();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again after an error
    if (file) onFile(file);
  };
  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <section aria-labelledby="pr-upload-title" className="mx-auto flex max-w-3xl flex-col gap-8">
      <h2 id="pr-upload-title" ref={headingRef} tabIndex={-1} className="sr-only outline-none">
        {t("planReader.stepUpload")}
      </h2>
      <p className="max-w-2xl text-ink-muted sm:hidden">{t("planReader.uploadLead")}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cx(
          "flex flex-col items-stretch gap-3 rounded-lg border-2 p-6 sm:items-center sm:gap-4 sm:p-10",
          dragging ? "border-solid border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-raised))]" : "border-dashed border-border-strong bg-surface-raised",
        )}
      >
        <Icon name="upload" size={40} className="hidden self-center text-accent sm:block" />
        <p className="hidden font-display text-[24px] font-semibold leading-[30px] sm:block">{dragging ? t("planUi.dropActive") : t("planReader.dropHere")}</p>

        <Button variant="primary" size="lg" icon="camera" block onClick={() => cameraRef.current?.click()} className="sm:hidden">
          {t("planReader.takePhoto")}
        </Button>
        <Button variant="secondary" size="lg" icon="upload" block onClick={() => fileRef.current?.click()} className="sm:hidden">
          {t("planReader.chooseFile")}
        </Button>
        <Button variant="primary" size="lg" icon="upload" onClick={() => fileRef.current?.click()} className="hidden sm:inline-flex">
          {t("planReader.chooseFile")}
        </Button>

        <p className="small text-center text-ink-muted">{t("planReader.fileRules")}</p>

        <input ref={cameraRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
      </div>

      <div>
        <h3 className="text-[18px]">{t("planReader.tipsTitle")}</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {(["tip1", "tip2", "tip3"] as const).map((k) => (
            <li key={k} className="flex items-start gap-3">
              <Icon name="check" className="mt-0.5 text-accent" />
              <span>{t(`planReader.${k}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <PrivacyNotice />
    </section>
  );
}
