# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Last Updated: 2025-12-14 - GPT-5.2
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 1 local-first web UI (admin) without breaking CLI

## What Changed Recently
- Added structured pipeline events (`--json-events`) for service/web streaming.
- Added `StorageAdapter` so web can read `output/` without duplicating path logic.
- Added metadata sidecars: `output/<channel_dir>/_channel.json` and `output/<channel_dir>/<basename>.meta.json`.
- Added language detection (yt-dlp metadata/captions) + AssemblyAI ALD fallback; language info included in TXT header (with source/confidence when available).
- Phase 0.1: yt-dlp error classification + smarter retries + clearer per-video error stages.
- Phase 0.2: minimal local HTTP API runner (`youtube2text-api`) with `POST /runs`, SSE events, and artifacts listing.
- Phase 0.2.1: API run/event persistence on disk (restart-safe by default).
- Docker: install `yt-dlp` into a Python virtualenv inside the image (avoids Debian PEP-668 without `--break-system-packages`); optional version pin via build arg.
- Docker smoke test added and passing: `npm run test:docker-smoke` builds the image, starts the container, checks `/health` and `/runs`, then cleans up.
- Phase 1 started: Next.js admin UI scaffold in `web/` + API `GET /library/...` endpoints to browse existing `output/` and fetch artifacts (txt/json/audio).
- UI polish: removed inline `style={{}}` usage in `web/app/*` (use CSS classes in `web/app/globals.css`).
- Web types: renamed `web/lib/types.ts` to `web/lib/apiSchema.ts`.

## Roadmap (Do In Order)
1. Phase 0: core service hardening - DONE
2. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events) - IN PROGRESS

## Phase 1 Next Steps (Do In Order)
1. UI error handling when API is down (Next.js error boundaries + user feedback) - DONE
2. API contract: OpenAPI + generated TS types/client + contract-check workflow to prevent drift - DONE (see `docs/operations/API_CONTRACT.md`)
3. SSE global: add global event stream so the runs list is "live" - DONE
4. Follow-ups: improve SSE UX (optional) - DONE

Recently completed follow-ups:
- Styling consistency: removed inline `style={{}}` in the UI in favor of CSS classes.
- Types facade: replaced `web/lib/types.ts` with `web/lib/apiSchema.ts` (re-exports from `web/lib/apiTypes.gen.ts`).
- SSE events: run detail Events view summarizes key fields (stage, index/total, reason/error) instead of raw JSON lines.

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

## Future Reminder
- Scheduled sync/cron: periodically enumerate followed channels and enqueue newly published videos.

## Testing Notes
- `npm run build`
- `npm test`
- `npm run test:docker-smoke` (requires Docker daemon running)
- Manual fixture URLs: `tests/fixtures/test-videos.md`
- Web (manual): `npm run dev:api` then `npm run dev:web`

## Open Questions
- Confirm AssemblyAI `language_code` edge cases (e.g., `es` vs `es_es`) if any appear in practice.
- Decide if we want a documented "recommended" `YT_DLP_EXTRA_ARGS` value beyond the default `[]`.
