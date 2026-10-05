"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

export interface GallerySlide {
  src: string | null; // null = placeholder tile (photo to supply)
  label: string; // alt text or bracketed placeholder
}

/** Main 4:3 image + thumbnail buttons with aria-pressed. */
export function ProductGallery({ slides, name }: { slides: GallerySlide[]; name: string }) {
  const t = useTranslations("productUi");
  const [i, setI] = useState(0);
  const current = slides[i] ?? slides[0]!;
  return (
    <div className="min-w-0">
      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-line">
        {current.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.src} alt={t("imageAlt", { name })} width={1200} height={900} className="h-full w-full object-cover" fetchPriority="high" />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-line bg-surface-raised text-ink-muted">{current.label}</div>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-4 gap-3">
        {slides.map((s, idx) => (
          <li key={idx}>
            <button
              type="button"
              aria-pressed={idx === i}
              aria-label={t("photoLabel", { n: idx + 1, total: slides.length })}
              onClick={() => setI(idx)}
              className={cx(
                "block aspect-[4/3] w-full overflow-hidden rounded-md border-2 bg-surface-raised",
                idx === i ? "border-ink" : "border-transparent hover:border-border-strong",
              )}
            >
              {s.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.src} alt="" width={300} height={225} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="small flex h-full w-full items-center justify-center px-1 text-center text-ink-muted">{s.label}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
