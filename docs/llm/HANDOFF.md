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
- Docs/code alignment: high; Claude audit v3 items resolved.
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

## Documentation Audit v3 (Claude 2025-12-31, complete fresh re-run)

### Summary
- Tests: 102/102 pass (44 test files, ~24s execution)
- Version: 0.28.1 (synced package.json + openapi.yaml)
- `as any` remaining: 4 (in settings.ts, low impact)
- Overall alignment: high (issues resolved)

---

### CRITICAL - Must fix (RESOLVED)

1. **HOW_TO_USE.md quickstart will FAIL**
   - Lines 44-63: API+Web quickstart does NOT set Y2T_API_KEY
   - Line 75: Claims "API refuses to start unless Y2T_API_KEY is set"
   - server.ts:186-189 confirms API key IS required
   - Fix: Add `Y2T_API_KEY=dev` or `Y2T_ALLOW_INSECURE_NO_API_KEY=true` to quickstart

2. **openapi.yaml /health security override NOT implemented**
   - openapi.yaml:390 declares `security: []` (no auth for /health)
   - server.ts:303 runs `requireApiKey()` BEFORE path routing at line 317
   - Result: /health actually DOES require auth despite OpenAPI claiming otherwise
   - Fix: Move health check before auth middleware OR remove `security: []` from OpenAPI

---

### HIGH PRIORITY - Doc errors (RESOLVED)

3. **Pipeline stage order wrong in ARCHITECTURE.md:82**
   - Docs: `download|split|transcribe|format|comments|save`
   - Actual order in run.ts:
     - download (line 410)
     - transcribe (line 450)
     - split (line 454, conditional if audio too large)
     - comments (line 506, if commentsEnabled)
     - save (line 530)
     - format (line 608, CSV only)
   - The split stage is conditional and occurs after transcribe, not before

4. **INTEGRATION.md missing artifact types**
   - Lines 140-145 list: txt, md, jsonl, json, comments, audio
   - Missing from docs:
     - `meta` - server.ts:708-713 serves .meta.json
     - `csv` - server.ts:724-731 serves .csv files

5. **INTEGRATION.md webhook Content-Type wrong**
   - Line 172: docs say `application/json; charset=utf-8`
   - webhooks.ts:119: code sends `"content-type": "application/json"` (no charset)

6. **Undocumented error code: server_misconfigured**
   - auth.ts:155-157 can return 500 with error `server_misconfigured`
   - Message: "Y2T_API_KEY is required"
   - Not in INTEGRATION.md error table (lines 89-97)

7. **DEPLOY_PLAYBOOK.md missing defaults**
   - Line 32: Y2T_AUTH_FAIL_MAX / WINDOW_MS - no defaults shown
     - Actual: max=30, window=60000ms (auth.ts:70-73)
   - Line 39: Y2T_REQUEST_TIMEOUT_MS - no default shown
     - Actual: 30000ms (server.ts:237)
   - Line 40: Y2T_RUN_TIMEOUT_MINUTES - no default shown
     - Actual: 240 minutes (server.ts:196-197)

8. **Storage file not documented**
   - storage/index.ts:83 creates `_errors.jsonl` per channel
   - Not mentioned in ARCHITECTURE.md storage layout (lines 59-74)

---

### MEDIUM PRIORITY (RESOLVED)

9. **docker-compose.yml template incomplete**
   - Only includes 9 env vars, but DEPLOY_PLAYBOOK.md documents 25+
   - Missing from template:
     - Y2T_TRUST_PROXY
     - Y2T_MAX_BODY_BYTES
     - Y2T_AUTH_FAIL_MAX, Y2T_AUTH_FAIL_WINDOW_MS
     - Y2T_RATE_LIMIT_WRITE_MAX, Y2T_RATE_LIMIT_WINDOW_MS
     - Y2T_RATE_LIMIT_READ_MAX, Y2T_RATE_LIMIT_READ_WINDOW_MS
     - Y2T_RATE_LIMIT_HEALTH_MAX, Y2T_RATE_LIMIT_HEALTH_WINDOW_MS
     - Y2T_SSE_MAX_CLIENTS
     - Y2T_REQUEST_TIMEOUT_MS
     - Y2T_API_KEY_MAX_BYTES
     - Y2T_WEBHOOK_ALLOWED_DOMAINS, Y2T_WEBHOOK_SECRET
     - Y2T_WEBHOOK_RETRIES, Y2T_WEBHOOK_TIMEOUT_MS, Y2T_WEBHOOK_MAX_AGE_SECONDS
     - Y2T_RUN_TIMEOUT_MINUTES
     - Y2T_MAX_BUFFERED_EVENTS_PER_RUN
     - Y2T_WATCHLIST_ALLOW_ANY_URL

10. **Missing tests for critical modules**
    - No unit tests for:
      - CLI (src/cli/index.ts) - argument parsing, options
      - youtube/metadata.ts - metadata fetching
      - utils/exec.ts - command execution
      - utils/audio.ts - audio processing
    - These are covered indirectly via integration tests only

---

### LOW PRIORITY (RESOLVED)

11. **Webhook header case mismatch**
    - INTEGRATION.md:172-177 uses PascalCase: `X-Y2T-Timestamp`
    - webhooks.ts:119-130 uses lowercase: `x-y2t-timestamp`
    - HTTP headers are case-insensitive, but docs should match code

12. **docker-compose NEXT_PUBLIC_Y2T_API_BASE_URL=localhost**
    - Line 35: `NEXT_PUBLIC_Y2T_API_BASE_URL: http://localhost:8787`
    - Won't work in production - needs to be configurable per deployment

---

### README.md / HOW_TO_USE.md - Verified Correct

All other claims verified accurate:
- All 20+ CLI options match src/cli/index.ts
- All env var defaults match src/config/schema.ts and loader.ts
- API host:port defaults (127.0.0.1:8787) match src/api/index.ts:8-9
- Run persistence to `output/_runs/` correct
- Config precedence (_settings.json < config.yaml < .env) correct

---

### OpenAPI vs server.ts - Endpoints Match

All 28 endpoints implemented and match:
- GET /health, /metrics, /providers, /settings, /runs, /events
- PATCH /settings
- POST /maintenance/cleanup, /runs, /runs/plan
- GET/POST /watchlist, GET/PATCH/DELETE /watchlist/{id}
- GET/POST /scheduler/*, POST /scheduler/trigger
- GET /runs/{id}, /runs/{id}/logs, /runs/{id}/events, /runs/{id}/artifacts
- POST /runs/{id}/cancel
- GET /library/channels, /library/channels/{dir}, /library/channels/{dir}/videos
- GET /library/channels/{dir}/videos/{basename}/{kind}

Zod schemas in src/api/schemas.ts align with OpenAPI request bodies.

---

### ARCHITECTURE.md / STRUCTURE.md - Verified Correct

All directories and modules exist:
- src/cli/, src/api/, src/config/, src/youtube/, src/transcription/
- src/formatters/, src/storage/, src/pipeline/, src/utils/
- scripts/ (2 files: apiContractCheck.mjs, dockerSmokeTest.mjs)
- tests/ (44 test files)
- web/ (Next.js admin UI)

Storage paths match implementation:
- output/<channel>/<basename>.{json,txt,md,jsonl,csv,meta.json,comments.json}
- output/<channel>/_channel.json
- audio/<channel>/<basename>.<ext>

---

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

---

### Test Coverage (102/102 pass)

**44 test files covering:**
- Core utilities: naming, language, formatters, error classification (8 files)
- Storage & catalog: fs adapter, symlinks, processed index, caching (6 files)
- API security: auth, path traversal, CORS, rate limiting, body limits (5 files)
- API core: health, providers, plan, settings, runs, logs, cancel (11 files)
- Events & state: buffers, persistence, graceful shutdown, race conditions (8 files)
- Features: watchlist, scheduler, webhooks, cache-first (6 files)

**Coverage gaps (no dedicated unit tests):**
- src/cli/index.ts - CLI argument parsing
- src/youtube/metadata.ts - video metadata fetching
- src/utils/exec.ts - command execution wrapper
- src/utils/audio.ts - audio processing utilities

---

### Alignment Confirmation

| Aspect | Status |
|--------|--------|
| API endpoints (28) | MATCH openapi.yaml <-> server.ts |
| Auth (X-API-Key) | ISSUE: /health auth mismatch in OpenAPI |
| CORS | Default no headers, configurable via Y2T_CORS_ORIGINS |
| Settings | Zod + clamping work correctly |
| Output formats | meta, csv missing from INTEGRATION.md |
| Pipeline stages | Order incorrect in ARCHITECTURE.md |
| OO/Interfaces | 3 interfaces well implemented |
| Strong typing | Only 4 as any remain (settings.ts) |
| Test coverage | 102/102 pass, 4 modules lack unit tests |

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
