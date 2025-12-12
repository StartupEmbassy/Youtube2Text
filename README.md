# Youtube2Text

Local-first, modular CLI service that:
1. Enumerates all videos from a public YouTube channel or playlist.
2. Downloads audio-only tracks using `yt-dlp`.
3. Transcribes audio with AssemblyAI using speaker diarization.
4. Stores structured results on disk for later analysis or UI browsing.

The goal is to keep each stage separable and replaceable (e.g., swapping AssemblyAI for another ASR provider, adding semantic post-processing, or attaching a web dashboard).

## Core Capabilities

- Channel/playlist enumeration via `yt-dlp --flat-playlist` (no YouTube API key required).
- Audio-only download in `mp3` or `wav`.
- AssemblyAI upload + diarized transcription (`speaker_labels: true`).
- Idempotent processing: skips videos already processed unless forced.
- Output formats: `.json`, readable `.txt`, optional `.csv`.
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
- `yt-dlp` installed and available on PATH
- AssemblyAI API key
- Windows/macOS/Linux

## Configuration

Configuration is loaded from:

1. `.env` (required for secrets).
2. Optional `config.yaml` for non-secret defaults.

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

## CLI Usage (Planned)

```
youtube2text <channel_or_playlist_url> [options]
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

## Output Layout

Outputs are organized by channel and video ID:

```
output/<channel_id>/<video_id>.json
output/<channel_id>/<video_id>.txt
output/<channel_id>/<video_id>.csv   # if enabled
```

Raw audio is stored under:

```
audio/<channel_id>/<video_id>.<ext>
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
