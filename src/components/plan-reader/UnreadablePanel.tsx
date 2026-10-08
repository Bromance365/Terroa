"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

/**
 * State 4. Phase 1: "Envoyer le plan à l'équipe" only links to /quote; the file is NOT attached or
 * uploaded (nothing leaves the browser). Phase 3: attach the stored plan to the quote request.
 */
export function UnreadablePanel({ onRetry, headingRef }: { onRetry: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = useTranslations();
  return (
    <section aria-labelledby="pr-unreadable-title" className="panel mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-10">
      <Icon name="alert" size={32} className="text-danger" />
      <h2 id="pr-unreadable-title" ref={headingRef} tabIndex={-1} className="outline-none">
        {t("planReader.unreadableTitle")}
      </h2>
      <p className="text-ink-muted">{t("planReader.unreadableText")}</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <LinkButton href="/quote" size="lg" icon="arrowRight">
          {t("planReader.sendToTeam")}
        </LinkButton>
        <Button variant="secondary" size="lg" icon="upload" onClick={onRetry}>
          {t("planUi.tryAnother")}
        </Button>
      </div>
      <p className="small">
        {t("measure.unreadableHint")} <Link href="/measure">{t("measure.navLabel")}</Link>
      </p>
    </section>
  );
}
