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
| 3 | Unit tests | PASS | `npm test`: 8 files, 76 tests (67 at phase 1 + 9 server-side) (quantities 16 incl. the 15 originals moved to Vitest, calculator units/import, quote schema, plan-reader compute/types/file validation, FR/EN message parity) |
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
| F2 | Medium (content) | Catalogue, prices, reply delay, delivery terms, contacts, privacy officer, retention periods, legal texts are missing | Vy / Terroa, HANDOFF.md §13. Blocks launch. Placeholders in use: `[Collection]`, `[Ville]`, `[Projet]`, `[Année]`, `[nom, courriel]`, `[délai]`, `[durée]`, `[N]`, `[Téléphone]`, `[Courriel]`, `[Adresse de l'entrepôt]`, `[Heures d'ouverture]`, `[Raison sociale]`, `[à confirmer]`, `[zones et délais]`, `[PDF à fournir]`, `[Photo …]`, legal `[Texte à fournir par Terroa.]` |
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

## Phase 2 additions (5 October 2026, evening) — code ready, nothing connected

Decisions from Vy: prices hidden ("Prix sur soumission"), hosting Vercel, retention quotes 24 months and plans 30 days (proposed starting point, to be confirmed by Terroa and counsel), email via Resend.

| # | Check | Result | Evidence |
|---|---|---|---|
| 29 | Quote persistence layer (`src/lib/server/quote-repository.ts`) | PASS (fake client) | Unit tests: no-database fallback, request then items insert with `retain_until`, marketing consent timestamp only when opted in, idempotent replay returns the first reference, compensating delete when items fail |
| 30 | Email (`src/lib/server/mailer.ts`, Resend REST) | PASS (mocked fetch) | Plain text only, subject carries the reference only, no send and no throw when unconfigured, staff only unless `SEND_CUSTOMER_CONFIRMATIONS=true` (off by default) |
| 31 | Retention job + cron route | PASS (fake client) / route fails closed | Removes expired plan files, keeps an audit timestamp, purges expired quotes; `GET /api/cron/retention` returns 503 without `CRON_SECRET`, 401 on a wrong bearer (timing-safe compare) |
| 32 | Browser regression after changes | PASS | Scripted flows re-run: all PASS; `/api/quotes` returns a reference in no-database mode and logs `stored:false` with no personal data |
| 33 | Service-role key stays server-side | PASS | `server-only` import on all server modules (client import fails the build); build output grep for key names still empty |
| 34 | Supabase schema + RLS against a real project | PASS | Migration applied to project `yceqveccwdmzgkkamupi` (ca-central-1); RLS enabled on all 7 tables; buckets `product-media` (public) and `plans` (private); security advisor: 0 findings |
| 35 | Authorized/denied access (anon, non-staff, staff roles) | PASS (SQL role simulation) | 11 checks, fixtures rolled back: anon reads published products/consented projects only, 0 rows from quote tables, insert and update denied; non-staff 0 quote rows; staff sees quotes and drafts. Not tested through the REST API with real Auth users (needs staff accounts) |
| 36 | Real email delivery, SPF/DKIM on the sending domain | BLOCKED | Needs Resend account, verified domain, `MAIL_FROM`, `QUOTE_NOTIFY_TO` |
| 37 | Vercel cron execution | BLOCKED | Not deployed; `vercel.json` schedules `0 7 * * *` UTC |

New finding F16 (Low): the quote API runs in no-database mode until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel (checks 36–37 stay BLOCKED).

Updated findings: F2 now excludes prices (hidden by decision) and retention values (proposed, not final); F6 still open (rate limiter in memory, no bot check); new F15 (Medium): privacy policy still says `[durée]` and `[N] jours` until Terroa confirms the retention periods in `src/lib/retention.ts`.

Verdict unchanged: **READY for review, NOT READY for production** (checks 23–25 and 34–37 BLOCKED).

## Phase 3 additions (5 October 2026) — plan reader backend, off by default

Approved by Vy: Anthropic as the provider for the plan reader. Not yet decided or done: the model name (`ANTHROPIC_MODEL` is required, no default; `claude-opus-5-5` suggested) and the privacy impact assessment (EFVP), so the live reader stays disabled until `PLAN_READER_ENABLED=true`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 38 | Test suite | PASS | `npm test`: 10 files, 98 tests (22 new: server plan service/model/guards, client analyzer) |
| 39 | Contract: `POST /api/plans`, `POST /api/plans/{id}/analyze`, `DELETE /api/plans/{id}` | PASS (fakes) | Type/size rejected before the database; random storage key; token stored as SHA-256 only and compared in constant time; wrong token = 404; one analysis per upload (409); upload deleted by token; all routes 503 when not enabled (verified on the production build) |
| 40 | Malformed and hostile files | PASS (unit) | SVG renamed to an image: refused by magic bytes; PDF with JavaScript/EmbeddedFile: refused; PDF over 10 pages: refused; non-image bytes: refused by sharp |
| 41 | EXIF / GPS in photos | PASS (unit) | A JPEG with GPS EXIF comes out of `cleanImage` with no EXIF; the stored copy is replaced by the cleaned one |
| 42 | Prompt injection and untrusted output | PASS (unit) | System prompt states document text is data and the only output is the schema; request uses structured outputs (no forced `tool_choice`, which current models reject), no sampling params; hostile output (RTL override, 99 999 ft, negative, out-of-range bbox, extra fields) is sanitised, dimensions become null and the room "illegible"; refusal, truncation and garbage return "unreadable" |
| 43 | Model call against the real API | BLOCKED | No `ANTHROPIC_API_KEY` in this session and no model decision; spending real money needs approval |
| 44 | Signed upload to the private bucket, real deletion, retention job on real rows | BLOCKED | Needs the service-role key in an environment (Vercel) |
| 45 | Prompt-injection fixture against the real model | BLOCKED | Same as 43 |

New findings: **F17 (Medium, privacy)**: the EFVP and written provider terms are still required before `PLAN_READER_ENABLED=true`; **F18 (Low)**: PDFs have no on-page preview in live mode (no renderer), only images show under the overlays; **F19 (Low)**: refusal fallbacks (`fallbacks: "default"`) are not implemented, a refusal shows the "unreadable" state; **F20 (Low)**: PDF page count and active-content checks are byte scans (best effort).

## Visual polish pass (6 October 2026)

Preserve-mode redesign: tokens, fonts and palette unchanged; composition, motion and surfaces improved. No functional change.

| # | Check | Result | Evidence |
|---|---|---|---|
| 46 | Home recomposition | PASS (visual) | "Trois façons" is one lead card plus two supporting cards, categories and projects use asymmetric grids (no three equal tiles, no empty grid cells) |
| 47 | Motion is motivated and safe | PASS | Hero entrance (hierarchy), card lift and button press (feedback), section reveals (reading order), header shadow after scroll. CSS only (scroll-driven animations where supported, plain visible content elsewhere), all inside `prefers-reduced-motion: no-preference`; verified a real scroll shows the reveal and a reduced-motion render shows everything |
| 48 | Mobile product grids | PASS | Two columns under 640 px on home and category pages, no horizontal overflow at 390 px |
| 49 | Regression | PASS | lint 0 errors, 98 tests, build, axe 0 violations (19 pages x 2 viewports), scripted browser flows all PASS |
| 50 | Imagery | OPEN (F21, Medium) | Illustrations are still the temporary SVG scenes; real photography is the largest remaining visual gap. AI image generation was not run (costs credits, needs approval) |
| 51 | Browser console | PASS with note | Uploading a plan while the plan reader is disabled logs one expected 503 before falling back to the demo |

## Measure tool and 3D preview (6 October 2026)

PlanScope-style tools adapted to Terroa (`/mesurer`, `/en/measure`). Plan stays in the browser: no upload, no storage, no network call. The Materio-Direct pricing tool was not imported (another company's costs and margins).

| # | Check | Result | Evidence |
|---|---|---|---|
| 52 | Scale, detection, areas | PASS | Real Chromium, synthetic two-room PDF (1000 px = 40 ft): scale set by drag, click-to-detect Salon = 465 sq ft (expected 430-500), second click adds Chambre, list shows 2 rooms |
| 53 | PDF rendering under production CSP | PASS | pdf.js legacy build (v6 non-legacy needs very recent JS); same-origin worker, no console errors |
| 54 | 3D preview | PASS with note | Lazy-loaded three.js canvas mounts for the measured rooms; only swiftshader GPU performance warnings in headless Chromium |
| 55 | Accessibility, overflow | PASS | axe 0 violations on `/mesurer` and `/en/measure` (1440 and 390), no horizontal overflow at 390 px |
| 56 | Regression | PASS | lint 0 errors, typecheck, 167 tests, build |

Fixed during testing: door-bridging radius was capped at 48 px, so doorways over about 3 ft failed to seal on large bitmaps ("leak"); cap raised to 72.

New findings: **F22 (Low)**: detection runs on the main thread (about 1 s on large plans); **F23 (Low)**: no vertex editing of a detected room (redraw or adjust by dimensions); **F24 (Low)**: touch gestures untested on a real device; **F25 (Low)**: 3D walls are indicative only and the figures are not a quote.

## Verdict

**READY for phase 1 review** (UI with mock data): every phase 1 acceptance item that can be verified here passes.

**NOT READY for production**: nothing is deployed or live-tested, F2 content is missing, F1/F6/F7 are open, and checks 23–25 are BLOCKED. Phase 2 (Supabase, email, bot check) must not start before the HANDOFF §13 answers.
