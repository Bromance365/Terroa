import type { Locale } from "@/i18n/routing";
import { SQFT_TO_M2 } from "@/lib/quantities";

const tag = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");

/** "1 250,00 $" / "$1,250.00" */
export function formatMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale), { style: "currency", currency: "CAD" }).format(value);
}

export function formatNumber(value: number, locale: Locale, maxFractionDigits = 1) {
  return value.toLocaleString(tag(locale), { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

/** "1 039 pi²" / "1,039 sq. ft." */
export function formatSqft(value: number, locale: Locale) {
  return `${formatNumber(value, locale, 0)} ${locale === "fr" ? "pi²" : "sq. ft."}`;
}

export function formatM2(value: number, locale: Locale) {
  return `${formatNumber(value, locale, 1)} m²`;
}

/** "1 039 pi² (96,5 m²)" */
export function formatAreaBoth(sqft: number, locale: Locale) {
  return `${formatSqft(sqft, locale)} (${formatM2(sqft * SQFT_TO_M2, locale)})`;
}

/** Montreal time, "2 octobre 2026 à 14 h 30" / "October 2, 2026, 2:30 p.m." */
export function formatDateTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}
