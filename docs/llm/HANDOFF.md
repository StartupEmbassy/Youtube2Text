# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

## Current Status
- Last Updated: 2025-12-14 - GPT-5.2
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 0 complete; next Phase 1 local-first web UI without breaking CLI

## What Changed Recently
- Added structured pipeline events (`--json-events`) for service/web streaming.
- Added `StorageAdapter` so web can read `output/` without duplicating path logic.
- Added metadata sidecars: `output/<channel_dir>/_channel.json` and `output/<channel_dir>/<basename>.meta.json`.
- Added language detection (yt-dlp metadata/captions) and unit tests.
- Validated language detection for ES/EN/FR/DE (all OK). Chinese video has no YouTube metadata.
- Implemented: AssemblyAI Automatic Language Detection (ALD) fallback via `language_detection: true` when yt-dlp metadata/captions cannot determine a supported language (covers Chinese/no-metadata cases). See D-006.
- Added language info to TXT header: `Language: es (yt-dlp)` or `Language: zh (auto-detected, 97% confidence)`.
- Phase 0.1: yt-dlp error classification + smarter retries + clearer per-video error stages.
- Phase 0.2: minimal local HTTP API runner (`youtube2text-api`) with `POST /runs`, SSE events, and artifacts listing.

## Phase 0: Next Steps (Do In Order)
0. Keep builds clean (build compiles only `src/`; tests run via `npm test` + `tsx`)
1. yt-dlp reliability hardening (public videos only) - DONE
2. Minimal HTTP API runner (`POST /runs`, `GET /runs/:id/events` SSE, `GET /runs/:id/artifacts`) - DONE
3. Persist API runs/events on disk (restart-safe) - DONE
4. Dockerize once API exists (Node + yt-dlp + ffmpeg; volumes for `output/` and `audio/`) - DONE
5. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events)

## Phase 0.1 Notes (implemented)
- yt-dlp errors are classified (access vs transient vs unavailable) and only retryable failures are retried.
- `player_client=default` hint only shows for retryable failures (not access-denied).

## Phase 0.2 Notes (implemented)
- Start local API with `npm run dev:api` or `npm run build && npm run api`.
- Endpoints are documented in `README.md`.
- Runs/events are persisted by default under `output/_runs/` (disable with `Y2T_API_PERSIST_RUNS=false`).
- Docker API runner: `docker compose up --build` (see `README.md`).

## Key Decisions (Do Not Drift)
- CLI must remain fully operational; service/web are additional layers.
- No members-only/private content support (no cookie ingestion/refresh).
- Web Phase 1 starts only after Phase 0 is stable.

## Critical Notes
- Keep default `ytDlpExtraArgs` as `[]`. Do not default to `youtube:player_client=android` (can require extra tokens and break public downloads).

## Future Reminder
- Scheduled sync/cron: periodically enumerate followed channels and enqueue newly published videos.

## Testing Notes
- `npm run build`
- `npm test`
- `npm run test:docker-smoke` (builds Docker image, hits API `/health`, then stops)
- Manual fixture URLs: `tests/fixtures/test-videos.md`

## Open Questions
- Confirm AssemblyAI `language_code` edge cases (e.g., `es` vs `es_es`) if any appear in practice.
- Decide if we want a documented "recommended" `YT_DLP_EXTRA_ARGS` value beyond the default `[]`.

## Note (resolved): apiPersistence test flakiness
- Fixed by queuing persistence writes in `RunManager` and adding `runManager.flush()` for tests to await before reloading.
