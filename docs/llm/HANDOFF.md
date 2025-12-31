# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.28.1 (versions must stay synced: `package.json` + `openapi.yaml`)
- CLI: stable; primary workflow (must not break)
- API: stable; OpenAPI at `openapi.yaml`; generated frontend types at `web/lib/apiTypes.gen.ts`
- Web: Next.js admin UI (Runs/Library/Watchlist/Settings)

## Phase 2.8.2 (DONE): Server-side clamps/validation
- Added server-side validation/clamping for settings, runs, and watchlist inputs.
- Invalid `afterDate` or manual `languageCode` returns 400; numeric fields clamp to safe bounds.
- New helper: `src/api/validation.ts` with shared limits.

## Phase 2.8.2b (DONE): API hardening follow-ups
- Done: sanitize 500 responses (no internal error leaks).
- Done: log persistence failures (no silent `.catch(() => {})`).
- Done: request-body schema validation via Zod (remove unsafe casts).

## Review Notes (GPT v0.28.1)
- Docs/code alignment: improved; Claude v2 issues addressed (see "Documentation Audit v2" section below).
- Tests: `npm test` 102/102 pass.
- Build: OK (`npm run build`, `npm --prefix web run build`, `npm run api:contract:check`).
- Docker: healthy.
- Security audit: Phase 1 + Phase 2 complete.
- New: OpenAI Whisper provider (`openai_whisper`) alongside AssemblyAI (config + settings + CLI).
- New: Audio size policy + auto-splitting (provider caps + `maxAudioMB`, `splitOverlapSeconds`).
- New: `GET /providers` endpoint for provider capabilities (max upload size, diarization).
- New: Provider capabilities now live on `TranscriptionProvider.getCapabilities()` (no static registry).

## Code Review (Claude 2025-12-27)

### CRITICAL - DONE in Phase 2.8.2b

1. **Unsafe `as any` casts in server.ts (80+ instances)** - DONE
2. **Error messages exposed to clients (server.ts:907)** - DONE
3. **Silent persistence failures (runManager.ts:411)** - DONE

### MEDIUM - Technical debt

4. **Race conditions (partial)**
   - Scheduler concurrent trigger guard + test DONE
   - `EventBuffer` concurrent append/read DONE
   - `RunManager` concurrent list DONE

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

## Phase 2.9 (DONE): STT provider capability refactor
- `TranscriptionProvider` exposes `getCapabilities()`; pipeline uses provider-owned caps.
- `/providers` now lists capabilities sourced from provider modules.

## Documentation Audit v2 (Claude 2025-12-31, fresh re-analysis)

### Summary
- Tests: 102/102 pass
- Version: 0.28.1 (synced package.json + openapi.yaml)
- `as any` remaining: 4 (in settings.ts, low impact)
- Overall alignment: ~88% (more issues found in fresh audit)

### CRITICAL - Code bugs / Doc errors

1. **Y2T_CATALOG_MAX_AGE_HOURS legacy fallback broken**
   - File: src/config/loader.ts:61
   - Bug: `getEnv("Y2T_CATALOG_MAX_AGE_HOURS", "Y2T_CATALOG_MAX_AGE_HOURS")` - same param twice
   - Should be: `getEnv("Y2T_CATALOG_MAX_AGE_HOURS", "CATALOG_MAX_AGE_HOURS")`

2. **Y2T_MAX_BUFFERED_EVENTS_PER_RUN default mismatch**
   - README.md line 251: says default 1000
   - DEPLOY_PLAYBOOK.md line 41: says default 1000
   - Actual code (src/api/index.ts:12): default is 5000
   - Fix: Update docs to say 5000

3. **README.md auth contradiction**
   - Line 203: "Auth (optional, recommended...)"
   - Line 204: "Y2T_API_KEY is required"
   - These contradict each other. API key IS required (or Y2T_ALLOW_INSECURE_NO_API_KEY=true)

4. **INTEGRATION.md error code names wrong**
   - Line 94: says `timeout` but code uses `request_timeout` (server.ts:292)
   - Line 97: says `server_error` but code uses `internal_error` (server.ts:995)

### HIGH PRIORITY - OpenAPI spec gaps

5. **9 endpoints missing 401 response in openapi.yaml**
   - /maintenance/cleanup (lines 65-79)
   - /watchlist/{id} GET/PATCH/DELETE (lines 181-253)
   - /library/channels/* (lines 621-689)
   - /runs POST (lines 400-426)
   - /runs/plan (lines 428-455)
   - /runs/{runId}/cancel (lines 528-551)
   - /runs/{runId}/artifacts (lines 553-571)
   - All require auth via requireApiKey() at server.ts:303

6. **Pipeline stage order wrong in ARCHITECTURE.md:82**
   - Docs: download|split|transcribe|format|comments|save
   - Actual order in run.ts: download -> split -> transcribe -> comments -> save -> format(csv only)

7. **Missing event types in ARCHITECTURE.md:80-82**
   - `run:cancelled` and `run:error` not documented but exist in events.ts

8. **16+ env vars not in docker-compose.yml template**
   - Y2T_TRUST_PROXY, Y2T_MAX_BODY_BYTES, Y2T_AUTH_FAIL_*, Y2T_RATE_LIMIT_*
   - Y2T_SSE_MAX_CLIENTS, Y2T_REQUEST_TIMEOUT_MS, Y2T_API_KEY_MAX_BYTES
   - Y2T_WEBHOOK_* (5 vars), Y2T_RUN_TIMEOUT_MINUTES

### MEDIUM PRIORITY - Doc inconsistencies

9. **Webhook headers case mismatch in INTEGRATION.md:172-177**
   - Docs: PascalCase (X-Y2T-Timestamp)
   - Code: lowercase (x-y2t-timestamp) in webhooks.ts:119-130
   - HTTP headers are case-insensitive but docs should match implementation

10. **Content-Type header always sent, not conditional**
    - INTEGRATION.md implies Content-Type only with secret
    - Actual: always sent (webhooks.ts:119)
    - Also: no `; charset=utf-8` in actual header

11. **CLI flag --audioDir not in README.md:146-168**
    - Exists at src/cli/index.ts:30

12. **openapi.yaml missing 429 for /health?deep=true**
    - Deep health CAN return 429 (server.ts:328) but not in spec

### LOW PRIORITY - Minor gaps

13. **Legacy env vars undocumented** (loader.ts:19-62 supports unprefixed names)

14. **docker-compose.yml NEXT_PUBLIC_Y2T_API_BASE_URL=localhost** won't work in prod

15. **Submodules not detailed in STRUCTURE.md** (config/ storage/ youtube/ transcription/)

### RESOLVED since last audit

- Pipeline stage `enumerate` - REMOVED from events.ts (was item 7)
- STRUCTURE.md Phase 2+ features - NOW DOCUMENTED on line 42 (was item 8)

### OO Design Evaluation

**Interfaces (well-defined):**
- `TranscriptionProvider` (src/transcription/provider.ts:9)
- `StorageAdapter` (src/storage/adapter.ts:21)
- `PipelineEventEmitter` (src/pipeline/events.ts:97)

**Implementations:**
- `AssemblyAiProvider implements TranscriptionProvider`
- `OpenAiWhisperProvider implements TranscriptionProvider`
- `FileSystemStorageAdapter implements StorageAdapter`
- `JsonLinesEventEmitter implements PipelineEventEmitter`

**Factory pattern:** `createTranscriptionProvider()` in src/transcription/factory.ts

**TypeScript:** strict: true + noUncheckedIndexedAccess: true

**Zod validation:** Robust schemas in src/api/schemas.ts

### Alignment Confirmation

| Aspect | Status |
|--------|--------|
| API endpoints (23) | MATCH openapi.yaml <-> server.ts |
| Auth (X-API-Key) | CORRECT, /health exempt |
| CORS | Default no headers, configurable |
| Settings | Zod + clamping work |
| Output formats | All documented exist |
| Pipeline stages | FIXED (enumerate removed) |
| OO/Interfaces | 3 interfaces well implemented |
| Strong typing | Only 4 as any remain |

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


### LOW (partial)

5. **No rate limit for auth failures** - FIXED
   - Added `Y2T_AUTH_FAIL_MAX` + `Y2T_AUTH_FAIL_WINDOW_MS`.
6. **Webhook replay attacks** - PARTIAL
   - Added `X-Y2T-Max-Age` header + `verifyWebhookSignature()` helper; receiver must enforce max age.

### What is GOOD

- `spawn()` with `shell: false` (no command injection)
- Path traversal protected with `isSafeBaseName()` + symlink rejection
- Zod validation on all endpoints
- Secrets never in persisted outputs
- Error responses sanitized
- Rate limiting for write operations

## Security Audit Phase 2 (Claude 2025-12-28) - Additional Risks

### HIGH SEVERITY (resolved in v0.23.9)

1. **Memory leak in rate limiter buckets** - DONE
   - Periodic cleanup removes buckets older than 2x window (auth + write limiters).

2. **Redirect following in webhooks -> SSRF** - DONE
   - Webhook fetch uses `redirect: "error"` to block redirects.

3. **IP spoofing bypasses rate limiting** - DONE
   - Added `Y2T_TRUST_PROXY=true` to honor `X-Forwarded-For` / `X-Real-IP`.

4. **SSE connections unlimited** - DONE
   - Added `Y2T_SSE_MAX_CLIENTS` cap (default 1000, `0` disables).

### MEDIUM SEVERITY (backlog)

5. **No API key header length limit** - DONE
   - Added `Y2T_API_KEY_MAX_BYTES` to cap `X-API-Key`.
6. **Buffer triple copy in readJsonBody()** - DONE
   - Switched to streaming decode via `TextDecoder` to avoid Buffer.concat.
7. **No rate limiting on GET endpoints** - DONE
   - Added `Y2T_RATE_LIMIT_READ_MAX` / `Y2T_RATE_LIMIT_READ_WINDOW_MS`.
8. **No global request timeout** - DONE
   - Added `Y2T_REQUEST_TIMEOUT_MS` for non-SSE requests.
9. **Health endpoint without rate limit** - DONE
   - Added `Y2T_RATE_LIMIT_HEALTH_MAX` / `Y2T_RATE_LIMIT_HEALTH_WINDOW_MS` for `deep=true`.
10. **Fixed window rate limit allows burst** - DONE
    - Switched to token-bucket style refill in `rateLimit.ts`.

## TypeScript & Interfaces (Claude 2025-12-29)

### Configuration
- `strict: true` enabled in tsconfig.json
- `noUncheckedIndexedAccess: true` enabled
- Only 4 `as any` instances remain (in `settings.ts`, low impact)

### Key Interfaces
1. **TranscriptionProvider** (`src/transcription/provider.ts:3-6`)
   - Abstracts speech-to-text provider
   - `AssemblyAiProvider` + `OpenAiWhisperProvider` implement this interface
2. **StorageAdapter** (`src/storage/adapter.ts:21-33`)
   - Abstracts file system operations
   - `FileSystemStorageAdapter` implements this
3. **PipelineEventEmitter** (`src/pipeline/events.ts:96-98`)
   - Abstracts event emission strategy

### Changing Speech-to-Text Provider
- Interface exists and is used via `createTranscriptionProvider()` (no direct instantiation in pipeline).
- To add Google/AWS: implement `TranscriptionProvider` + extend factory switch.
- Estimated effort: provider implementation time + config wiring (factory already exists).

### STT Provider Comparison (Claude 2025-12-29)

| Aspect | AssemblyAI | OpenAI Whisper |
|--------|------------|----------------|
| Provider key | `assemblyai` | `openai_whisper` |
| Speaker diarization | Yes | No |
| Price | ~$0.25/hour | ~$0.006/min (~$0.36/hour) |
| Speed | Async (polling) | Sync (faster for short files) |
| File size limit | 5GB | 25MB (auto-splits) |
| Best for | Long videos, speaker labels | Short videos, quick results |

**Note:** OpenAI Whisper 25MB limit is handled via auto-splitting with overlap trimming.

### Future Improvement (optional)
- Replace 4 remaining `as any` in `settings.ts` with proper types

### Docs hygiene (ongoing)
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE
- Update relevant docs for every behavior change
- Add entry to `docs/llm/HISTORY.md` for every version bump
- Phase 2.7 table archived in `docs/llm/HANDOFF_ARCHIVE.md` to keep this snapshot short
- Process guardrail: do not continue or commit if tests are failing; fix tests first.

## Testing / Sanity Pass
- `npm test`
- `npm run build`
- `npm --prefix web run build`
- `npm run api:contract:check`
- `npm run test:docker-smoke` (may take >5 min locally; injects `Y2T_API_KEY=smoke`)

## Operator Notes
- `.env` must include `ASSEMBLYAI_API_KEY` when `sttProvider=assemblyai`.
- `.env` must include `OPENAI_API_KEY` or `Y2T_OPENAI_API_KEY` when `sttProvider=openai_whisper`.
- Optional: `Y2T_MAX_AUDIO_MB` (cap before splitting) + `Y2T_SPLIT_OVERLAP_SECONDS` (overlap between chunks).
- `Y2T_API_KEY` is required for the HTTP API server (set `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local dev only).
- If the API is behind a trusted proxy/load balancer, set `Y2T_TRUST_PROXY=true`.
- `Y2T_SSE_MAX_CLIENTS` caps concurrent SSE connections (default 1000, `0` disables).
- `Y2T_API_KEY_MAX_BYTES` caps `X-API-Key` size; read/health rate limits and request timeout are configurable (see README).
- Security note: `callbackUrl` webhooks allow any http(s) URL unless `Y2T_WEBHOOK_ALLOWED_DOMAINS` is set; keep API private or enable the allowlist.

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content, audits, UX decisions)
