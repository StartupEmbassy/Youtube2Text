# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Last Updated: 2025-12-14 - GPT-5.2
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 2 hosted single-tenant service planning (keep CLI intact)

## What Changed Recently
- Phase 0 DONE: core pipeline hardening + language detection + yt-dlp reliability + API runner + Docker.
- Phase 1 DONE: Next.js admin UI (Runs + Library) with SSE, OpenAPI contract/typegen, and live runs list.
- Outputs expanded: `.json` (canonical) + `.txt` + `.md` + `.jsonl` (+ optional `.csv`, `.comments.json`, `.meta.json`).
- Web UX: "Open downloads" shortcuts, more descriptive run labels, thumbnails across Runs/Library.
- Ops: contract check (`npm run api:contract:check`) + docker smoke test (`npm run test:docker-smoke`).

## Roadmap (Do In Order)
1. Phase 0: core service hardening - DONE
2. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events) - DONE
3. Phase 2: hosted single-tenant service (admin) - PLANNED
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
1. Deploy/runtime hardening: server config, HTTPS reverse proxy, healthchecks, logs, backups, upgrades.
2. Auth (admin): protect web/API with a single admin login (or network allowlist) and CSRF basics.
3. Persistent store: move run state from filesystem-only to a small DB (or keep filesystem but add an index DB); define retention policies.
4. Background jobs/queue: decouple run execution from HTTP request lifecycle (worker process).
5. Scheduler: optional cron to watch followed channels and enqueue new videos.

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
