# LLM Work Handoff

This file is the current operational snapshot. Keep it short (target: 1-2 screens).
Older long-form notes were moved to `docs/llm/HANDOFF_ARCHIVE.md`.

All content should be ASCII-only to avoid Windows encoding issues.

## Current Status
- Version: 0.17.5 (versions must stay synced: `package.json` + `openapi.yaml`)
- CLI: stable; primary workflow (must not break)
- API: stable; OpenAPI at `openapi.yaml`; generated frontend types at `web/lib/apiTypes.gen.ts`
- Web: Next.js admin UI (Runs/Library/Watchlist/Settings)

## Phase 2.7 (In Progress): Settings + Polish

### 2.7.1 Non-secret defaults via settings file
- Persist non-secret defaults to `output/_settings.json` (never store secrets).
- API:
  - `GET /settings`
  - `PATCH /settings` (send `null` to clear a key)
- Precedence order:
  - `output/_settings.json` (lowest) < `config.yaml` < `.env` (highest)
 - Status: DONE in v0.17.0

### 2.7.3 Settings UI UX polish (DONE)
- Implemented the Claude+Gemini UX fixes for `/settings`:
  - settings-specific compact input classes (`.inputXs/.inputSm/.inputMd`)
  - `.formRow` + right-aligned `.formLabel` on desktop (mobile-first column layout)
  - `.stackTight` and reduced card clutter (2-3 cards with internal sections)
- Reference spec: `docs/llm/HANDOFF_ARCHIVE.md`
- Card 1: Core + Language + Outputs
- Card 2: Planning + Polling + Retries
- Card 3: Advanced (download) - textarea full width

#### Additional Gemini Recommendations

1. **Touch targets:** Ensure buttons/inputs are min 44x44px for mobile
2. **Visual separation:** Add clear spacing between rows in vertical mobile layout
3. **Breakpoint:** Use 900px (matches existing project convention in globals.css)

**Source:** Claude UX review + Gemini CLI validation + GPT responsiveness suggestion. See `docs/llm/HANDOFF_ARCHIVE.md` for full analysis.

### 2.7.2 Roadmap and docs hygiene
- Keep this HANDOFF short; move older content into HISTORY/DECISIONS/ARCHIVE.
- For every behavior change, update the relevant docs (README + ops/docs as appropriate).
- For every version bump, add a top entry to `docs/llm/HISTORY.md`.

## Next Steps (Do In Order)

### 2.7.4 Settings Help Tooltips (DONE - Gemini-designed)

**Problem:** Users don't understand what each setting does.

**Solution:** Add `?` icon tooltips next to each label (Gemini recommendation: cleanest UX for 15+ fields).

Status: DONE in v0.17.2

#### CSS to Add (in `globals.css`)

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

#### Component Pattern

```tsx
function Tooltip({ text }: { text: string }) {
  return (
    <span className="tooltipContainer">
      <span className="tooltipIcon">?</span>
      <span className="tooltipText">{text}</span>
    </span>
  );
}

// Usage in formRow:
<div className="formRow">
  <span className="formLabel">
    concurrency
    <Tooltip text="How many videos to process in parallel (1-10 typical)" />
  </span>
  <input className="inputXs" ... />
</div>
```

#### Help Text for Each Field

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
| ytDlpExtraArgs | Advanced downloader arguments (yt-dlp), one per line. Most users should leave this empty. |

**Source:** Gemini CLI UX recommendation (tooltip pattern for 15+ fields).

---

### 2.7.5 UX follow-up: rename "yt-dlp" section + fix textarea resize (DONE)

**Status: DONE in v0.17.3.**

#### Problem
1. "yt-dlp" is technical jargon users dont understand
2. Textarea can be resized horizontally, breaking layout

#### Solution (3-LLM consensus: GPT proposed, Claude + Gemini approved)

**Change 1: Rename section**
- Current: `<h3>yt-dlp</h3>`
- New: `<h3>Advanced (download)</h3>`

**Change 2: Update tooltip text**
- Current: `Extra yt-dlp arguments...`
- New: `Advanced flags for the YouTube downloader. Leave empty unless troubleshooting.`

**Change 3: Fix textarea resize**
Add to `globals.css`:
```css
textarea.input {
  resize: vertical;
  max-width: 100%;
}
```

#### Review Summary
| Reviewer | Verdict |
|----------|---------|
| GPT | Proposed the changes |
| Claude | Approved - "yt-dlp is useless jargon for users" |
| Gemini | Approved - "improves clarity for non-technical users, resize:vertical is standard practice" |

### Future (lower priority)
1) Add runtime timeouts and Docker healthcheck (ops hardening).
2) Rate limiting + auth/cors hardening (only if exposing beyond localhost).

## Testing / Sanity Pass
- `npm test`
- `npm run build`
- `npm --prefix web run build`
- `npm run api:contract:check`
- `npm run test:docker-smoke`

## Operator Notes
- `.env` must include `ASSEMBLYAI_API_KEY`.
- `Y2T_API_KEY` is optional but recommended when running in Docker or on a server.

## Where To Read More
- `docs/llm/HISTORY.md` (append-only change log)
- `docs/llm/DECISIONS.md` (why we chose things)
- `docs/llm/HANDOFF_ARCHIVE.md` (older handoff content)
