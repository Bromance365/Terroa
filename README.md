# Terroa — design handoff bundle

Everything Claude Code needs to build the new terroa.ca from the Design canvas "Terroa — refonte terroa.ca" (2 October 2026).

| Path | What it is |
|---|---|
| `CLAUDE.md` | Project instructions for Claude Code (stack, rules, definition of done). Put it at the repo root. |
| `HANDOFF.md` | The build spec: routes, layout, tokens, components, every screen, data model, server contracts, facts to collect, build phases. |
| `SECURITY_PRIVACY.md` | Data inventory, trust boundaries, abuse cases, required controls, Law 25 checklist. |
| `QA_REPORT.md` | What was checked at design stage, with evidence and verdict. |
| `design/screens/` | PNG renders of all 14 artboards (desktop 1440 px, mobile 390 px at 2x) plus two interaction states. |
| `design/artboards/` | Canvas source files (`.dc.html`) and `canvas.json`. Reference only. |
| `design/tokens.css`, `design/tokens.json` | Design tokens as CSS variables + Tailwind v4 theme, and the source tokens. |
| `design/assets/` | Temporary SVG illustrations (materials, room scenes, sample plan). Replace with Terroa photos. |
| `messages/` | French and English UI copy (283 keys each). |
| `src/lib/quantities/` | Finished quantity maths (boxes, panels, units, rounding) with 15 passing tests. |
| `src/lib/plan-reader/extraction.schema.json` | Output contract for the AI plan reader. |

## Start the build in Claude Code

1. Create an empty folder (or repo) for the site and unzip this bundle into it.
2. Open Claude Code in that folder and paste:

```text
You're starting the Terroa website build. Read CLAUDE.md, HANDOFF.md and SECURITY_PRIVACY.md, and look at design/screens/*.png.
Do phase 1 from HANDOFF.md section 14: scaffold Next.js (App Router, TypeScript strict, Tailwind v4, next-intl), wire design/tokens.css and self-hosted fonts, build the components in section 6 and every page in section 7 with mock data in data/*.json. Keep the [bracketed] placeholders as they are. Reuse src/lib/quantities and move its tests to Vitest.
French at /, English at /en. Don't connect Supabase, email or the Anthropic API yet.
When done, run lint, typecheck, tests and build, check every page at 1440 and 390 px in both languages, and update QA_REPORT.md.
```

3. Before phase 2 and 3, answer the open items in HANDOFF.md section 13 (catalogue, price display, reply delay, privacy officer, retention, AI-provider approval).

The live canvas stays the visual reference: https://claude.ai/code/artifact/2288c354-4e9a-4dc7-bb26-75b7bd7519ab (private to your account). The bundle does not depend on it.
