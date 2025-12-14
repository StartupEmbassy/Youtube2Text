# Youtube2Text Architecture (Service First, Web Later)

> Version: 1.1.2-draft
> Last Updated: 2025-12-14
> Status: Design / Roadmap
> Authors: Claude + GPT-5.2 (viewpoints preserved)

## Overview

Youtube2Text ships today as a standalone CLI pipeline. The roadmap evolves it into:
1. A core library that can run as CLI or as a service (Phase 0).
2. A local-first web UI that reads existing outputs and can run jobs (Phase 1).
3. A multi-tenant cloud platform (Phase 2+).

## Non-negotiables

- CLI independence: the CLI must remain fully functional and usable without any web code.
- Shared core: web/service layers reuse the same core modules; core never depends on web.
- Local-first path to cloud: validate correctness + UX locally before committing to cloud infra.
- Public videos only: no cookies ingestion/refresh; members-only/private content is out of scope.

## Claude vs GPT Notes (kept explicit)

Claude (original intent):
- Cloud-first multi-tenant platform (Next.js + Supabase + object storage + Redis/BullMQ).
- Import the CLI core as a library inside workers.
- RLS everywhere for isolation.
- UI early to validate UX.

GPT-5.2 (adjustment):
- Insert a core hardening/service-first Phase 0 before any UI.
- Treat structured progress events as a first-class contract (no log parsing).
- Keep CLI behavior identical by default; new capabilities are opt-in flags/config.

## System Architecture (high level)

Layers:

1. Core pipeline (shared)
   - YouTube enumeration + metadata
   - Audio extraction
   - ASR provider(s)
   - Formatters
   - Storage abstraction
   - Progress/event emission

2. Runners (thin shells)
   - CLI runner (current)
   - Future HTTP API runner
   - Future worker runner (cloud)

3. UI
   - Phase 1 local-first web UI
   - Phase 2+ cloud UI

Key point: the service and UI are replaceable shells around the same core.

## Storage Strategy

Local-first artifacts on disk. Current layout:

- `output/<channel_title_slug>__<channel_id>/<basename>.json`
- `output/<channel_title_slug>__<channel_id>/<basename>.txt`
- `output/<channel_title_slug>__<channel_id>/<basename>.csv` (optional)
- `output/<channel_title_slug>__<channel_id>/<basename>.comments.json` (optional, non-fatal)
- `output/<channel_title_slug>__<channel_id>/<basename>.meta.json` (sidecar for indexing/browsing)
- `output/<channel_title_slug>__<channel_id>/_channel.json` (per-channel metadata)
- `audio/<channel_title_slug>__<channel_id>/<basename>.<ext>`

Future multi-tenancy (Phase 2+) can wrap the same structure under a `user_id` prefix:
`output/<user_id>/...` and `audio/<user_id>/...`.

## Events Contract

Core emits structured events via a `PipelineEventEmitter` port. Example event types:

- `run:start`, `run:done`
- `video:start`, `video:skip`, `video:error`, `video:done`
- `video:stage` (download|upload|transcribe|format|comments|save)

Runners decide how to consume events:
- CLI default: human logs to stdout.
- CLI `--json-events`: JSONL events to stdout (logs to stderr).
- API runner: translate events to SSE/WebSocket streams.

## Transcription, Language Handling, Credits

Transcription is abstracted via a `TranscriptionProvider` (AssemblyAI first).

Language handling requirement: non-English videos transcribe poorly when forced to `en_us`.

Implemented approach (Phase 0):
1. Manual override (`--language` / `languageCode`) when desired.
2. Otherwise auto-detect per video using yt-dlp metadata priority:
   - `metadata.language` (most reliable)
   - `subtitles` (manually uploaded)
   - `automatic_captions` (filtered to AssemblyAI-supported codes)
3. If still undetected, enable AssemblyAI automatic language detection (`language_detection: true`).

Persist detected language in per-video `.meta.json` for later UI/RAG use.

Credits behavior:
- Preflight account/balance check is best-effort (warn/abort/none).
- Hard stop on "insufficient credits" errors is mandatory.

## Phases / Roadmap (counted, sequential)

### Phase 0 - Core service hardening (no web UI)

Completed:
1. PipelineEventEmitter + CLI `--json-events`.
2. StorageAdapter + filesystem implementation for reading existing `output/`.
3. Sidecar metadata (`_channel.json`, `<basename>.meta.json`) for indexing/browsing.
4. Language auto-detection (metadata/captions) + unit tests.
5. yt-dlp reliability hardening (public videos only)
   - Keep `ytDlpExtraArgs` configurable.
   - Recommended: `["--extractor-args","youtube:player_client=default"]` when you hit EJS warnings.
   - Do not default to `youtube:player_client=android` (can require extra YouTube tokens and break public downloads).
6. Minimal HTTP API runner (service shell around core)
   - `POST /runs` to start a run
   - `GET /runs/:id/events` (SSE) to stream JSON events
   - `GET /runs/:id/artifacts` to list produced outputs
7. Persist API runs/events on disk (survive restarts)
   - Persist under `output/_runs/<runId>/` by default
   - Reload on startup; use `Last-Event-ID` for SSE reconnect
8. Dockerize once the API exists
   - Image bundles Node + yt-dlp + ffmpeg
   - Volumes for `output/` and `audio/`

Remaining (do in order):
9. Future reminder: scheduled sync/cron
   - periodically enumerate followed channels and enqueue newly published videos

Exit criteria: core still runs as CLI exactly like today and can be embedded in a service with structured events.

### Phase 1 - Local-first web UI (kept from Claude, moved later)

Goal: browse outputs + run jobs locally as an admin.

Screens:
- Dashboard (runs + errors + recent channels/videos)
- Runs/Queue with real-time progress (from JSON events)
- Channel library with filters/search (reads `output/`)
- Video view: audio player + transcript + comments tab + exports

### Phase 2+ - Cloud multi-tenant platform (optional)

Add:
- user auth + private workspaces per user
- persistent DB indexes (runs/jobs, channels, videos, errors)
- object storage for artifacts
- workers/queues for background processing
- usage tracking + admin controls (foundation for future billing)
