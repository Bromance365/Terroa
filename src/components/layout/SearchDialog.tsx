"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export interface SearchItem {
  id: string;
  name: string;
  descriptor: string;
  href: string; // already localized
  image: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Client-side product search over the (small) published catalogue. Nothing is sent to a server. */
export function SearchDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: SearchItem[] }) {
  const t = useTranslations("search");
  const ref = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const [q, setQ] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return items;
    return items.filter((i) => norm(`${i.name} ${i.descriptor}`).includes(n));
  }, [q, items]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${inputId}-title`}
      onClose={() => {
        setQ("");
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto mt-[10vh] w-[min(640px,calc(100vw-32px))] max-w-none rounded-lg bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 id={`${inputId}-title`} className="text-[18px] leading-6">
          {t("title")}
        </h2>
        <IconButton label={t("close")} icon="close" variant="ghost" onClick={onClose} />
      </div>
      <div className="p-4">
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("placeholder")}
            className="min-h-[48px] w-full rounded-sm border border-border-strong bg-surface-raised pl-10 pr-3"
          />
        </div>
        <p className="small mt-3 text-ink-muted" aria-live="polite">
          {t("count", { count: results.length })}
        </p>
        <ul className="mt-2 max-h-[50vh] overflow-auto">
          {results.map((r) => (
            <li key={r.id} className="border-t border-line first:border-t-0">
              <Link href={r.href} onClick={onClose} className="flex min-h-[56px] items-center gap-3 py-2 text-ink no-underline hover:text-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt="" width={48} height={48} className="h-12 w-12 flex-none rounded-sm object-cover" />
                <span className="min-w-0">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="small block text-ink-muted">{r.descriptor}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
