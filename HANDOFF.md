# Terroa — design handoff to Claude Code

Version 0.1 · 2 October 2026 · Owner: Vy Truong
Source of truth for visuals: the Design canvas "Terroa — refonte terroa.ca"
(https://claude.ai/code/artifact/2288c354-4e9a-4dc7-bb26-75b7bd7519ab). A copy of every artboard is in `design/artboards/`, full-page renders are in `design/screens/`.

## 1. Overview

Terroa sells premium vinyl flooring, floor coverings and acoustic panels to Quebec professionals (contractors, interior designers, architects, property managers). The current terroa.ca exposes little more than that positioning. The new site turns it into a quoting tool:

1. **Catalogue** — browse by category, filter, open a product sheet with specs and documents.
2. **Quote basket** — collect products and quantities, describe the project, send a quote request. **No online payment.** Prices, taxes (GST/QST) and delivery come back in Terroa's quote.
3. **Calculator** — rooms × dimensions + waste → boxes of flooring; walls → acoustic panels.
4. **Plan reader** — upload a floor plan (PDF/JPG/PNG or phone photo); an AI model reads rooms and dimensions; the user checks every room, assigns a product per room and sends the areas to the basket.
5. **Projects gallery** — completed projects with the products used ("add these products to my quote") and a share action.

French first at `/`, English under `/en`. Mobile first: pros use the calculator and the plan reader on site.

### What is placeholder

Everything in square brackets on the canvas (`[PRIX]`, `[délai]`, `[adresse]`, `[Collection]`, `[à confirmer]`…) is a fact Terroa must supply. On the canvas these use a dashed "data to confirm" style; that style must **not** ship. Product names (Chêne naturel, Chêne fumé, Noyer, Frêne blanchi, Chêne gris, Béton pâle, Lattes chêne/noyer/noires) are stand-ins for the real catalogue. All imagery (`design/assets/*.svg`) is temporary illustration. Example quantities (944 sq ft, 52 boxes, 20 sq ft per box, 24 × 96 in panels) are sample inputs, not product data. See section 13 for the full list of facts to collect.

## 2. Stack and project rules

Next.js App Router · TypeScript (strict) · Tailwind CSS v4 · Supabase (Postgres, Auth for staff, Storage) · Anthropic API for the plan reader (server only) · deploy on Vercel or Netlify (decision open). Self-host fonts with `next/font/google` (Fraunces, DM Sans). i18n with `next-intl` (`messages/fr-CA.json`, `messages/en-CA.json`, 283 keys each, ICU plurals). Quantity maths is done: `src/lib/quantities` (pure TS, 15 passing tests) — reuse it on client and server.

## 3. Information architecture and routes

| Page | FR route (default, no prefix) | EN route | Canvas artboard |
|---|---|---|---|
| Home | `/` | `/en` | `Home.dc.html`, `MobileHome.dc.html` |
| Category | `/planchers/vinyle` · `/panneaux-acoustiques` · `/revetements` | `/en/flooring/vinyl` · `/en/acoustic-panels` · `/en/floor-coverings` | `Category.dc.html` |
| Product | `/planchers/vinyle/[slug]` | `/en/flooring/vinyl/[slug]` | `Product.dc.html`, `MobileProduct.dc.html` |
| Quote basket | `/soumission` | `/en/quote` | `QuoteBasket.dc.html`, `MobileQuote.dc.html` |
| Calculator | `/calculateur` | `/en/calculator` | `Calculator.dc.html`, `MobileCalculator.dc.html` |
| Plan reader | `/lecteur-de-plans` | `/en/plan-reader` | `PlanReader.dc.html`, `MobilePlanReader.dc.html` |
| Projects | `/realisations` (+ `/realisations/[slug]` later) | `/en/projects` | `Gallery.dc.html` |
| Legal | `/confidentialite`, `/conditions` | `/en/privacy`, `/en/terms` | footer links |

Every page links to its counterpart in the other language (localized slugs, `hreflang` alternates). The language link goes to the equivalent page, never to the home page.

## 4. Layout

- Container: `max-width: var(--container-max)` (1280 px), side gutter `var(--gutter)` = `clamp(16px, 4vw, 32px)`.
- Section rhythm on desktop: 96 px between major sections (3 × `space-8`), 64 px inside heroes and two-column blocks (2 × `space-8`), 32 px between a section title and its content (`space-8`). On mobile: 32 px between sections.
- Grids use `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))` so they collapse without breakpoints: product cards 260 px, category/project tiles 320–340 px, tool cards 320 px, form fields 260 px.
- Sidebars (category filters, quote summary, calculator result, plan viewer) sit in a `flex-wrap` row: main column `flex: 999 1 560–640px`, side column `flex: 1 1 260–380px`. They stack under the main column on narrow screens. Side columns with results are `position: sticky; top: 88px` on desktop.

| Breakpoint | Behaviour |
|---|---|
| ≥ 1024 px | Full header nav; two-column layouts side by side. |
| 900–1023 px | Header nav still visible; side columns may wrap below. |
| < 900 px | Header shows wordmark, search, quote button (icon + count) and a menu button; nav and language links move into the menu sheet. |
| < 640 px (mobile) | One column; primary actions full width; sticky bottom action bar on product, calculator and quote screens (see mobile artboards). |

## 5. Design tokens

`design/tokens.css` holds the CSS variables and the Tailwind v4 `@theme` mapping; `design/tokens.json` is the source file from the design system. Use tokens, never hex values.

| Token | Light | Usage |
|---|---|---|
| `surface` | #faf8f4 | Page background |
| `surface-raised` | #ffffff | Cards, inputs, panels, sticky bars |
| `ink` | #1b1d22 | Text, selected chips (fill) |
| `ink-muted` | #565b66 | Secondary text, helper text (min 14 px) |
| `line` | #d9d4ca | Dividers and card hairlines only |
| `border-strong` | #7a7f8a | Inputs, outline buttons, unselected chips (3:1) |
| `accent` | #0b5d57 | Primary buttons, links, focus ring, included rooms |
| `on-accent` | #ffffff | Text/icons on accent |
| `copper` | #b4531f | One emphasis per screen: hero phrase, calculator result, included area |
| `danger` | #b3261e | Errors, remove actions (always with a word or icon) |
| `success` | #0b6b8a | Confirmations, "high confidence" (always with a word or icon) |

Dark values exist for every token (see tokens.css). The public site ships light; dark stays opt-in (`[data-theme="dark"]`) until Vy decides. The home page's plan-reader band reuses the dark tokens locally (`.theme-dark` on the section) while the plan image keeps light tokens (`.theme-light`).

| Type style | Spec | Used for |
|---|---|---|
| `display` | Fraunces 600, 56/60 | Home hero only (mobile: use `h1` size) |
| `h1` | Fraunces 600, 36/42 | Page titles, big numbers on mobile |
| `h2` | Fraunces 600, 24/30 | Section titles, card titles in tiles |
| `body` | DM Sans 400, 16/24 | All copy; 16 px minimum on mobile |
| `small` | DM Sans 400, 14/20 | Helper text, captions, table cells |
| `label` | DM Sans 600, 12/16, +0.06em | Field labels, overlines. Sentence case in French; `text-transform: uppercase` in English only |

Numbers that people compare (quantities, areas, totals) use `font-variant-numeric: tabular-nums`. Spacing tokens `space-2/4/6/8` = 8/16/24/32 px (Tailwind `2/4/6/8`). Radius: `radius-sm` 6 px inputs and tags, `radius-md` 10 px buttons and cards, `radius-lg` 16 px panels and feature blocks. Pills (chips, count badges) are fully rounded.

## 6. Components

All shown on the `Components` artboard. Build them as React server components where possible; client components only where marked.

| Component | Variants | Props (main) | Notes |
|---|---|---|---|
| `Button` / `LinkButton` | primary, secondary (outline), ghost, danger; size `md` 44 px, `lg` 52 px | `variant`, `size`, `icon`, `loading`, `disabled` | One primary per screen region. `LinkButton` renders `<a>`; never nest a button in a link. Loading: label "Envoi en cours…", `aria-busy`, disabled. |
| `IconButton` | outline, ghost | `label` (required → `aria-label`), `icon` | 44 × 44 minimum. |
| `TextField` | default, error, with unit suffix | `label`, `helper`, `error`, `suffix` (`pi`, `pi²`, `m`, `po`, `mm`), `inputMode` | Visible label (label style). Error: 2 px `danger` border + message with icon below, linked by `aria-describedby`, `aria-invalid`. Decimal fields accept comma or point. |
| `Select` | default | `label`, `options` | Native `<select>` with custom chevron (`appearance: none` + inline SVG). |
| `Textarea` | default | `label`, `rows` | Resizable vertically. |
| `Checkbox`, `RadioGroup` | — | `label`, `checked` | Native inputs, 20 px, `accent-color: var(--accent)`, row min-height 44 px. Marketing opt-in is unchecked by default. |
| `SegmentedControl` (client) | 2–3 options | `options`, `value`, `onChange` | Buttons with `aria-pressed`. Used for floor/panels and imperial/metric. |
| `FilterChip` (client) | selected / unselected / removable | `label`, `pressed` | Selected = `ink` fill + check icon (not colour alone). Removable chip has `aria-label="Retirer le filtre …"`. |
| `SwatchPicker` | — | `items` (image, name, href) | 48 px swatches, selected ring `0 0 0 2px surface, 0 0 0 4px ink`. Each tone is its own product URL. |
| `QuantityStepper` (client) | — | `value`, `min=1`, `max=9999`, `unit` | − / input / +; − disabled at min; input accepts digits only. |
| `Badge` | confidence high / check / illegible; excluded; new | `kind` | Icon + word, never colour alone. |
| `Alert` | info, success, danger | `title`, `children` | Icon + bold lead sentence. |
| `Toast` (client) | — | `message`, `action` | `ink` background; "Ajouté à la soumission. Chêne naturel, 21 boîtes. Voir (3)". Polite live region, 5 s, pauses on hover/focus. |
| `SiteHeader` | desktop, mobile | `currentSection`, `quoteCount` | Sticky. Quote button shows count; `aria-label="Soumission, 3 produits"`. Skip link first in tab order. |
| `Breadcrumb` | — | `items` | `<nav aria-label="Fil d'Ariane">` + `<ol>`, last item `aria-current="page"`. |
| `ProductCard` | floor, panel | `product` | Image 1:1, name, short descriptor, price display (see 9.3), add button with `aria-label="Ajouter {name} à la soumission"`. |
| `CategoryTile`, `ProjectTile`, `ToolCard` | — | — | See Home. Project tiles show products used. |
| `QuoteLineItem` (client) | floor (boxes), panel (panels) | `item` | Image, name, kind, origin note ("Salon, cuisine · 374 pi² prévus · plan RDC"), stepper, remove. |
| `QuoteSummary` | — | `totals` | Products, floor boxes, panels, planned area, tax note, submit. |
| `CalculatorRoomRow` (client) | — | `room`, `units` | Name, length, width, computed area, remove; inline error under the row. |
| `CalculatorResult` | floor, panels | `result` | Copper big number with `aria-live="polite"`. |
| `UploadDropzone` (client) | desktop (drag and drop), mobile (camera first) | `accept`, `maxBytes` | Mobile: `<input type="file" accept="image/*,application/pdf" capture="environment">` behind "Prendre une photo du plan"; a second input without `capture` behind "Choisir un fichier". |
| `PlanViewer` (client) | — | `imageUrl`, `rooms` | Page image with room overlays positioned from `bbox` percentages; numbered markers; zoom in/out buttons. |
| `DetectedRoomRow` (client) | included / excluded; high / check / illegible | `room` | Include checkbox, number, name, printed dimensions, area, confidence badge, flooring select, reason note. |
| `SiteFooter` | full (home), compact (other pages) | — | Must show the privacy officer's title and contact (Law 25). |

## 7. Screens

### 7.1 Home (`Home.dc.html`, `MobileHome.dc.html`)

Order: header → hero (copy left, 4:5 project photo right with "Dans cette pièce" product chip linking to the two products shown) → "Trois façons de commencer" (catalogue, calculator, plan reader) → "Nos produits" (3 category tiles) → "Sélection" (4 product cards) → plan-reader band (dark tokens, plan image with 3 sample overlays, 3 numbered steps) → "Réalisations" (3 project tiles) → "Comment fonctionne la soumission" (3 steps) → CTA panel (quote + phone) → full footer.

- Hero copy (FR): "Planchers et panneaux acoustiques *haut de gamme* pour les pros du Québec" — the italic phrase is the page's single copper emphasis.
- Primary action everywhere on the page: "Demander une soumission". Secondary: "Téléverser un plan".
- Mobile: hero title at `h1` size, both CTAs full width at 52 px, then the photo, then the three starts as list rows.

### 7.2 Category (`Category.dc.html`)

Breadcrumb, H1 + lead, shortcut links to calculator and plan reader, then filters (left) + results (right).

- Filters: Ton (Pâle, Moyen, Foncé, Gris, with swatches), Format (Planche, Tuile grand format), Type de pose (Clic flottant, À coller), Usage (Résidentiel, Commercial léger, Commercial). **Facet list to confirm with the real catalogue.** Filters update the URL query string (shareable, crawlable canonical without params).
- Toolbar: result count (`h2` for screen readers), removable active-filter chips, sort select.
- Grid of product cards, a full-width plan-reader promo card after the first rows, then "Afficher plus de produits" with "6 produits sur [N]" (load more, no infinite scroll).
- Empty state: "Aucun produit ne correspond à ces filtres." + "Retirer tous les filtres".
- Below 900 px the filter column stacks above results; build it as a "Filtres" button opening a bottom sheet (`<dialog>`), with an "Afficher N produits" apply button.

### 7.3 Product (`Product.dc.html`, `MobileProduct.dc.html`)

Gallery (main 4:3 image + 4 thumbnails as buttons with `aria-pressed`) and buy panel:

- Overline "Plancher de vinyle · [Collection]", H1 name, price line (see 9.3), tone swatches (each tone links to its own product URL), key facts (format, coverage per box, installation).
- Quantity panel: "Surface à couvrir" (sq ft) → computed boxes in the stepper (waste 10 % default, rounded up, using the product's coverage), helper "374 pi² + 10 % de perte, arrondi à la boîte supérieure." + link "Calculer pièce par pièce". The stepper stays editable; editing boxes does not rewrite the area.
- Primary "Ajouter à la soumission" (52 px) → adds the line and shows the toast; secondary "Fiche technique (PDF)".
- Info rows: delivery or pickup ([zones et délais]), technical question ([Téléphone]).
- Section nav (in-page anchors): Caractéristiques (definition list), Documents (PDF list with download icon), Réalisations (projects that use the product), "Autres tons de la collection".
- Mobile: sticky bottom bar with stepper + "Ajouter à la soumission" and the line "374 pi² + 10 % de perte · Recalculer".

### 7.4 Quote basket (`QuoteBasket.dc.html` — working prototype, `MobileQuote.dc.html`)

- Lines: image, name, kind, origin note, quantity stepper (boxes or panels), remove. Removing the last line shows the empty state with "Voir les produits" and "Rétablir les produits retirés".
- "Le projet": project name (optional), type, site city (required — city only, not the street address: data minimisation), start window, receiving (delivery to site vs warehouse pickup; the helper text switches), notes.
- "Vos coordonnées": name (required), company (optional), email (required), phone (optional), role. Marketing opt-in checkbox, unchecked by default, separate from the quote. Privacy notice under the fields with link to the policy.
- Summary (sticky): products count, floor boxes, panels, planned area, tax note, "Envoyer la demande", reply delay.
- Validation on submit (server repeats it): name ≥ 2 chars, valid email, city ≥ 2 chars, at least one line. Errors appear next to each field and a summary message under the submit button; focus moves to the first invalid field.
- Success state replaces the form: "Demande envoyée", recipient email, reference `TR-[numéro]`, totals, city, "Retour à l'accueil", "Modifier la demande".
- The basket lives in `localStorage` (no account needed) and is re-validated against the catalogue on load (deleted or unpublished products are flagged, not silently dropped).
- Mobile is two steps: products (step 1) → project and contact details (step 2), sticky "Continuer : projet et coordonnées".

### 7.5 Calculator (`Calculator.dc.html` — working prototype, `MobileCalculator.dc.html`)

- Mode: Plancher / Panneaux acoustiques. Units: `pi · po` / `m · mm`. Switching units converts the display only: values keep the unit they were typed in, so switching back and forth never drifts.
- Floor: room rows (name, length, width, computed area, remove), "Ajouter une pièce", net total; waste 5 / 10 / 15 % (default 10 %); coverage per box (prefilled from the chosen product; editable).
- Panels: wall rows (name, width, height, panel count), panel width and height (prefilled from the product).
- Result card: big number (boxes or panels) in copper, net area, waste, area to order with the other unit in brackets, coverage; "Ajouter à la soumission", "Téléverser un plan à la place".
- Rules (implemented in `src/lib/quantities`): order area rounded up to 1 sq ft / 0.1 m²; boxes rounded up; panels whole per wall; invalid rows excluded and flagged; limits 1 000 ft per dimension, 100 000 sq ft total, 60 rooms, 30 walls.
- Rooms imported from the plan reader show "Importées du plan RDC · Revoir dans le lecteur".
- Mobile: room cards with an edit button, waste as three equal buttons, sticky result bar "52 boîtes · 1 039 pi² · 20 pi² par boîte" + "Ajouter".

### 7.6 Plan reader (`PlanReader.dc.html` — working prototype for step 2, `MobilePlanReader.dc.html` for step 1)

States, in order:

1. **Upload** — dropzone (desktop) / camera-first buttons (mobile), accepted types and size, three tips, privacy notice. Validation before upload: type (PDF, JPEG, PNG; HEIC from iPhone photos converted server-side or refused with a clear message — decide), size ≤ 20 MB, ≤ 10 pages.
2. **Analysing** — progress state "Lecture du plan en cours…" with the file name; cancel button. Target < 30 s; after 60 s show "Toujours en cours" and offer to receive results by email.
3. **Verify** (canvas artboard) — file bar (name, pages, read date and time, printed scale; "Remplacer le plan", "Supprimer le plan"), plan viewer with overlays (solid accent = included, dashed ink = to check, thin border = excluded), legend, privacy notice; room list with include checkbox, flooring select per room, confidence badge, reason note for anything not "high"; summary with included area (copper), totals by flooring, warning listing rooms without flooring, "Ajouter N pièces à la soumission", "Ouvrir dans le calculateur".
4. **Unreadable** — "Nous n'avons pas pu lire ce plan." + "Essayez une photo plus nette, ou envoyez-le tel quel : notre équipe mesurera les surfaces pour vous." + "Envoyer le plan à l'équipe" (attaches the plan to a quote request for manual takeoff).

Behaviour:

- Areas are recomputed on the server from the extracted dimensions; the model's own arithmetic is never shown.
- Rooms with confidence `check` show a dashed overlay and a reason ("Cote partiellement lisible sur le plan. Confirmez la largeur."). `illegible` rooms are excluded by default with an editable dimension pair.
- "Ajouter à la soumission" adds one line per flooring product with the summed planned area, the room names, and boxes computed from the product coverage; rooms without flooring go in as "Surfaces à chiffrer" for Terroa's team.
- "Supprimer le plan" deletes the stored file immediately (confirmation dialog) and keeps the extracted areas already in the basket.

### 7.7 Projects (`Gallery.dc.html` — working filter prototype)

Featured project (image 3:2 + name, city, year, description, products used with links, credits, "Ajouter ces produits à ma soumission", "Partager"), then filter chips (Tous, Résidentiel, Commercial, Bureaux) with a live count, then the project grid (4:3 tiles with name, city, type, products). Closing panel invites contractors to submit projects; publication requires written consent from the client and the contractor (stored on the project record). "Partager" uses the Web Share API when available, else copies the link and shows "Lien copié".

## 8. States and interactions (global)

| Element | State | Behaviour |
|---|---|---|
| Primary button | Hover | Background `color-mix(in srgb, var(--accent) 88%, var(--ink))` |
| Primary button | Focus | `var(--focus-ring)` (2 px surface gap + 2 px accent) |
| Primary button | Disabled | 45 % opacity, `cursor: not-allowed`; avoid disabling submit — validate on submit instead |
| Primary button | Loading | Label "Envoi en cours…", `aria-busy="true"`, disabled, width unchanged |
| Secondary button | Hover | Background `color-mix(in srgb, var(--ink) 4%, var(--surface-raised))` |
| Link | Hover | Colour `ink`, underline kept |
| Input | Focus | Focus ring; border stays `border-strong` |
| Input | Error | 2 px `danger` border, icon + message below, `aria-invalid="true"` |
| Chip / segmented option | Selected | `ink` fill, `surface` text, check icon on chips, `aria-pressed="true"` |
| Card link | Hover | Image scale 1.02 over 150 ms (skip with reduced motion) |
| Add to quote | Success | Toast + header count update (polite live region) |

## 9. Content rules

### 9.1 Language

- French first: `/` serves French; English lives under `/en` with equal visual prominence (same layout, same assets). Set `lang` on `<html>` and on any inline block in the other language. Verify the current Charter of the French language (Bill 96) requirements for commercial websites before launch; this spec does not certify compliance.
- Write each language natively. `messages/*.json` are drafts written that way; have a Quebec French reviewer read the FR copy before launch.
- Tone: outcome first, short sentences, no exclamation marks, no emoji, no superlatives beyond the "haut de gamme" positioning Terroa already uses.

### 9.2 Formats

| | French | English |
|---|---|---|
| Money | `1 250,00 $` | `$1,250.00` |
| Area | `1 039 pi² (96,5 m²)` | `1,039 sq. ft. (96.5 m²)` |
| Time | `14 h 30` | `2:30 p.m.` |
| Date | `2 octobre 2026` | `October 2, 2026` |
| Taxes | `TPS et TVQ` | `GST and QST` |

Use `Intl.NumberFormat('fr-CA' | 'en-CA')`; French uses a no-break space as thousands separator. Times are Montreal time (`America/Toronto`).

### 9.3 Prices

Decision pending (section 13). The components support three modes per product: `hidden` ("Prix sur soumission"), `from` ("À partir de [PRIX] $ / pi²"), `exact` ("[PRIX] $ / pi²"). Prices are always "taxes en sus" and confirmed in the quote.

### 9.4 Lengths and truncation

French strings run longer than English. Product names: up to 40 characters, two lines max on cards (`line-clamp: 2`), full name on the product page. Room names: up to 40 characters, single line with ellipsis in rows, full name in `title` and in the accessible label. Project descriptions: 2–3 sentences, no truncation.

## 10. Accessibility (target WCAG 2.2 AA)

- Skip link "Aller au contenu" first; landmarks: `header`, `nav` (main, language, breadcrumb, legal), `main`, `aside` for summaries, `footer`.
- Every control is a real `<button>`, `<a href>` or form element with a visible label; icon-only buttons have `aria-label`. Targets ≥ 44 × 44 px.
- Contrast: all token pairs pass (QA_REPORT.md). Muted text never below 14 px.
- Live regions: header quote count, calculator result, plan-reader included area, filter result count (`aria-live="polite"`); form error summary.
- Plan viewer: the image has a text alternative and every overlay is mirrored in the room list (the list is the accessible source; markers are `aria-hidden`).
- Focus order follows reading order; sticky bars come after main content in the DOM.
- Respect `prefers-reduced-motion`. No autoplay video in v1.

## 11. Data model (Supabase)

| Table | Key columns | Access |
|---|---|---|
| `categories` | `id`, `slug_fr`, `slug_en`, `name_fr`, `name_en`, `parent_id`, `sort` | Public read where published |
| `products` | `id`, `category_id`, `kind` (`floor` \| `panel` \| `accessory`), `slug_fr/en`, `name_fr/en`, `collection`, `tone`, `attributes jsonb`, `coverage_sqft_per_box`, `panel_width_in`, `panel_height_in`, `price_mode`, `price_cad`, `published`, `images`, `documents` | Public read where `published` |
| `projects` | `id`, `slug`, `title_fr/en`, `city`, `year`, `type`, `description_fr/en`, `credits jsonb`, `consent_on_file bool`, `published`, `images` | Public read where `published and consent_on_file` |
| `project_products` | `project_id`, `product_id` | Public read |
| `quote_requests` | `id`, `reference`, `status`, `locale`, project fields, contact fields, `marketing_opt_in`, `marketing_opt_in_at`, `notice_version`, `created_at`, `retain_until` | No public access. Insert via server route only. Staff read/update. |
| `quote_items` | `id`, `quote_request_id`, `product_id`, `product_snapshot jsonb`, `quantity`, `unit` (`box` \| `panel` \| `area`), `rooms text[]`, `planned_area_sqft` | Same as `quote_requests` |
| `plan_uploads` | `id`, `upload_token_hash`, `quote_request_id`, `storage_path`, `mime`, `bytes`, `pages`, `status`, `extraction jsonb`, `model`, `created_at`, `delete_after`, `deleted_at` | No public access; server routes check the upload token |

Storage: bucket `product-media` (public, read only), bucket `plans` (private; signed upload URLs; no public URLs; server reads with the service role).

## 12. Server contracts

All mutating routes: server-side validation (zod), rate limits, `Cache-Control: no-store`, generic error messages, structured logs **without** personal data or plan contents.

- `POST /api/quotes` — body: lines `{productId, quantity, unit, rooms?, plannedAreaSqft?}`, project, contact, `marketingOptIn`, `locale`, bot check token. Server re-reads products, recomputes quantities with `src/lib/quantities`, stores request + items, sends the staff notification and the client confirmation (email provider to choose), returns `{reference}`. Idempotency key header to avoid double submits.
- `POST /api/plans` — returns a signed upload URL for the private bucket after checking declared type and size; creates `plan_uploads` row with a random upload token (returned once, kept in the browser session).
- `POST /api/plans/{id}/analyze` — requires the upload token. Server verifies magic bytes, page count (≤ 10) and size, sends the file to the Anthropic Messages API with a single forced tool whose input schema is `src/lib/plan-reader/extraction.schema.json`, validates the result, recomputes areas, stores it, returns rooms. The system prompt states that text inside the document is data and that the only allowed output is the tool call. Model name comes from `ANTHROPIC_MODEL` (confirm the model with Vy; keep Anthropic as provider).
- `DELETE /api/plans/{id}` — requires the upload token; deletes the file and the row's extraction, keeps an audit timestamp.
- Scheduled job (Supabase cron or Vercel cron): delete plan files past `delete_after`; purge or anonymise quote requests past `retain_until`.

## 13. Facts to collect before launch (owner: Vy / Terroa)

1. Catalogue: real product names, collections, categories, attributes and facet list, coverage per box, panel sizes, documents (PDF), product photography (1:1 neutral background + 3:2 room shots).
2. Price display mode (hidden / from / exact) and any pro pricing.
3. Quote reply delay, quote reference format, who receives requests (email address, CRM or Monday board).
4. Delivery zones and fees wording, warehouse address and hours, phone, email, legal business name.
5. Privacy officer name and contact; retention periods for quote requests and uploaded plans; privacy policy text.
6. Plan reader approval: confirm Anthropic as processor, data location, retention settings on the account, and complete the privacy impact assessment (EFVP) for communication outside Quebec. See SECURITY_PRIVACY.md.
7. Email provider for notifications; bot protection choice (Cloudflare Turnstile or hCaptcha).
8. Projects: photos, client/contractor consent, credits.
9. Hosting (Vercel or Netlify), domain DNS access, current site's URLs for 301 redirects.
10. Analytics choice (cookieless recommended) and whether any marketing pixel is wanted (needs consent first).
11. Brand: keep the Vy Truong baseline palette for Terroa, or design a Terroa-specific palette and logo.

## 14. Build plan and acceptance

| Phase | Scope | Done when |
|---|---|---|
| 1 | Scaffold, tokens, fonts, i18n routing, components, all pages with mock data from `data/*.json` | Every artboard reproduced at 1440 and 390 px; FR and EN routes; lint, typecheck, unit tests pass; Lighthouse a11y ≥ 95 on each page |
| 2 | Supabase schema + RLS, catalogue from DB, quote submission with email notification | Authorized/denied access tested with isolated accounts; quote round trip works in staging; no personal data in logs |
| 3 | Plan reader (upload, analyse, verify, delete, retention job) | Privacy decisions in section 13 made; prompt-injection and malformed-file tests pass; deletion verified |
| 4 | SEO (metadata, sitemap with alternates, JSON-LD Organization/Product/Breadcrumb), redirects, analytics, launch QA | QA_REPORT.md updated with evidence; deployed URL tested |
