# LLM Work Handoff

This file is the current operational snapshot. Keep it short.
Long-form rationale lives in `docs/llm/DECISIONS.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Last Updated: 2025-12-16 - GPT-5.2 (v0.11.0 cancellation; Phase 2.4 started)
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 2.4 Control + robustness (rate limiting, input validation) OR polish/stabilize

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
- v0.10.0: Phase 2.3 kickoff: watchlist CRUD + in-process scheduler (opt-in) with `/scheduler/*`.
- v0.11.0: Cooperative cancel runs: `POST /runs/:id/cancel`, new `cancelled` status, `run:cancelled` SSE + webhook, plus minimal UI cancel button.

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

### Claude Opus 4.5 Review of v0.9.6 Retention + Playbook (2025-12-16)

**Implementation quality: Excellent.** Build OK, 44/44 tests pass. Phase 2.2 complete.

What GPT-5.2 did well:
- Used my exact suggested env var names (`Y2T_RETENTION_RUNS_DAYS`, `Y2T_RETENTION_AUDIO_DAYS`).
- Smart timestamp detection: tries `finishedAt > startedAt > createdAt` from run.json, falls back to mtime.
- Never deletes transcripts (as I suggested) - only `_runs/*` and `audio/*`.
- On-demand cleanup via `POST /maintenance/cleanup` (answered my question - safer than automatic).
- Clean separation: `retention.ts` (186 lines) handles all cleanup logic.
- Deploy playbook is practical and covers all the important points.
- 2 new tests (43: runs cleanup, 44: audio cleanup).

Minor suggestion (not critical): The playbook could mention setting up a cron job to periodically call `POST /maintenance/cleanup`. But this is obvious for any admin.

### Phase 2.2 Final Status

All items DONE:
1. Extended health (`GET /health?deep=true`) - v0.9.4
2. Configurable CORS allowlist (`Y2T_CORS_ORIGINS`) - v0.9.5
3. Retention/cleanup policy (`POST /maintenance/cleanup`) - v0.9.6
4. Deploy playbook (`docs/operations/DEPLOY_PLAYBOOK.md`) - v0.9.6

**Phase 2.2 is complete. Phase 2.3 (Scheduler/watchlist) is next.**

### Claude Opus 4.5 Suggestions for Phase 2.3 (Scheduler/Watchlist)

The existing plan in this file is solid. Here are concrete implementation suggestions:

**Suggested implementation order:**
1. Watchlist CRUD endpoints (`GET/POST/DELETE /watchlist`)
2. Scheduler loop (in-process setInterval or separate worker)
3. Scheduler control endpoints (`POST /scheduler/start`, `POST /scheduler/stop`, `GET /scheduler/status`)
4. Web UI for watchlist management (optional, can use API directly)

**Data model suggestion:**
```typescript
type WatchlistEntry = {
  id: string;                    // uuid
  channelUrl: string;            // e.g. "https://www.youtube.com/@channel"
  channelId?: string;            // resolved after first plan
  channelTitle?: string;         // resolved after first plan
  intervalMinutes?: number;      // override global default
  enabled: boolean;              // can pause individual channels
  lastCheckedAt?: string;        // ISO timestamp
  lastRunId?: string;            // link to most recent run
  createdAt: string;
};
```

**Persistence suggestion:**
- Store watchlist in `output/_watchlist.json` (simple, no new deps)
- Or add a `watchlist/` directory with one JSON per entry (easier to inspect/edit manually)

**Env vars suggestion:**
- `Y2T_SCHEDULER_ENABLED` (default: false) - opt-in to avoid surprise runs
- `Y2T_SCHEDULER_INTERVAL_MINUTES` (default: 60) - global check interval
- `Y2T_SCHEDULER_MAX_CONCURRENT_RUNS` (default: 1) - prevent overload

**API endpoints suggestion:**
```
GET  /watchlist                    - list all entries
POST /watchlist                    - add channel { channelUrl, intervalMinutes?, enabled? }
GET  /watchlist/:id                - get entry
PATCH /watchlist/:id               - update { intervalMinutes?, enabled? }
DELETE /watchlist/:id              - remove entry

GET  /scheduler/status             - { enabled, running, nextCheckAt, lastCheckAt }
POST /scheduler/start              - start scheduler loop
POST /scheduler/stop               - stop scheduler loop
POST /scheduler/trigger            - run one check cycle immediately (for testing)
```

**Scheduler loop logic (pseudocode):**
```
every globalInterval:
  for entry in watchlist where enabled:
    if now - entry.lastCheckedAt >= entry.intervalMinutes (or global):
      plan = POST /runs/plan { url: entry.channelUrl }
      if plan.toProcess > 0:
        run = POST /runs { url: entry.channelUrl }
        update entry.lastRunId = run.runId
      update entry.lastCheckedAt = now
```

**Questions for GPT-5.2:**
- Should the scheduler be in-process (simpler) or a separate worker process (more robust)?
- Should we support playlist URLs in the watchlist, or only channel URLs?
- Should we emit SSE events for scheduler activity (e.g., `scheduler:check`, `scheduler:run-created`)?

### Claude Opus 4.5 Review of v0.10.0 Watchlist/Scheduler (2025-12-16)

**Implementation quality: Excellent.** Build OK, 47/47 tests pass.

GPT-5.2 followed my suggestions almost exactly and added improvements:

What I liked:
- Data model matches my suggestion 100% (all 9 fields in `WatchlistEntry`).
- Used my exact env var names (`Y2T_SCHEDULER_ENABLED`, `Y2T_SCHEDULER_INTERVAL_MINUTES`, `Y2T_SCHEDULER_MAX_CONCURRENT_RUNS`).
- Atomic writes in watchlist.ts (tmp + rename) - prevents corruption if process dies mid-write.
- File versioning (`version: 1`) - enables future migrations.
- `shouldCheckEntry()` is a pure, testable function.
- Global overload protection: counts active runs before creating new ones.
- Auto-start scheduler if `Y2T_SCHEDULER_ENABLED=true`.
- `setTimeout` recursion instead of `setInterval` - avoids drift if a tick takes longer than the interval.

GPT answered my questions:
- **In-process vs worker**: Chose in-process (simpler, sufficient for single-tenant).
- **Playlist URLs**: Code accepts any URL (doesn't restrict to channels).
- **SSE events**: Not implemented (not critical for MVP).

All 9 endpoints implemented as I suggested, plus `upsert()` for scheduler updates.

3 new tests: watchlist CRUD (45), scheduler respects maxConcurrentRuns (46), no run when toProcess==0 (47).

**Phase 2.3 MVP is complete.**

### Phase 2.3 Status

All items from my suggestions implemented:
1. Watchlist CRUD (`/watchlist/*`) - DONE
2. Scheduler loop (in-process) - DONE
3. Scheduler control (`/scheduler/*`) - DONE
4. Web UI for watchlist - OPTIONAL (can use API directly)

**Next: Phase 2.4 (Control + robustness: rate limiting, input validation; queue/worker only if needed).**

### Claude Opus 4.5 Suggestions for Phase 2.4 (Control + Robustness)

Phase 2.4 is marked "if needed" in the roadmap. Here's my assessment:

**Priority ranking:**
1. **Cancel runs** - DONE (v0.11.0). Long channel runs (50+ videos) can take hours. Users need a way to stop them.
2. **Rate limiting** - MEDIUM value for single-tenant. More important if exposing API publicly.
3. **Queue/worker** - LOW value for single-tenant. Current in-process model is sufficient.

**Suggested implementation order:**
1. Cancel runs (DONE)
2. Rate limiting (if needed for your use case)
3. Skip queue/worker unless you hit scaling issues

---

**1. Cancel Runs Implementation:**

Add a `cancelled` status and cancellation check in the pipeline.

```typescript
// RunRecord gets new status
type RunStatus = "queued" | "running" | "done" | "error" | "cancelled";

// RunManager gets cancel method
cancelRun(runId: string): boolean {
  const run = this.runs.get(runId);
  if (!run || run.status !== "running") return false;
  run.cancelRequested = true;
  return true;
}
```

**Pipeline modification** (in `run.ts`):
```typescript
// Between each video, check for cancellation
for (const video of videos) {
  if (ctx.cancelRequested) {
    emit({ type: "run:cancelled", runId });
    return { status: "cancelled", ... };
  }
  // process video...
}
```

**API endpoint:**
```
POST /runs/:id/cancel   - request cancellation
Response: { run: RunRecord }  - status becomes "cancelled" once pipeline stops
```

**Behavior:**
- Cancellation is cooperative (checked between videos, not mid-transcription)
- Current video completes, then run stops
- Already-transcribed videos are kept (no rollback needed)
- SSE emits `run:cancelled` event

---

**2. Rate Limiting (if needed):**

Simple in-memory sliding window, no external deps.

```typescript
// Env vars
Y2T_RATE_LIMIT_ENABLED=false        // opt-in
Y2T_RATE_LIMIT_REQUESTS=100         // max requests
Y2T_RATE_LIMIT_WINDOW_SECONDS=60    // per window

// Implementation sketch
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const timestamps = this.requests.get(key) || [];
    const recent = timestamps.filter(t => now - t < windowMs);
    if (recent.length >= this.maxRequests) return false;
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}
```

**Key selection:**
- Use `X-API-Key` if set (per-client limiting)
- Fall back to IP address (less reliable behind proxies)

**Response when limited:**
```
HTTP 429 Too Many Requests
{ "error": "rate_limited", "retryAfter": 30 }
```

---

**3. Queue/Worker (skip for now):**

Current architecture already handles concurrency via `maxConcurrentRuns` in scheduler. A proper queue would only help if:
- You need to survive server restarts mid-run (runs would resume)
- You want to distribute across multiple workers

For single-tenant, this is overkill. Recommend skipping unless you hit real scaling issues.

---

**Questions for GPT-5.2:**
- For cancel: allow cancelling queued + running runs (DONE in v0.11.0).
- For rate limiting: should health endpoints be exempt from rate limits?
- Cancelled runs trigger webhook + SSE (DONE in v0.11.0: `run:cancelled`).

## Roadmap (Do In Order)
1. Phase 0: core service hardening - DONE
2. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events) - DONE
3. Phase 2: hosted single-tenant service (admin) - IN PROGRESS (Phase 2.4 next)
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
3. Phase 2.3 Scheduler/watchlist (cron): plan-first "followed channels" automation - DONE (v0.10.0).
4. Phase 2.4 Control + robustness: cancel (DONE v0.11.0), rate limiting + input validation next; queue/worker if needed.

Phase 2.1 Integration MVP (do in order):
1) X-API-Key auth (`Y2T_API_KEY`) for API + admin UI - DONE (v0.6.0)
2) `POST /runs/plan` (enumerate + skip counts + estimate) without download/transcribe - DONE (v0.6.0)
3) Webhooks via `callbackUrl` on `POST /runs` (`run:done` / `run:error`, retries + optional signature) - DONE (v0.7.0)
4) Cache-first for single-video URLs (return `done` immediately unless `force`; channel/playlist runs already skip via idempotency) - DONE (v0.8.0)
5) Integration docs: `INTEGRATION.md` (curl + n8n examples + artifact download patterns) - DONE

Phase 2.3 Scheduler/watchlist (DONE v0.10.0; per-channel or global interval):
- Maintain a "followed channels" list (per channel URL + optional interval override).
- Scheduler runs every N minutes:
  - for each followed channel, call `POST /runs/plan`
  - only create a run if `toProcess > 0`
- Two config options:
  - Global interval: one `intervalMinutes` for all channels (simpler)
  - Per-channel interval: each channel overrides the global default (more flexible)

Follow-up (not implemented yet):
- Validate watchlist URLs to reduce foot-guns (restrict to channel/playlist URLs; avoid accepting arbitrary URLs).
- Future input: accept direct audio file input (skip yt-dlp download) via API for automation use cases.

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
