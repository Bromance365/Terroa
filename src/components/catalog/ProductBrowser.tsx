"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/controls";
import { Checkbox, Select } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";

type FacetKey = "tone" | "format" | "install" | "usage";
export interface BrowserItem {
  id: string;
  order: number;
  isNew: boolean;
  toneRank: number;
  facets: Record<FacetKey, string[]>;
}
export interface FacetOption {
  value: string;
  label: string;
  swatch?: string;
}
export interface Facet {
  key: FacetKey;
  title: string;
  options: FacetOption[];
}

const PAGE_SIZE = 12;
const SORTS = ["relevance", "new", "tone"] as const;
type Sort = (typeof SORTS)[number];

function parse(params: URLSearchParams, facets: Facet[]) {
  const active: Record<string, string[]> = {};
  for (const f of facets) {
    const allowed = new Set(f.options.map((o) => o.value));
    const vals = (params.get(f.key) ?? "").split(",").filter((v) => allowed.has(v));
    if (vals.length) active[f.key] = vals;
  }
  const s = params.get("sort");
  const sort: Sort = SORTS.includes(s as Sort) ? (s as Sort) : "relevance";
  return { active, sort };
}

/**
 * Filters + results. Filter state lives in the URL query string (shareable). The canonical page
 * has no parameters, and the unfiltered list is server-rendered for crawlers.
 */
export function ProductBrowser({
  items,
  cards,
  facets,
  promo,
}: {
  items: BrowserItem[];
  cards: Record<string, ReactNode>;
  facets: Facet[];
  promo: ReactNode;
}) {
  const t = useTranslations("category");
  const tu = useTranslations("categoryUi");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const { active, sort } = useMemo(() => parse(new URLSearchParams(searchParams.toString()), facets), [searchParams, facets]);
  const [draft, setDraft] = useState(active);

  const apply = (next: Record<string, string[]>, nextSort: Sort = sort) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v.length) q.set(k, v.join(","));
    if (nextSort !== "relevance") q.set("sort", nextSort);
    const qs = q.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false });
    setShown(PAGE_SIZE);
  };

  const matches = (it: BrowserItem, sel: Record<string, string[]>) =>
    Object.entries(sel).every(([k, vals]) => vals.length === 0 || it.facets[k as FacetKey].some((v) => vals.includes(v)));

  const results = useMemo(() => {
    const list = items.filter((it) => matches(it, active));
    return list.sort((a, b) =>
      sort === "new" ? Number(b.isNew) - Number(a.isNew) || a.order - b.order : sort === "tone" ? a.toneRank - b.toneRank || a.order - b.order : a.order - b.order,
    );
  }, [items, active, sort]);

  const draftCount = useMemo(() => items.filter((it) => matches(it, draft)).length, [items, draft]);

  const toggle = (state: Record<string, string[]>, key: string, value: string) => {
    const cur = state[key] ?? [];
    return { ...state, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
  };

  const activeChips = facets.flatMap((f) => (active[f.key] ?? []).map((v) => ({ key: f.key, value: v, label: f.options.find((o) => o.value === v)?.label ?? v })));
  const hasActive = activeChips.length > 0;

  const renderFilters = (state: Record<string, string[]>, onToggle: (k: string, v: string) => void, idPrefix: string) => (
    <div>
      {facets.map((f) => (
        <fieldset key={f.key} className="m-0 border-0 border-t border-line p-0 py-5">
          <legend className="label float-left mb-3 w-full p-0">{f.title}</legend>
          <div className="clear-both">
            {f.options.map((o) => (
              <Checkbox
                key={o.value}
                id={`${idPrefix}-${f.key}-${o.value}`}
                checked={(state[f.key] ?? []).includes(o.value)}
                onChange={() => onToggle(f.key, o.value)}
                label={
                  <span className="flex items-center gap-2.5">
                    {o.swatch ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.swatch} alt="" width={24} height={24} className="h-6 w-6 rounded-[4px] object-cover" />
                    ) : null}
                    {o.label}
                  </span>
                }
                className="py-1.5"
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );

  const visible = results.slice(0, shown);

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-6">
      {/* Desktop filters */}
      <aside className="hidden w-[260px] flex-none min-[900px]:block" aria-label={t("filters")}>
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-[22px]">{t("filters")}</h2>
          {hasActive ? (
            <Button variant="ghost" onClick={() => apply({})}>
              {t("clearAll")}
            </Button>
          ) : null}
        </div>
        {renderFilters(active, (k, v) => apply(toggle(active, k, v)), "d")}
      </aside>

      <section className="min-w-0 flex-1 basis-[min(100%,560px)]" aria-label={tu("resultsFor")}>
        <div className="flex flex-wrap items-center gap-3 pb-6">
          <Button variant="secondary" icon="filter" className="min-[900px]:hidden" onClick={() => {
              setDraft(active);
              sheetRef.current?.showModal();
            }} aria-haspopup="dialog">
            {tu("filtersOpen")}
            {hasActive ? <span className="num ml-1 rounded-full bg-ink px-2 text-[13px] text-surface">{activeChips.length}</span> : null}
          </Button>
          <h2 className="text-[18px] leading-6 [font-family:var(--font-sans-stack)]" aria-live="polite">
            {t("results", { count: results.length })}
          </h2>
          {hasActive ? (
            <ul className="flex flex-wrap gap-2" aria-label={tu("activeFilters")}>
              {activeChips.map((c) => (
                <li key={`${c.key}-${c.value}`}>
                  <FilterChip removable label={c.label} removeLabel={t("removeFilter", { name: c.label })} onClick={() => apply(toggle(active, c.key, c.value))} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ml-auto w-full min-[480px]:w-auto">
            <Select
              label={t("sortBy")}
              value={sort}
              onChange={(e) => apply(active, e.target.value as Sort)}
              fieldClassName="min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-3"
            >
              <option value="relevance">{t("sortRelevance")}</option>
              <option value="new">{t("sortNew")}</option>
              <option value="tone">{t("sortTone")}</option>
            </Select>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="panel flex flex-col items-start gap-4 p-8">
            <p className="font-display text-[22px]">{t("emptyTitle")}</p>
            <Button variant="secondary" onClick={() => apply({})}>
              {t("emptyAction")}
            </Button>
          </div>
        ) : (
          <ul className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
            {visible.flatMap((it, i) => {
              const nodes = [<li key={it.id}>{cards[it.id]}</li>];
              if (i === Math.min(5, visible.length - 1)) {
                nodes.push(
                  <li key="promo" className="col-span-full">
                    {promo}
                  </li>,
                );
              }
              return nodes;
            })}
          </ul>
        )}

        {results.length > shown ? (
          <div className="mt-10 flex flex-col items-center gap-3">
            <p className="small text-ink-muted">{t("shownOf", { shown, total: results.length })}</p>
            <Button variant="secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              {t("showMore")}
            </Button>
          </div>
        ) : null}
      </section>

      {/* Mobile bottom sheet */}
      <dialog
        ref={sheetRef}
        aria-label={t("filters")}
        onClick={(e) => {
          if (e.target === sheetRef.current) sheetRef.current?.close();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-auto rounded-t-lg bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-2">
          <h2 className="text-[22px]">{t("filters")}</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setDraft({})}>
              {t("clearAll")}
            </Button>
            <IconButton label={tu("filtersClose")} icon="close" variant="ghost" onClick={() => sheetRef.current?.close()} />
          </div>
        </div>
        <div className="px-4">
          {renderFilters(draft, (k, v) => setDraft((d) => toggle(d, k, v)), "m")}
        </div>
        <div className="sticky bottom-0 border-t border-line bg-surface p-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <Button
            size="lg"
            block
            onClick={() => {
              apply(draft);
              sheetRef.current?.close();
            }}
          >
            {tu("apply", { count: draftCount })}
          </Button>
        </div>
      </dialog>
    </div>
  );
}

export function PlanPromo({ title, text, action, image, alt }: { title: string; text: string; action: string; image: string; alt: string }) {
  return (
    <div className="card flex flex-wrap items-center gap-6 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt} width={180} height={126} className="hidden h-[126px] w-[180px] flex-none rounded-sm border border-line object-cover sm:block" loading="lazy" />
      <div className="min-w-0 flex-1 basis-64">
        <h3 className="font-display text-[22px] leading-7">{title}</h3>
        <p className="mt-1 text-ink-muted">{text}</p>
      </div>
      <LinkButton href="/plan-reader" variant="secondary" icon="upload" className={cx("w-full sm:w-auto")}>
        {action}
      </LinkButton>
    </div>
  );
}
