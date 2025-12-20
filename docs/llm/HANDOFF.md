# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.19.1 (versions must stay synced: `package.json` + `openapi.yaml`)
- CLI: stable; primary workflow (must not break)
- API: stable; OpenAPI at `openapi.yaml`; generated frontend types at `web/lib/apiTypes.gen.ts`
- Web: Next.js admin UI (Runs/Library/Watchlist/Settings)

## Phase 2.7 (DONE): Settings + Polish

| Version | What was done |
|---------|---------------|
| v0.17.0 | Settings API + non-secret defaults in `output/_settings.json` |
| v0.17.1 | Compact inputs, formRow layout, 3 cards |
| v0.17.2 | Help tooltips with `?` icons (Gemini-designed) |
| v0.17.3 | Renamed "yt-dlp" to "Advanced (download)", textarea resize fix |
| v0.17.4 | Inline `effective: value` hints when field is unset |
| v0.17.5 | Per-field source tracking (`env`, `config.yaml`, `settings file`, `default`) |
| v0.17.6 | Move effective hints to tooltips (reduce clutter), Save button to top |
| v0.17.7 | Show compact inline value only (no prefix), keep full info in tooltip, 8px spacing |
| v0.18.0 | Remove unsafe arbitrary yt-dlp extra args setting (security) |

**Key details:**
- Settings precedence: `output/_settings.json` (lowest) < `config.yaml` < `.env` (highest)
- Layout: 2 cards (Core+Language+Outputs, Planning+Polling+Retries)
- Responsive: 900px breakpoint, right-aligned labels on desktop
- Full implementation specs: `docs/llm/HANDOFF_ARCHIVE.md`

### Docs hygiene (ongoing)
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE
- Update relevant docs for every behavior change
- Add entry to `docs/llm/HISTORY.md` for every version bump

## Next Steps (Future, lower priority)
1) Phase 2.8 security hardening for hosted use: make `Y2T_API_KEY` mandatory (non-local), add server-side clamps/validation, and add rate limiting for write endpoints.
2) Add runtime timeouts and Docker healthcheck (ops hardening).

## Testing / Sanity Pass
- `npm test`
- `npm run build`
- `npm --prefix web run build`
- `npm run api:contract:check`
- `npm run test:docker-smoke`

## Operator Notes
- `.env` must include `ASSEMBLYAI_API_KEY`.
- `Y2T_API_KEY` is required for the HTTP API server (set `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local dev only).

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content)

---

## Documentation Audit (2025-12-20)

Claude Opus 4.5 performed a full documentation cleanup:

**Changes made:**
1. `docs/PROJECT_CONTEXT.md` - Updated date from 2025-12-17 to 2025-12-20
2. `docs/ARCHITECTURE.md` - Updated version 1.1.6-draft to 1.1.7, date to 2025-12-20
3. `docs/llm/HANDOFF.md` - Condensed from ~220 lines to ~90 lines:
   - Removed 100+ lines of CSS/component specs (already implemented)
   - Consolidated Phase 2.7 section into summary table
   - Moved implementation specs to HANDOFF_ARCHIVE.md
4. `docs/llm/HANDOFF_ARCHIVE.md` - Added new section with:
   - Tooltip CSS specs (Gemini-designed)
   - Tooltip component pattern (with GPT accessibility enhancements)
   - Help text table for all 16 fields
   - v0.17.3-v0.17.5 change summaries

**Verified:**
- Code matches documentation (Settings UI, globals.css, SettingsForm.tsx)
- Version 0.17.5 synced in package.json and openapi.yaml
- All DONE items in HANDOFF are actually implemented

---

## UX Decision (2025-12-20): Settings effective hints cleanup - v0.17.6

**Problem:** Inline `effective: value (source)` text on every field (16 fields) creates visual clutter.

**3-LLM Consensus (Gemini recommendation weighted highest):**

| Option | Gemini | Claude | Decision |
|--------|--------|--------|----------|
| Inline text always visible | NO - too cluttered | NO | Rejected |
| Placeholder text | NO - accessibility issues, disappears on focus | NO | Rejected |
| Separate summary table | NO - disconnected from fields | NO | Rejected |
| Info icon with tooltip | YES - clean, discoverable, mobile-friendly | YES - use existing `?` tooltip | **Approved** |
| Auto-save | NO - accidental changes with 16 fields | NO | Rejected |
| Explicit Save button | YES - deliberate actions | YES - but move to top | **Approved** |

**Implementation (v0.17.6):**
1. Remove all inline `effective: ... (source)` text
2. Add effective value info to existing `?` tooltip (combines help text + effective value)
3. Move Save button to top of the form (more accessible)

**Source:** Gemini CLI consultation + Claude review.
