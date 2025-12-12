# Youtube2Text Web Platform Architecture

> Version: 1.1.0-draft  
> Last Updated: 2025-12-12  
> Status: Design Phase  
> Authors: Claude + GPT‑5.2 (merged; viewpoints preserved)

## Overview

Youtube2Text currently ships as a standalone CLI pipeline. This document describes how to evolve it into:
1. A **service/API** that can be called from n8n/Zapier or other interfaces.
2. A **local-first web UI** on top of that service.
3. A **multi-tenant cloud platform** with private workspaces per user.

### Non‑negotiables

- **CLI independence**: the CLI must remain fully functional and usable without the web platform.
- **Shared core**: web/service layers reuse CLI modules; the core never depends on web code.
- **Local-first path to cloud**: validate UX locally before committing to cloud infra.

### Review Notes (Claude vs GPT‑5.2)

**Claude (original intent):**
- Cloud-first multi-tenant platform (Next.js + Supabase + R2 + Redis/BullMQ).
- Import CLI core as a library inside workers.
- RLS everywhere for isolation.
- Web Phase 0 MVP to validate UX.

**GPT‑5.2 (complement / adjustment):**
- Insert a **core hardening/service-first Phase 0** before any UI.
- Make structured progress **events a first-class contract**, not log parsing.
- Promote channel-level RAG and Markdown export earlier because they are core to user workflow.
- Preserve CLI defaults; new capabilities are opt-in flags/config.

---

## System Architecture (High Level)

Layers:

1. **Core Pipeline (shared)**
   - YouTube enumeration + metadata
   - Audio extraction
   - ASR provider(s)
   - Formatters
   - Storage abstraction
   - Progress/event emission

2. **Service/API Layer**
   - Accepts URL + config
   - Starts jobs (sync/transcribe)
   - Streams events (SSE/WebSocket)
   - Returns artifact locations for each video

3. **UI Layer**
   - Local-first admin UI (Phase 1)
   - Cloud multi-tenant UI (Phase 2+)

**Key point:** the service and UI are replaceable shells around the same core.

---

## Technology Stack

### Phase 1 (local-first MVP)

**Claude proposal (accepted):**
- Next.js App Router in `web/`
- Tailwind + shadcn/ui
- wavesurfer.js for waveform audio
- Simple local password auth for admin
- Service uses local filesystem adapter

### Phase 2+ (cloud)

**Claude proposal (accepted with minor adjustments):**
- Next.js (Vercel)
- Supabase Postgres + Auth + Realtime
- Cloudflare R2 for audio/transcripts
- Upstash Redis + BullMQ workers
- Optional OpenRouter (or configurable LLM providers)

---

## Storage Strategy

### Local-first (Phase 0–1)

Artifacts on disk, namespaced for future multi-tenancy:

```
output/<user_id>/<channel_title_slug>__<channel_id>/<basename>.json
output/<user_id>/<channel_title_slug>__<channel_id>/<basename>.txt
output/<user_id>/<channel_title_slug>__<channel_id>/<basename>.csv
output/<user_id>/<channel_title_slug>__<channel_id>/<basename>.comments.json
audio/<user_id>/<channel_title_slug>__<channel_id>/<basename>.mp3
```

Where `<basename>` follows `filenameStyle`:
- `id` → `<video_id>`
- `id_title` → `<video_id>__<title_slug>`
- `title_id` (default) → `<title_slug>__<video_id>`

### Cloud (Phase 2+)

- Large artifacts stored in R2 using the same key layout.
- Postgres stores indexes for:
  - users, sources/channels, videos
  - runs/jobs + per-video stage state
  - errors
  - exports
  - embeddings/chunks
- Idempotency uses DB + expected artifact keys, not hard-coded filenames.

---

## Job Processing & Events

### Event Contract (Claude sketch, adopted)

Core emits structured events via a `PipelineEventEmitter` port:

```
run:start
video:start
video:stage (download|upload|transcribe|format|comments|save)
video:skip
video:error
video:done
run:done
```

Payload includes: `user_id`, `channel_id`, `video_id`, `index`, `total`, `stage`, `timestamp`, `message`.

### CLI integration

- Default emitter prints human logs (current behavior).
- Optional flag `--json-events` switches emitter to JSON lines on stdout.

### Cloud workers (Claude proposal)

- BullMQ queue in Redis.
- Worker runs core pipeline with:
  - R2 storage adapter
  - JSON/SSE event emitter
  - DB stage updates

---

## Transcription, Language Handling & Credits

### ASR Provider Port

`TranscriptionProvider` is injected into the pipeline (default AssemblyAI). This allows future providers without modifying core logic.

### Language Detection (user requirement)

Problem: Spanish videos transcribed poorly when forced to `en_us`.

Plan:
- **Auto-detect language per video** in Phase 0:
  1. Prefer `yt-dlp` metadata fields if present (e.g., `language`, `tags`, `categories`).
  2. Fallback to lightweight language detection over video title/description/comments.
- Map detected language to AssemblyAI `language_code`.
- Allow override via config/CLI for deterministic runs.
- Persist detected language in video metadata for later UI/RAG use.

### Credits behavior

- Preflight check via `/account` is best-effort.
- Hard stop on “insufficient credits” errors is mandatory.

---

## LLM Integration

### Phase 1 MVP

- Per-video chat using full transcript + description + comments context.

### Phase 2+ Core Requirement

Channel-level “Ask the channel”:
- Index per user + channel.
- Chunk transcripts with timestamps and metadata.
- Retrieve top‑k chunks → answer with citations.

---

## Web UI (kept from Claude, rephased)

### Phase 1 Local‑First UI

Screens:
- Dashboard (runs + errors + recent channels/videos)
- Runs/Queue with real-time progress (from JSON events)
- Channel library with filters/search
- Video view: audio player + diarized transcript + comments tab + export buttons

### Phase 2+ Multi‑Tenant UI

Add:
- User auth (Google OAuth)
- Private workspaces per user
- Admin user management + limits (foundation for future billing)
- Usage tracking

---

## Deployment

**Claude proposal (accepted):**
- Local Phase 1: `web/` runs on your machine; service spawns CLI locally.
- Cloud Phase 2+: Vercel for web/API, Railway/Render (or equivalent) for BullMQ workers, Supabase + R2 + Upstash as managed services.

---

## Implementation Phases

### Phase 0: Core Service Hardening (before any UI)

**Claude suggestions we adopt:**
- Add `PipelineEventEmitter` port to the pipeline.
- Add `--json-events` CLI flag.
- Add `StorageAdapter` port with default filesystem adapter.
- Wire `TranscriptionProvider` via DI.

**GPT‑5.2 additions:**
- Keep CLI behavior identical by default.
- Define minimal service/API runner contract (no UI).
- Implement **language auto-detection** and mapping to ASR language codes.

Exit criteria: core works as CLI exactly like today and can be embedded in a service with structured events.

### Phase 1: Local‑First Web MVP (Claude detailed plan)

**1.1 Project Setup**  
Next.js `web/`, Tailwind + shadcn/ui, local admin auth.

**1.2 Channel Library**  
LocalStorageAdapter, scan output folders, channel/video list UI.

**1.3 Video Viewer**  
Audio streaming, waveform, timestamp seek, speaker coloring, comments tab.

**1.4 Pipeline Runner UI**  
Spawn CLI with `--json-events`, SSE to UI, progress dashboard.

**1.5 Chat & Markdown Export**  
Per-video chat, per-video MD export, per-channel MD with index.

### Phase 2: Cloud Foundation

Supabase schema + RLS, R2 bucket, OAuth auth, API routes.

### Phase 3: Sources & Videos (cloud)

CRUD sources, sync/enumeration jobs, video browsing in cloud UI.

### Phase 4: Cloud Processing Pipeline

BullMQ workers, audio → R2, AssemblyAI jobs, realtime progress.

### Phase 5: Video Player & Search

Waveform playback, transcript search, UI polish.

### Phase 6: LLM Chat & Channel RAG

Provider config, streaming chat, channel semantic search/RAG.

### Phase 7: Webhooks & Export

Webhook system, exports (JSON/TXT/CSV/MD/ZIP).

### Phase 8: Polish & Optimization

Recovery, performance, usage tracking.

### Phase 9: Beta Launch

Security review, monitoring, onboarding.

---

## Open Questions

- Which language detection heuristic is preferred for Phase 0 fallback?
- Do we want language detection to be per‑video or per‑channel default with overrides?
- Preferred LLM provider for Phase 1 per-video chat.

