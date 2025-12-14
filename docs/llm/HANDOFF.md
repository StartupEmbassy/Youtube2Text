# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

## Current Status
- Last Updated: 2025-12-14 - GPT-5.2
- Scope: Public YouTube videos only (no cookies support)
- Goal: Finish Phase 0 (core service hardening) without breaking CLI

## What Changed Recently
- Added structured pipeline events (`--json-events`) for service/web streaming.
- Added `StorageAdapter` so web can read `output/` without duplicating path logic.
- Added metadata sidecars: `output/<channel_dir>/_channel.json` and `output/<channel_dir>/<basename>.meta.json`.
- Added language detection (yt-dlp metadata/captions) and unit tests.

## Phase 0: Next Steps (Do In Order)
0. Keep builds clean (build compiles only `src/`; tests run via `npm test` + `tsx`)
1. yt-dlp reliability hardening (public videos only)
2. Minimal HTTP API runner (`POST /runs`, `GET /runs/:id/events` SSE, `GET /runs/:id/artifacts`)
3. Dockerize once API exists (Node + yt-dlp + ffmpeg; volumes for `output/` and `audio/`)

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
- Manual fixture URLs: `tests/fixtures/test-videos.md`

## Open Questions
- Confirm AssemblyAI `language_code` edge cases (e.g., `es` vs `es_es`) if any appear in practice.
- Decide if we want a documented "recommended" `YT_DLP_EXTRA_ARGS` value beyond the default `[]`.
- Implement AssemblyAI ALD as fallback? See D-006 in DECISIONS.md. Chinese video has no YouTube metadata.
