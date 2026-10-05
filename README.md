# Terroa — terroa.ca

Quoting site for premium vinyl flooring, floor coverings and acoustic panels (Quebec professionals). French at `/`, English at `/en`. Status: build phase 1 (UI with mock data). See `HANDOFF.md`, `CLAUDE.md`, `SECURITY_PRIVACY.md` and `QA_REPORT.md`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
```

- Mock data: `data/*.json` (catalogue, projects, sample plan). Business facts are bracketed placeholders (`src/lib/site.ts`, `messages/*.json`).
- Copy: `messages/fr-CA.json`, `messages/en-CA.json` (parity tested). Add keys with `python3 scripts/addkeys.py '<fr json>' '<en json>'`.
- Not connected yet: Supabase, email, Anthropic API, analytics. `POST /api/quotes` is a validated stub; the plan reader uses `src/lib/plan-reader/analyzer.ts` (mock).
