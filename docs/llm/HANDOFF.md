# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.21.0 (versions must stay synced: `package.json` + `openapi.yaml`)
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
| v0.19.0-v0.19.1 | Mandatory API key with `Y2T_ALLOW_INSECURE_NO_API_KEY` opt-out |
| v0.19.2 | Bugfix: `requireApiKey` middleware now respects insecure mode |
| v0.19.3 | Security: docker-compose insecure default false; prevent library path traversal |

**Key details:**
- Settings precedence: `output/_settings.json` (lowest) < `config.yaml` < `.env` (highest)
- Layout: 2 cards (Core+Language+Outputs, Planning+Polling+Retries)
- Responsive: 900px breakpoint, right-aligned labels on desktop
- Full implementation specs: `docs/llm/HANDOFF_ARCHIVE.md`

## Phase 2.8.2 (DONE): Server-side clamps/validation
- Added server-side validation/clamping for settings, runs, and watchlist inputs.
- Invalid `afterDate` or manual `languageCode` returns 400; numeric fields clamp to safe bounds.
- New helper: `src/api/validation.ts` with shared limits.

## Phase 2.8.2b (DONE): API hardening follow-ups
- Done: sanitize 500 responses (no internal error leaks).
- Done: log persistence failures (no silent `.catch(() => {})`).
- Done: request-body schema validation via Zod (remove unsafe casts).

## Review Notes (GPT v0.21.0)
- Docs/code alignment looks good for v0.21.x.
- Tests: `npm test` passes (72/72).
- `package-lock.json` still shows version 0.17.5 - run `npm install` to sync.
- OpenAPI warning: `GlobalRunEvent` schema unused (Redocly warns).

## Code Review (Claude 2025-12-27)

### CRITICAL - DONE in Phase 2.8.2b

1. **Unsafe `as any` casts in server.ts (80+ instances)** - DONE
2. **Error messages exposed to clients (server.ts:907)** - DONE
3. **Silent persistence failures (runManager.ts:411)** - DONE

### MEDIUM - Technical debt

4. **Race conditions (no tests)**
   - `EventBuffer` concurrent append/read
   - `RunManager` mutable maps without locking
   - Scheduler potential double-enqueue

5. **Documentation drift** - DONE (aligned in docs)

6. **Environment variable naming inconsistent**
   - `FILENAME_STYLE` vs `Y2T_CATALOG_MAX_AGE_HOURS` (prefix inconsistent)
   - `YTDLP_PATH` vs `YT_DLP_PATH` (both accepted, not documented)

### MINOR - Cleanup

7. **Missing tests**
   - Webhook retry/HMAC validation
   - Graceful shutdown sequence
   - Concurrent runs race conditions
   - Symlinks in output directory

## Phase 2.8.3 (DONE): Rate limiting
- Write endpoints are rate limited per API key (or IP) with 429 + Retry-After.
- Config via `Y2T_RATE_LIMIT_WRITE_MAX` and `Y2T_RATE_LIMIT_WINDOW_MS`.

## Next Steps

1) **Ops hardening**: Runtime timeouts, Docker healthcheck.

### Docs hygiene (ongoing)
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE
- Update relevant docs for every behavior change
- Add entry to `docs/llm/HISTORY.md` for every version bump

## Testing / Sanity Pass
- `npm test`
- `npm run build`
- `npm --prefix web run build`
- `npm run api:contract:check`
- `npm run test:docker-smoke`

## Operator Notes
- `.env` must include `ASSEMBLYAI_API_KEY`.
- `Y2T_API_KEY` is required for the HTTP API server (set `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local dev only).
- Security note: `callbackUrl` webhooks allow any http(s) URL (SSRF risk if API key is leaked); keep API private or add URL allowlists in a future phase.

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content, audits, UX decisions)
