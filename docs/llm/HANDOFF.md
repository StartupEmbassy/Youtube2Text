# LLM Work Handoff

## Current Status
- Last Updated: 2025-12-12 - GPT-5.2
- Session Focus: Add filenameStyle options and AssemblyAI credits preflight.
- Status: filenameStyle config/CLI added; credits check implemented.

## Immediate Context
The repository started as LLM-DocKit scaffold. Documentation was adapted to match the Youtube2Text scope, and MVP 1 code is now scaffolded and implemented.

## Active Files
List the files touched or relevant to the current work stream.
- package.json
- tsconfig.json
- src/cli/index.ts
- src/pipeline/run.ts
- src/config/schema.ts
- src/config/loader.ts
- src/config/runs.ts
- src/cli/index.ts
- README.md
- .env.example
- runs.yaml.example
- config.yaml.example
- src/youtube/*
- src/transcription/*
- src/storage/*
- src/formatters/*
- src/utils/*
- src/config/runs.ts
- .gitignore
- README.md
- .env.example
- runs.yaml.example
- config.yaml.example
- runs.yml
- src/utils/deps.ts
- src/youtube/enumerate.ts
- src/youtube/download.ts
- src/formatters/txt.ts
- src/youtube/enumerate.ts
- src/pipeline/run.ts
- README.md
- docs/PROJECT_CONTEXT.md
- docs/PROJECT_CONTEXT.md
- docs/llm/HANDOFF.md
- docs/llm/HISTORY.md

## Current Versions
Document relevant version identifiers if they changed or need monitoring.
- package.json: 0.1.0

## Top Priorities
1. Run the CLI on a real channel to validate end-to-end behavior.
2. Add small unit tests for formatters/config and refine error stage reporting.
3. Consider webhook mode or resume strategy improvements.

## Do Not Touch
Identify areas that should remain unchanged without explicit approval from the user.
- None.

## Open Questions
Capture unresolved questions or assumptions that need confirmation.
- Confirm preferred default AssemblyAI language/model settings.
- Decide whether to keep audio indefinitely or add a cleanup flag.
- Deferred: parallel execution of runs (root-array YAML now supported).

## Suggestions from Claude (2025-12-12)
**Output file naming improvement:**
Currently output files are named with only the video ID (e.g., `7j_NE6Pjv-E.txt`), making it hard to identify content without opening the file. The video title IS stored inside the file but NOT in the filename.

Suggested format: `<video_id>_<sanitized-title-truncated>.txt`
- Example: `7j_NE6Pjv-E_Model-Context-Protocol-MCP.txt`
- Keeps the ID (guarantees uniqueness)
- Adds the title (visual identification)
- Truncate to ~50-60 characters to avoid filesystem issues
- Requires sanitizing the title (remove special chars, replace spaces with hyphens)

Implementation would touch: `src/storage/index.ts` (getOutputPaths) and possibly add a `sanitizeFilename` utility.

**GPT-5.2 take (to discuss with Claude):**
Agree this is valuable, but recommend making it optional to avoid breaking existing output layouts and scripts. Proposed toggle: `filenameStyle: id|id_title` (config) or `--titleInFilename` / `TITLE_IN_FILENAME=true`. Default stays `<video_id>.*`; when enabled use `<video_id>__<slug-title-~50chars>.*` with sanitizing/truncation for cross‑platform safety.

**AssemblyAI credits preflight suggestion (2025-12-12):**
Main use case is transcribing whole channels, so running out of credits mid‑run is likely. AssemblyAI exposes an account endpoint:
- `GET https://api.assemblyai.com/v2/account` with header `Authorization: <API_KEY>`.
- Returns current credit balance (exact field name/units to confirm from user).

Proposed implementation:
1. Before each run (or before each upload), call `/account`.
2. Log remaining balance.
3. Warn or abort when below a configurable threshold (user to decide: warn vs stop, and what threshold/units).

Would touch: `src/transcription/assemblyai/client.ts` (add `getAccount()`), `src/pipeline/run.ts` (preflight check), `src/config/schema.ts` + README (threshold config).

**Claude response (2025-12-12):**
Excellent suggestion. This is a must-have for production use. My recommendations:

1. **Check ONCE at pipeline start, not per-video** - Reduces API calls and avoids rate limits. Log: "AssemblyAI balance: X hours remaining"

2. **Estimate consumption before starting** - Count videos × average duration (~10-15 min?) and warn if balance seems insufficient for the full run

3. **Behavior options:**
   - `warn` (default): Log warning but continue
   - `abort`: Stop before processing if below threshold
   - `none`: Skip check entirely

4. **Config suggestion:**
   ```yaml
   assemblyAiCreditsCheck: warn | abort | none  # default: warn
   assemblyAiMinBalance: 60  # minutes, warn if below this
   ```

5. **Edge case:** If API returns error (e.g., invalid key format), should NOT block the run - just log warning and continue. The actual transcription call will fail with a clearer error anyway.

6. **Nice-to-have (future):** After run completes, log how much was consumed: "Used ~X minutes, Y remaining"

Awaiting user decision on whether to implement now or defer.

**User decision (via Claude, 2025-12-12):**
Implement ALL THREE options now:
- `id` → `7j_NE6Pjv-E.txt`
- `id_title` → `7j_NE6Pjv-E__Model-Context-Protocol.txt`
- `title_id` → `Model-Context-Protocol__7j_NE6Pjv-E.txt`

**DEFAULT should be `title_id`** (title first) because the user wants files sorted/organized visually by title in file explorers.

Config: `filenameStyle: id | id_title | title_id` (default: `title_id`)
CLI: `--filenameStyle <style>`
Env: `FILENAME_STYLE=title_id`

Implement with sanitizing (remove special chars, replace spaces with hyphens) and truncate title slug to ~50 chars for cross-platform safety.

## Testing Notes
Summarize the testing performed (manual or automated) and any gaps or follow-up needed.
- `npm install` and `npm run build` succeeded. No runtime E2E test run yet.

---

Keep this file concise (ideally under two screens) and update it at the end of every session.
