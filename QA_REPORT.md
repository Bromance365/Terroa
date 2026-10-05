# QA report — Terroa site, build phase 1 (UI with mock data)

- Date: 5 October 2026 (Montréal time)
- Tested revision: branch `claude/exciting-bell-cevqft`, working tree at the commit that contains this file (see `git log`)
- Environment: cloud sandbox, Node 22, Next.js 16.3 production build served locally with `next start` on http://localhost:3100 (HTTP, not the deployed URL), headless Chromium via Playwright, axe-core 4 (WCAG 2.0–2.2 A/AA + best practice). Fonts are self-hosted (no Google call). Synthetic data only.
- Scope: HANDOFF.md phase 1. No Supabase, email, Anthropic API, analytics or deployment exists. Plan reader and quote submission run on mocks/stubs, identified below. Security and privacy items marked "requirement" are not implemented controls yet.
- Earlier design-stage report (2 October) is superseded by this one; its open findings F1–F5 are carried below.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Lint | PASS | `npm run lint`: 0 errors, 1 warning (anonymous default export in `eslint.config.mjs`, harmless) |
| 2 | Typecheck (strict, `noUncheckedIndexedAccess`) | PASS | `npm run typecheck`: no errors |
| 3 | Unit tests | PASS | `npm test`: 7 files, 67 tests (quantities 16 incl. the 15 originals moved to Vitest, calculator units/import, quote schema, plan-reader compute/types/file validation, FR/EN message parity) |
| 4 | Production build | PASS | `npm run build`: all routes prerendered for `fr` and `en` (static), `/api/quotes` dynamic |
| 5 | All 24 pages load, FR and EN, 1440 px and 390 px | PASS | 48 page loads, HTTP 200 (unknown path 404 with localized page), console clean, no horizontal overflow (`scrollWidth - clientWidth = 0`) on every page |
| 6 | Visual match to the 14 artboards (home, category, product, calculator, plan reader, projects, quote) | PASS (visual review) | Compared renders with `design/screens/*`. Known intentional differences: no dashed "data to confirm" style (HANDOFF.md), quote/calculator start empty instead of the canvas sample values |
| 7 | Accessibility scan | PASS | axe-core on 19 pages × 2 viewports (FR + EN): 0 violations after fixing `landmark-unique` (two language navs) and `region` (mobile sticky bar) |
| 8 | Keyboard | PASS (partial) | Skip link is the first tab stop; filter, stepper, dialog controls are native buttons/inputs; delete dialog and menu use `<dialog>` (Escape closes). Not covered: a full manual keyboard pass with a screen reader — BLOCKED (no AT in sandbox) |
| 9 | Product → basket → toast → header count | PASS | Scripted: 374 pi² → 21 boxes (matches spec), toast "Ajouté à la soumission. Chêne naturel, 21 boîtes. Voir (1)", header label "Soumission, 1 produit" |
| 10 | Language switch lands on the equivalent page | PASS | `/planchers/vinyle/chene-naturel` ⇄ `/en/flooring/vinyl/natural-oak`; `<html lang>` follows the locale |
| 11 | Quote form validation and submit | PASS | Empty submit flags 3 fields and moves focus to the first; valid submit shows "Demande envoyée" with `TR-` + 6 digits (stub reference); basket cleared after success |
| 12 | `/api/quotes` hardening | PASS | Empty body 400, cross-origin 403, non-JSON 415, 30 KB body 413, `Cache-Control: no-store`; server recomputes totals from the catalogue (unit tests). Rate limit is in-memory only (see F6) |
| 13 | Category filters, URL state, search | PASS | `?tone=dark` set instantly and removable chip clears it; header search narrows to 1 result |
| 14 | Calculator maths | PASS | 12 × 10 ft + 10 % at 20 pi²/box → 132 pi², 7 boxes; unit switching does not drift (unit tests); EN page renders |
| 15 | Plan reader (mock) | PASS | PNG accepted; SVG bytes renamed `.png` rejected by magic bytes; verify state shows 944 pi² (sample), per-room flooring, unassigned warning, totals by flooring |
| 16 | Mobile layout: sticky add bar, menu sheet | PASS | Bar pinned to viewport bottom at 390 px; menu `<dialog>` opens |
| 17 | Security headers | PASS (local) | CSP (self only, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options; no `X-Powered-By`. Deployed URL not tested → see check 24 |
| 18 | Secrets in client bundle | PASS | grep of `.next/static` and `.next/server` for `sk-ant-`, `service_role`, `ANTHROPIC_API_KEY`: no match. No secret env vars are read yet |
| 19 | Dependencies | PASS | `npm audit --omit=dev`: 0 vulnerabilities (lockfile committed) |
| 20 | SEO basics | PASS (local) | Unique titles/descriptions, canonical + hreflang (`fr-CA`, `en-CA`, `x-default`) via metadata, sitemap with alternates, robots (disallows `/api/`), JSON-LD Organization/Breadcrumb/Product (no `offers` until prices exist), quote page `noindex`. Rich-results validation BLOCKED (no network tool) |
| 21 | Performance | PARTIAL | Pages are static; fonts self-hosted; home HTML 115 KB, JS ≈ 200 KB gzip (zod removed from the global bundle). No Lighthouse run available → BLOCKED. Temporary SVG illustrations are 30–45 KB each |
| 22 | Persistence | PASS | Basket survives reload (localStorage, validated on load); removal/restore covered by the code path, not by an automated test |
| 23 | French copy reviewed by a Quebec French reader | BLOCKED | Needs a human reviewer |
| 24 | Deployed URL tested | BLOCKED | Nothing is deployed; deployment is outside this task (CLAUDE.md) |
| 25 | Push + pull request | BLOCKED | `git push` returns 403: the Claude GitHub App is not connected for `Bromance365/Terroa`. Work is committed locally on `claude/exciting-bell-cevqft` |
| 26 | Law 25 / privacy controls | N/A (phase 1) | Privacy and terms pages are drafts with bracketed gaps; no personal data is stored or sent anywhere in phase 1 (quote POST is a stub, plan reader is local). Requirements remain in SECURITY_PRIVACY.md |
| 27 | RLS, authorized/denied access, upload storage | N/A (phase 2/3) | No database or storage connected |
| 28 | Prompt-injection / malformed-file tests against the AI | N/A (phase 3) | No model call exists. The plan-reader output schema is already strict and sanitising (unit-tested with hostile values) |

## Open findings

| ID | Severity | Finding | Next step |
|---|---|---|---|
| F1 | Medium (privacy) | The plan reader will send plans to an AI provider outside Quebec | Privacy impact assessment, provider terms and notice wording before phase 3 (SECURITY_PRIVACY.md §5) |
| F2 | Medium (content) | Catalogue, prices, reply delay, delivery terms, contacts, privacy officer, retention periods, legal texts are missing | Vy / Terroa, HANDOFF.md §13. Blocks launch. Placeholders in use: `[PRIX]`, `[Collection]`, `[Ville]`, `[Projet]`, `[Année]`, `[nom, courriel]`, `[délai]`, `[durée]`, `[N]`, `[Téléphone]`, `[Courriel]`, `[Adresse de l'entrepôt]`, `[Heures d'ouverture]`, `[Raison sociale]`, `[à confirmer]`, `[zones et délais]`, `[PDF à fournir]`, `[Photo …]`, legal `[Texte à fournir par Terroa.]` |
| F3 | Low (privacy/perf) | Closed: fonts are self-hosted with `next/font/local` (the sandbox blocks Google Fonts, so `next/font/google` could not build). Same families and files as the spec | None |
| F4 | Low (accessibility) | 12 px label style kept per the design system; contrast passes | Consider 14 px field labels |
| F5 | Low (design) | Dark tokens only used locally (home plan band); site ships light | Keep dark opt-in |
| F6 | Medium (security, phase 2) | Rate limiting is in memory per server instance, resets on deploy and is not shared across serverless instances; there is no bot check yet (Turnstile/hCaptcha) | Shared store + bot check before quotes are stored/emailed |
| F7 | Medium (security, phase 4) | CSP allows `'unsafe-inline'` scripts/styles so pages stay static | Move to nonce or hash-based CSP, accepting dynamic rendering or Next SRI |
| F8 | Low (functional) | Rooms without a flooring choice on the plan reader cannot be sent ("Surfaces à chiffrer"): a quote line needs a product. Warning copy says the team will propose one | Extend `/api/quotes` with product-less area lines in phase 2 |
| F9 | Low (functional) | "Envoyer le plan à l'équipe" links to the quote page without attaching the file; product documents (PDF) and the "Fiche technique" button are placeholders; "Proposer un projet" has no email until `site.emailHref` is set | Phase 2/3 |
| F10 | Low (data) | Mock catalogue: Béton pâle is filed under vinyl (as in the design), coverings lists all floor products; coverage 20 pi² and panel size 24 × 96 po are sample inputs and are the only invented numbers, flagged in `data/products.json` | Replace with the real catalogue |
| F11 | Low (UX) | Plan reader always shows the sample plan and sample rooms for any valid file, with a visible "Démonstration" note | Remove in phase 3 |
| F12 | Low (console) | Browser warns about two `<link rel=preload>` scene images not used shortly after client-side navigation | Drop `fetchPriority` on non-hero images if it persists |
| F13 | Low (a11y verification) | No screen-reader pass; no real-device pass (iOS Safari camera input, Android) | Manual test before launch |
| F14 | Info | Rounding in the plan reader uses round-half-up per room so the sample totals match the design (254 / 138 / 944); the calculator uses the original quantity module | Confirm preferred rounding with Terroa |

## Verdict

**READY for phase 1 review** (UI with mock data): every phase 1 acceptance item that can be verified here passes.

**NOT READY for production**: nothing is deployed or live-tested, F2 content is missing, F1/F6/F7 are open, and checks 23–25 are BLOCKED. Phase 2 (Supabase, email, bot check) must not start before the HANDOFF §13 answers.
