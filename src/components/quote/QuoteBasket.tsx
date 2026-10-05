"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, Radio, Select, TextField, Textarea } from "@/components/ui/Field";
import { Alert, QuantityStepper } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { getProduct, imgSrc, productName, type Product } from "@/lib/catalog";
import { formatSqft } from "@/lib/format";
import {
  PROJECT_TYPES,
  RECEPTIONS,
  ROLES,
  START_WINDOWS,
  MAX_NOTES,
  quoteRequestSchema,
  type QuoteTotals,
} from "@/lib/quote-schema";
import {
  addToQuote,
  clearQuote,
  isLineAvailable,
  removeLine,
  restoreRemoved,
  setQuantity,
  summarize,
  useQuote,
  type QuoteLine,
} from "@/lib/quote-store";

type FieldKey = "lines" | "projectName" | "city" | "notes" | "name" | "company" | "email" | "phone";
/** DOM order: focus goes to the first invalid field in this order. */
const FIELD_ORDER: FieldKey[] = ["lines", "projectName", "city", "notes", "name", "company", "email", "phone"];

const TYPE_KEY = { residential: "typeResidential", multiunit: "typeMultiunit", commercial: "typeCommercial", office: "typeOffice" } as const;
const START_KEY = { month: "startMonth", quarter: "startQuarter", later: "startLater", unknown: "startUnknown" } as const;
const ROLE_KEY = {
  contractor: "roleContractor",
  designer: "roleDesigner",
  architect: "roleArchitect",
  manager: "roleManager",
  owner: "roleOwner",
} as const;

interface Values {
  projectName: string;
  type: (typeof PROJECT_TYPES)[number];
  city: string;
  startWindow: (typeof START_WINDOWS)[number];
  reception: (typeof RECEPTIONS)[number];
  notes: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  role: (typeof ROLES)[number];
  marketingOptIn: boolean;
  website: string;
}

const INITIAL: Values = {
  projectName: "",
  type: "residential",
  city: "",
  startWindow: "month",
  reception: "delivery",
  notes: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  role: "contractor",
  marketingOptIn: false,
  website: "",
};

interface Sent {
  reference: string;
  name: string;
  email: string;
  city: string;
  totals: QuoteTotals;
  lines: QuoteLine[];
}

const fieldId = (key: string) => `quote-${key}`;
const noopSubscribe = () => () => {};

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

function fieldKeyFor(path: ReadonlyArray<PropertyKey>): FieldKey | null {
  const [a, b] = path;
  if (a === "lines") return "lines";
  if (a === "project") return b === "city" ? "city" : b === "notes" ? "notes" : b === "name" ? "projectName" : null;
  if (a === "contact") return b === "name" ? "name" : b === "email" ? "email" : b === "phone" ? "phone" : b === "company" ? "company" : null;
  return null;
}

function buildPayload(v: Values, lines: QuoteLine[], locale: Locale) {
  const opt = (s: string) => {
    const x = s.trim();
    return x === "" ? undefined : x;
  };
  return {
    lines: lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unit: l.unit,
      ...(l.rooms && l.rooms.length ? { rooms: l.rooms } : {}),
      ...(l.plannedAreaSqft ? { plannedAreaSqft: l.plannedAreaSqft } : {}),
    })),
    project: {
      name: opt(v.projectName),
      type: v.type,
      city: v.city,
      startWindow: v.startWindow,
      reception: v.reception,
      notes: opt(v.notes),
    },
    contact: {
      name: v.name,
      email: v.email,
      company: opt(v.company),
      phone: opt(v.phone),
      role: v.role,
    },
    marketingOptIn: v.marketingOptIn,
    locale,
    website: v.website,
  };
}

export function QuoteBasket({ heading }: { heading: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const quote = useQuote();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);
  const idemKey = useRef<string | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  const lines = quote.lines;
  const available = lines.filter(isLineAvailable);
  const unavailable = lines.filter((l) => !isLineAvailable(l));
  const totals = summarize(available);

  // Focus requests run after render so a field hidden on mobile (step 1) can be revealed first.
  useEffect(() => {
    if (!focusRequest) return;
    document.getElementById(focusRequest.id)?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (sent) {
      window.scrollTo({ top: 0 });
      sentHeading.current?.focus();
    }
  }, [sent]);

  const requestFocus = (id: string) => setFocusRequest((p) => ({ id, n: (p?.n ?? 0) + 1 }));

  const update = <K extends keyof Values>(key: K, value: Values[K], errorKey?: FieldKey) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errorKey && errors[errorKey]) setErrors((e) => ({ ...e, [errorKey]: undefined }));
  };

  const goStep = (next: 1 | 2) => {
    setStep(next);
    window.scrollTo({ top: 0 });
    if (next === 2) requestFocus("quote-step2-title");
  };

  function validate() {
    const found: Partial<Record<FieldKey, string>> = {};
    if (unavailable.length > 0) found.lines = t("quoteForm.unavailableBlock");
    const parsed = quoteRequestSchema.safeParse(buildPayload(values, available, locale));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = fieldKeyFor(issue.path);
        if (!key || found[key]) continue;
        found[key] =
          key === "lines"
            ? t("errors.itemsRequired")
            : key === "name"
              ? values.name.trim() ? t("quoteForm.nameTooShort") : t("errors.nameRequired")
              : key === "email"
                ? t("errors.emailInvalid")
                : key === "city"
                  ? t("errors.cityRequired")
                  : key === "phone"
                    ? t("quoteForm.phoneInvalid")
                    : key === "notes"
                      ? t("quoteForm.notesTooLong")
                      : t("errors.generic");
      }
    }
    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    const firstInvalid = FIELD_ORDER.find((k) => found[k]);
    if (firstInvalid) {
      setErrors(found);
      setMessage(unavailable.length > 0 && Object.keys(found).length === 1 ? t("quoteForm.unavailableBlock") : t("quote.checkFields"));
      if (firstInvalid === "lines") {
        const target = unavailable[0];
        setStep(1);
        requestFocus(target ? `quote-remove-${target.id}` : "quote-products-title");
      } else {
        requestFocus(fieldId(firstInvalid));
      }
      return;
    }

    setErrors({});
    setMessage(null);
    setSubmitting(true);
    const payload = buildPayload(values, available, locale);
    idemKey.current ??= newIdempotencyKey();
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey.current },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data: unknown = await res.json();
        const reference = (data as { reference?: unknown })?.reference;
        const serverTotals = (data as { totals?: Partial<QuoteTotals> })?.totals;
        if (typeof reference !== "string" || !serverTotals) throw new Error("bad response");
        setSent({
          reference,
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          city: values.city.trim(),
          totals: {
            products: Number(serverTotals.products ?? totals.products),
            boxes: Number(serverTotals.boxes ?? totals.boxes),
            panels: Number(serverTotals.panels ?? totals.panels),
            areaSqft: Number(serverTotals.areaSqft ?? totals.areaSqft),
          },
          lines: [...lines],
        });
        // The request is stored: clear the basket and the form data now that the success state holds its own copy.
        clearQuote();
        return;
      }
      setMessage(res.status === 429 ? t("errors.rateLimited") : res.status === 422 ? t("quoteForm.unavailableServer") : t("errors.generic"));
    } catch {
      setMessage(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  function editRequest() {
    if (!sent) return;
    for (const l of sent.lines) {
      addToQuote({
        productId: l.productId,
        unit: l.unit,
        quantity: l.quantity,
        rooms: l.rooms,
        plannedAreaSqft: l.plannedAreaSqft,
        source: l.source,
        sourceLabel: l.sourceLabel,
      });
    }
    idemKey.current = null;
    setSent(null);
    setStep(1);
    window.scrollTo({ top: 0 });
  }

  // ---- Success -------------------------------------------------------------
  if (sent) {
    const summaryParts = [
      t("quoteForm.productsCount", { count: sent.totals.products }),
      sent.totals.boxes > 0 ? t("common.box", { count: sent.totals.boxes }) : null,
      sent.totals.panels > 0 ? t("common.panel", { count: sent.totals.panels }) : null,
    ].filter(Boolean);
    return (
      <div className="container-page section-y">
        <section className="panel max-w-[720px] border-success p-6 sm:p-12" aria-labelledby="quote-sent-title">
          <Icon name="checkCircle" size={40} className="text-success" />
          <h1 id="quote-sent-title" ref={sentHeading} tabIndex={-1} className="mt-6 outline-none">
            {t("quote.sentTitle")}
          </h1>
          <p className="mt-4" role="status">
            {t("quote.sentText", { name: sent.name, email: sent.email })}
          </p>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line py-5">
            <dt className="text-ink-muted">{t("quote.reference")}</dt>
            <dd className="num font-semibold">{sent.reference}</dd>
            <dt className="text-ink-muted">{t("quote.products")}</dt>
            <dd>{summaryParts.join(" · ")}</dd>
            {sent.totals.areaSqft > 0 ? (
              <>
                <dt className="text-ink-muted">{t("quote.summaryArea")}</dt>
                <dd className="num">{formatSqft(sent.totals.areaSqft, locale)}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">{t("quote.site")}</dt>
            <dd>{sent.city}</dd>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/" size="lg">
              {t("quote.backHome")}
            </LinkButton>
            <Button variant="secondary" size="lg" onClick={editRequest}>
              {t("quote.edit")}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // ---- Waiting for the stored basket ---------------------------------------
  if (!hydrated) {
    return (
      <div className="container-page section-y">
        {heading}
        <div className="min-h-[320px]" aria-hidden="true" />
      </div>
    );
  }

  // ---- Empty ---------------------------------------------------------------
  if (lines.length === 0) {
    return (
      <div className="container-page section-y">
        {heading}
        <section className="panel mt-8 max-w-[720px] p-6 sm:p-10" aria-labelledby="quote-empty-title">
          <h2 id="quote-empty-title">{t("quote.emptyTitle")}</h2>
          <p className="mt-2 text-ink-muted">{t("quote.emptyText")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/flooring/vinyl" size="lg">
              {t("common.seeProducts")}
            </LinkButton>
            {quote.removed.length > 0 ? (
              <Button variant="secondary" size="lg" icon="rotate" onClick={restoreRemoved}>
                {t("quote.restore")}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const summaryRows = (
    <dl className="divide-y divide-line">
      <SummaryRow label={t("quote.products")} value={String(totals.products)} />
      <SummaryRow label={t("quote.summaryFloors")} value={t("common.box", { count: totals.boxes })} />
      <SummaryRow label={t("quote.summaryPanels")} value={t("common.panel", { count: totals.panels })} />
      {totals.areaSqft > 0 ? <SummaryRow label={t("quote.summaryArea")} value={formatSqft(totals.areaSqft, locale)} /> : null}
    </dl>
  );

  return (
    <div className={cx("container-page section-y", step === 1 && "pb-52 lg:pb-12")}>
      {/* Mobile step bar */}
      <div className="-mt-2 mb-4 flex min-h-[44px] items-center justify-between gap-4 lg:hidden">
        {step === 1 ? (
          <Link href="/flooring/vinyl" className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-ink no-underline">
            <Icon name="arrowRight" className="rotate-180" />
            {t("quote.continueShopping")}
          </Link>
        ) : (
          <button type="button" onClick={() => goStep(1)} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-ink">
            <Icon name="arrowRight" className="rotate-180" />
            {t("quoteForm.backToProducts")}
          </button>
        )}
        <span className="small text-ink-muted">{step === 1 ? t("quote.step1of2") : t("quoteForm.step2of2")}</span>
      </div>

      <div className={cx(step === 2 && "sr-only lg:not-sr-only")}>{heading}</div>

      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-12">
          {/* Products */}
          <section className={cx(step === 2 && "hidden lg:block")} aria-labelledby="quote-products-title">
            <h2 id="quote-products-title" tabIndex={-1} className="outline-none">
              {t("quote.products")}
            </h2>
            <ul className="mt-4 border-t border-line" aria-label={t("quoteForm.reviewedLines")}>
              {lines.map((line) => (
                <LineRow key={line.id} line={line} locale={locale} />
              ))}
            </ul>
            {quote.removed.length > 0 ? (
              <Button variant="ghost" icon="rotate" className="mt-3" onClick={restoreRemoved}>
                {t("quote.restore")}
              </Button>
            ) : null}
            {errors.lines && unavailable.length === 0 ? (
              <p className="small mt-3 flex items-start gap-1.5 text-danger" id="quote-lines">
                <Icon name="alert" size={16} className="mt-0.5" />
                <span>{errors.lines}</span>
              </p>
            ) : null}

            {/* Mobile totals above the sticky bar */}
            <div className="mt-6 space-y-1 lg:hidden">
              <div className="flex justify-between gap-4">
                <span className="text-ink-muted">{t("quote.summaryFloors")}</span>
                <span className="num font-semibold">
                  {t("common.box", { count: totals.boxes })}
                  {totals.areaSqft > 0 ? ` · ${formatSqft(totals.areaSqft, locale)}` : ""}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-ink-muted">{t("quote.summaryPanels")}</span>
                <span className="num font-semibold">{t("common.panel", { count: totals.panels })}</span>
              </div>
            </div>
          </section>

          {/* Project + contact */}
          <form id="quote-form" noValidate onSubmit={onSubmit} className={cx("space-y-12", step === 1 && "hidden lg:block lg:space-y-12")}>
            <h2 id="quote-step2-title" tabIndex={-1} className="outline-none lg:sr-only">
              {t("quoteForm.step2Title")}
            </h2>

            <section aria-labelledby="quote-project-title">
              <h2 id="quote-project-title">{t("quote.project")}</h2>
              <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-3">
                <TextField
                  id={fieldId("projectName")}
                  label={t("quote.projectName")}
                  optionalText={t("quote.optional")}
                  placeholder={t("quoteForm.projectNamePlaceholder")}
                  maxLength={120}
                  autoComplete="off"
                  value={values.projectName}
                  error={errors.projectName}
                  onChange={(e) => update("projectName", e.target.value, "projectName")}
                />
                <Select
                  id={fieldId("type")}
                  label={t("quote.projectType")}
                  value={values.type}
                  onChange={(e) => update("type", e.target.value as Values["type"])}
                >
                  {PROJECT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {t(`quote.${TYPE_KEY[k]}`)}
                    </option>
                  ))}
                </Select>
                <TextField
                  id={fieldId("city")}
                  label={t("quote.siteCity")}
                  helper={t("quote.siteCityHelp")}
                  maxLength={80}
                  autoComplete="address-level2"
                  aria-required="true"
                  value={values.city}
                  error={errors.city}
                  onChange={(e) => update("city", e.target.value, "city")}
                />
                <Select
                  id={fieldId("start")}
                  label={t("quote.start")}
                  value={values.startWindow}
                  onChange={(e) => update("startWindow", e.target.value as Values["startWindow"])}
                >
                  {START_WINDOWS.map((k) => (
                    <option key={k} value={k}>
                      {t(`quote.${START_KEY[k]}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <fieldset className="mt-6 min-w-0 border-0 p-0" aria-describedby="quote-reception-help">
                <legend className="label mb-1">{t("quote.reception")}</legend>
                <div className="flex flex-col">
                  {RECEPTIONS.map((r) => (
                    <Radio
                      key={r}
                      name="reception"
                      value={r}
                      checked={values.reception === r}
                      onChange={() => update("reception", r)}
                      label={t(r === "delivery" ? "quote.delivery" : "quote.pickup")}
                    />
                  ))}
                </div>
                <p id="quote-reception-help" className="small mt-1 text-ink-muted">
                  {t(values.reception === "delivery" ? "quote.deliveryHelp" : "quote.pickupHelp")}
                </p>
              </fieldset>

              <Textarea
                id={fieldId("notes")}
                fieldClassName="mt-6"
                label={t("quote.notes")}
                optionalText={t("quote.optional")}
                placeholder={t("quote.notesPlaceholder")}
                maxLength={MAX_NOTES}
                rows={4}
                value={values.notes}
                error={errors.notes}
                onChange={(e) => update("notes", e.target.value, "notes")}
              />
            </section>

            <section aria-labelledby="quote-contact-title">
              <h2 id="quote-contact-title">{t("quote.contact")}</h2>
              <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-3">
                <TextField
                  id={fieldId("name")}
                  label={t("quote.name")}
                  placeholder={t("quote.namePlaceholder")}
                  maxLength={100}
                  autoComplete="name"
                  aria-required="true"
                  value={values.name}
                  error={errors.name}
                  onChange={(e) => update("name", e.target.value, "name")}
                />
                <TextField
                  id={fieldId("company")}
                  label={t("quote.company")}
                  optionalText={t("quote.optional")}
                  maxLength={120}
                  autoComplete="organization"
                  value={values.company}
                  error={errors.company}
                  onChange={(e) => update("company", e.target.value, "company")}
                />
                <TextField
                  id={fieldId("email")}
                  type="email"
                  inputMode="email"
                  label={t("quote.email")}
                  placeholder="nom@entreprise.ca"
                  maxLength={254}
                  autoComplete="email"
                  aria-required="true"
                  value={values.email}
                  error={errors.email}
                  onChange={(e) => update("email", e.target.value, "email")}
                />
                <TextField
                  id={fieldId("phone")}
                  type="tel"
                  inputMode="tel"
                  label={t("quote.phone")}
                  optionalText={t("quote.optional")}
                  maxLength={30}
                  autoComplete="tel"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(e) => update("phone", e.target.value, "phone")}
                />
                <Select
                  id={fieldId("role")}
                  label={t("quote.role")}
                  value={values.role}
                  onChange={(e) => update("role", e.target.value as Values["role"])}
                >
                  {ROLES.map((k) => (
                    <option key={k} value={k}>
                      {t(`quote.${ROLE_KEY[k]}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <Checkbox
                className="mt-4"
                id={fieldId("marketing")}
                checked={values.marketingOptIn}
                onChange={(e) => update("marketingOptIn", e.target.checked)}
                label={t("quote.marketingOptIn")}
                helper={t("quote.marketingOptInHelp")}
              />

              {/* Honeypot: hidden from people and assistive tech, skipped by the tab key. */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor={fieldId("website")}>{t("quoteForm.honeypotLabel")}</label>
                <input
                  id={fieldId("website")}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
                />
              </div>

              <p className="small mt-6 max-w-2xl text-ink-muted">
                {t("quote.privacyNotice")}{" "}
                <Link href="/privacy" className="inline-flex min-h-[44px] items-center">
                  {t("quoteForm.privacyLinkLabel")}
                </Link>
              </p>
            </section>
          </form>
        </div>

        {/* Summary (desktop: sticky; mobile: after the form on step 2) */}
        <aside className={cx("lg:sticky lg:top-24 lg:self-start", step === 1 && "hidden lg:block")} aria-labelledby="quote-summary-title">
          <div className="panel p-6">
            <h2 id="quote-summary-title">{t("quote.summary")}</h2>
            <div className="mt-4">{summaryRows}</div>
            <p className="small mt-4 text-ink-muted">{t("quote.summaryTaxes")}</p>
            <Button
              type="submit"
              form="quote-form"
              size="lg"
              block
              className="mt-5"
              loading={submitting}
              loadingLabel={t("quote.submitting")}
            >
              {t("quote.submit")}
            </Button>
            {message ? (
              <Alert kind="danger" role="alert" className="mt-4">
                {message}
              </Alert>
            ) : null}
            <p className="small mt-4 text-ink-muted">{t("quote.replyDelay")}</p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky bar, step 1 */}
      {step === 1 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised px-4 pt-3 lg:hidden"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <Button size="lg" block onClick={() => goStep(2)}>
            {t("quote.continueDetails")}
            <Icon name="arrowRight" />
          </Button>
          <p className="small mt-2 text-center text-ink-muted">{t("quote.replyDelay")}</p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="num text-right font-semibold">{value}</dd>
    </div>
  );
}

function LineRow({ line, locale }: { line: QuoteLine; locale: Locale }) {
  const t = useTranslations();
  const product: Product | undefined = getProduct(line.productId);

  if (!product) {
    return (
      <li className="border-b border-line py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-[260px]">
            <p className="font-semibold">{t("quoteForm.unavailableName")}</p>
            <Alert kind="danger" role="alert" title={t("quoteForm.unavailableTitle")} className="mt-2">
              {t("quoteForm.unavailableText")}
            </Alert>
          </div>
          <RemoveButton line={line} name={t("quoteForm.unavailableName")} />
        </div>
      </li>
    );
  }

  const name = productName(product, locale);
  const descriptor =
    product.kind === "panel" ? t("catalog.panelDescriptor") : product.category === "coverings" ? t("catalog.coveringDescriptor") : t("catalog.floorDescriptor");
  const origin = [
    line.rooms && line.rooms.length ? line.rooms.join(", ") : null,
    line.plannedAreaSqft ? t("quoteForm.plannedArea", { area: formatSqft(line.plannedAreaSqft, locale) }) : null,
    line.sourceLabel ?? null,
  ].filter(Boolean);
  const unitLabel = line.unit === "box" ? t("quoteForm.unitBoxes") : line.unit === "panel" ? t("quoteForm.unitPanels") : t("quoteForm.unitArea");

  return (
    <li className="border-b border-line py-5">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(product.image)} alt="" width={88} height={88} className="h-16 w-16 flex-none rounded-sm bg-line object-cover sm:h-[88px] sm:w-[88px]" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-[200px]">
            <p className="font-semibold">{name}</p>
            <p className="small text-ink-muted">{descriptor}</p>
            {origin.length > 0 ? <p className="small text-ink-muted">{origin.join(" · ")}</p> : null}
          </div>
          <div className="flex flex-none items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="label">{unitLabel}</span>
              <QuantityStepper
                value={line.quantity}
                onChange={(n) => setQuantity(line.id, n)}
                decreaseLabel={t("quoteForm.decrease", { name })}
                increaseLabel={t("quoteForm.increase", { name })}
                inputLabel={t("quoteForm.quantityOf", { name })}
              />
            </div>
            <RemoveButton line={line} name={name} />
          </div>
        </div>
      </div>
    </li>
  );
}

function RemoveButton({ line, name }: { line: QuoteLine; name: string }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      id={`quote-remove-${line.id}`}
      onClick={() => removeLine(line.id)}
      aria-label={t("quote.removeItem", { name })}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 self-end rounded-md px-2 font-semibold text-danger hover:underline"
    >
      <Icon name="trash" />
      <span className="hidden sm:inline">{t("quote.remove")}</span>
    </button>
  );
}
