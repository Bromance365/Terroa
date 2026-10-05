import "server-only";
import type { QuoteRequest, QuoteTotals } from "@/lib/quote-schema";

/**
 * Transactional email through Resend's REST API (no SDK, no extra dependency).
 * - Messages are plain text only: no HTML, so user content cannot inject markup.
 * - Subjects carry the reference only; header-bound values are stripped of CR/LF.
 * - The staff notification is sent only when RESEND_API_KEY, MAIL_FROM and QUOTE_NOTIFY_TO are set.
 * - Customer confirmations stay OFF until SEND_CUSTOMER_CONFIRMATIONS=true (needs Vy's go-ahead).
 */
const noCrlf = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

interface Message {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

async function send(msg: Message, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return false;
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: noCrlf(msg.subject), text: msg.text, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

export function staffMessage(reference: string, req: QuoteRequest, totals: QuoteTotals): Omit<Message, "to"> {
  const lines = [
    `Quote request ${reference} (${req.locale})`,
    `Products: ${totals.products} · boxes: ${totals.boxes} · panels: ${totals.panels} · planned area: ${totals.areaSqft} sq ft`,
    "",
    `Project: ${req.project.name ?? "-"} (${req.project.type})`,
    `Site city: ${req.project.city}`,
    `Start: ${req.project.startWindow} · reception: ${req.project.reception}`,
    `Notes: ${req.project.notes ?? "-"}`,
    "",
    `Contact: ${req.contact.name}, ${req.contact.email}`,
    `Company: ${req.contact.company ?? "-"} · phone: ${req.contact.phone ?? "-"} · role: ${req.contact.role}`,
    `Marketing opt-in: ${req.marketingOptIn ? "yes" : "no"}`,
  ];
  return { subject: `New quote request ${reference}`, text: lines.join("\n"), replyTo: req.contact.email };
}

export function customerMessage(reference: string, req: QuoteRequest): Omit<Message, "to"> {
  const fr = req.locale === "fr";
  return {
    subject: fr ? `Demande de soumission ${reference} reçue` : `Quote request ${reference} received`,
    text: fr
      ? `Bonjour ${noCrlf(req.contact.name)},\n\nNous avons bien reçu votre demande ${reference}. Notre équipe vous répondra avec les prix, les taxes et la livraison.\n\nTerroa`
      : `Hello ${noCrlf(req.contact.name)},\n\nWe received your request ${reference}. Our team will reply with pricing, taxes and delivery.\n\nTerroa`,
  };
}

/** Never throws: an email problem must not turn an accepted quote into an error for the visitor. */
export async function notifyQuote(reference: string, req: QuoteRequest, totals: QuoteTotals, fetchImpl: typeof fetch = fetch) {
  const outcome = { staff: false, customer: false };
  try {
    const staffTo = process.env.QUOTE_NOTIFY_TO;
    if (staffTo) outcome.staff = await send({ to: staffTo, ...staffMessage(reference, req, totals) }, fetchImpl);
    if (process.env.SEND_CUSTOMER_CONFIRMATIONS === "true") {
      outcome.customer = await send({ to: req.contact.email, ...customerMessage(reference, req) }, fetchImpl);
    }
  } catch {
    // Logged below without personal data.
  }
  console.info(JSON.stringify({ event: "quote.notified", reference, ...outcome }));
  return outcome;
}
