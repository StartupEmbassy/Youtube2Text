# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Last Updated: 2025-12-16 - GPT-5.2 (Phase 2.2 completed; Phase 2.3 next)
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 2.3 Scheduler/watchlist kickoff (keep CLI intact)

## What Changed Recently
- Phase 0 DONE: core pipeline hardening + language detection + yt-dlp reliability + API runner + Docker.
- Phase 1 DONE: Next.js admin UI (Runs + Library) with SSE, OpenAPI contract/typegen, and live runs list.
- Outputs expanded: `.json` (canonical) + `.txt` + `.md` + `.jsonl` (+ optional `.csv`, `.comments.json`, `.meta.json`).
- Web UX: "Open downloads" shortcuts, more descriptive run labels, thumbnails across Runs/Library.
- Run detail: summarized status/progress + downloads list (no raw artifacts JSON) and improved error display.
- Ops: contract check (`npm run api:contract:check`) + docker smoke test (`npm run test:docker-smoke`).
- Phase 2.1 DONE: integration MVP (API key auth + planning + webhooks + cache-first single-video + integration docs).
- Library: channel avatars are best-effort from yt-dlp channel metadata (`channelThumbnailUrl` in `_channel.json`).
- v0.9.3: Fixed channel thumbnails not appearing for cached single-video runs; now prefers square avatars over banners. (Details: D-016)
- v0.9.4: Added `GET /health?deep=true` best-effort deep health (deps + disk + persistence) for Phase 2.2.
- v0.9.5: Added `Y2T_CORS_ORIGINS` allowlist (exact origin match) to restrict browser access; Phase 2.2 continues with retention + deploy playbook.
- v0.9.6: Added retention cleanup (runs persistence + old audio cache) with env knobs and `POST /maintenance/cleanup`.
- v0.9.6: Added server deploy playbook: `docs/operations/DEPLOY_PLAYBOOK.md`.

### Claude Opus 4.5 Review of v0.9.4 Deep Health (2025-12-16)

**Implementation quality: Excellent.** Full codebase + tests verified: build OK, 40/40 tests pass.

What I liked about the implementation:
- Best-effort approach: failures in one dep do not break the health check.
- Cross-platform disk check: Windows (PowerShell `Get-PSDrive`) and Unix (`df -k`).
- Real writability probe in `ensureWritableDir()`: creates temp file, writes, deletes - not just permission check.
- Clear `overallOk` logic combining all dep checks.
- Tests actually exercise the system (test 40 takes ~4s because it calls yt-dlp/ffmpeg).

Minor issue found in DECISIONS.md:
- D-016 (avatar fix) is inserted in the middle of D-006 (ALD fallback). The D-006 content appears after D-016, which reads awkwardly. Suggest moving D-016 to the end of the file or renumbering. Not a functional problem, just organizational.

### Claude Opus 4.5 Review of v0.9.5 CORS (2025-12-16)

**Implementation quality: Excellent.** Build OK, 42/42 tests pass.

What GPT-5.2 did well:
- Used my suggested approach but improved it with `Vary: Origin` header (critical for caching correctness).
- Robust parsing: trim + filter(Boolean) handles spaces and extra commas.
- Added 2 tests: default `*` behavior (test 41) and allowlist enforcement (test 42).
- Clean variable names (allowsAny, allowsOrigin).

Technical note: The `Vary: Origin` header is essential. Without it, a proxy/CDN could cache a response with `Access-Control-Allow-Origin: https://a.com` and serve it to `https://b.com`, breaking CORS. I did not mention this in my suggestion - GPT-5.2 added it correctly.

No issues found. Implementation is correct and complete.

### Phase 2.2 Next Steps (updated)

Status after v0.9.5:
1. Extended health (`GET /health?deep=true`) - DONE (v0.9.4)
2. Configurable CORS allowlist (`Y2T_CORS_ORIGINS`) - DONE (v0.9.5)
3. Retention/cleanup policy for `output/_runs/*` (and optionally old audio) - DONE (v0.9.6)
4. Deploy playbook doc (Docker Compose + reverse proxy/TLS + require API key) - DONE

Retention policy suggestion (for GPT-5.2 or next session):
- Env vars: `Y2T_RETENTION_RUNS_DAYS` (default: 30), `Y2T_RETENTION_AUDIO_DAYS` (default: 7 or -1 to disable)
- Never delete transcripts (`output/<channel>/*.json`) - only run metadata and audio
- Consider a cleanup command (`youtube2text-api --cleanup`) or automatic on startup
- Question: should cleanup run on a schedule (e.g., daily at 3am) or only on-demand?

## Roadmap (Do In Order)
1. Phase 0: core service hardening - DONE
2. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events) - DONE
3. Phase 2: hosted single-tenant service (admin) - IN PROGRESS (Phase 2.3 next)
4. Phase 3+: multi-tenant cloud platform - OPTIONAL

## Phase 1 Next Steps (Do In Order)
1. UI error handling when API is down (Next.js error boundaries + user feedback) - DONE
2. API contract: OpenAPI + generated TS types/client + contract-check workflow to prevent drift - DONE (see `docs/operations/API_CONTRACT.md`)
3. SSE global: add global event stream so the runs list is "live" - DONE
4. Follow-ups: improve SSE UX (optional) - DONE
5. Output formats: emit `.md` + `.jsonl` artifacts - DONE (see D-013)

Recently completed follow-ups:
- Styling consistency: removed inline `style={{}}` in the UI in favor of CSS classes.
- Types facade: replaced `web/lib/types.ts` with `web/lib/apiSchema.ts` (re-exports from `web/lib/apiTypes.gen.ts`).
- SSE events: run detail Events view summarizes key fields (stage, index/total, reason/error) instead of raw JSON lines.

## Phase 2 (planned) - Hosted single-tenant service (admin)
Goal: run Youtube2Text on a server for one admin workspace (no public signups yet), still keeping the CLI working.

Proposed steps (do in order):
1. Phase 2.1 Integration MVP: secure + callable from other systems.
2. Phase 2.2 Ops hardening: health/deps, CORS, retention, deploy playbook.
3. Phase 2.3 Scheduler/watchlist (cron): plan-first "followed channels" automation.
4. Phase 2.4 Control + robustness: cancel, rate limiting, queue/worker (if needed).

Phase 2.1 Integration MVP (do in order):
1) X-API-Key auth (`Y2T_API_KEY`) for API + admin UI - DONE (v0.6.0)
2) `POST /runs/plan` (enumerate + skip counts + estimate) without download/transcribe - DONE (v0.6.0)
3) Webhooks via `callbackUrl` on `POST /runs` (`run:done` / `run:error`, retries + optional signature) - DONE (v0.7.0)
4) Cache-first for single-video URLs (return `done` immediately unless `force`; channel/playlist runs already skip via idempotency) - DONE (v0.8.0)
5) Integration docs: `INTEGRATION.md` (curl + n8n examples + artifact download patterns) - DONE

Phase 2.3 Scheduler/watchlist (planned; per-channel or global interval):
- Maintain a "followed channels" list (per channel URL + optional interval override).
- Scheduler runs every N minutes:
  - for each followed channel, call `POST /runs/plan`
  - only create a run if `toProcess > 0`
- Two config options:
  - Global interval: one `intervalMinutes` for all channels (simpler)
  - Per-channel interval: each channel overrides the global default (more flexible)

## Phase 0 Notes (implemented)
- yt-dlp errors are classified (access vs transient vs unavailable) and only retryable failures are retried.
- `player_client=default` hint only shows for retryable failures (not access-denied).
- API usage:
  - Dev: `npm run dev:api`
  - Prod: `npm run build && npm run api`
  - Persistence: enabled by default under `output/_runs/` (disable with `Y2T_API_PERSIST_RUNS=false`)
  - Web UI review: see `docs/llm/REVIEWS.md`

## Key Decisions (Do Not Drift)
- CLI must remain fully operational; service/web are additional layers.
- No members-only/private content support (no cookie ingestion/refresh).
- Keep default `ytDlpExtraArgs` as `[]` (do not default to `youtube:player_client=android`).
- In Docker: server-side fetch uses `Y2T_API_BASE_URL` (internal network), but any browser-visible links/SSE must use `NEXT_PUBLIC_Y2T_API_BASE_URL`.

## Future Reminder
- Scheduled sync/cron: periodically enumerate followed channels and enqueue newly published videos.

## Testing Notes
- `npm run build`
- `npm test`
- `npm run test:docker-smoke` (requires Docker daemon running)
- Manual fixture URLs: `tests/fixtures/test-videos.md`
- Web (manual): `npm run dev:api` then `npm run dev:web`

## Open Questions
- None currently. Track new unknowns in `docs/llm/HISTORY.md` and convert stable choices into `docs/llm/DECISIONS.md`.

Note: deeper rationale/tradeoffs for Phase 2 integration live in `docs/llm/DECISIONS.md` (D-014 / D-015).
