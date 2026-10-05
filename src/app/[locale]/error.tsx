"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <div className="container-page section-y flex min-h-[50vh] flex-col items-start justify-center gap-4">
      <h1>{t("title")}</h1>
      <p className="text-ink-muted">{t("text")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
