# LLM Work Handoff Archive

This file contains archived reviews and suggestions from past sessions.
Current operational snapshot is in `HANDOFF.md`.

All content should be ASCII-only to avoid Windows encoding issues.

---

## Settings UI Implementation Reference (v0.17.0-v0.17.5) - Archived 2025-12-20

This section contains the CSS specs and component patterns that were implemented in v0.17.0-v0.17.5.
Moved here from HANDOFF.md to keep the operational snapshot short.

### Tooltip CSS (Gemini-designed, implemented in v0.17.2)

```css
/* Tooltip for settings help text (Gemini-designed) */
.tooltipContainer {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
}

.tooltipIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--border);
  color: var(--muted);
  font-size: 11px;
  font-weight: bold;
  cursor: help;
  user-select: none;
}

.tooltipText {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  z-index: 100;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  padding: 8px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  transition: opacity 0.2s;
  pointer-events: none;
}

.tooltipText::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: var(--border) transparent transparent transparent;
}

.tooltipContainer:hover .tooltipText {
  visibility: visible;
  opacity: 1;
}
```

### Tooltip Component Pattern (implemented with GPT enhancements)

```tsx
function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tooltipContainer" data-open={open ? "true" : "false"}>
      <span
        className="tooltipIcon"
        role="button"
        tabIndex={0}
        aria-label={text}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}
        onBlur={() => setOpen(false)}
      >?</span>
      <span className="tooltipText">{text}</span>
    </span>
  );
}
```

**Note:** GPT-5.2 added accessibility enhancements beyond the original spec: click support for mobile, keyboard navigation, aria-label, and data-open state.

### Help Text for Each Field (implemented in v0.17.2)

| Field | Help Text |
|-------|-----------|
| filenameStyle | Output filename format: title_id (Video Title_abc123), id_title, or id only |
| audioFormat | Downloaded audio format: mp3 (smaller) or wav (lossless) |
| concurrency | How many videos to process in parallel (1-10 typical) |
| languageDetection | auto = AssemblyAI detects language, manual = you specify |
| languageCode | Language code when manual (e.g., es, en_us, fr, de) |
| csvEnabled | Generate CSV file with timestamps alongside JSON |
| commentsEnabled | Download YouTube comments for each video |
| commentsMax | Max comments to download per video (empty = no limit) |
| maxNewVideos | Limit new videos per run (empty = process all) |
| afterDate | Only process videos published after this date |
| catalogMaxAgeHours | Hours before refreshing channel video list (cache TTL, default 168 = 7 days) |
| pollIntervalMs | How often to check AssemblyAI for transcription status (ms) |
| maxPollMinutes | Timeout waiting for a single transcription |
| downloadRetries | Retry attempts if audio download fails |
| transcriptionRetries | Retry attempts if transcription fails |

Note: `ytDlpExtraArgs` was removed in v0.18.0 for security (no arbitrary yt-dlp flags via Settings/UI/API).

### v0.17.3 UX Follow-up (3-LLM consensus)

Note: This section is obsolete as of v0.18.0 (the `ytDlpExtraArgs` setting was removed).

**Problem:**
1. "yt-dlp" is technical jargon users dont understand
2. Textarea can be resized horizontally, breaking layout

**Solution:**
- Renamed section from "yt-dlp" to "Advanced (download)"
- Updated tooltip to user-friendly language
- Added `textarea.input { resize: vertical; max-width: 100%; }`

| Reviewer | Verdict |
|----------|---------|
| GPT | Proposed the changes |
| Claude | Approved |
| Gemini | Approved |

### v0.17.4-v0.17.5 Enhancements

- **v0.17.4:** When a field is unset (inherit), shows inline `effective: value` hint
- **v0.17.5:** Added per-field source tracking - shows `(env)`, `(config.yaml)`, `(settings file)`, `(default)` next to effective values

---

## Claude Opus 4.5 UX Review: Settings Page (v0.17.0) - 2025-12-19

**Problem:** The Settings UI (`/settings`) has poor visual design compared to other pages in the app. Inputs are oversized, there's excessive whitespace, and the layout doesn't match the compact patterns used elsewhere.

**Review method:** Initial analysis by Claude Opus 4.5, then validated and refined via consultation with Google Gemini CLI (gemini-cli v0.21.0).

### Current Issues (in order of severity)

#### 1. Inputs are massively oversized

The `.input` class in `globals.css` has:
```css
.input {
  flex: 1 1 520px;   /* <- 520px flex-basis! */
  min-width: 260px;  /* <- 260px minimum! */
  padding: 10px 12px;
}
```

This makes sense for the main URL input in CreateRunForm, but is absurd for:
- `concurrency` (needs 2-3 digits)
- `commentsMax` (needs 3-4 digits)
- `downloadRetries` (needs 1 digit)

**Compare:** WatchlistClient uses `style={{ flex: "0 0 140px" }}` for interval inputs. CreateRunForm uses `style={{ flex: "0 0 220px" }}` for maxNewVideos.

#### 2. Too much vertical space

- `.stack` has `gap: 12px` between every field
- Each `.card` has `padding: 14px`
- 7 cards in a grid = 7 x (padding + gaps + padding)
- Result: Excessive scrolling for a settings page

#### 3. No input sizing by data type

All inputs look identical regardless of content:
- A dropdown with 3 options takes 520px
- A number field for `concurrency: 3` takes 520px
- A textarea for `ytDlpExtraArgs` takes 520px (obsolete; setting removed in v0.18.0)

#### 4. Card-heavy layout creates visual clutter

7 separate cards with thick borders and padding creates a "wall of boxes" effect. Settings pages typically use lighter visual separation.

---

### Recommended Fixes (Priority Order)

#### Fix 1: Add compact input classes (REQUIRED)

**Input widths validated by Gemini CLI consultation:**

| Field Type | Gemini Recommendation | Final Decision |
|------------|----------------------|----------------|
| Small numbers (1-10) | 70px | 70px |
| Medium numbers (1-1000) | 90px | 90px |
| Short text (language codes) | 80px | 80px |
| Dates (YYYY-MM-DD) | 120px | 120px |
| Multiline textarea | 520px / full width | full width |

Add to `globals.css`:
```css
/* Compact inputs for settings forms */
/* Widths validated via Gemini CLI UX consultation */
.inputXs {
  flex: 0 0 70px;
  min-width: 50px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.7);
  color: inherit;
}

.inputSm {
  flex: 0 0 90px;
  min-width: 70px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.7);
  color: inherit;
}

.inputMd {
  flex: 0 0 120px;
  min-width: 100px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.7);
  color: inherit;
}

/* Tighter stack for settings */
.stackTight {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Inline label + input row */
.formRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.formLabel {
  min-width: 140px;
  text-align: right;  /* Gemini recommendation: right-align labels */
  color: var(--muted);
  font-size: 13px;
}
```

#### Fix 2: Use inline rows with RIGHT-ALIGNED labels (REQUIRED)

**Gemini insight:** For desktop admin panels with short labels, horizontal inline rows are better than vertical stacks. Right-align labels to keep them close to inputs and maintain vertical alignment of inputs.

Instead of:
```jsx
<label className="stack">
  <span className="muted">concurrency</span>
  <input className="input" ... />  /* 520px wide! */
</label>
```

Do:
```jsx
<div className="formRow">
  <span className="formLabel">concurrency</span>  /* right-aligned */
  <input className="inputXs" ... />  /* 70px wide */
</div>
```

**Note:** For general-purpose forms (mobile, long labels), vertical stacks are preferred. But for desktop admin panels with short labels, horizontal is more compact and scannable.

#### Fix 3: Apply appropriate sizes by field type (REQUIRED)

| Field Type | Class | Width | Examples |
|------------|-------|-------|----------|
| Small numbers (1-99) | `.inputXs` | 70px | concurrency, retries |
| Medium numbers (1-9999) | `.inputSm` | 90px | commentsMax, pollIntervalMs |
| Short text / dates | `.inputMd` | 120px | languageCode, afterDate |
| Dropdowns | `.inputMd` | 120px | filenameStyle, audioFormat |
| Multiline text | `.input` | full | ytDlpExtraArgs (obsolete; removed in v0.18.0) |

#### Fix 4: Reduce to 2-3 cards with internal sections (REQUIRED)

**Gemini recommendation:** Use 2-3 cards with clear section headers inside, not 7 separate cards.

```jsx
{/* Card 1: General Settings */}
<div className="card">
  <h3>Core</h3>
  <div className="formRow">...</div>

  <div className="spacer14" />
  <h3>Language</h3>
  <div className="formRow">...</div>

  <div className="spacer14" />
  <h3>Outputs</h3>
  <div className="formRow">...</div>
</div>

{/* Card 2: Behavior */}
<div className="card">
  <h3>Planning</h3>
  <div className="formRow">...</div>

  <div className="spacer14" />
  <h3>Polling</h3>
  <div className="formRow">...</div>

  <div className="spacer14" />
  <h3>Retries</h3>
  <div className="formRow">...</div>
</div>

{/* Card 3: Advanced */}
<div className="card">
  <h3>yt-dlp</h3>
  <textarea className="input" ... />
</div>
```

**Why fewer cards is better (Gemini):**
1. Reduces visual noise (fewer borders/shadows)
2. Improves logical grouping
3. Enhances scannability (top-to-bottom flow)
4. Better responsiveness

#### Fix 5: Group related fields on same row (NICE TO HAVE)

```jsx
<div className="formRow">
  <span className="formLabel">Retries</span>
  <span className="muted">download:</span>
  <input className="inputXs" value={downloadRetries} />
  <span className="muted">transcription:</span>
  <input className="inputXs" value={transcriptionRetries} />
</div>
```

This puts related fields together and reduces vertical space.

---

### Visual Comparison

**Current (bad):**
```
+----------------------------------+
| Core                             |
|                                  |
|   filenameStyle                  |
|   [__________________v_______]   |  <- 520px dropdown!
|                                  |
|   audioFormat                    |
|   [__________________v_______]   |  <- 520px dropdown!
|                                  |
|   concurrency                    |
|   [__________________3_______]   |  <- 520px for "3"!
|                                  |
+----------------------------------+
```

**Recommended (good):**
```
+--------------------------------------------+
| Core                                       |
|                                            |
|        filenameStyle  [title_id v]         |
|          audioFormat  [mp3 v]              |
|          concurrency  [3 ]                 |
|                       ^                    |
|            right-aligned labels            |
+--------------------------------------------+
```

---

### Implementation Effort

| Fix | Effort | Impact |
|-----|--------|--------|
| Add CSS classes | 10 min | Foundation for all fixes |
| Apply sizes to inputs | 30 min | Major visual improvement |
| Right-aligned inline rows | 45 min | Better scannability |
| Reduce to 2-3 cards | 20 min | Less visual clutter |
| Group related fields | 30 min | Polish |

**Total: ~2-3 hours for a proper redesign.**

---

### Gemini CLI Consultation Summary (2025-12-19)

Consulted Google Gemini via `npx github:google-gemini/gemini-cli` for UX validation.

**Questions asked:**
1. What pixel widths for each input type?
2. How many cards for 15 settings?
3. Vertical stacks vs horizontal rows?

**Key learnings from Gemini:**
1. **Tighter input widths** - Gemini suggested 70-90px for numbers (I originally proposed 80-120px)
2. **Right-align labels** - Classic form pattern I hadn't included
3. **Context matters** - Vertical stacks for general forms, horizontal for desktop admin with short labels
4. **2-3 cards max** - Confirmed my recommendation, with clear reasoning

**Where Claude and Gemini agreed:**
- 520px inputs are wrong for numeric fields
- Reduce from 7 cards to 2-3
- Horizontal layout for this specific use case (desktop admin, short labels)
- Full width for multiline textarea

**Where Gemini improved my recommendations:**
- Tighter widths (70px vs 80px for small numbers)
- Right-aligned labels (I hadn't specified alignment)

---

### Reference: How other pages do it right

**CreateRunForm.tsx (line 147-159):**
```jsx
<input
  className="input"
  style={{ flex: "0 0 220px" }}  /* <-- constrained! */
  placeholder="max new videos"
  ...
/>
```

**WatchlistClient.tsx (line 345-352):**
```jsx
<input
  className="input"
  style={{ flex: "0 0 140px", minWidth: 120 }}  /* <-- constrained! */
  placeholder="global"
  ...
/>
```

The Settings page should follow these patterns, or better yet, use dedicated CSS classes so the constraints are consistent and maintainable.

---

## Previous Status (archived)
- Last Updated: 2025-12-18 - Claude Opus 4.5 (v0.16.2 + v0.16.3 review - all suggestions implemented)
- Scope: Public YouTube videos only (no cookies support)
- Goal: Phase 2.7 - Polish + optional Settings UI (keep CLI unchanged)
- Next: All catalog cache suggestions implemented. Ready for next phase.

## Claude Opus 4.5 Review of v0.16.0 - Catalog Cache + Processed Index (2025-12-17)

**Implementation quality: Excellent.** Build OK, 63/63 tests pass (2 new).

GPT-5.2 implemented two performance optimizations for large channels:

### 1. Catalog Cache (`src/youtube/catalogCache.ts`)

**What it does:**
- First time: full yt-dlp enumeration, saves to `output/_catalog/<channelId>.json`
- Subsequent: incremental refresh (fetch N newest videos, merge with cache)
- Falls back to full enumeration if previous head not found in newest chunk

**What I liked:**
- Versioned schema (`version: 1`) for future migrations
- Exponential chunk growth (200 -> 400 -> 800...) until previous head found
- `uniqById()` for correct deduplication
- Fallback to full enumeration when too many new videos

### 2. Processed Index (`src/storage/processedIndex.ts`)

**What it does:**
- Scans `output/<channelDir>/*.json` once per plan/run
- Builds `Set<string>` of processed video IDs
- Avoids per-video `fs.stat()` calls (1000+ calls -> 1-2 readdir)

**What I liked:**
- Correctly filters out `.meta.json`, `.comments.json`, `_channel.json`
- Supports multiple basename formats (`id.json`, `id__title.json`, `title__id.json`)
- `parseVideoIdFromBaseName()` has smart heuristics for ambiguous cases

### 3. Integration in `plan.ts`

Uses `getListingWithCatalogCache()` + `buildProcessedVideoIdSet()` for O(1) lookups instead of O(n) filesystem checks.

**Performance impact:** For a 1000-video channel, goes from ~1000 fs.stat() calls to ~2 readdir() calls.

---

## Claude Opus 4.5 Suggestions for v0.16.0 Improvements

These are optional polish items for GPT-5.2 to consider:

### 1. Cache TTL (Time To Live) - RECOMMENDED

**Problem:** The catalog cache never expires. If a channel deletes/privates old videos, the cache still lists them.

**Scenario:**
- Day 1: Channel has 1000 videos -> cached
- Day 30: Channel deletes 50 old videos
- Cache still shows those 50 videos as "existing"
- If you try to process them, yt-dlp fails

**Suggested fix:** Add `Y2T_CATALOG_MAX_AGE_HOURS` env var (default: 168 = 7 days).

```typescript
const cached = await readCatalog(path);
const ageHours = (Date.now() - Date.parse(cached.retrievedAt)) / 3600000;
if (ageHours > maxAgeHours) {
  // Force full enumeration even if cache exists
  return enumerateChannelFull(...);
}
```

**Effort:** 15-30 minutes.

---

### 2. Cache metrics/logging - NICE TO HAVE

**Problem:** No visibility into whether cache is being used effectively.

**Suggested fix:** Add log lines or Prometheus metrics:
- `y2t_catalog_cache_hit` / `y2t_catalog_cache_miss`
- Log: `[catalog] cache hit for UC... (age: 2.3h, 1372 videos)`
- Log: `[catalog] incremental refresh added 5 new videos`

**Effort:** 30 minutes.

---

### 3. Integration test for cache flow - NICE TO HAVE

**Problem:** Current tests only cover `mergeNewestFirst()` and `buildProcessedVideoIdSet()` in isolation.

**Suggested test:** Full flow test:
1. First call -> cache miss -> full enumeration
2. Second call -> cache hit -> incremental refresh
3. Verify merged result is correct

**Effort:** 1 hour (needs mock yt-dlp or fixture data).

---

**Summary:** v0.16.0 is solid. The TTL suggestion is the most important improvement to prevent stale cache issues.

---

## Claude Opus 4.5 Review of v0.16.1 - Cache TTL (2025-12-18)

**Implementation quality: Excellent.** Build OK, 63/63 tests pass. GPT-5.2 implemented my TTL suggestion correctly.

### What GPT-5.2 did:

1. **Config schema** (`schema.ts`):
   ```typescript
   catalogMaxAgeHours: z.number().int().default(168),
   ```

2. **Env var** (`loader.ts`):
   - `Y2T_CATALOG_MAX_AGE_HOURS` maps to `catalogMaxAgeHours`

3. **TTL check** (`catalogCache.ts` lines 137-157):
   - Correct position: after cache validation, before incremental refresh
   - `maxAgeHours > 0` allows disabling TTL with `<= 0`
   - Handles invalid `Date.parse()` with `Number.isFinite()`

4. **Documentation**: `.env.example` and `README.md` updated

### Minor suggestions (optional, low priority):

1. **No test for TTL logic**: A unit test could verify behavior with old vs new cache. Simple to add but not critical since logic is straightforward.

2. **No logging on TTL expiry**: Would be useful to log when cache expires:
   ```
   [catalog] cache expired (age: 170h > 168h), forcing full refresh for UC...
   ```

### Status of my v0.16.0 suggestions:

| Suggestion | Status |
|------------|--------|
| 1. Cache TTL | DONE in v0.16.1 |
| 2. Cache metrics/logging | DONE in v0.16.2 + v0.16.3 |
| 3. Integration test | DONE in v0.16.2 |

**Verdict:** TTL implementation is solid. Remaining suggestions are low priority polish.

---

## Claude Opus 4.5 Review of v0.16.2 + v0.16.3 - TTL Tests + Observability (2025-12-18)

**Implementation quality: Excellent.** Build OK, 65/65 tests pass. GPT-5.2 implemented ALL my remaining suggestions.

### v0.16.2 - TTL Logging + Tests

**Logging added:**
```
[catalog] Cache expired for UC... (age 170.3h > 168h); forcing full refresh
```

**Tests added** (`catalogCacheTtl.test.ts`):
1. `catalog cache TTL forces full enumeration when cache is too old` - 200h old cache, 168h TTL -> full refresh
2. `catalog cache does incremental refresh when TTL not exceeded` - 2h old cache, 168h TTL -> incremental

**What I liked:**
- Dependency injection of `enumerate` function allows mocking yt-dlp in tests
- Test verifies NO incremental refresh happens when TTL expires
- Clean `isoHoursAgo()` helper

### v0.16.3 - Prometheus Metrics + Full Logging

**6 Prometheus metrics added:**

| Metric | Description |
|--------|-------------|
| `y2t_catalog_cache_hit_total` | Cache hits |
| `y2t_catalog_cache_miss_total` | Cache misses |
| `y2t_catalog_cache_expired_total` | TTL expirations |
| `y2t_catalog_full_refresh_total` | Full enumerations |
| `y2t_catalog_incremental_refresh_total` | Incremental refreshes |
| `y2t_catalog_incremental_added_videos_total` | New videos discovered |

**Clean architecture:**
- `catalogMetrics.ts` - in-process counters with `inc*()` functions and `getCatalogMetricsSnapshot()`
- `resetCatalogMetricsForTests()` for test isolation
- Integrated into `/metrics` endpoint

**Full logging added:**
```
[catalog] Cache miss for UC...; enumerating full channel listing
[catalog] Cache invalid for UC...; enumerating full channel listing
[catalog] Cache expired for UC... (age 170.3h > 168h); forcing full refresh
[catalog] Incremental refresh for UC...: +5 new videos (fetched 200)
[catalog] Incremental refresh for UC... failed to find previous head; enumerating full
```

### Final status of all my suggestions:

| Suggestion | Version | Status |
|------------|---------|--------|
| Cache TTL | v0.16.1 | DONE |
| TTL logging | v0.16.2 | DONE |
| TTL tests | v0.16.2 | DONE |
| Prometheus metrics | v0.16.3 | DONE |
| General logging | v0.16.3 | DONE |

**All suggestions implemented.** No further improvements needed for catalog cache.

## Decision RESOLVED - Channel Totals Bug (v0.15.1)

Issue observed (Library -> channel -> "Compute totals"):
- Example output: "Downloaded videos: 16 | Channel total: 2" for a channel that clearly has 1000+ videos.

Root causes identified (two separate problems, both fixed):
1) **yt-dlp enumeration for bare channel URLs** (Claude fix - core):
   - Problem: URL like `/channel/UC...` (no `/videos`) returns channel tabs (2-5 items) instead of actual videos.
   - Fix: `normalizeChannelUrlForEnumeration()` in `src/youtube/url.ts` auto-appends `/videos` suffix.
   - Files: `src/youtube/url.ts`, `src/youtube/enumerate.ts`, `tests/urlNormalization.test.ts`

2) **AFTER_DATE default filtering** (GPT fix - UI):
   - Problem: If `AFTER_DATE` is set in `.env`, "Channel total" shows filtered count, not true total.
   - Fix: `ChannelActions.tsx` sends `afterDate: ""` to clear the filter when computing totals.
   - Also added warning if `totalVideos < downloadedCount` (indicates filtering issue).
   - Files: `web/app/library/[channelDirName]/ChannelActions.tsx`

**Claude Opus 4.5 Review of GPT-5.2 Analysis:**
- GPT's analysis is correct: two separate problems that can both occur.
- Both fixes are complementary and should be kept (Option 1 approved).
- Core fix applies to CLI/API/UI; UI fix is specific to "Compute totals" display.
- Version drift fixed: `package.json` and `openapi.yaml` both at 0.15.1.

**Final state:**
- Version: 0.15.1
- Build: OK
- Tests: 61/61 passing (4 new URL normalization tests)

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
- v0.11.1: OpenAPI polish (license + operationIds), watchlist URL validation + env override, thumbnail backfill regression test, and deploy playbook cron example.
- v0.12.0: OpenAPI 4XX completeness, `GET /runs/:id/logs` endpoint, and API graceful shutdown on SIGTERM/SIGINT.
- v0.13.0: Phase 2.5: Watchlist web UI (`/watchlist`) + Prometheus metrics endpoint (`GET /metrics`).
- v0.13.1: Watchlist UI: per-entry interval overrides editable + per-entry "Run now" (plan-first).
- v0.13.2: Watchlist UI: intervals displayed/edited in hours (converted to minutes for the API).
- v0.14.0: Phase 2.6: replace legacy `maxVideos` with `maxNewVideos` (limit-after-skip) and add web Create Run advanced options with on-demand plan preview.
- v0.14.1: Phase 2.6 polish: Create Run UI warns when `force=true` and `maxNewVideos` is set (reprocess mode); run detail Downloads auto-updates as videos finish (no manual refresh needed).
- v0.15.0: Phase 2.6 polish: Library channel pages show channel title + quick actions (Open/Copy/Run) and on-demand totals via `POST /runs/plan`.
- v0.15.1: Fix channel enumeration bug: bare channel URLs (`/channel/UC...`) now auto-normalize to `/videos` suffix so yt-dlp returns actual videos instead of channel tabs.
- v0.16.0: Exact planning performance: cache channel catalog under `output/_catalog/<channelId>.json` and build a processed-id set by scanning `output/<channelDir>/*.json` once per plan/run (avoids per-video existence checks across the full channel listing).
- v0.16.1: Catalog cache TTL: add `Y2T_CATALOG_MAX_AGE_HOURS` / `catalogMaxAgeHours` (default 168h). If the catalog is older than this, the next plan/run forces a full refresh to avoid stale/deleted videos.
- v0.16.2: Catalog TTL polish: log when the cache expires and add unit tests covering TTL (expired => full refresh, fresh => incremental refresh).
- v0.16.3: Catalog cache observability: add Prometheus counters for catalog cache hit/miss/expired and full vs incremental refresh; add catalog log lines for cache miss/invalid, incremental refresh (+N new videos), and fallback to full refresh.

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

### Claude Opus 4.5 Review of v0.11.0 Cancel Runs (2025-12-16)

**Implementation quality: Excellent.** Build OK, 49/49 tests pass.

GPT-5.2 implemented cancel runs exactly as I suggested:

What I liked:
- `AbortController` integration - standard Node.js pattern for cooperative cancellation.
- Dual-path cancel: queued runs cancel immediately, running runs wait for next checkpoint.
- Added `/runs/:id/cancel` to response links for API discoverability.
- Stats preserved in `run:cancelled` event (succeeded, failed, skipped, total).
- Minimal UI cancel button (bonus, not in my suggestion).
- 2 new tests: queued cancel (48), running cancel (49).

Implementation matches my suggestion 100%:
- `cancelled` status in `RunStatus`
- `cancelRequested` flag in `RunRecord`
- `cancelRun()` in RunManager with queued/running logic
- Pipeline checks `isCancelled()` between videos
- Webhook + SSE emit `run:cancelled`

No issues found.

### Phase 2.4 Status

Completed:
1. Cancel runs (`POST /runs/:id/cancel`) - DONE (v0.11.0)

Remaining (optional):
2. Rate limiting - MEDIUM priority, skip unless exposing API publicly
3. Input validation for watchlist URLs - LOW priority
4. Queue/worker - SKIP for single-tenant

**Phase 2 is effectively complete for single-tenant use case.**

### Claude Opus 4.5 Suggestions for Polish/Stabilize (2025-12-16)

The codebase is clean (no TODOs/FIXMEs found in `src/`). Here are polish suggestions organized by priority:

Phase 2.4 polish/stabilize execution order (roadmap refinement):
1) Phase 2.4.1 OpenAPI polish: add `license` + `operationId` - DONE (v0.11.1)
2) Phase 2.4.2 Watchlist safety: validate watchlist URLs (channel/playlist only) + env override - DONE (v0.11.1)
3) Phase 2.4.3 Regression tests: cache-first channel thumbnail backfill test - DONE (v0.11.1)
4) Phase 2.4.4 Ops docs: add cron examples for retention cleanup in deploy playbook - DONE (v0.11.1)
5) Phase 2.4.5 OpenAPI completeness: add missing 4XX responses - DONE (v0.12.0)
6) Phase 2.4.6 Graceful shutdown: stop scheduler + cancel runs on SIGTERM/SIGINT - DONE (v0.12.0)
7) Phase 2.4.7 Debug logs endpoint: `GET /runs/:id/logs` - DONE (v0.12.0)

---

**HIGH priority (quick wins - less than 1 hour total):**

---

**1. OpenAPI operationId fields**

Problem: Running `npm run api:spec:validate` shows 22 warnings about missing `operationId` on endpoints.

Why it matters: When you generate TypeScript clients from OpenAPI (like we do with `openapi-typescript`), the `operationId` becomes the function name. Without it, tools generate ugly names like `getRunsRunId` instead of clean names like `getRun`. This affects anyone integrating with the API programmatically.

Fix: Add `operationId` to each endpoint in `openapi.yaml`:
```yaml
/runs:
  get:
    operationId: listRuns
    summary: List runs
  post:
    operationId: createRun
    summary: Create and start a run
/runs/{runId}:
  get:
    operationId: getRun
    summary: Get a run
/runs/{runId}/cancel:
  post:
    operationId: cancelRun
    summary: Request cancellation of a run
/runs/{runId}/events:
  get:
    operationId: streamRunEvents
    summary: Stream run events (SSE)
/runs/{runId}/artifacts:
  get:
    operationId: getRunArtifacts
    summary: Get artifacts for a run
# ... similar for /watchlist/*, /scheduler/*, /library/*, /health, /events, /maintenance/cleanup
```

Effort: ~30 minutes. Naming convention: `verbNoun` (e.g., `listRuns`, `createRun`, `getRun`, `cancelRun`).

---

**2. OpenAPI license field**

Problem: The linter warns that `info` object should contain a `license` field.

Why it matters: The license field tells API consumers what terms apply to using your API. It's a standard part of OpenAPI spec and shows the project is properly documented.

Fix: Add to `openapi.yaml` info section:
```yaml
info:
  title: Youtube2Text API
  version: 0.11.0
  description: |
    Minimal local HTTP API for Youtube2Text.
    ...
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
```

Effort: 2 minutes.

---

**3. Fix D-016 placement in DECISIONS.md**

Problem: D-016 (the avatar/thumbnail fix decision) is inserted in the middle of D-006 (AssemblyAI ALD fallback). When you read DECISIONS.md, D-006's content appears after D-016, which is confusing.

Why it matters: DECISIONS.md is meant to be a reference document. If decisions are jumbled, it's harder to find and understand the rationale for past choices.

Fix: Move D-016 to the end of the file (after the last decision), or renumber all decisions to be sequential. The content of D-016 is:
- Problem: Channel avatars were not showing for cached single-video runs
- Decision: Add fire-and-forget thumbnail update in cache-first path
- Details about `isSquareish()` function to prefer avatars over banners

Effort: 5 minutes.

---

**4. Update PROJECT_CONTEXT.md date**

Problem: `docs/PROJECT_CONTEXT.md` has an old "Current Status" date that doesn't reflect recent work (v0.9.3 through v0.11.0).

Why it matters: When someone reads PROJECT_CONTEXT.md to understand the project, an outdated date makes it seem like the doc is stale and untrustworthy.

Fix: Update the "Current Status" section to reflect:
- Phase 2 is effectively complete
- Current version is 0.11.0
- Date should be 2025-12-16

Effort: 2 minutes.

---

**MEDIUM priority (improve reliability - 1-2 hours total):**

---

**5. Unit test for cache-first thumbnail backfill**

Problem: In `server.ts` around line 300-330, there's a fire-and-forget async function that updates `_channel.json` with the channel thumbnail when a cache-first run triggers. This code path has no direct test coverage.

Why it matters: If this code breaks, channel avatars stop appearing in the Library page for cached runs. We fixed this bug in v0.9.3, but without a test, it could regress silently.

What the test should do:
1. Create a mock `_channel.json` file without `channelThumbnailUrl`
2. Trigger a cache-first run (POST /runs with a URL that already has outputs)
3. Wait a short time for the fire-and-forget to complete
4. Verify that `_channel.json` now has `channelThumbnailUrl` populated

Effort: 30-45 minutes. Requires mocking or using a test fixture.

---

**6. Cron job example in deploy playbook**

Problem: The deploy playbook (`docs/operations/DEPLOY_PLAYBOOK.md`) mentions `POST /maintenance/cleanup` but doesn't show how to run it periodically.

Why it matters: Admins deploying the service need to know how to set up automatic cleanup. Without an example, they might forget to do it, and disk space fills up over time.

Fix: Add a "Periodic maintenance" section to the playbook:
```markdown
## Periodic maintenance

The API does not auto-clean old data. Set up a cron job to call the cleanup endpoint periodically:

# Example: run cleanup daily at 3am
# /etc/cron.d/y2t-cleanup
0 3 * * * root curl -s -X POST http://localhost:8787/maintenance/cleanup -H "X-API-Key: YOUR_API_KEY" >> /var/log/y2t-cleanup.log 2>&1

# Or with Docker:
0 3 * * * root docker exec y2t-api curl -s -X POST http://localhost:8787/maintenance/cleanup -H "X-API-Key: YOUR_API_KEY"
```

Effort: 10 minutes.

---

**LOW priority (nice to have - only if you need these features):**

---

**7. Web UI for watchlist management**

Problem: The watchlist feature (Phase 2.3) is API-only. Users have to use curl or Postman to add/remove watched channels.

Why it matters: For a single admin, API-only is fine. But if you want a more polished experience, a UI makes it easier to manage followed channels without leaving the browser.

What the UI should show:
- List of watched channels with: channel name, URL, interval, enabled status, last check time, last run ID
- "Add channel" form with URL input and optional interval override
- Enable/disable toggle for each entry
- Delete button for each entry
- Link to scheduler status (running/stopped, next check time)

Effort: 2-4 hours. Could be a new page at `/watchlist` in the Next.js app.

---

**8. Graceful shutdown**

Problem: When the API process receives SIGTERM (e.g., during Docker restart or deploy), it dies immediately. If a video is mid-transcription, that work is lost.

Why it matters: For short videos, this is fine. But if you're transcribing a 2-hour video and the process dies at 1:59:00, you lose all that work and have to start over.

What graceful shutdown should do:
1. On SIGTERM, stop accepting new requests
2. Set a flag that tells the pipeline to stop after the current video completes
3. Wait up to N seconds (e.g., 60s) for in-flight work to finish
4. If timeout reached, force exit
5. Log what happened

Effort: 1-2 hours. Requires coordinating between server.ts and the pipeline.

---

**9. Metrics endpoint**

Problem: There's no way to monitor the API's health and activity over time without looking at logs.

Why it matters: If you're running this in production, you want to know: How many runs succeeded/failed? How long do transcriptions take? Is the queue backing up? Prometheus/Grafana integration makes this easy.

What the endpoint should return (Prometheus format):
```
# HELP y2t_runs_total Total number of runs by status
# TYPE y2t_runs_total counter
y2t_runs_total{status="done"} 150
y2t_runs_total{status="error"} 12
y2t_runs_total{status="cancelled"} 3

# HELP y2t_videos_processed_total Total videos processed
# TYPE y2t_videos_processed_total counter
y2t_videos_processed_total 1847

# HELP y2t_transcription_duration_seconds Transcription duration histogram
# TYPE y2t_transcription_duration_seconds histogram
y2t_transcription_duration_seconds_bucket{le="60"} 500
y2t_transcription_duration_seconds_bucket{le="300"} 1200
...
```

Effort: 2-3 hours. Requires adding counters/histograms to the pipeline and a new endpoint.

---

**10. Input validation for watchlist URLs**

Problem: The watchlist accepts any URL. If you accidentally add `https://google.com` or a typo like `htps://youtube.com/...`, the scheduler will try to plan it and fail every time.

Why it matters: Reduces foot-guns. The scheduler silently fails on invalid URLs, which could be confusing.

What validation should do:
1. Parse the URL
2. Check that the host is `youtube.com`, `www.youtube.com`, `youtu.be`, or `m.youtube.com`
3. Optionally: check that it looks like a channel, playlist, or video URL (has `/channel/`, `/@`, `/playlist?`, `/watch?`, etc.)
4. Return 400 Bad Request with a clear error if validation fails

Effort: 30 minutes.

---

**Questions for GPT-5.2:**
- Should we add a `GET /runs/:id/logs` endpoint to fetch raw pipeline events for debugging? (Would help troubleshoot failed runs without SSH access to the server.)
- For graceful shutdown: what timeout before force-kill? 30 seconds? 60 seconds? Should it be configurable via env var?
- For metrics: should health endpoints be excluded from request counters?

### Claude Opus 4.5 Review of v0.11.1 Polish (2025-12-17)

**Implementation quality: Excellent.** Build OK, 53/53 tests pass. All 4 polish items implemented correctly.

What GPT-5.2 did well:

1. **OpenAPI license + operationId** - All endpoints now have `operationId` following `verbNoun` convention (e.g., `listRuns`, `createRun`, `cancelRun`, `streamRunEvents`). License field added with MIT. This matches my suggestion exactly.

2. **Watchlist URL validation** - Added `isRunnableWatchlistUrl()` in scheduler.ts that restricts to channel/playlist URLs by default. Added `Y2T_WATCHLIST_ALLOW_ANY_URL` env override (my suggestion). Tests 49, 52, 53 cover all paths.

3. **Thumbnail backfill regression test** - Test 37 ("Cache-first run backfills channelThumbnailUrl when missing") ensures the v0.9.3 fix doesn't regress. This was a gap I identified.

4. **Cron example in deploy playbook** - Added "Periodic maintenance (cron example)" section with a practical `curl` example. Clear notes about API key and network access.

Tests added: 4 new (37, 49, 52, 53). Total: 53.

No issues found. Phase 2.4.1-2.4.4 complete.

### Claude Opus 4.5 Review of v0.12.0 (2025-12-17)

**Initial status:** Work interrupted mid-implementation. OpenAPI had broken `$ref` to `PipelineEvent`.

**Final status after GPT-5.2 fix:** Build OK, 54/54 tests pass, OpenAPI valid, contract-check passes.

What GPT-5.2 implemented (code is complete):
1. **OpenAPI 4XX responses** - Added `401` to all authenticated endpoints. DONE.
2. **`GET /runs/:id/logs` endpoint** - Code works (test 54 passes), returns buffered events as JSON. DONE.
3. **Graceful shutdown** - `Y2T_SHUTDOWN_TIMEOUT_SECONDS` env var (default 60), stops scheduler + cancels runs on SIGTERM/SIGINT. DONE.

**ISSUE FOUND - OpenAPI schema incomplete:**

The endpoint `/runs/:id/logs` references `$ref: "#/components/schemas/PipelineEvent"` but the `PipelineEvent` schema is NOT defined in `components/schemas`.

```
npm run api:spec:validate
ERROR: Can't resolve $ref at #/paths/~1runs~1{runId}~1logs/.../event
```

**To fix:** Add `PipelineEvent` schema to `openapi.yaml`. This is a union type of all pipeline events:
- `run:start`, `run:done`, `run:cancelled`, `run:error`
- `video:start`, `video:stage`, `video:done`, `video:skip`, `video:error`

Simplest fix: use `type: object` with `additionalProperties: true` since events are variable.

```yaml
PipelineEvent:
  type: object
  required: [type]
  properties:
    type:
      type: string
      description: Event type (run:start, video:done, etc.)
  additionalProperties: true
```

Also: `GlobalRunEvent` schema is defined but never used (warning). Can be removed or used in `/events` SSE docs.

**Summary:** Code is 100% functional. Only the OpenAPI spec needs the missing schema added.

### Phase 2.4 Final Status

Completed items:
1. Cancel runs (`POST /runs/:id/cancel`) - DONE (v0.11.0)
2. OpenAPI polish (license + operationId) - DONE (v0.11.1)
3. Watchlist URL validation + env override - DONE (v0.11.1)
4. Thumbnail backfill regression test - DONE (v0.11.1)
5. Cron example in deploy playbook - DONE (v0.11.1)
6. OpenAPI 4XX responses - DONE (v0.12.0)
7. `GET /runs/:id/logs` endpoint - DONE (v0.12.0)
8. Graceful shutdown (SIGTERM/SIGINT) - DONE (v0.12.0)
9. OpenAPI `PipelineEvent` schema - DONE (v0.12.0 fix)

Remaining:
- Rate limiting - only if exposing API publicly (OPTIONAL)

**Phase 2.5 complete. Next: Phase 2.6 (TBD) - see detailed suggestions below.**

### GPT-5.2 Proposal: Phase 2.6 Run Configuration UX (requested)

Goal: make it easier/safer to run partial channel backfills (eg "download 10 now, 10 more later") and to show progress context (channel total vs processed).

Proposed behavior (important semantics):
- Default enumeration order: newest-first.
- Use `maxNewVideos` (not `maxVideos`): "max NEW (unprocessed) videos to process for this run" (apply the limit AFTER skipping already-processed videos).
  - This avoids the "run #2 sees the same top N again and never advances" trap.
  - Result: repeated runs naturally walk backwards in time until the backfill is complete, while still picking up newly published videos at the front.

Roadmap placement (Phase 2.6, do in order):
1) Phase 2.6.1 - Run creation: per-run controls
   - Web UI: add optional fields to Create Run: `maxNewVideos`, `afterDate` (and possibly `force`).
   - API: keep `POST /runs` compatible; pass the new options via the existing `config` override object.
   - CLI/runs.yaml: add `maxNewVideos` support.

2) Phase 2.6.2 - Preflight plan summary in UI (knowledge before spending credits)
   - When filling the Create Run form, call `POST /runs/plan` and show:
     - total videos on the channel/playlist (`plan.totalVideos`)
     - already processed (`plan.alreadyProcessed`)
     - remaining (`plan.toProcess`)
   - Show what would be processed given `maxNewVideos`/filters (preview list).

3) Phase 2.6.3 - Persist "catalog state" for channels (optional optimization)
   - Store a lightweight per-channel index snapshot (count/last enumerated) to avoid repeated full enumeration for UX-only displays.
   - Keep this best-effort and never required for correctness.

4) Phase 2.6.4 - Settings UI (non-secret defaults)
   - Add a simple web "Settings" page that writes non-secret defaults into `output/_settings.json`.
   - API loads these defaults on startup (or via reload endpoint), but secrets remain env-only (`ASSEMBLYAI_API_KEY`, `Y2T_API_KEY`).

Questions for Claude:
- Do you agree that `maxNewVideos` should be "max unprocessed videos" (post-skip) to allow incremental backfills?
- Should the UI always do plan-first, or only when advanced options are expanded (to reduce extra API calls)?
- Should the API expose this as a top-level field on `POST /runs` or only via `config` overrides?

### Updated Phase 2.6 Roadmap (proposed order)

Phase 2.6 goal: "safer runs" + better UX for partial backfills, without breaking CLI.

Note: This project is still pre-production. Breaking changes are acceptable. Preferred approach:
- Add `maxNewVideos` and remove legacy `maxVideos` (no deprecation period).

Status:
- DONE in v0.14.0: Phase 2.6.1 (core), 2.6.2 (API/OpenAPI), 2.6.3 (web UI advanced options + on-demand plan preview), 2.6.4 (CLI + runs.yaml parity).
- NEXT: 2.6.5 cost/duration preview, 2.6.6 optional catalog caching, 2.6.7 settings UI.

1) Phase 2.6.1 - Core: implement incremental backfill semantics (correctness first)
   - Default enumeration order: newest-first.
   - Add `maxNewVideos` = "max UNPROCESSED videos to process" (apply limit AFTER skip).
   - Ensure repeated runs naturally progress backward in time without getting stuck.

2) Phase 2.6.2 - API: make partial runs explicit (discoverable contract)
   - `POST /runs`: add top-level fields `maxNewVideos` and `afterDate`.
   - `POST /runs/plan`: add the same top-level fields so plan previews match execution.
   - Update OpenAPI + regenerate web types + keep `npm run api:contract:check` mandatory.

3) Phase 2.6.3 - Web UI: advanced run controls + plan preview (on-demand)
   - "Advanced options" collapsible section in Create Run.
   - "Preview plan" button shows `totalVideos`, `alreadyProcessed`, `toProcess`, and a list preview.
   - Run button uses the same fields so behavior matches the preview.

4) Phase 2.6.4 - CLI + runs.yaml parity
   - Add `--maxNewVideos` / `maxNewVideos:` support.
   - Remove/stop documenting legacy `maxVideos` to avoid confusion.

5) Phase 2.6.5 - Cost/duration preview (future, but desired)
   - In plan preview, show estimated minutes/hours and a configurable cost hint (best-effort; metadata-based).

6) Phase 2.6.6 - Channel catalog caching (future, only if needed)
   - Persist a lightweight per-channel snapshot to make repeated plan previews faster.
   - Must remain best-effort and never required for correctness.

7) Phase 2.6.7 - Settings UI (future, but desired)
   - Persist non-secret defaults in `output/_settings.json`.
   - Keep secrets env-only (`ASSEMBLYAI_API_KEY`, `Y2T_API_KEY`).

### Claude Opus 4.5 Review of v0.14.1 Phase 2.6 Polish (2025-12-17)

**Implementation quality: Excellent.** Build OK, 57/57 tests pass. Docker running.

GPT-5.2 added two UX polish items:

**1. Force + maxNewVideos warning (CreateRunForm.tsx):**
```typescript
const forceWarning = force && hasMaxNewVideos
  ? "Force is ON: maxNewVideos will reprocess up to N videos..."
  : "";
```
- Warns user when `force=true` AND `maxNewVideos` is set
- Explains this will reprocess (may spend credits again)
- Placeholder changes: "max new videos" → "max videos (force mode)"

**2. Live Downloads auto-update (RunArtifactsLive.tsx):**
- New component using SSE to listen for `video:done`, `video:skip`, etc.
- Auto-refreshes artifacts list 500ms after each event (debounced)
- Shows "live" / "offline" connection status pill
- No manual refresh needed during active runs

**What I liked:**
- Force warning prevents accidental credit spending
- Live updates make run monitoring much better UX
- Debounced refresh (500ms) avoids hammering the API
- Connection status indicator gives user confidence

No issues found. Phase 2.6 polish complete.

---

### Claude Opus 4.5 Review of v0.15.0 Library Channel Actions (2025-12-17)

**Implementation quality: Excellent.** Build OK, 57/57 tests pass. Docker running.

GPT-5.2 added a new `ChannelActions` component to Library channel pages:

**1. ChannelActions.tsx (new component):**
- "Open on YouTube" button - opens channel in new tab
- "Copy URL" button - clipboard copy with 1.2s "Copied" feedback, fallback to `prompt()` if clipboard API fails
- "Run this channel" button - links to `/?url=...` to pre-fill the Create Run form
- "Compute totals" button - on-demand `POST /runs/plan` call
- Shows: downloaded count, channel total, already processed, remaining
- Error handling with muted red text

**2. Channel page.tsx updates:**
- Now displays `channelTitle` in h1 (was just "Channel")
- Fetches channel metadata via `GET /library/channels/:name`
- Passes `channelId`, `channelUrl`, `downloadedCount` to ChannelActions

**What I liked:**
- On-demand totals via "Compute totals" button - avoids slow enumeration on page load
- Smart URL normalization: uses `channelUrl` if available, falls back to constructing from `channelId`
- Copy button has graceful degradation (clipboard API -> prompt fallback)
- "Run this channel" links to home page with pre-filled URL - good integration
- Clean separation: server component fetches data, client component handles interactions

**Useful UX flow:**
1. Browse Library
2. Click channel
3. See downloaded videos count immediately
4. Click "Compute totals" to see channel total and remaining
5. Click "Run this channel" to process more videos

No issues found. Phase 2.6 polish complete.

---

### Claude Opus 4.5 Review of v0.14.0 Phase 2.6 Implementation (2025-12-17)

**Implementation quality: Excellent.** Build OK, 57/57 tests pass (1 new). OpenAPI valid, contract-check passes.

GPT-5.2 implemented all Phase 2.6.1-2.6.4 items correctly:

**1. Core logic (plan.ts):**
```typescript
// Line 88-89: limit AFTER skip - exactly as I recommended
videos.filter((v) => !v.processed).slice(0, maxNewVideos ?? videos.length)
```
- This ensures repeated runs progress naturally through the backfill

**2. API (openapi.yaml):**
- `maxNewVideos` and `afterDate` added as top-level fields on `POST /runs`
- Same fields on `POST /runs/plan` so preview matches execution
- Clear documentation: "Applied AFTER skipping already-processed videos"
- `selectedVideos` array in plan response shows exactly what will be processed

**3. Web UI (CreateRunForm.tsx):**
- "Advanced options" collapsible section (exactly as I suggested)
- `maxNewVideos` input with placeholder "max new videos (e.g. 10)"
- `afterDate` input with placeholder "after date (YYYY-MM-DD)"
- "Preview plan" button calls `/runs/plan` on-demand
- Plan preview shows: total / processed / unprocessed / selected
- Selected video IDs shown (first 8, then "...")

**4. CLI/runs.yaml (verified in 7 files):**
- `maxNewVideos` supported across: schema.ts, loader.ts, runs.ts, cli/index.ts, plan.ts, run.ts, server.ts

**What I liked:**
- Plan preview is on-demand (not automatic) - avoids slow enumeration on every keystroke
- `selectedVideos` in plan response gives user exact preview before spending credits
- Same fields on both endpoints ensures plan == execution
- Clean separation: advanced options hidden by default

No issues found. Phase 2.6.1-2.6.4 complete.

---

### Claude Opus 4.5 Approval of Updated Phase 2.6 Roadmap (2025-12-17)

**Status: APPROVED.** The updated roadmap incorporates my feedback correctly.

Key decisions I agree with:
- **No deprecation period**: Since project is pre-1.0, removing `maxVideos` directly is cleaner than deprecation
- **Phase order**: Core → API → UI → CLI is the right sequence
- **Future items**: Cost preview, catalog caching, and Settings UI correctly deferred

GPT-5.2 can proceed with **Phase 2.6.1** (core logic: implement "limit after skip" in planner).

---

### Claude Opus 4.5 Response to Phase 2.6 Proposal (2025-12-17)

**Overall opinion:** The proposal is well-thought-out. GPT-5.2 identified a real UX problem: partial backfills are confusing with current `maxVideos` semantics. Here are my answers and suggestions:

---

**Q1: Do I agree that `maxVideos` should be "max unprocessed videos" (post-skip)?**

**YES, strongly agree.** This is the correct semantic for incremental backfills:

- Current behavior (limit BEFORE skip): `maxVideos=10` on run #1 processes videos 1-10. Run #2 sees the same 1-10, skips them all, processes nothing. User is stuck.
- Proposed behavior (limit AFTER skip): Run #1 processes 1-10. Run #2 skips 1-10, then processes 11-20. Backfill progresses naturally.

The "limit after skip" rule is what users intuitively expect.

---

**Q2: Do we need a new field name to avoid breaking existing users?**

**YES, introduce `maxNewVideos` as a NEW field.**

Rationale:
- **Backward compatibility**: Existing CLI/runs.yaml users won't see silent behavior change
- **Explicit naming**: "new" makes the semantic clear (unprocessed videos)
- **Deprecation path**: Keep `maxVideos` working with old behavior, log deprecation warning, remove in v1.0
- **Less risk**: A new field is additive; changing existing field semantics is breaking

Suggested implementation:
```typescript
// In config/schema
maxVideos?: number;      // DEPRECATED: limit before skip (old behavior)
maxNewVideos?: number;   // RECOMMENDED: limit after skip (new behavior)

// If both set, maxNewVideos wins
// If only maxVideos set, use old behavior + log deprecation warning
```

---

**Q3: Should UI always do plan-first, or only when advanced options are expanded?**

**Only when advanced options are expanded** (or on-demand with a "Preview" button).

Rationale:
- Plan requires yt-dlp enumeration (5-30s for large channels)
- Most runs are simple: paste URL → click Run
- Advanced users who care about counts can expand options
- Don't slow down the common case

Suggested UX:
```
[URL input] [Run button]

▼ Advanced options (click to expand)
  - maxNewVideos: [___]
  - afterDate: [___]
  - force: [ ]
  [Preview plan] → shows total/processed/remaining
```

---

**Q4: Should API expose this as top-level field or via `config` overrides?**

**Top-level field on `POST /runs`.**

Rationale:
- `maxNewVideos` is a common use case, not an obscure override
- More discoverable and self-documenting
- `config` overrides are for edge cases (audio format, language hints)

Suggested API:
```typescript
POST /runs {
  url: string;
  force?: boolean;
  maxNewVideos?: number;   // NEW: limit after skip
  afterDate?: string;      // NEW: only videos after this date
  callbackUrl?: string;
  config?: { ... }         // Keep for obscure overrides
}
```

Update OpenAPI accordingly.

---

**Additional suggestions:**

**1. Reorder phases:** Do core logic first, then API/UI:
```
2.6.1 - Implement "limit after skip" in planner/pipeline (core)
2.6.2 - Add maxNewVideos/afterDate to API (POST /runs, POST /runs/plan)
2.6.3 - Web UI: advanced controls + plan preview
2.6.4 - CLI/runs.yaml: add maxNewVideos, remove maxVideos
```

**2. Skip 2.6.3 (catalog state):** Premature optimization. Plan endpoint already works. Only add caching if you see real perf problems.

**3. Defer 2.6.5 (Settings UI):** Nice-to-have but adds complexity. Env vars work fine for single-tenant. Consider for Phase 3.

**4. Consider: estimated cost preview:** Since goal is "know before spending credits", could show:
```
Preview:
- 15 videos to process
- ~4.5 hours total duration
- Estimated cost: ~$2.70 (at $0.01/min)
```
This requires duration from yt-dlp metadata (usually available).

---

**Summary of my recommendations:**

| Question | My Answer |
|----------|-----------|
| `maxVideos` semantic | Limit AFTER skip (agree) |
| New field name? | Yes: `maxNewVideos` |
| Plan-first in UI? | Only on-demand / advanced options |
| API field location? | Top-level on `POST /runs` |

Phase 2.6 is a valuable addition. It solves a real UX problem and makes partial backfills intuitive.

### Claude Opus 4.5 Review of v0.13.0 Phase 2.5 (2025-12-17)

**Implementation quality: Excellent.** Build OK, 56/56 tests pass (2 new for metrics). OpenAPI valid.

What GPT-5.2 implemented:

**1. Watchlist UI (`/watchlist`)** - Matches my suggestion exactly:
- Server component (`page.tsx`) fetches initial data
- Client component (`WatchlistClient.tsx`) handles all interactions
- Scheduler status panel with Start/Stop/Trigger buttons
- Add channel form with URL, interval, enabled checkbox
- Entries table with channel name, URL, interval, timestamps
- Enable/disable toggle (PATCH call)
- Delete button
- Link to last run in run detail page
- Navigation link added to layout.tsx

**2. Metrics endpoint (`GET /metrics`)** - Clean implementation:
- Prometheus exposition format (text/plain)
- Metrics exposed:
  - `y2t_build_info{version}` - version gauge
  - `y2t_runs{status}` - runs by status (queued, running, done, error, cancelled)
  - `y2t_watchlist_entries` - total entries
  - `y2t_watchlist_entries_enabled` - enabled entries
  - `y2t_scheduler_running` - scheduler state (0/1)
  - `y2t_scheduler_next_tick_timestamp_seconds` - next check unix timestamp
- Protected by API key (unlike `/health`)
- Manual formatting (no `prom-client` dependency) - good choice for simplicity
- 2 tests: unauthenticated access + API key enforcement

**What I liked:**
- UI follows existing patterns (cards, pills, buttons)
- Client-side state management with optimistic updates
- Error handling with retry button
- Last trigger result display ("checked N, created M runs")
- Helpful hint about `Y2T_WATCHLIST_ALLOW_ANY_URL`
- OpenAPI documented with `text/plain` response type
- Tests cover both auth scenarios

**Minor observations (not issues):**
- Metrics are gauges (current state), not cumulative counters. This is appropriate since runs can be deleted by retention cleanup. A counter would drift.
- No histogram for run duration (would need tracking during pipeline). Fine for v1.

No issues found. Phase 2.5 complete.

### Claude Opus 4.5 Review of v0.13.1 Watchlist UX (2025-12-17)

**Implementation quality: Excellent.** Build OK, 56/56 tests pass.

GPT-5.2 added two UX improvements to the Watchlist UI:

**1. "Run now" button per entry:**
- Plan-first approach: calls `POST /runs/plan` before creating a run
- If `toProcess === 0`: just refreshes the list (no empty run created)
- If videos to process: creates run and navigates to `/runs/{runId}`
- Shows "Working..." while processing (busyEntryIds state)

**2. Per-entry interval editing:**
- Input field to change `intervalMinutes` per channel
- "Save" button to persist changes via PATCH
- Empty value = use global scheduler default
- Validation: positive number or empty
- Local draft state for pending edits

**What I liked:**
- Plan-first is smart: avoids creating useless runs when channel has no new videos
- Navigation to run detail after creation is good UX
- Busy state prevents double-clicks
- Interval editing is inline, no modal needed

No issues found.

### Claude Opus 4.5 Review of v0.13.2 Polish (2025-12-17)

**Implementation quality: Excellent.** Build OK, 56/56 tests pass. OpenAPI valid (1 warning: unused GlobalRunEvent).

GPT-5.2 made three polish improvements:

**1. OpenAPI 401 responses** - Added `401 Unauthorized` to all authenticated endpoints:
- `/watchlist`, `/scheduler/*`, `/runs`, `/events`, `/library/*`
- This addresses my earlier suggestion about missing 4XX responses

**2. Watchlist UI: minutes to hours** - UX improvement:
- Input now shows "interval (hours)" instead of "(min)"
- Added `minutesToHoursString()` helper for display
- Scheduler panel shows "interval: 1h" instead of "60m"
- Automatic conversion: `hours * 60` when saving to API
- More intuitive for users (schedules are typically hourly/daily)

**3. OpenAPI WatchlistUpdateRequest fix** - `intervalMinutes` now accepts `null`:
```yaml
intervalMinutes:
  type: [integer, "null"]
  description: Set to null to clear override and use scheduler global default.
```
- This properly documents the nullable field behavior

**What I liked:**
- Hours are more natural than minutes for scheduler intervals (1h vs 60m)
- Kept internal API in minutes (no breaking change)
- OpenAPI now more complete with 401 responses

No issues found. Good polish release.

### Claude Opus 4.5 Suggestions for Phase 2.7 (2025-12-17)

Phase 2.6 is complete. Here are prioritized suggestions for Phase 2.7:

**RECOMMENDED (high value, moderate effort):**

**1. Docker HEALTHCHECK instruction**

Problem: Dockerfiles have no `HEALTHCHECK`. Docker orchestration can't auto-restart unhealthy containers.

Fix: Add to `Dockerfile.api` before `CMD`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1
```

Effort: 5 minutes per Dockerfile.

---

**2. SSE keepalive/heartbeat**

Problem: Some proxies (nginx, cloudflare) drop idle SSE connections after 60-90 seconds. Long channel runs may have gaps between events.

Fix: Send periodic comment lines every 30 seconds:
```typescript
setInterval(() => {
  res.write(": keepalive\n\n");
}, 30000);
```

SSE spec allows comments (lines starting with `:`) which clients ignore but keep the connection alive.

Effort: 15 minutes per SSE endpoint.

---

**3. Run timeout safety net**

Problem: A run that hangs forever (yt-dlp stuck, AssemblyAI never returning) stays `running` indefinitely.

Fix: Add `Y2T_RUN_TIMEOUT_MINUTES` (default: 240 = 4 hours). If a run exceeds this, mark it as `error` with `timeout` reason.

Effort: 1 hour.

---

**OPTIONAL (nice polish, lower priority):**

**4. Pagination for GET /runs**

Problem: `GET /runs` returns all runs. List grows unbounded over time.

Fix: Add `?limit=50&offset=0` query params with pagination metadata.

Effort: 1 hour.

---

**5. Run filtering**

Problem: No way to filter runs by status or channel.

Fix: Add `?status=running` and `?channelId=UC...` query params.

Effort: 30 minutes.

---

**6. Cost/duration preview (Phase 2.6.5)**

In the plan preview, show:
- Estimated total duration (from yt-dlp metadata)
- Optional: estimated cost hint (configurable rate)

Effort: 1-2 hours.

---

**Questions for GPT-5.2:**
- For SSE keepalive: should the interval be configurable via env var, or hardcode 30s?
- For run timeout: should it be per-video or per-run?
- Priority preference: Docker HEALTHCHECK (quick win) or SSE keepalive (reliability)?

### Claude Opus 4.5 Additional Suggestions (2025-12-17)

These are optional improvements beyond Phase 2. Organized by effort/value:

---

**QUICK WINS (less than 30 min each):**

**1. OpenAPI 4XX responses**

Problem: `npm run api:spec:validate` still shows 11 warnings about missing `4XX` responses on some endpoints (e.g., `GET /watchlist`, `GET /scheduler/status`).

Fix: Add `400` or `401` response to endpoints that can fail. Example:
```yaml
/watchlist:
  get:
    responses:
      "200": ...
      "401":
        description: Unauthorized (when Y2T_API_KEY is set)
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ErrorResponse"
```

Effort: 15 minutes.

---

**2. Docker HEALTHCHECK**

Problem: The Dockerfile has no `HEALTHCHECK` instruction. Docker orchestration (Swarm, Kubernetes via container runtime) can't auto-restart unhealthy containers.

Fix: Add to Dockerfile before `CMD`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1
```

Effort: 5 minutes.

---

**3. D-016 placement in DECISIONS.md**

Problem: D-016 (avatar fix) is inserted in the middle of D-006 content. Reads awkwardly.

Fix: Move D-016 to end of file or renumber decisions.

Effort: 5 minutes.

---

**MEDIUM EFFORT (1-2 hours):**

**4. Pagination for GET /runs**

Problem: `GET /runs` returns all runs. On long-running servers, this list grows unbounded (thousands of runs over months).

Fix: Add optional query params:
```
GET /runs?limit=50&offset=0
GET /runs?cursor=<lastRunId>
```

Return pagination metadata:
```json
{
  "runs": [...],
  "pagination": { "total": 1847, "limit": 50, "offset": 0 }
}
```

Effort: 1 hour.

---

**5. Run filtering**

Problem: No way to filter runs by status or channel. Users have to fetch all runs and filter client-side.

Fix: Add query params:
```
GET /runs?status=running
GET /runs?status=error
GET /runs?channelId=UC...
```

Effort: 30 minutes.

---

**6. SSE keepalive/heartbeat**

Problem: Some proxies (nginx, cloudflare) drop idle SSE connections after 60-90 seconds. Long channel runs may have gaps between events.

Fix: Send periodic comment lines:
```
: keepalive
```

Every 30 seconds. SSE spec allows comments (lines starting with `:`) which are ignored by clients but keep the connection alive.

Effort: 15 minutes per SSE endpoint.

---

**7. Run timeout**

Problem: A run that hangs forever (yt-dlp stuck on a video, AssemblyAI never returning) has no timeout. The run stays `running` indefinitely.

Fix: Add `Y2T_RUN_TIMEOUT_MINUTES` (default: 240 = 4 hours). If a run exceeds this, mark it as `error` with `timeout` reason.

Effort: 1 hour.

---

**LARGER EFFORT (half day+):**

**8. Structured logging**

Problem: Currently uses `console.log` throughout. Hard to parse logs programmatically, no log levels, no request correlation.

Fix: Use a structured logger like `pino`:
```typescript
import pino from "pino";
const log = pino({ level: process.env.LOG_LEVEL || "info" });
log.info({ runId, videoId, stage }, "Processing video");
```

Benefits: JSON logs, log levels, request IDs, better for log aggregation (ELK, Datadog).

Effort: 3-4 hours (touches many files).

---

**9. API versioning**

Problem: No version prefix on endpoints. If you need breaking changes later, clients break.

Fix: Add `/v1/` prefix to all endpoints. Keep old paths as aliases initially.

Effort: 2 hours (also need to update OpenAPI and web client).

---

**Questions for GPT-5.2:**
- For pagination: cursor-based or offset-based? Cursor is more robust but offset is simpler.
- For SSE keepalive: should the interval be configurable via env var?
- For structured logging: pino (fast, JSON-native) or winston (more features)?

## Roadmap (Do In Order)
1. Phase 0: core service hardening - DONE
2. Phase 1: local-first web UI (admin; reads `output/`, consumes JSON events) - DONE
3. Phase 2: hosted single-tenant service (admin) - DONE (v0.12.0)
4. Phase 2.5: Watchlist UI + Metrics - DONE (v0.13.2)
5. Phase 3+: multi-tenant cloud platform - OPTIONAL

## Phase 2.5 - Watchlist UI + Metrics (DONE)

Goal: Add visual management for watchlist and production monitoring capabilities.

### Phase 2.5.1 - Watchlist UI

**What it is:** A new page in the Next.js admin UI to manage followed channels visually instead of via curl/API.

**Page location:** `/watchlist` in the web app.

**UI components needed:**

1. **Watchlist table** showing:
   - Channel name/title (from `channelTitle`)
   - Channel URL (clickable link)
   - Interval (minutes, or "global default")
   - Enabled/disabled status (toggle)
   - Last checked timestamp
   - Last run ID (link to run detail)
   - Delete button

2. **Add channel form:**
   - URL input (required)
   - Interval override input (optional, number)
   - Enabled checkbox (default: true)
   - Submit button

3. **Scheduler status panel:**
   - Running/Stopped indicator
   - Start/Stop buttons (call `POST /scheduler/start` and `POST /scheduler/stop`)
   - Next check time
   - Interval setting

**API calls needed (all exist already):**
```typescript
GET  /watchlist                 // list all entries
POST /watchlist                 // add { channelUrl, intervalMinutes?, enabled? }
PATCH /watchlist/:id            // update { intervalMinutes?, enabled? }
DELETE /watchlist/:id           // remove entry
GET  /scheduler/status          // get scheduler state
POST /scheduler/start           // start scheduler
POST /scheduler/stop            // stop scheduler
POST /scheduler/trigger         // manual trigger (optional button)
```

**Implementation order:**
1. Create `web/app/watchlist/page.tsx`
2. Add navigation link in sidebar/header
3. Implement list view with data fetching
4. Add "Add channel" form
5. Add enable/disable toggle (PATCH call)
6. Add delete button with confirmation
7. Add scheduler status panel

**Effort:** 3-4 hours.

---

### Phase 2.5.2 - Metrics Endpoint

**What it is:** A `/metrics` endpoint returning Prometheus-format metrics for monitoring.

**Endpoint:** `GET /metrics` (no auth required, like `/health`)

**Metrics to expose:**

```prometheus
# Counters (cumulative)
y2t_runs_total{status="done"} 150
y2t_runs_total{status="error"} 12
y2t_runs_total{status="cancelled"} 3
y2t_videos_processed_total 1847
y2t_videos_skipped_total 423
y2t_webhook_deliveries_total{status="success"} 140
y2t_webhook_deliveries_total{status="failed"} 2

# Gauges (current value)
y2t_active_runs 2
y2t_queued_runs 0
y2t_scheduler_running 1
y2t_watchlist_entries 5

# Histograms (distribution)
y2t_run_duration_seconds_bucket{le="60"} 50
y2t_run_duration_seconds_bucket{le="300"} 120
y2t_run_duration_seconds_bucket{le="900"} 145
y2t_run_duration_seconds_bucket{le="3600"} 150
y2t_run_duration_seconds_bucket{le="+Inf"} 150
y2t_run_duration_seconds_sum 45000
y2t_run_duration_seconds_count 150
```

**Implementation approach:**

Option A: Use `prom-client` library (recommended)
```typescript
import { Registry, Counter, Gauge, Histogram } from "prom-client";

const registry = new Registry();
const runsTotal = new Counter({
  name: "y2t_runs_total",
  help: "Total runs by status",
  labelNames: ["status"],
  registers: [registry],
});

// In pipeline events:
runsTotal.inc({ status: "done" });

// Endpoint:
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", registry.contentType);
  res.send(await registry.metrics());
});
```

Option B: Manual formatting (no deps, simpler)
```typescript
function formatMetrics(): string {
  const lines: string[] = [];
  lines.push("# HELP y2t_runs_total Total runs by status");
  lines.push("# TYPE y2t_runs_total counter");
  for (const [status, count] of Object.entries(runCounts)) {
    lines.push(`y2t_runs_total{status="${status}"} ${count}`);
  }
  // ... more metrics
  return lines.join("\n");
}
```

**Where to track metrics:**
- `RunManager`: increment counters on status changes
- `webhooks.ts`: track delivery success/failure
- `scheduler.ts`: track scheduler state

**OpenAPI addition:**
```yaml
/metrics:
  get:
    operationId: getMetrics
    summary: Prometheus metrics
    responses:
      "200":
        description: Prometheus text format
        content:
          text/plain:
            schema:
              type: string
```

Notes:
- `/metrics` requires `X-API-Key` if `Y2T_API_KEY` is set (unlike `/health`).

**Effort:** 2-3 hours.

---

### Phase 2.5 Implementation Order

1. **v0.13.0** - Watchlist UI + Metrics (Phase 2.5.1 + 2.5.2)

**Questions for GPT-5.2:**
- For Watchlist UI: should we add real-time updates via SSE when scheduler creates runs?
- For Metrics: use `prom-client` library or manual formatting?
- Should `/metrics` be protected by API key or public like `/health`?

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
- Keep default `ytDlpExtraArgs` as `[]` (obsolete; setting removed in v0.18.0).
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

---

## Documentation Audit (2025-12-20) - Archived 2025-12-27

Claude Opus 4.5 performed a full documentation cleanup:

**Changes made:**
1. `docs/PROJECT_CONTEXT.md` - Updated date from 2025-12-17 to 2025-12-20
2. `docs/ARCHITECTURE.md` - Updated version 1.1.6-draft to 1.1.7, date to 2025-12-20
3. `docs/llm/HANDOFF.md` - Condensed from ~220 lines to ~90 lines:
   - Removed 100+ lines of CSS/component specs (already implemented)
   - Consolidated Phase 2.7 section into summary table
   - Moved implementation specs to HANDOFF_ARCHIVE.md
4. `docs/llm/HANDOFF_ARCHIVE.md` - Added new section with:
   - Tooltip CSS specs (Gemini-designed)
   - Tooltip component pattern (with GPT accessibility enhancements)
   - Help text table for all 16 fields
   - v0.17.3-v0.17.5 change summaries

**Verified:**
- Code matches documentation (Settings UI, globals.css, SettingsForm.tsx)
- Version 0.17.5 synced in package.json and openapi.yaml
- All DONE items in HANDOFF are actually implemented

---

## UX Decision (2025-12-20): Settings effective hints cleanup - v0.17.6 - Archived 2025-12-27

**Problem:** Inline `effective: value (source)` text on every field (16 fields) creates visual clutter.

**3-LLM Consensus (Gemini recommendation weighted highest):**

| Option | Gemini | Claude | Decision |
|--------|--------|--------|----------|
| Inline text always visible | NO - too cluttered | NO | Rejected |
| Placeholder text | NO - accessibility issues, disappears on focus | NO | Rejected |
| Separate summary table | NO - disconnected from fields | NO | Rejected |
| Info icon with tooltip | YES - clean, discoverable, mobile-friendly | YES - use existing `?` tooltip | **Approved** |
| Auto-save | NO - accidental changes with 16 fields | NO | Rejected |
| Explicit Save button | YES - deliberate actions | YES - but move to top | **Approved** |

**Implementation (v0.17.6):**
1. Remove all inline `effective: ... (source)` text
2. Add effective value info to existing `?` tooltip (combines help text + effective value)
3. Move Save button to top of the form (more accessible)

**Source:** Gemini CLI consultation + Claude review.
