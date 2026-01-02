# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.30.0 (versions must stay synced: `package.json` + `openapi.yaml`)
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
- Tests: `npm test` 107/107 pass (44 test files, ~31s)
- Build: OK (`npm run build`, `npm --prefix web run build`, `npm run api:contract:check`)
- Docker: healthy
- STT Providers: OpenAI Whisper + AssemblyAI both fully documented and implemented
- npm audit: 0 vulnerabilities

## Security (consolidated snapshot)
- Historical audits and full details are in `docs/llm/HANDOFF_ARCHIVE.md`.

Current validated risks:
- IP spoofing risk if Y2T_TRUST_PROXY=true without a real proxy (enables auth brute-force bypass by IP spoof).

Recently mitigated:
- Rate limiter keys are hashed (no raw API key in memory buckets).
- /health?deep=true now requires auth unless Y2T_HEALTH_DEEP_PUBLIC=true.
- Webhook DNS rebinding blocked by hostname resolution + private IP checks.

Conditional risk (environment-dependent):
- PowerShell drive query is safe today (root-only), but becomes risky if outputDir is ever user-controlled.

Verified not an issue (current code):
- SSE bypass rate limiting: read limiter runs for all GET requests; SSE only skips request timeout.

## Security Roadmap v7 (planned, do in order)
1) Hash API keys in rate limiter buckets (avoid raw key in memory). (DONE)
2) Protect /health?deep=true (require API key or new opt-in env). (DONE)
3) Mitigate DNS rebinding for callbackUrl (resolve host -> block private IPs). (DONE)
4) Require or strongly recommend Y2T_WEBHOOK_ALLOWED_DOMAINS in production docs.
5) Tighten trust proxy guidance (do not enable without a real proxy).
6) CORS guidance: avoid "*" in production.
7) Add deployment security checklist (API key, allowlist, deep health).
8) Add tests for deep health auth + webhook DNS rebinding.

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
- `GET /health?deep=true` requires `X-API-Key` unless `Y2T_HEALTH_DEEP_PUBLIC=true`.
- If the API is behind a trusted proxy/load balancer, set `Y2T_TRUST_PROXY=true`.
- `Y2T_SSE_MAX_CLIENTS` caps concurrent SSE connections (default 1000, `0` disables).
- `Y2T_API_KEY_MAX_BYTES` caps `X-API-Key` size; read/health rate limits and request timeout are configurable (see README).
- Security note: `callbackUrl` webhooks allow any http(s) URL unless `Y2T_WEBHOOK_ALLOWED_DOMAINS` is set; keep API private or enable the allowlist.

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content, audits, UX decisions)
