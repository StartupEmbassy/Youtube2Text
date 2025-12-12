# Project Context - Youtube2Text

## Vision
Build a modular local-first pipeline to turn YouTube channel audio into speaker‑diarized transcripts, stored on disk in structured formats for later analysis and UI browsing.

## Objectives
1. Provide a CLI that accepts a public YouTube channel or playlist URL with optional filters (date, max videos).
2. Enumerate videos reliably without requiring YouTube API keys.
3. Download audio-only tracks per video using `yt-dlp`.
4. Transcribe audio via AssemblyAI with speaker diarization enabled.
5. Persist results as `.json` plus clean, speaker-labeled `.txt`, with optional `.csv` export.
6. Ensure idempotency and robust fault handling (skip already processed videos, retry transient failures).

## Stakeholders
- Product owner: TBD
- Technical owner: TBD
- Primary users: Researchers, creators, or teams needing diarized transcripts at scale.
- Additional stakeholders: TBD

## Architectural Overview
The system is designed as a set of reusable stages coordinated by a CLI orchestrator.

Stages:
- **InputResolver**: resolves a channel/playlist URL to a list of video IDs and metadata.
- **AudioExtractor**: downloads and caches audio locally (mp3/wav).
- **TranscriptionProvider**: interface for ASR backends; initial implementation uses AssemblyAI.
- **Formatter**: converts diarized transcript JSON to readable `.txt` and optional `.csv`.
- **Storage**: persists outputs under a stable on-disk layout and performs idempotency checks.
- **Orchestrator (CLI)**: applies filters, concurrency limits, retries/backoff, and logging.

This separation keeps the pipeline local-first and makes later extensions straightforward:
- replace AssemblyAI with another provider,
- add semantic post-processing (summaries/topics),
- attach a React dashboard that reads stored outputs only.

## Key Components
| Component | Purpose | Owner | Notes |
|-----------|---------|-------|-------|
| InputResolver | Channel/playlist → video list | TBD | Uses `yt-dlp --flat-playlist`. |
| AudioExtractor | Video → local audio file | TBD | Wraps `yt-dlp` for audio-only download. |
| TranscriptionProvider | Audio → diarized transcript | TBD | AssemblyAI v1 implementation first. |
| Formatter | Transcript → txt/csv | TBD | Speaker-labeled output. |
| Storage | Persist outputs + idempotency | TBD | Layout: `output/<channel_id>/<video_id>.*`. |
| Orchestrator (CLI) | Pipeline coordination | TBD | Concurrency, retries, filters. |

## Current Status (2025-12-12)
Documentation scaffold adapted to Youtube2Text scope. No application code has been written yet.

## Upcoming Milestones
1. Scaffold Node.js + TypeScript project and CLI skeleton.
2. Implement YouTube enumeration and audio download modules.
3. Implement AssemblyAI transcription provider and formatters.
4. Add idempotency, retry tests, and documentation polish.

## References
- AssemblyAI API Docs: https://www.assemblyai.com/docs/
- yt-dlp Docs: https://github.com/yt-dlp/yt-dlp
