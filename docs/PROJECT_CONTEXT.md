# Project Context - Youtube2Text

## Vision
Build a modular local-first pipeline to turn YouTube channel audio into speaker-diarized transcripts, stored on disk in structured formats for later analysis and UI browsing.

## Objectives
1. Provide a CLI that accepts a public YouTube channel, playlist, or video URL with optional filters (date, max videos).
2. Enumerate videos reliably without requiring YouTube API keys.
3. Download audio-only tracks per video using `yt-dlp`.
4. Transcribe audio via AssemblyAI with speaker diarization enabled.
5. Persist results as `.json` (canonical) plus clean, speaker-labeled `.txt` and `.md` (timestamps + wrapping), plus `.jsonl` (one utterance per line), with optional `.csv` export.
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
- attach a web dashboard that reads stored outputs only,
- package the pipeline for deployment (Docker image included for the HTTP API runner).

## Key Components
| Component | Purpose | Owner | Notes |
|-----------|---------|-------|-------|
| InputResolver | Channel/playlist -> video list | TBD | Uses `yt-dlp --flat-playlist`. |
| AudioExtractor | Video -> local audio file | TBD | Wraps `yt-dlp` for audio-only download. |
| TranscriptionProvider | Audio -> diarized transcript | TBD | AssemblyAI v1 implementation first. |
| Formatter | Transcript -> txt/csv | TBD | Speaker-labeled output. |
| Storage | Persist outputs + idempotency | TBD | Layout: `output/<channel_title_slug>__<channel_id>/<basename>.*`. |
| Orchestrator (CLI) | Pipeline coordination | TBD | Concurrency, retries, filters. |

## Current Status (2025-12-20)
MVP CLI is functional. The core is being hardened so it can be embedded as a service later without breaking CLI usage.

Completed:
- CLI supports channel/playlist/single-video URLs
- Audio download via `yt-dlp`, cached locally
- AssemblyAI diarized transcription
- Outputs: `.json`, readable `.txt` and `.md`, `.jsonl`, optional `.csv`
- Optional comments dump via `yt-dlp` into `.comments.json` (non-fatal)
- Per-video `.meta.json` and per-channel `_channel.json` sidecars for browsing/indexing
- Structured JSONL events via `--json-events` (for a future service/UI)
- Language auto-detection via yt-dlp metadata/captions (with manual override)
- AssemblyAI automatic language detection fallback when yt-dlp has no language
- Unit tests for naming/language/txt formatting
- yt-dlp error classification + smarter retries (no retries for access-denied)
- Minimal local HTTP API runner (SSE events + artifacts listing)
- API run/event persistence on disk (restart-safe by default)
- Docker image + docker compose for the API runner
- Phase 2.3 Scheduler/watchlist (cron): plan-first followed-channels automation
- Phase 2.4 Control: cancel runs (cooperative)
- Phase 2.4.x polish: OpenAPI 4XX completeness, graceful shutdown, debug logs endpoint
- Phase 2.5: watchlist web UI + Prometheus metrics endpoint

In progress / next:
- Phase 2.8: security hardening for hosted use (mandatory API key, server-side clamps/validation, rate limiting on write endpoints).

Done recently:
- Phase 2.6: run configuration UX (maxNewVideos + plan preview) to support incremental backfills.
- Phase 2.7: exact planning performance - channel catalog cache + processed index (output-backed) to speed `POST /runs/plan` for large channels.
- Phase 2.7: Settings UI + non-secret defaults persisted to `output/_settings.json` (API `GET/PATCH /settings`).

## Roadmap / Milestones (Do in order)
1. Phase 0: yt-dlp reliability hardening (public videos only) - DONE
2. Phase 0: minimal HTTP API runner (start run + stream events + list artifacts) - DONE
3. Phase 0: persist API runs/events on disk (restart-safe) - DONE
4. Phase 0: Dockerize API runner (service-style deployment) - DONE
5. Phase 1: local-first web UI (reads `output/`, consumes JSON events)
   - DONE: OpenAPI + generated TS types + contract-check workflow to prevent endpoint/type drift (see `docs/operations/API_CONTRACT.md`)
   - DONE: Global SSE (`GET /events`) for live runs list
   - DONE: Additional artifacts `.md` + `.jsonl`
6. Phase 2: hosted single-tenant service (admin)
   - Phase 2.1 Integration MVP: API key auth, `POST /runs/plan`, webhooks, cache-first single-video, integration docs
   - Phase 2.2 Ops hardening: extended healthcheck, CORS allowlist, retention/cleanup
   - Phase 2.3 Scheduler/watchlist (cron): followed channels list + global/per-channel interval, uses `POST /runs/plan` to decide
   - Phase 2.4 Control: cancel run (DONE), rate limiting (optional), optional worker/queue
   - Phase 2.5: watchlist web UI + Prometheus metrics endpoint (DONE)
7. Phase 3+: optional multi-tenant cloud platform

Future input (not implemented yet):
- Accept direct audio file input (skip yt-dlp download stage) via API, intended for n8n/automation use cases.

## References
- AssemblyAI API Docs: https://www.assemblyai.com/docs/
- yt-dlp Docs: https://github.com/yt-dlp/yt-dlp
