# CLAUDE.md — Terroa website (terroa.ca)

## Context

Terroa sells premium vinyl flooring, floor coverings and acoustic panels to Quebec professionals. This repository rebuilds terroa.ca as a quoting tool: catalogue, quote basket (no online payment), quantity calculator, AI plan reader, projects gallery. Owner: Vy Truong. Keep Terroa separate from Vy's other businesses: no shared data, keys, storage, colours or copy.

## Read before coding

1. `HANDOFF.md` — routes, layout, tokens, components, screen specs, data model, server contracts, build phases.
2. `SECURITY_PRIVACY.md` — data inventory, trust boundaries, abuse cases, required controls, Law 25 checklist.
3. `design/screens/*.png` — full-page renders of every artboard (desktop 1440 px, mobile 390 px).
4. `design/tokens.css` — CSS variables + Tailwind v4 `@theme`. `design/tokens.json` is the source.
5. `messages/fr-CA.json`, `messages/en-CA.json` — UI copy (ICU format, identical keys).
6. `src/lib/quantities` — finished quantity maths with tests. Reuse it; do not rewrite it.
7. `design/artboards/*.dc.html` — the canvas sources, for exact values (padding, sizes, copy). Reference only: do not import or ship them.

## Stack

Next.js App Router · TypeScript strict · Tailwind CSS v4 · next-intl · Supabase (Postgres, Storage, Auth for staff) · Anthropic Messages API for the plan reader, server-side only, model from `ANTHROPIC_MODEL` · zod for every server input · Vercel or Netlify (not decided). Fonts with `next/font/google` (Fraunces, DM Sans), self-hosted.

## Rules

- French first at `/`, English at `/en`, localized slugs, `hreflang` alternates, `lang` set correctly. Both languages written natively.
- Never invent prices, specs, coverage, delays, addresses, phone numbers, testimonials, statistics or legal text. Keep the `[bracketed]` placeholders from the design, and list them in the QA report.
- Design tokens only — no hex values in components. One primary action per region. `copper` at most once per screen. Status colours always paired with a word or icon. Touch targets ≥ 44 px. Label style: sentence case in French, CSS uppercase in English.
- Quantities and totals are recomputed on the server; client numbers are display only.
- Secrets stay server-side (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, email and bot-check secrets). Nothing secret behind `NEXT_PUBLIC_`.
- RLS on every table. Anonymous users can read published catalogue rows only.
- No personal data or plan content in logs, analytics or error reports. Use synthetic test data.
- Plan-reader output is untrusted: schema-validate, clamp, recompute, show for user verification.
- Code, comments and commit messages in English.

## Do not, without Vy's explicit go-ahead

Deploy to production · send email to real customers · connect a live payment system · change the AI provider or downgrade the model · add tracking pixels or cookies that need consent · publish project photos without `consent_on_file` · delete data outside the test environment · change DNS.

## Definition of done (every change)

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and fix failures. Check the affected pages at 1440 px and 390 px in French and English, keyboard only, and with the browser console open. Review the diff. Update `QA_REPORT.md`: each check PASS, FAIL, BLOCKED or N/A with evidence, then READY, NOT READY or BLOCKED. Missing tools, credentials or evidence mean BLOCKED. Never call anything live until the deployed URL has been tested.
