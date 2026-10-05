/**
 * Retention periods. Proposed by Vy on 5 October 2026 as a starting point; Terroa and counsel must
 * confirm them before launch, and the privacy policy (legal.p5Text) must state the final values.
 */
export const QUOTE_RETENTION_MONTHS = 24;
export const PLAN_RETENTION_DAYS = 30;

export function quoteRetainUntil(from = new Date()) {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + QUOTE_RETENTION_MONTHS);
  return d;
}

export function planDeleteAfter(from = new Date()) {
  return new Date(from.getTime() + PLAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
