"use client";

import { useRef, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** File bar of the verify state: name, pages, read date and time, printed scale, replace and delete. */
export function FileBar({
  fileName,
  pages,
  readAt,
  scale,
  onReplace,
  onDelete,
}: {
  fileName: string;
  pages: number;
  readAt: Date;
  scale: string | null;
  onReplace: (file: File) => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const input = useRef<HTMLInputElement>(null);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onReplace(file);
  };

  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <Icon name="file" size={28} className="text-accent" />
      <div className="min-w-0 flex-[1_1_240px]">
        <p className="truncate font-semibold" title={fileName}>
          <span className="sr-only">{t("planUi.fileLabel")} : </span>
          {fileName}
        </p>
        <p className="small text-ink-muted">
          {t("planReader.fileMeta", { pages, date: formatDateTime(readAt, locale), scale: scale ?? t("planUi.scaleNone") })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" icon="upload" onClick={() => input.current?.click()}>
          {t("planReader.replace")}
        </Button>
        <Button variant="danger" icon="trash" onClick={onDelete}>
          {t("planReader.delete")}
        </Button>
      </div>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}
