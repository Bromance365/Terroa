/**
 * Business facts Terroa must supply (HANDOFF.md section 13). Kept as bracketed placeholders
 * on purpose; nothing here is invented. Replace before launch.
 */
export const site = {
  name: "Terroa",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://terroa.ca",
  phone: "[Téléphone]",
  phoneHref: null as string | null, // e.g. "tel:+15145550123" once confirmed
  email: "[Courriel]",
  emailHref: null as string | null, // e.g. "mailto:projets@terroa.ca" once confirmed
  address: "[Adresse de l'entrepôt]",
  hours: "[Heures d'ouverture]",
  legalName: "[Raison sociale]",
  privacyOfficer: "[nom, courriel]",
} as const;
