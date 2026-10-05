"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/** Native modal <dialog>: focus trap, Escape and focus return come from the platform. */
export function DeleteDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] max-w-none rounded-lg bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={`${id}-title`} className="text-[20px] leading-7">
          {t("planUi.deleteTitle")}
        </h2>
        <p id={`${id}-text`}>{t("planReader.deleteConfirm")}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t("planUi.cancel")}
          </Button>
          <Button variant="danger" icon="trash" onClick={onConfirm}>
            {t("planReader.delete")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
