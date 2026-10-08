/**
 * Best-effort checks on PDF bytes before they are stored or forwarded (SECURITY_PRIVACY abuse case 4).
 * The file is never rendered or executed on our side; these checks cut cost and refuse obviously
 * active content. Obfuscated or compressed structures can hide from a byte scan, which is acceptable
 * because the only consumer is the model API.
 */
const ACTIVE = /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|SubmitForm|ImportData)\b/;

export function countPdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  const m = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
  return m ? m.length : 0;
}

export function hasActiveContent(bytes: Uint8Array): boolean {
  return ACTIVE.test(Buffer.from(bytes).toString("latin1"));
}
