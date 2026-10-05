"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { dismissToast, useQuote, useToast } from "@/lib/quote-store";
import { ToastView } from "@/components/ui/controls";

export function ToastHost() {
  const t = useTranslations("toast");
  const toast = useToast();
  const quote = useQuote();
  return (
    <ToastView
      message={toast}
      onDismiss={dismissToast}
      action={
        <Link href="/quote" className="inline-flex min-h-[44px] items-center whitespace-nowrap font-semibold text-surface underline underline-offset-4 hover:text-surface">
          {t("view", { count: quote.lines.length })}
        </Link>
      }
    />
  );
}
