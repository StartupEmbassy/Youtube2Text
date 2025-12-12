# LLM Work Handoff

## Current Status
- Last Updated: 2025-12-12 - GPT-5.2
- Session Focus: Rephase architecture to service-first Phase 0 + language detection.
- Status: `docs/ARCHITECTURE.md` rewritten to make core hardening Phase 0, UI Phase 1+, and add language detection requirement.

## Modularity Review (GPT‑5.2, 2025-12-12)

Summary of current modularity and interface usage for Claude to review.

**What's working well:**
- Clear domain separation in `src/`: `youtube/`, `transcription/`, `formatters/`, `storage/`, `config/`, `pipeline/`, `cli/`, `utils/`.
- Pipeline stages are explicit and locally replaceable at the function/module level.
- `TranscriptionProvider` interface exists and `AssemblyAiProvider` implements it cleanly.

**Where interfaces / dependency inversion are not fully used yet:**
- `src/pipeline/run.ts` instantiates `new AssemblyAiProvider(...)` directly, so the provider interface isn't injected.
- Pipeline depends directly on concrete YouTube helpers (`enumerateVideos`, `downloadAudio`, `fetchVideoDescription`, `fetchVideoComments`) instead of an abstract `YoutubeSource`/`AudioExtractor`.
- Pipeline calls concrete storage functions; no `Storage` interface for swapping backends.
- Pipeline imports provider-specific `InsufficientCreditsError`, creating a core → provider concrete dependency.
- Formatters are modular but chosen manually; no common `Formatter`/`OutputWriter` contract.

**Net assessment:**
- Structurally modular enough for current MVP CLI.
- Only one true interface boundary so far (ASR), and even that is not DI‑wired.
- The folder boundaries make it easy to formalize ports later without rewriting everything.

**If/when moving toward "fully replaceable" design (not requested now):**
- Add "ports" in pipeline for `YoutubeResolver`, `AudioExtractor`, `TranscriptionProvider` (already), `Storage`, `Formatter`, and `ProgressReporter/EventEmitter`.
- Have `runPipeline` accept these deps (DI or a `PipelineContext`).
- Use core‑level error types instead of provider‑specific ones.

### Claude Response to Modularity Review (2025-12-12)

**Verification:** I reviewed the code and your analysis is accurate. Confirmed:
- `run.ts:59` and `run.ts:144` → `new AssemblyAiProvider(...)` (not injected)
- `run.ts:3-7` → concrete YouTube function imports
- `run.ts:11-17` → concrete storage function imports
- `run.ts:23` → `InsufficientCreditsError` from assemblyai (coupling)

**My recommendation - prioritized by Phase 0 web needs:**

| Interface | Priority | Rationale |
|-----------|----------|-----------|
| `StorageAdapter` | **NOW** | Web Phase 0 needs to read local `output/`/`audio/`. Without this, we duplicate read logic. |
| `PipelineEventEmitter` | **NOW** | Required for `--json-events` flag. Web needs structured events, not log parsing. |
| `TranscriptionProvider` | **NOW (wire DI)** | Interface exists but isn't injected. Also add `getAccount()` to interface. |
| Core-level errors | **NOW** | Create `src/errors/` with `InsufficientCreditsError`, `DownloadError`, etc. Break provider coupling. |
| `YoutubeResolver` | **DEFER** | yt-dlp is only source. Create when second provider exists. YAGNI. |
| `AudioExtractor` | **DEFER** | Same rationale. |
| `Formatter` | **DEFER** | TXT/CSV/JSON are trivial. Abstraction overhead not worth it yet. |

**Proposed folder structure:**

```
src/
├── ports/                    # Interfaces (inbound/outbound)
│   ├── storage.ts           # StorageAdapter
│   ├── events.ts            # PipelineEventEmitter
│   ├── transcription.ts     # Move TranscriptionProvider here
│   └── index.ts
├── adapters/                 # Concrete implementations
│   ├── local-storage.ts     # For Phase 0 web
│   ├── assemblyai.ts        # Move from transcription/
│   └── index.ts
├── errors/                   # Core error types
│   ├── credits.ts           # InsufficientCreditsError
│   ├── download.ts          # DownloadError
│   └── index.ts
├── pipeline/
│   ├── context.ts           # PipelineContext with injected deps
│   └── run.ts               # Accepts context, no direct imports
```

**StorageAdapter interface proposal:**

```typescript
interface StorageAdapter {
  // Discovery (for web UI)
  listChannels(): Promise<ChannelInfo[]>;
  listVideos(channelId: string): Promise<VideoInfo[]>;

  // Read
  getTranscript(channelId: string, videoId: string): Promise<TranscriptJson>;
  getAudioPath(channelId: string, videoId: string): Promise<string>;
  getComments(channelId: string, videoId: string): Promise<Comment[] | null>;

  // Write
  saveTranscript(channelId: string, videoId: string, data: TranscriptJson): Promise<void>;
  saveAudio(channelId: string, videoId: string, buffer: Buffer): Promise<string>;

  // Idempotency
  isProcessed(channelId: string, videoId: string): Promise<boolean>;
}
```

**PipelineEventEmitter interface proposal:**

```typescript
type PipelineEvent =
  | { type: 'run:start'; channelId: string; totalVideos: number }
  | { type: 'video:start'; videoId: string; title: string; index: number }
  | { type: 'video:stage'; videoId: string; stage: 'download' | 'upload' | 'transcribe' | 'format' }
  | { type: 'video:done'; videoId: string; index: number }
  | { type: 'video:skip'; videoId: string; index: number; reason: string }
  | { type: 'video:error'; videoId: string; index: number; error: string }
  | { type: 'run:done'; success: number; failed: number; skipped: number };

interface PipelineEventEmitter {
  emit(event: PipelineEvent): void;
  on(callback: (event: PipelineEvent) => void): void;
}
```

**Question for GPT:** Do you want to implement these interfaces, or should I? Either way, this should happen before starting Phase 0 web to avoid duplicate work.

### GPT-5.2 Follow‑up on Interfaces & Service‑First Readiness (2025-12-12)

Context: user is considering exposing the pipeline as an API/service (e.g., for n8n) before building a full web UI, while keeping the CLI fully standalone.

**Agreement with Claude’s proposals:**
- Yes, the `StorageAdapter` and `PipelineEventEmitter` ports are the right next abstractions.
- Wiring `TranscriptionProvider` via DI (instead of direct instantiation) is the main win to unlock multi‑backend ASR and cleaner testing.
- The event contract Claude sketched maps directly to the structured progress API we’ll need for both n8n and a future web UI.

**Why this matters for an API/service:**
- Today’s core is modular by folders but still coupled in `runPipeline`. It’s easy to wrap the CLI, but not ideal for a long‑running multi‑tenant service.
- With these ports + JSON events, we can build a thin “service layer” that:
  1) accepts a URL + config,
  2) runs the pipeline,
  3) streams events,
  4) returns artifact paths/URLs (`.json/.txt/.csv/.comments.json`) per video.
- That layer can power n8n, a web UI, or any other interface without changing the CLI.

**Suggested order (if we proceed):**
1. Add `PipelineEventEmitter` to pipeline as optional dependency; implement a default “logger emitter” for CLI.
2. Add a CLI flag `--json-events` that uses a JSON emitter to stdout (no behavior change otherwise).
3. Introduce `StorageAdapter` in pipeline with a default FS adapter matching current layout.
4. Switch `runPipeline` to accept injected `TranscriptionProvider` (default AssemblyAI).

**Answer to Claude’s question:**
- Either of us can implement; I lean toward implementing in the core now (before Phase 0 web) because it is also prerequisite for a clean n8n/API service.

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
1. **Web Platform Phase 0**: Begin local-first MVP per `docs/ARCHITECTURE.md`:
   - 0.1: Create `web/` Next.js project with shadcn/ui
   - 0.2: Implement `LocalStorageAdapter` and channel library UI
   - 0.3: Video viewer with audio player and transcript sync
   - 0.4: Pipeline runner with `--json-events` and SSE streaming
   - 0.5: Per-video chat and Markdown export
2. **CLI Enhancement**: Add `--json-events` flag for structured pipeline events (required for Phase 0.4).
3. Run the CLI on a real channel to validate end-to-end behavior.
4. Add small unit tests for formatters/config and refine error stage reporting.

## Do Not Touch
Identify areas that should remain unchanged without explicit approval from the user.
- None.

## Open Questions
Capture unresolved questions or assumptions that need confirmation.
- Confirm preferred default AssemblyAI language/model settings.
- Decide whether to keep audio indefinitely or add a cleanup flag.
- Deferred: parallel execution of runs (root-array YAML now supported).
- **User decision needed:** Is channel-level chat (RAG) a Phase 0 must-have or can it wait for Phase 2? (Claude recommends Phase 2, GPT suggests earlier)
- **User decision needed:** Preferred LLM provider for Phase 0 chat - OpenRouter, direct OpenAI/Anthropic, or configurable from start?

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
