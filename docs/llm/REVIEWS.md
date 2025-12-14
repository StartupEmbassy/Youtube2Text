# Reviews

Keep this file ASCII-only to avoid Windows encoding issues.

## 2025-12-14 - Claude - Phase 1 Web UI Review

### What GPT did well
- Next.js 14 App Router with RSC: pages fetch on server, minimal client JS.
- `output: "standalone"` in next.config.mjs: optimized Docker bundle.
- Minimal deps: only next, react, react-dom (no UI framework bloat).
- Clean separation: `lib/api.ts`, `lib/types.ts`, `app/` pages.
- CSS variables for theming, no heavy frameworks.
- Docker multi-stage uses `.next/standalone` output correctly.
- API extended with `/library/channels`, `/library/channels/:id/videos`, artifact streaming.
- Reuses `FileSystemStorageAdapter` - no path logic duplication.
- Excludes `_runs/` from channel listing (dirs starting with `_` are reserved).
- SSE client (`RunEvents.tsx`) uses `EventSource` correctly.

### Areas to improve (future iterations)
- Types duplicated: `web/lib/types.ts` vs `src/` types should be shared or generated.
- No error handling in UI: if API is down, RSC pages fail with no feedback.
- No form to create runs: UI is read-only, cannot POST new runs.
- Mixed styling: inline `style={{}}` mixed with CSS classes (inconsistent).
- SSE no auto-reconnect: if connection drops, no retry logic.

### Verdict
Good scaffold for Phase 1 "local-first admin". Functional, minimal, correct architecture. Issues are minor and fixable in later iterations.

