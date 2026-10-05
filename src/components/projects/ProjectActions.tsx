"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAddToQuote } from "@/lib/useAddToQuote";
import { getProduct } from "@/lib/catalog";

export function AddProjectProducts({ productIds }: { productIds: string[] }) {
  const t = useTranslations("gallery");
  const add = useAddToQuote();
  return (
    <Button
      size="lg"
      block
      onClick={() => {
        for (const id of productIds) {
          const p = getProduct(id);
          if (p) add({ productId: id, unit: p.kind === "panel" ? "panel" : "box", quantity: 1, source: "catalogue" });
        }
      }}
    >
      {t("addProducts")}
    </Button>
  );
}

/** Web Share API when available, otherwise copy the link and say so. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("gallery");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon="share"
        onClick={async () => {
          const url = window.location.href;
          try {
            if (navigator.share) {
              await navigator.share({ title, url });
              return;
            }
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 3000);
          } catch {
            // User cancelled the share sheet or clipboard is blocked: nothing to do.
          }
        }}
      >
        {t("share")}
      </Button>
      <span role="status" aria-live="polite" className="small ml-3 text-ink-muted">
        {copied ? t("linkCopied") : ""}
      </span>
    </>
  );
}
