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

## Review Notes (Claude v7 FULL audit 2026-01-02)
- Docs/code alignment: 100%; no issues found
- Tests: `npm test` 102/102 pass (44 test files, 26s)
- Build: OK (`npm run build`, `npm --prefix web run build`, `npm run api:contract:check`)
- Docker: healthy
- Security audit: Phase 3 complete (see below)
- STT Providers: OpenAI Whisper + AssemblyAI both fully documented and implemented
- npm audit: 0 vulnerabilities

## Security Audit Phase 3 (Claude 2026-01-02)

### CRITICAL ISSUES

1. **PowerShell Command Injection** - health.ts:48-50
   - `outputDir` path injected into PowerShell command string
   - Attack: `Y2T_OUTPUT_DIR="C:\x'; Get-Process #"` executes arbitrary code
   - Fix: Escape drive letter or use PowerShell parameter binding

2. **API Key Stored in Rate Limiter Memory** - server.ts:242-246
   - Full API key used as rate limit bucket key: `key:${apiKey}`
   - Risk: Memory dumps/debugging exposes API keys
   - Fix: Use hash of API key instead: `key:${sha256(apiKey).slice(0,16)}`

### HIGH ISSUES

3. **SSE Endpoints Bypass Rate Limiting** - server.ts:283-286
   - `/events` and `/runs/{id}/events` skip rate limiters entirely
   - Risk: Unlimited SSE connections per client
   - Fix: Apply rate limits before SSE detection

4. **IP Spoofing Bypasses Rate Limits** - ip.ts:30-45
   - When `Y2T_TRUST_PROXY=true`, `X-Forwarded-For` fully trusted
   - Risk: Attacker spoofs IP to bypass all rate limits
   - Fix: Validate forwarded IP against trusted proxy whitelist

5. **Rate Limiter Memory Leak Under Attack** - rateLimit.ts:56-64
   - IP spoofing + sustained attack = unbounded bucket map growth
   - Risk: OOM DoS attack
   - Fix: Use LRU cache or more aggressive cleanup

6. **Auth Brute Force Limiter Bypassed** - auth.ts:172
   - Uses `getClientIp()` which is vulnerable to IP spoofing
   - Risk: Unlimited auth attempts with IP rotation
   - Fix: Rate limit by API key hash, not just IP

### MEDIUM ISSUES

7. **Health Endpoint Leaks System Details** - health.ts:33,39,81
   - Error messages include file paths, command output
   - Risk: Information disclosure
   - Fix: Return generic error messages

8. **OPTIONS Requests Bypass Auth** - server.ts:276-279
   - Standard CORS behavior but allows endpoint discovery
   - Risk: Low (no data access)

### VERIFIED SECURE

- **Command Injection**: exec.ts uses `spawn()` with `shell:false` - SECURE
- **Path Traversal**: `isSafeBaseName()` + symlink detection - SECURE
- **SSRF Webhooks**: Blocks private IPs, localhost, supports allowlist - SECURE
- **Timing Attacks**: Uses `timingSafeEqual` for API key comparison - SECURE
- **Secrets in Persistence**: API keys excluded from _settings.json - SECURE
- **Body Size Limits**: 1MB default, enforced in http.ts - SECURE
- **Dependencies**: `npm audit` shows 0 vulnerabilities - SECURE

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

## Documentation Audit v7 (Claude 2026-01-02, FRESH COMPLETE AUDIT)

### Summary
- Tests: 102/102 pass (44 test files, ~26s execution)
- Version: 0.28.1 (synced package.json + openapi.yaml)
- `as any` remaining: 4 (in settings.ts, low impact)
- Overall alignment: 100%

---

### NO ISSUES FOUND

All documentation matches code implementation exactly.

---

### VERIFIED CORRECT (100% Match)

- **README/HOW_TO_USE**: All CLI options, env vars, defaults, quickstart examples correct
- **API/OpenAPI**: 28 endpoints, 8 error codes, security, artifacts, webhooks - ALL MATCH
- **INTEGRATION.md**: Error codes, auth flow, webhook format - ALL MATCH
- **ARCHITECTURE/STRUCTURE**: directories, pipeline stages, storage layout, interfaces - ALL MATCH
- **STT Providers**: AssemblyAI (5GB, diarization), OpenAI (25MB, no diarization) - ALL MATCH
- **Deploy/Ops**: rate limits, auth, timeouts, retention, docker-compose, .env.example - ALL MATCH

---

### ACCEPTED (non-blocking)

#### Unit test coverage gaps
- 28/75 src modules have direct unit tests
- 47/75 covered indirectly via integration tests
- Key gaps: cli/index.ts, youtube/metadata.ts, utils/exec.ts, utils/audio.ts

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

## Security Audit v7 (Combined: Claude list + GPT review, 2026-01-01)

### Claude findings (as reported)

CRITICAL
1) PowerShell command injection in health.ts (Y2T_OUTPUT_DIR used in PS command).
2) API key stored in rate limiter bucket keys (server.ts).

HIGH
3) SSE bypasses rate limiting (server.ts).
4) IP spoofing bypasses rate limits (ip.ts when trust proxy).
5) Rate limiter memory leak (rateLimit.ts).
6) Auth brute force bypass (auth.ts).

MEDIUM
7) /health deep leaks details (health.ts).
8) OPTIONS bypass auth (server.ts).

### GPT review of those items

Validated
- API key in rate limiter bucket keys: real risk (memory dump could expose keys). Severity likely HIGH/Medium.
- /health?deep=true leaks details: real; decision whether to require auth for deep health.
- IP spoofing is a config risk if Y2T_TRUST_PROXY=true without a trusted proxy.

Not validated (likely false positives)
- PowerShell injection: health.ts uses drive root derived from path root, not user-controlled script input.
- SSE bypasses rate limiting: read rate limiter applies to all GET requests (except /health).
- Rate limiter memory leak: cleanup timer evicts old buckets (2x window).
- Auth brute force bypass: auth failures are rate-limited by IP.
- OPTIONS bypass: expected CORS preflight, no privileged action.

### GPT additional note
- Webhook DNS rebinding remains a medium risk if callbackUrl allowlist is not enforced.

## Security Roadmap v7 (planned, do in order)
1) Hash API keys in rate limiter buckets (avoid raw key in memory).
2) Protect /health?deep=true (require API key or new opt-in env).
3) Mitigate DNS rebinding for callbackUrl (resolve host -> block private IPs).
4) Require or strongly recommend Y2T_WEBHOOK_ALLOWED_DOMAINS in production docs.
5) Tighten trust proxy guidance (do not enable without a real proxy).
6) CORS guidance: avoid "*" in production.
7) Add deployment security checklist (API key, allowlist, deep health).
8) Add tests for deep health auth + webhook DNS rebinding.

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
