# Youtube2Text

Local-first, modular CLI service that:
1. Enumerates videos from a public YouTube channel, playlist, or a single video URL.
2. Downloads audio-only tracks using `yt-dlp`.
3. Transcribes audio with AssemblyAI using speaker diarization.
4. Stores structured results on disk for later analysis or UI browsing.

The goal is to keep each stage separable and replaceable (e.g., swapping AssemblyAI for another ASR provider, adding semantic post-processing, or attaching a web dashboard).

Quick links:
- Practical walkthrough: `HOW_TO_USE.md`
- Integration guide (curl/n8n/webhooks): `INTEGRATION.md`
- LLM snapshot/roadmap: `docs/llm/HANDOFF.md`
- Deployment playbook (single-tenant admin): `docs/operations/DEPLOY_PLAYBOOK.md`

## Core Capabilities

- Channel/playlist enumeration via `yt-dlp --flat-playlist` (no YouTube API key required).
- Audio-only download in `mp3` or `wav`.
- AssemblyAI upload + diarized transcription (`speaker_labels: true`).
- Idempotent processing: skips videos already processed unless forced.
- Output formats: `.json` (canonical), readable `.txt` + `.md` (timestamps + wrapping), `.jsonl` (LLM-friendly, one utterance per line), optional `.csv`.
- Optional per-video comments dump via `yt-dlp` into `.comments.json`.
- Optional per-video metadata sidecar `.meta.json` for browsing/indexing.
- Fault handling with retries/backoff and per-video error logs.
- Library UX: channel avatars are best-effort from yt-dlp metadata (stored in `output/<channelDir>/_channel.json`). If a channel folder was created before avatars existed (or before v0.9.2), rerun that channel (or any video from it) once to populate the thumbnail URL.

## Architecture (High Level)

Pipeline stages with explicit module boundaries:

- **InputResolver**: resolves a channel/playlist URL to a list of video IDs and metadata.
- **AudioExtractor**: downloads and caches audio tracks locally.
- **TranscriptionProvider**: interface for ASR backends. First implementation: AssemblyAI.
- **Formatter**: converts diarized transcript JSON into `.txt`, `.md`, `.jsonl` and optional `.csv` formats.
- **Storage**: writes outputs and handles idempotency checks.
- **Orchestrator (CLI)**: coordinates stages with concurrency, filtering, retries, and logging.

Later extensions read from `output/` only (e.g., React dashboard), keeping the pipeline server-agnostic.

## Requirements

- Node.js 18+
- `yt-dlp` installed and available on PATH (system dependency)
- AssemblyAI API key
- Windows/macOS/Linux

### Production Note

For local development, Youtube2Text relies on a system-installed `yt-dlp`.
When deploying to a server or container, ensure `yt-dlp` is installed in that environment as well. For the HTTP API runner, a Docker image/docker-compose setup is included (see "Docker (API runner)" below).

### Troubleshooting yt-dlp on Windows

If you installed `yt-dlp` via `winget`, PowerShell can sometimes resolve it via an alias while child processes (like Node.js) cannot.
If Youtube2Text reports "yt-dlp not found" but `yt-dlp --version` works in your shell, restart the shell or ensure the real `yt-dlp.exe` path is on PATH.
The pipeline also attempts to resolve the executable via PowerShell automatically.

If VSCode's integrated terminal still cannot find it, set an explicit path:

```powershell
$env:YT_DLP_PATH="C:\path\to\yt-dlp.exe"
npm run dev
```

You can also pass an explicit path via CLI or `runs.yaml`:

```powershell
npm run dev -- --ytDlpPath "C:\Users\cdela\AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe"
```

### yt-dlp extractor warnings (public videos)

If you see warnings about a missing JavaScript runtime (EJS), you can optionally set `YT_DLP_EXTRA_ARGS` to use a different YouTube player client.

- Conservative option (often silences warnings):
  - `YT_DLP_EXTRA_ARGS=["--extractor-args","youtube:player_client=default"]`
- More aggressive option (may avoid extractor JS entirely, but can require additional YouTube tokens depending on upstream changes):
  - `YT_DLP_EXTRA_ARGS=["--extractor-args","youtube:player_client=android"]`

If downloads fail after changing this, set `YT_DLP_EXTRA_ARGS=[]` to revert to yt-dlp defaults.

Note: Youtube2Text only targets public videos. If a channel contains members-only/private/age-restricted videos, yt-dlp will fail for those and Youtube2Text will record the failure and continue with the rest.

## Configuration

Configuration is loaded from:

1. `.env` (required for secrets).
2. Optional `config.yaml` for non-secret defaults.
3. Optional `runs.yaml` for convenient multi-run execution.

`.env` takes precedence for overlapping keys.

Example environment variables:

```
ASSEMBLYAI_API_KEY=your_key_here
OUTPUT_DIR=output
AUDIO_DIR=audio
FILENAME_STYLE=title_id   # id | id_title | title_id
AUDIO_FORMAT=mp3
LANGUAGE_CODE=en_us
LANGUAGE_DETECTION=auto   # auto | manual
CONCURRENCY=2
MAX_VIDEOS=
AFTER_DATE=
CSV_ENABLED=false
ASSEMBLYAI_CREDITS_CHECK=warn   # warn | abort | none
ASSEMBLYAI_MIN_BALANCE_MINUTES=60
COMMENTS_ENABLED=false
COMMENTS_MAX=
YT_DLP_EXTRA_ARGS=[]
```

Example files:

- `.env.example` - template of supported env vars (copy to `.env`).
- `config.yaml.example` - optional non-secret defaults (copy to `config.yaml`).
- `runs.yaml.example` - optional batch runs template (copy to `runs.yaml` or `runs.yml`).

## CLI Usage

```
youtube2text [channel_or_playlist_or_video_url] [options]
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--maxVideos` | number | unset | Process at most N videos. |
| `--after` | date | unset | Only process videos after YYYY-MM-DD. |
| `--outDir` | path | `output` | Output root directory. |
| `--filenameStyle` | `id|id_title|title_id` | `title_id` | Output/audio filename style. |
| `--audioFormat` | `mp3|wav` | `mp3` | Audio download format. |
| `--language` | string | `en_us` | Passed to AssemblyAI. |
| `--languageDetection` | `auto|manual` | `auto` | Detect language per video via yt-dlp metadata/captions; if undetected, fall back to AssemblyAI automatic language detection. |
| `--concurrency` | number | `2` | Parallel videos processed. |
| `--force` | boolean | false | Reprocess even if outputs exist. |
| `--csv` | boolean | false | Emit `.csv` alongside `.json`/`.txt`. |
| `--assemblyAiCreditsCheck` | `warn|abort|none` | `warn` | Preflight AssemblyAI credits check mode. |
| `--assemblyAiMinBalanceMinutes` | number | `60` | Warn/abort if remaining credits below N minutes. |
| `--comments` | boolean | false | Fetch comments via yt-dlp and save `.comments.json`. |
| `--commentsMax` | number | unset | Limit comments per video when fetching. |
| `--json-events` | boolean | false | Emit JSONL pipeline events to stdout (logs go to stderr). |

## HTTP API (experimental)

This project also ships an optional local HTTP API runner. It does not replace the CLI.

Run in dev mode:

```powershell
npm run dev:api
```

Or build and run:

```powershell
npm run build
npm run api
```

Defaults:
- Listens on `http://127.0.0.1:8787` (set `HOST`/`PORT` to override)

Persistence (default enabled):
- Runs and SSE events are persisted under `output/_runs/<runId>/` so restarts do not lose history.
- Disable with `Y2T_API_PERSIST_RUNS=false`.
- Override directory with `Y2T_API_PERSIST_DIR=...`.

Auth (optional, recommended for server/Docker):
- Set `Y2T_API_KEY` to require `X-API-Key: ...` on all endpoints (except `GET /health`).
- Example:
  - `curl -H "X-API-Key: $Y2T_API_KEY" http://127.0.0.1:8787/runs`

CORS (recommended for server deployments):
- By default the API sends `Access-Control-Allow-Origin: *`.
- To restrict browser access to specific origins, set `Y2T_CORS_ORIGINS` (comma-separated), e.g.:
  - `Y2T_CORS_ORIGINS=https://your-admin.example.com,http://localhost:3000`

Retention / cleanup (ops hardening):
- Configure via env:
  - `Y2T_RETENTION_RUNS_DAYS` (default `30`, set `-1` to disable)
  - `Y2T_RETENTION_AUDIO_DAYS` (default `7`, set `-1` to disable)
- Cleanup scope:
  - Deletes only run persistence under `output/_runs/*` and old audio cache under `audio/*`
  - Never deletes transcripts under `output/<channelDir>/*`
- Cleanup triggers:
  - Best-effort automatic cleanup on API startup
  - Manual: `POST /maintenance/cleanup`

Scheduler / watchlist (Phase 2.3, opt-in):
- Maintain a list of followed channels via `POST /watchlist`.
- The in-process scheduler periodically calls `POST /runs/plan` and creates a run only when `toProcess > 0`.
- Enable with:
  - `Y2T_SCHEDULER_ENABLED=true`
  - `Y2T_SCHEDULER_INTERVAL_MINUTES=60` (default)
  - `Y2T_SCHEDULER_MAX_CONCURRENT_RUNS=1` (default)
- Manual testing:
  - `POST /scheduler/trigger`

Webhooks (optional):
- `POST /runs` supports `callbackUrl`. The API sends a POST webhook when the run ends:
  - `run:done` when status becomes `done`
  - `run:error` when status becomes `error`
- If `Y2T_WEBHOOK_SECRET` is set, requests include:
  - `X-Y2T-Timestamp` (ISO timestamp)
  - `X-Y2T-Signature` (`sha256=<hex>`), where HMAC-SHA256 is computed over `${timestamp}.${body}`

Endpoints:
- `GET /health`
- `GET /health?deep=true` (best-effort deps + disk + persistence checks)
- `POST /maintenance/cleanup` (retention cleanup for `output/_runs/*` + old audio cache)
- `GET /watchlist`, `POST /watchlist`, `PATCH /watchlist/:id`, `DELETE /watchlist/:id` (followed channels list)
- `GET /scheduler/status`, `POST /scheduler/start|stop|trigger` (Phase 2.3, opt-in)
- `GET /events` (SSE global stream for run updates)
- `POST /runs/plan` with JSON body `{ "url": "...", "force": false, "config": { ... } }` (enumerate + skip counts, no transcription)
- `POST /runs` with JSON body `{ "url": "...", "force": false, "callbackUrl": "https://...", "config": { ... } }` (cache-first for single-video URLs)
- `GET /runs`
- `GET /runs/:id`
- `GET /runs/:id/events` (SSE, supports `Last-Event-ID`)
- `GET /runs/:id/artifacts`
- `GET /library/channels`
- `GET /library/channels/:channelDirName`
- `GET /library/channels/:channelDirName/videos`
- `GET /library/channels/:channelDirName/videos/:basename/:kind` where `kind` is `txt|md|json|jsonl|meta|comments|csv|audio`

## Docker (API runner)

Docker runs the HTTP API runner (and optionally the web UI via docker-compose). It does not replace the CLI.

Prerequisites:
- Docker + Docker Compose
- `ASSEMBLYAI_API_KEY` available as an environment variable

Run:

```powershell
$env:ASSEMBLYAI_API_KEY="your_key_here"
$env:Y2T_API_KEY="your_admin_key_here"
docker compose up --build
```

Open:
- Web UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

Data is persisted locally via bind mounts:
- `./output` -> `/data/output` (includes `output/_runs/` for persisted runs/events)
- `./audio` -> `/data/audio`

Optional (reproducible builds): pin `yt-dlp` version at build time:

```powershell
docker build --build-arg YT_DLP_VERSION=2025.01.01 -t youtube2text-api .
```

### Docker smoke test (no credits)

This repo includes a no-credit smoke test that:
1) builds the Docker image
2) starts the API container
3) checks `GET /health` and `GET /runs`
4) stops the container

Run:

```powershell
npm run test:docker-smoke
```

## Web UI (Next.js, Phase 1 - experimental)

This repo includes an admin UI built with Next.js. It reads existing outputs via the API and streams run progress via SSE. It does not replace the CLI.
It can also start runs via the API (`POST /runs`).
The runs list auto-updates via the global SSE stream (`GET /events`).

Run locally (two terminals):

```powershell
npm run dev:api
```

```powershell
cd web
npm install
npm run dev
```

Defaults:
- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

Run via Docker Compose (API + Web):

```powershell
$env:ASSEMBLYAI_API_KEY="your_key_here"
docker compose up --build
```

### runs.yaml (optional)

If you run the CLI **without** providing a URL, and a `runs.yaml` (or `runs.yml`) file exists in the project root, Youtube2Text will execute each run in sequence. Each run `url` can be a channel, playlist, or individual video.

YAML must use spaces (no tabs). You can use either:

- Object form (recommended):
  ```yaml
  runs:
    - url: "https://..."
  ```
- Root array form:
  ```yaml
  - url: "https://..."
  - url: "https://..."
  ```

Example `runs.yaml`:

```yaml
runs:
  - url: "https://www.youtube.com/@somechannel"
    maxVideos: 10
    after: "2024-01-01"
    concurrency: 2
    csvEnabled: false

  - url: "https://www.youtube.com/playlist?list=PLxxxx"
    maxVideos: 5
    after: "2023-06-01"
    outDir: "output_alt"
    audioDir: "audio_alt"
    csvEnabled: true
    force: false
```

Fields in `runs.yaml` override defaults from `config.yaml`/`.env` for that specific run.

## Output Layout

Outputs are organized by channel folder named `<channel_title_slug>__<channel_id>` when available. Filenames depend on `filenameStyle` (default `title_id`):

```
output/<channel_title_slug>__<channel_id>/<title_slug>__<video_id>.json   # default title_id
output/<channel_title_slug>__<channel_id>/<video_id>.json                # filenameStyle=id
output/<channel_title_slug>__<channel_id>/<video_id>__<title_slug>.json  # filenameStyle=id_title
output/<channel_title_slug>__<channel_id>/<basename>.md                  # markdown transcript
output/<channel_title_slug>__<channel_id>/<basename>.jsonl               # utterances as JSONL (one per line)
output/<channel_title_slug>__<channel_id>/<basename>.comments.json       # if comments enabled
output/<channel_title_slug>__<channel_id>/<basename>.meta.json           # per-video metadata
output/<channel_title_slug>__<channel_id>/_channel.json                  # per-channel metadata
```

Raw audio is stored under:

```
audio/<channel_title_slug>__<channel_id>/<title_slug>__<video_id>.<ext>  # default title_id
```

Failures are recorded per channel in:

```
output/<channel_id>/_errors.jsonl
```

## Idempotency & Retries

- A video is considered processed if the expected JSON file exists under the current `filenameStyle`.
- Reprocessing requires `--force`.
- Download and transcription retries are handled independently with exponential backoff.

## Roadmap

- Alternative `TranscriptionProvider` implementations.
- Semantic post-processing: summarization, topic clustering.
- React dashboard to browse and interact with local outputs.

## Testing

Run unit tests:

```powershell
npm test
```

Build TypeScript output:

```powershell
npm run build
```
