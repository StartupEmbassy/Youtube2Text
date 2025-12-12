# Youtube2Text

Local-first, modular CLI service that:
1. Enumerates videos from a public YouTube channel, playlist, or a single video URL.
2. Downloads audio-only tracks using `yt-dlp`.
3. Transcribes audio with AssemblyAI using speaker diarization.
4. Stores structured results on disk for later analysis or UI browsing.

The goal is to keep each stage separable and replaceable (e.g., swapping AssemblyAI for another ASR provider, adding semantic post-processing, or attaching a web dashboard).

## Core Capabilities

- Channel/playlist enumeration via `yt-dlp --flat-playlist` (no YouTube API key required).
- Audio-only download in `mp3` or `wav`.
- AssemblyAI upload + diarized transcription (`speaker_labels: true`).
- Idempotent processing: skips videos already processed unless forced.
- Output formats: `.json`, readable `.txt` (speaker labels + timestamps, wrapped for readability), optional `.csv`.
- Fault handling with retries/backoff and per-video error logs.

## Architecture (High Level)

Pipeline stages with explicit module boundaries:

- **InputResolver**: resolves a channel/playlist URL to a list of video IDs and metadata.
- **AudioExtractor**: downloads and caches audio tracks locally.
- **TranscriptionProvider**: interface for ASR backends. First implementation: AssemblyAI.
- **Formatter**: converts diarized transcript JSON into `.txt` and optional `.csv` formats.
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
When deploying to a server or container, ensure `yt-dlp` is installed in that environment as well (planned approach: Docker image that bundles Node.js + `yt-dlp`).

### Troubleshooting yt-dlp on Windows

If you installed `yt-dlp` via `winget`, PowerShell can sometimes resolve it via an alias while child processes (like Node.js) cannot.
If Youtube2Text reports “yt-dlp not found” but `yt-dlp --version` works in your shell, restart the shell or ensure the real `yt-dlp.exe` path is on PATH.
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
AUDIO_FORMAT=mp3
LANGUAGE_CODE=en_us
CONCURRENCY=2
MAX_VIDEOS=
AFTER_DATE=
CSV_ENABLED=false
```

Example files:

- `.env.example` — template of supported env vars (copy to `.env`).
- `config.yaml.example` — optional non-secret defaults (copy to `config.yaml`).
- `runs.yaml.example` — optional batch runs template (copy to `runs.yaml` or `runs.yml`).

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
| `--audioFormat` | `mp3|wav` | `mp3` | Audio download format. |
| `--language` | string | `en_us` | Passed to AssemblyAI. |
| `--concurrency` | number | `2` | Parallel videos processed. |
| `--force` | boolean | false | Reprocess even if outputs exist. |
| `--csv` | boolean | false | Emit `.csv` alongside `.json`/`.txt`. |

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

Outputs are organized by channel and video ID plus a sanitized title slug:

```
output/<channel_id>/<title_slug>__<video_id>.json
output/<channel_id>/<title_slug>__<video_id>.txt
output/<channel_id>/<title_slug>__<video_id>.csv   # if enabled
```

Raw audio is stored under:

```
audio/<channel_id>/<title_slug>__<video_id>.<ext>
```

Failures are recorded per channel in:

```
output/<channel_id>/_errors.jsonl
```

## Idempotency & Retries

- A video is considered processed if `<video_id>.json` exists under the channel directory.
- Reprocessing requires `--force`.
- Download and transcription retries are handled independently with exponential backoff.

## Roadmap

- Alternative `TranscriptionProvider` implementations.
- Semantic post-processing: summarization, topic clustering.
- React dashboard to browse and interact with local outputs.
