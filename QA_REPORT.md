# QA report — Terroa design canvas and Claude Code handoff

- Date: 2 October 2026, evening (Montréal time)
- Tested revision: canvas "Terroa — refonte terroa.ca", artifact version 1790985808-b25b; handoff bundle v0.1
- Environment: cloud sandbox, headless Chromium (Playwright), local copies of DM Sans and Fraunces (Google Fonts is blocked in this sandbox), a local stand-in for the canvas runtime written for this check (not the Design editor itself), axe-core 4, Node 22 test runner
- Scope: design and handoff only. No site code, backend or deployment exists yet. Security and privacy items are requirements, not implemented controls.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Design system installed on the canvas (tokens copy + `designSystems` record) | PASS | Publish lists `project/ds/vy-truong/tokens.json`; `canvas.json` record for "Vy Truong", version 1790981713-e9a3 |
| 2 | Token contrast, light and dark themes | PASS | WCAG ratios on `surface`: ink 15.9 / 15.6, ink-muted 6.4 / 8.3, accent 7.3 / 8.7, copper 4.7 / 6.8, danger 6.2 / 7.9, success 5.7 / 9.4, on-accent on accent 7.7 / 8.6; border-strong 3.8 / 4.8 (controls, 3:1 target). `line` 1.4 is decorative only |
| 3 | Markup of the 14 artboards (closed tags, quoted attributes) | PASS | Local parser: 0 problems in 14 files |
| 4 | Frame sizes match content at 1440 px | PASS | Measured content height vs frame: Fondations 5432/5440, Composants 4301/4320, Accueil 4728/4740, Catégorie 1748/1760, Produit 2742/2760, Soumission 1888/1900, Calculateur 1294/1300, Lecteur 1614/1620, Réalisations 2150/2160 |
| 5 | No horizontal overflow at 390 px on the 9 fluid pages | PASS | Overflow script: none on all 9 (one header overflow found on Accueil and fixed before publishing) |
| 6 | Mobile artboards at 390 × 844, no fake status bar | PASS | `design/screens/10–14` |
| 7 | Accessibility scan, all 14 artboards (WCAG 2.0–2.2 A/AA + best practice) | PASS | axe-core: 0 violations on every artboard; harness confirmed to catch seeded faults (button-name, label, color-contrast) |
| 8 | Quote basket prototype: steppers, typed quantity, remove, empty state, delivery/pickup helper, validation errors, success, edit | PASS (stand-in runtime) | Scripted run: 3 → 2 products, 44 → 52 boxes; errors on name and email; success shows "2 produits · 52 boîtes"; no runtime errors |
| 9 | Calculator prototype: waste, units, rooms, errors, panels | PASS (stand-in runtime) | 944 pi² → 1 039 pi² → 52 boîtes; 15 % → 55; metric 100,9 m²; switching back restores 944 exactly; invalid input flagged; missing coverage handled; panels 6 |
| 10 | Plan reader prototype: include toggle, flooring per room, totals, unassigned warning | PASS (stand-in runtime) | 944 → 1 040 pi² with bathroom; warning lists Corridor, Salle de bain, Entrée; cleared when all assigned |
| 11 | Gallery prototype: filters and share | PASS (stand-in runtime) | Counts 6 / 3 / 1 / 2; aria-pressed updates; "Lien copié" |
| 12 | Rendering inside the live Design canvas editor | BLOCKED | No signed-in browser in this session. The real runtime may differ from the stand-in on state-driven style values and controlled selects. Needs a visual pass on the canvas. Not required for build phase 1, which works from the source files and PNG renders |
| 13 | Quantity module unit tests | PASS | `node --experimental-strip-types --test`: 15 / 15 |
| 14 | FR / EN copy files in sync | PASS | 283 keys each, same key set |
| 15 | French copy reviewed by a Quebec French reader | BLOCKED | Needs a human reviewer |
| 16 | English screens | N/A | Design stage: English copy drafted in `messages/en-CA.json`, layouts are shared |
| 17 | No invented business facts | PASS | Prices, specs, delays, addresses, contacts, project names and testimonials are bracketed placeholders (most frequent: `[PRIX]` ×15, `[Ville]` ×14, `[Projet]` ×13, `[à confirmer]` ×10, `[nom, courriel]` ×7, `[délai]` ×6). Sample inputs (944 pi², 20 pi² par boîte, 24 × 96 po) are identified as examples in HANDOFF.md |
| 18 | Supabase Canada region claim in SECURITY_PRIVACY.md | PASS | supabase.com/docs/guides/platform/regions lists Canada (Central) `ca-central-1`; AWS region described as near Montréal (help.ardoq.com Canadian data residency article) |
| 19 | Security and privacy controls | N/A | Nothing built; requirements and tests listed in SECURITY_PRIVACY.md |

## Open findings

| ID | Severity | Finding | Owner / next step |
|---|---|---|---|
| F1 | Medium (privacy) | The plan reader sends plans to an AI provider outside Quebec; plans can contain names and addresses, and phone photos can carry GPS data | Privacy impact assessment, provider terms and notice wording before phase 3 (SECURITY_PRIVACY.md §5) |
| F2 | Medium (content) | Catalogue, prices, reply delay, delivery terms, contacts, privacy officer and retention periods are missing | Terroa / Vy, HANDOFF.md §13; blocks launch, not phase 1 |
| F3 | Low (privacy, performance) | The canvas loads fonts from Google Fonts | Production self-hosts them with `next/font` (already in CLAUDE.md) |
| F4 | Low (accessibility) | Field labels use the system's 12 px label style; contrast passes but the size is small for site use | Consider 14 px field labels in the design system |
| F5 | Low (design) | Dark tokens exist but the pages were only reviewed in light | Keep dark opt-in until reviewed |

## Verdict

READY — for Claude Code build phase 1 (UI with mock data). The one blocked check (#12) does not affect phase 1.
The production site is NOT READY: it is not built, and launch depends on F1 and F2.
