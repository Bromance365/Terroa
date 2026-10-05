"use client";

import { useEffect, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/controls";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const SLOW_AFTER_MS = 60_000;

/** State 2. File name, indeterminate progress, cancel. After 60 s: "Toujours en cours". */
export function AnalyzingPanel({
  fileName,
  onCancel,
  headingRef,
}: {
  fileName: string;
  onCancel: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section aria-labelledby="pr-analyzing-title" aria-busy="true" className="panel mx-auto flex max-w-xl flex-col items-center gap-5 p-6 text-center sm:p-10">
      <h2 id="pr-analyzing-title" ref={headingRef} tabIndex={-1} className="outline-none">
        {t("planReader.analyzing")}
      </h2>
      <p className="flex max-w-full items-center gap-2 text-ink-muted">
        <Icon name="file" />
        <span className="truncate" title={fileName}>
          {fileName}
        </span>
      </p>
      <div role="progressbar" aria-label={t("planReader.analyzing")} className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full w-2/5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      </div>
      <p className="small text-ink-muted">{t("planUi.analyzingHint")}</p>
      <div role="status" aria-live="polite" className="w-full text-left">
        {slow ? (
          <Alert kind="info" title={t("planUi.stillRunningTitle")}>
            {t("planUi.stillRunning")}
          </Alert>
        ) : null}
      </div>
      <Button variant="secondary" icon="close" onClick={onCancel}>
        {t("planUi.cancelReading")}
      </Button>
    </section>
  );
}
