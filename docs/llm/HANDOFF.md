# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.23.7 (versions must stay synced: `package.json` + `openapi.yaml`)
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

## Review Notes (GPT v0.23.7)
- Docs/code alignment looks good for v0.23.x.
- Tests last known: `npm test` 85/85 (not re-run after 0.23.7).
- Build: OK.
- Docker: healthy.
- Fix (Claude): `apiAuth.test.ts` now isolates `Y2T_ALLOW_INSECURE_NO_API_KEY` to prevent env pollution.
- Security audit (Claude 2025-12-28): remediations applied; see section below.

## Code Review (Claude 2025-12-27)

### CRITICAL - DONE in Phase 2.8.2b

1. **Unsafe `as any` casts in server.ts (80+ instances)** - DONE
2. **Error messages exposed to clients (server.ts:907)** - DONE
3. **Silent persistence failures (runManager.ts:411)** - DONE

### MEDIUM - Technical debt

4. **Race conditions (partial)**
   - Scheduler concurrent trigger guard + test DONE
   - `EventBuffer` concurrent append/read pending
   - `RunManager` mutable maps without locking pending

5. **Documentation drift** - DONE (aligned in docs)

6. **Environment variable naming inconsistent** - DONE (Y2T_ preferred; legacy documented)

### MINOR - Cleanup

7. **Missing tests**
   - Graceful shutdown sequence
   - Symlinks in output directory

## Phase 2.8.3 (DONE): Rate limiting
- Write endpoints are rate limited per API key (or IP) with 429 + Retry-After.
- Config via `Y2T_RATE_LIMIT_WRITE_MAX` and `Y2T_RATE_LIMIT_WINDOW_MS`.

## Ops hardening (DONE)
- Add run timeout safety net for long-running runs.
- Add Docker healthcheck to `/health`.

## Tech Debt Backlog (do in order)
1) Normalize null/undefined handling across API/settings inputs (DONE).
2) Reduce `as any` for external data (YouTube metadata/comments) with guards/parsers (DONE).
3) Validation unification: clarify Zod vs validation.ts split (or consolidate) (DONE).
4) Harden settings input schema (reduce `z.record(z.unknown())`) (DONE).
5) Race condition tests (EventBuffer/RunManager pending) (DONE).
6) Missing tests: graceful shutdown sequence, symlink handling (DONE).
7) Optional: `npm audit` - 3 moderate vulns in `js-yaml` (prototype pollution), only affects
   `@redocly/cli` devDependency. NOT in production. Low priority, can ignore.

## Security Audit (Claude 2025-12-28)

### CRITICAL (fixed for production)

1. **Timing attack in API key comparison** - FIXED
   - Use `timingSafeEqual` with padded buffers.

2. **SSRF via callbackUrl** - FIXED
   - Block localhost/private IPs + optional `Y2T_WEBHOOK_ALLOWED_DOMAINS` allowlist.

### HIGH (fixed for production)

3. **CORS wildcard default** - FIXED
   - Default is now no CORS headers unless `Y2T_CORS_ORIGINS` is set.

4. **Request body no size limit** - FIXED
   - Added `Y2T_MAX_BODY_BYTES` (default 1,000,000) and 413 responses.

4. **Request body no size limit** - LOW
   - File: `src/api/http.ts:3-11`
   - Problem: `readJsonBody()` has no size limit, attacker can send huge body -> OOM
   - Fix: Add `MAX_BODY_SIZE = 1MB` check in the read loop

### LOW (partial)

5. **No rate limit for auth failures** - FIXED
   - Added `Y2T_AUTH_FAIL_MAX` + `Y2T_AUTH_FAIL_WINDOW_MS`.
6. **Webhook replay attacks** - TODO
   - We sign timestamps but do not enforce max age; receiver should validate.

### What is GOOD

- `spawn()` with `shell: false` (no command injection)
- Path traversal protected with `isSafeBaseName()` + symlink rejection
- Zod validation on all endpoints
- Secrets never in persisted outputs
- Error responses sanitized
- Rate limiting for write operations

### Docs hygiene (ongoing)
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE
- Update relevant docs for every behavior change
- Add entry to `docs/llm/HISTORY.md` for every version bump
- TODO: Move Phase 2.7 version table (lines 16-29) to ARCHIVE to reduce HANDOFF size

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
