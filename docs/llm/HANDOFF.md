# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.17.1 (versions must stay synced: `package.json` + `openapi.yaml`)
- CLI: stable; primary workflow (must not break)
- API: stable; OpenAPI at `openapi.yaml`; generated frontend types at `web/lib/apiTypes.gen.ts`
- Web: Next.js admin UI (Runs/Library/Watchlist/Settings)

## Phase 2.7 (In Progress): Settings + Polish

### 2.7.1 Non-secret defaults via settings file
- Persist non-secret defaults to `output/_settings.json` (never store secrets).
- API:
  - `GET /settings`
  - `PATCH /settings` (send `null` to clear a key)
- Precedence order:
  - `output/_settings.json` (lowest) < `config.yaml` < `.env` (highest)
 - Status: DONE in v0.17.0

### 2.7.3 Settings UI UX polish (DONE)
- Implemented the Claude+Gemini UX fixes for `/settings`:
  - settings-specific compact input classes (`.inputXs/.inputSm/.inputMd`)
  - `.formRow` + right-aligned `.formLabel` on desktop (mobile-first column layout)
  - `.stackTight` and reduced card clutter (2-3 cards with internal sections)
- Reference spec: `docs/llm/HANDOFF_ARCHIVE.md`
- Card 1: Core + Language + Outputs
- Card 2: Planning + Polling + Retries
- Card 3: yt-dlp (textarea full width)

#### Additional Gemini Recommendations

1. **Touch targets:** Ensure buttons/inputs are min 44x44px for mobile
2. **Visual separation:** Add clear spacing between rows in vertical mobile layout
3. **Breakpoint:** Use 900px (matches existing project convention in globals.css)

**Source:** Claude UX review + Gemini CLI validation + GPT responsiveness suggestion. See `docs/llm/HANDOFF_ARCHIVE.md` for full analysis.

### 2.7.2 Roadmap and docs hygiene
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE.
- For every behavior change, update the relevant docs (README + ops/docs as appropriate).
- For every version bump, add a top entry to `docs/llm/HISTORY.md`.

## Next Steps (Do In Order)
1) Add runtime timeouts and Docker healthcheck (ops hardening).
2) Future (only if exposing beyond localhost): rate limiting + auth/cors hardening.

## Testing / Sanity Pass
- `npm test`
- `npm run build`
- `npm --prefix web run build`
- `npm run api:contract:check`
- `npm run test:docker-smoke`

## Operator Notes
- `.env` must include `ASSEMBLYAI_API_KEY`.
- `Y2T_API_KEY` is optional but recommended when running in Docker or on a server.

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content)
