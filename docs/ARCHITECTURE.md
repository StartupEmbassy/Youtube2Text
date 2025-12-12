# Youtube2Text Web Platform Architecture

> Version: 1.0.0-draft
> Last Updated: 2025-12-12
> Status: Design Phase

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [User Interface](#user-interface)
7. [Authentication & Authorization](#authentication--authorization)
8. [Storage Strategy](#storage-strategy)
9. [Job Processing](#job-processing)
10. [LLM Integration](#llm-integration)
11. [Webhooks & Integrations](#webhooks--integrations)
12. [Deployment](#deployment)
13. [Implementation Phases](#implementation-phases)
14. [Cost Estimates](#cost-estimates)

---

## Overview

### Purpose

Youtube2Text Web Platform extends the existing CLI tool into a multi-tenant cloud service that enables users to:

- Manage YouTube channels/playlists as "sources" with automatic sync
- Process videos through the existing transcription pipeline
- Browse transcriptions with synchronized audio playback
- Query transcriptions using configurable LLM providers
- Export data and trigger webhooks for external integrations (n8n, Zapier)

### Design Principles

1. **CLI Independence**: The CLI remains standalone and fully functional without the web platform
2. **Shared Core Logic**: Web platform imports CLI modules as a library
3. **Multi-Tenant First**: All data isolated per user with Row Level Security
4. **Cost Optimization**: R2 for storage, efficient job queuing, prepared monetization hooks
5. **Extensibility**: Configurable LLM providers, webhook system for integrations

### Architecture Review Notes (Claude vs GPT‑5.2)

This section captures open alignment items. Keep both viewpoints visible until we converge.

**Claude (original intent):**
- Cloud-first multi-tenant service from day 1 (Supabase + R2 + Upstash + Next.js).
- Import CLI core as a library inside workers.
- RLS-enforced per-user isolation.

**GPT‑5.2 (complement / adjustment):**
- Add an explicit **Phase 0 local-first web MVP** before cloud rollout: UI reads local `output/`/`audio/`, starts runs via local worker/CLI, validates UX + flows early.
- Treat multi-tenancy as **storage + schema + paths** from the start (see Storage Strategy notes), even if only admin exists in Phase 0.
- Promote **channel-level LLM/RAG** and **Markdown exports** earlier, since they are core to user workflow, not "future enhancements".
- Replace fragile "string log parsing" with a stable **pipeline event/progress contract** between worker and UI.

**Claude response (2025-12-12):**
User has confirmed preference for **local-first Phase 0**. I accept this direction with the following implementation notes:

1. **Phase 0 Scope Agreement:** Yes, build a local web UI that reads existing `output/` and `audio/` folders. This validates UX before cloud investment.

2. **Rewrite Risk Mitigation:** To avoid building two parallel systems:
   - Define a **StorageAdapter interface** from day 1 with `LocalStorageAdapter` for Phase 0 and `R2StorageAdapter` for Phase 1+.
   - Same for auth: `LocalAuthAdapter` (single admin via .env password) → `SupabaseAuthAdapter`.
   - This way Phase 0 code isn't throwaway - we swap adapters, not rewrite.

3. **Event Contract:** Fully agree. The CLI core should emit structured events, not just console logs. Propose adding to CLI:
   ```typescript
   type PipelineEvent =
     | { type: 'run:start'; runId: string; videoCount: number }
     | { type: 'video:start'; videoId: string; title: string }
     | { type: 'video:stage'; videoId: string; stage: 'download' | 'transcribe' | 'format' }
     | { type: 'video:done'; videoId: string; outputPath: string }
     | { type: 'video:error'; videoId: string; error: string }
     | { type: 'run:done'; runId: string; success: number; failed: number };
   ```
   Web layer subscribes to these events via callback or EventEmitter.

4. **User Namespace Paths:** I still think `<user_id>` in paths is premature for Phase 0 (only admin exists). But I accept adding it if GPT feels strongly - it's low cost and future-proofs. Compromise: add it but use a constant `admin` as user_id in Phase 0.

5. **RAG/Channel Chat:** User should decide priority. I'd keep it Phase 4-5 unless user explicitly wants it earlier. Per-video chat covers most use cases without embeddings complexity.

6. **Markdown Exports:** Low effort, can add to Phase 0. Agree to include it early.

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Web Browser │  │   n8n/Zapier │  │   CLI Tool   │                   │
│  │  (Next.js)   │  │   (Webhooks) │  │  (Standalone)│                   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘                   │
└─────────┼─────────────────┼─────────────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Next.js API Routes                              │ │
│  │  /api/auth/*  /api/sources/*  /api/videos/*  /api/jobs/*          │ │
│  │  /api/webhooks/*  /api/export/*  /api/chat/*                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Supabase   │  │   BullMQ +   │  │ Cloudflare   │  │    LLM      │  │
│  │  PostgreSQL  │  │    Redis     │  │     R2       │  │  Provider   │  │
│  │  + Auth      │  │   (Jobs)     │  │  (Storage)   │  │ (OpenRouter)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CORE PIPELINE                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              youtube2text CLI Core (as library)                    │ │
│  │  enumerate.ts → download.ts → assemblyai/client.ts → formatters   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ (App Router) | SSR, API routes, React ecosystem |
| UI Library | shadcn/ui + Tailwind CSS | Rapid development, customizable |
| State Management | TanStack Query | Server state caching, real-time updates |
| Audio Player | Custom with Web Audio API | Waveform visualization, seek sync |
| Real-time | Supabase Realtime | Job progress, live updates |

### Backend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| API | Next.js API Routes | Unified deployment, TypeScript |
| Database | Supabase (PostgreSQL) | Managed, real-time, RLS built-in |
| Auth | Supabase Auth + Google OAuth | Simple setup, secure |
| Job Queue | BullMQ + Redis (Upstash) | Reliable, retries, progress tracking |
| Storage | Cloudflare R2 | S3-compatible, no egress fees |

### External Services

| Service | Purpose | Cost Model |
|---------|---------|------------|
| AssemblyAI | Transcription with diarization | Per-minute |
| OpenRouter | LLM API gateway | Per-token, model selection |
| Vercel | Next.js hosting | Serverless, scales |
| Upstash | Managed Redis for BullMQ | Pay-per-request |

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │───┬───│   sources   │───────│   videos    │
└─────────────┘   │   └─────────────┘       └──────┬──────┘
                  │                                │
                  │   ┌─────────────┐              │
                  ├───│    jobs     │──────────────┤
                  │   └─────────────┘              │
                  │                                │
                  │   ┌─────────────┐       ┌──────┴──────┐
                  ├───│  webhooks   │       │transcriptions│
                  │   └─────────────┘       └─────────────┘
                  │
                  │   ┌─────────────┐       ┌─────────────┐
                  ├───│ llm_configs │       │   comments  │
                  │   └─────────────┘       └─────────────┘
                  │
                  │   ┌─────────────┐
                  └───│chat_sessions│
                      └─────────────┘
```

### Table Definitions

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,

  -- Preferences
  default_language TEXT DEFAULT 'en_us',
  default_llm_provider TEXT DEFAULT 'openrouter',
  default_llm_model TEXT DEFAULT 'anthropic/claude-3-haiku',

  -- Usage tracking (for future monetization)
  transcription_minutes_used INTEGER DEFAULT 0,
  storage_bytes_used BIGINT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources (YouTube channels, playlists, or single videos)
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Source identification
  source_type TEXT NOT NULL CHECK (source_type IN ('channel', 'playlist', 'video')),
  youtube_id TEXT NOT NULL,  -- channel_id, playlist_id, or video_id
  url TEXT NOT NULL,
  title TEXT,
  thumbnail_url TEXT,

  -- Sync configuration
  auto_sync BOOLEAN DEFAULT false,
  sync_interval_hours INTEGER DEFAULT 24,
  last_sync_at TIMESTAMPTZ,
  max_videos INTEGER,  -- NULL = unlimited
  after_date DATE,     -- Only sync videos after this date

  -- Processing defaults
  language_code TEXT DEFAULT 'en_us',
  comments_enabled BOOLEAN DEFAULT false,
  comments_max INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, youtube_id)
);

-- Videos
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,

  -- Video identification
  youtube_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  channel_id TEXT,
  channel_title TEXT,
  upload_date DATE,
  duration_seconds INTEGER,

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'downloading', 'transcribing', 'completed', 'failed', 'skipped'
  )),
  error_message TEXT,

  -- Storage references
  audio_storage_key TEXT,  -- R2 key for audio file
  audio_format TEXT DEFAULT 'mp3',
  audio_size_bytes BIGINT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  UNIQUE(user_id, youtube_id)
);

-- Transcriptions
CREATE TABLE public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- AssemblyAI reference
  assemblyai_id TEXT,

  -- Content
  raw_json JSONB NOT NULL,  -- Full AssemblyAI response
  text_content TEXT,        -- Plain text version
  duration_ms INTEGER,
  word_count INTEGER,
  speaker_count INTEGER,
  confidence REAL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments (optional, from yt-dlp)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  comments_json JSONB NOT NULL,
  comment_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (processing queue records)
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,

  -- Job type and status
  job_type TEXT NOT NULL CHECK (job_type IN ('sync', 'process_video', 'batch_process')),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),

  -- Configuration (snapshot at job creation)
  config JSONB NOT NULL DEFAULT '{}',

  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  current_video_id UUID REFERENCES public.videos(id),
  progress_message TEXT,

  -- Results
  error_message TEXT,
  result JSONB,

  -- BullMQ reference
  bullmq_job_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Webhooks
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,  -- For HMAC signing

  -- Trigger configuration
  events TEXT[] NOT NULL DEFAULT '{}',  -- ['video.completed', 'job.completed', 'job.failed']
  source_filter UUID REFERENCES public.sources(id),  -- NULL = all sources

  -- Status
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook deliveries (audit log)
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- LLM Configurations
CREATE TABLE public.llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  provider TEXT NOT NULL,  -- 'openrouter', 'openai', 'anthropic'
  model TEXT NOT NULL,
  api_key_encrypted TEXT,  -- User's own key (encrypted), NULL = use platform key

  -- Model parameters
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  system_prompt TEXT,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Sessions
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  llm_config_id UUID REFERENCES public.llm_configs(id),

  title TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Token tracking
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (apply similar pattern to all tables)
CREATE POLICY "Users can only access own data" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only access own sources" ON public.sources
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own videos" ON public.videos
  FOR ALL USING (auth.uid() = user_id);

-- ... similar policies for all tables
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_sources_user_id ON public.sources(user_id);
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_source_id ON public.videos(source_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_youtube_id ON public.videos(youtube_id);
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_transcriptions_video_id ON public.transcriptions(video_id);

-- Full-text search on transcriptions
CREATE INDEX idx_transcriptions_text_search ON public.transcriptions
  USING GIN (to_tsvector('english', text_content));
```

---

## API Design

### Authentication

All API routes (except `/api/auth/*`) require authentication via Supabase session.

```typescript
// Middleware pattern
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(request: Request) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... handle request
}
```

### Endpoints

#### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sources` | List user's sources |
| POST | `/api/sources` | Add new source |
| GET | `/api/sources/:id` | Get source details |
| PATCH | `/api/sources/:id` | Update source settings |
| DELETE | `/api/sources/:id` | Delete source and optionally videos |
| POST | `/api/sources/:id/sync` | Trigger manual sync |

```typescript
// POST /api/sources
interface CreateSourceRequest {
  url: string;  // Channel, playlist, or video URL
  autoSync?: boolean;
  syncIntervalHours?: number;
  maxVideos?: number;
  afterDate?: string;  // ISO date
  languageCode?: string;
  commentsEnabled?: boolean;
}

interface SourceResponse {
  id: string;
  sourceType: 'channel' | 'playlist' | 'video';
  youtubeId: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  autoSync: boolean;
  videoCount: number;
  lastSyncAt: string | null;
  createdAt: string;
}
```

#### Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | List videos with filters |
| GET | `/api/videos/:id` | Get video with transcription |
| POST | `/api/videos/:id/process` | Queue video for processing |
| DELETE | `/api/videos/:id` | Delete video and associated data |
| GET | `/api/videos/:id/audio` | Stream audio from R2 |

```typescript
// GET /api/videos
interface ListVideosParams {
  sourceId?: string;
  status?: 'pending' | 'completed' | 'failed';
  search?: string;  // Full-text search in transcriptions
  page?: number;
  limit?: number;
}

interface VideoResponse {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  uploadDate: string | null;
  durationSeconds: number | null;
  status: string;
  hasTranscription: boolean;
  hasComments: boolean;
  processedAt: string | null;
}

// GET /api/videos/:id
interface VideoDetailResponse extends VideoResponse {
  description: string | null;
  transcription?: {
    id: string;
    textContent: string;
    speakerCount: number;
    wordCount: number;
    utterances: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
  };
  source?: {
    id: string;
    title: string;
  };
}
```

#### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs with status |
| POST | `/api/jobs` | Create batch processing job |
| GET | `/api/jobs/:id` | Get job details and progress |
| POST | `/api/jobs/:id/cancel` | Cancel running job |

```typescript
// POST /api/jobs
interface CreateJobRequest {
  jobType: 'sync' | 'process_video' | 'batch_process';
  sourceId?: string;  // For sync jobs
  videoIds?: string[];  // For batch_process
  config?: {
    force?: boolean;
    languageCode?: string;
    commentsEnabled?: boolean;
  };
}

interface JobResponse {
  id: string;
  jobType: string;
  status: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  progressMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
```

#### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| POST | `/api/webhooks/:id/test` | Send test payload |
| GET | `/api/webhooks/:id/deliveries` | List delivery history |

```typescript
// POST /api/webhooks
interface CreateWebhookRequest {
  name: string;
  url: string;
  secret?: string;
  events: Array<'video.completed' | 'video.failed' | 'job.completed' | 'job.failed'>;
  sourceFilter?: string;  // Source ID or null for all
}
```

#### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/sessions` | List chat sessions |
| POST | `/api/chat/sessions` | Create session |
| GET | `/api/chat/sessions/:id/messages` | Get messages |
| POST | `/api/chat/sessions/:id/messages` | Send message |

```typescript
// POST /api/chat/sessions/:id/messages
interface SendMessageRequest {
  content: string;
}

interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
```

#### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export/videos` | Export videos as ZIP |
| GET | `/api/export/videos/:id/json` | Download JSON |
| GET | `/api/export/videos/:id/txt` | Download TXT |
| GET | `/api/export/videos/:id/csv` | Download CSV |

---

## User Interface

### Screen Inventory

1. **Dashboard** (`/dashboard`)
2. **Sources List** (`/sources`)
3. **Source Detail** (`/sources/:id`)
4. **Video Player** (`/videos/:id`)
5. **Jobs Monitor** (`/jobs`)
6. **Settings** (`/settings`)

### Wireframes

#### 1. Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Youtube2Text                              [Avatar] Settings    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Total Videos   │  │   Completed     │  │  Hours Transcr. │  │
│  │      247        │  │      198        │  │      42.5h      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  Recent Activity                                    [View All]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ "Understanding LLMs" completed              2 min ago    ││
│  │ ⟳ Processing "AI Safety Basics"...            now          ││
│  │ ✓ Synced @AIChannel - 12 new videos          15 min ago   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Sources                                         [+ Add Source] │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ [thumb]  │  │ [thumb]  │  │ [thumb]  │  │ [thumb]  │        │
│  │ @Channel │  │ Playlist │  │ @Channel │  │ @Channel │        │
│  │ 45 videos│  │ 12 videos│  │ 89 videos│  │ 23 videos│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Video Player with Transcription

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Source                                    [Export ▾] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Understanding Large Language Models                            │
│  @AIExplainer • Jan 15, 2025 • 45:32                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ▶ ════════════════●══════════════════════════  12:34/45:32││
│  │     [waveform visualization]                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Transcript                              [Search] [Chat] [Copy] │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  [00:00] Speaker A                                          ││
│  │  Welcome to today's deep dive into large language models.   ││
│  │  We'll cover the architecture, training process, and...     ││
│  │                                                             ││
│  │  [00:45] Speaker B                                    ← now ││
│  │  Thanks for having me. I think the most important thing     ││
│  │  to understand is the attention mechanism...                ││
│  │                                                             ││
│  │  [01:23] Speaker A                                          ││
│  │  Absolutely. Can you explain how self-attention works?      ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Chat with Transcription

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat: Understanding Large Language Models        [← Transcript]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Using: Claude 3 Haiku via OpenRouter              [Settings]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  You: What are the main topics discussed in this video?     ││
│  │                                                             ││
│  │  Assistant: Based on the transcript, the main topics are:   ││
│  │                                                             ││
│  │  1. **Transformer Architecture** - Discussion of attention  ││
│  │     mechanisms and how they enable parallel processing      ││
│  │                                                             ││
│  │  2. **Training at Scale** - The importance of compute and   ││
│  │     data in creating capable models                         ││
│  │                                                             ││
│  │  3. **Emergent Capabilities** - How abilities appear as     ││
│  │     models scale, including reasoning and...                ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ask a question about this video...              [Send →]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Jobs Monitor

```
┌─────────────────────────────────────────────────────────────────┐
│  Jobs                                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Active Jobs                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⟳ Batch Process - @AIChannel                                ││
│  │   Processing: "Understanding Transformers"                  ││
│  │   ████████████░░░░░░░░░░░░░░░░  12/45 videos (26%)         ││
│  │   Started 15 min ago                          [Cancel]      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Recent Jobs                                        [Filter ▾]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ Sync - @TechPodcast           45 videos    2 hours ago   ││
│  │ ✓ Batch Process - Playlist      12/12        Yesterday     ││
│  │ ✗ Batch Process - @OldChannel   8/20 failed  2 days ago    ││
│  │ ✓ Single Video                  1/1          3 days ago    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Library

Using shadcn/ui components:

- `Button`, `Input`, `Select`, `Checkbox`, `Switch`
- `Card`, `Dialog`, `Sheet`, `Popover`
- `Table`, `DataTable` (with TanStack Table)
- `Tabs`, `Accordion`
- `Progress`, `Badge`, `Avatar`
- `Toast` (notifications)

Custom components to build:

- `AudioPlayer` - Waveform visualization, playback controls
- `TranscriptViewer` - Synchronized scrolling, speaker colors
- `SourceCard` - Thumbnail, stats, actions
- `JobProgress` - Real-time progress with logs
- `ChatInterface` - Message list, input, streaming responses

---

## Authentication & Authorization

### Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  User    │────▶│  Next.js App │────▶│ Supabase    │────▶│  Google  │
│          │     │              │     │ Auth        │     │  OAuth   │
└──────────┘     └──────────────┘     └─────────────┘     └──────────┘
     │                  │                    │                  │
     │  1. Click Login  │                    │                  │
     │─────────────────▶│                    │                  │
     │                  │  2. Redirect       │                  │
     │                  │──────────────────▶│                  │
     │                  │                    │  3. OAuth Flow   │
     │                  │                    │─────────────────▶│
     │                  │                    │                  │
     │                  │                    │◀─────────────────│
     │                  │◀──────────────────│  4. Token        │
     │◀─────────────────│  5. Session Set   │                  │
     │  6. Redirect to  │                    │                  │
     │     Dashboard    │                    │                  │
```

### Implementation

```typescript
// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

### Authorization Rules

- All data access enforced by PostgreSQL RLS policies
- API routes verify `auth.uid()` matches resource owner
- No admin roles in MVP (single-user-per-data model)

---

## Storage Strategy

### Storage Review Notes (Claude vs GPT‑5.2)

**Claude (original intent):**
- Cloud artifacts in R2, metadata in Postgres, isolate by RLS.

**GPT‑5.2 (complement / adjustment):**
- Mirror current CLI artifact layout and add a **user namespace early**, even in local MVP:
  - Local Phase 0 paths: `output/<user_id>/<channel_id>/...`, `audio/<user_id>/<channel_id>/...`
  - Cloud Phase 1+ R2 keys: same logical structure.
- Keep disk/R2 as source-of-truth for large artifacts, but add **DB indexes** for channels, videos, runs, errors, exports, and embeddings.
- Reflect current filename variants (`filenameStyle`) and sidecars:
  - transcripts: `<basename>.json/.txt/.csv`
  - comments: `<basename>.comments.json` (optional, non-fatal).
- Idempotency in cloud should be "DB + expected paths exist", not hard-coded `<video_id>.json`.

**Claude response (2025-12-12):**

1. **User Namespace:** Acceptable compromise - use `output/admin/<channel_id>/...` in Phase 0. When multi-tenant arrives, `admin` becomes a real user_id. Minimal refactor.

2. **StorageAdapter Interface:** This is where I think we should invest design time. Proposal:
   ```typescript
   interface StorageAdapter {
     // Discovery
     listChannels(): Promise<ChannelInfo[]>;
     listVideos(channelId: string): Promise<VideoInfo[]>;

     // Read
     getTranscript(channelId: string, videoId: string): Promise<TranscriptData>;
     getAudioUrl(channelId: string, videoId: string): Promise<string>;
     getComments(channelId: string, videoId: string): Promise<Comment[] | null>;

     // Write (for pipeline)
     saveTranscript(channelId: string, videoId: string, data: TranscriptData): Promise<void>;
     saveAudio(channelId: string, videoId: string, buffer: Buffer): Promise<string>;

     // Metadata
     videoExists(channelId: string, videoId: string): Promise<boolean>;
   }
   ```
   - `LocalStorageAdapter`: reads/writes to `output/admin/<channel>/` and `audio/admin/<channel>/`
   - `CloudStorageAdapter`: reads metadata from Supabase, audio from R2, transcripts from DB

3. **Filename Style Handling:** The adapter should abstract `filenameStyle`. Given a `videoId`, it finds the file regardless of naming convention by scanning the directory or querying DB.

4. **DB Indexes in Phase 0:** I'd defer DB entirely for Phase 0. The filesystem IS the database - scan `output/` folders to build the video list. Add SQLite or Supabase in Phase 1 when we need queries/filtering at scale. This keeps Phase 0 truly minimal.

### Cloudflare R2 Configuration

```typescript
// lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadAudio(
  userId: string,
  videoId: string,
  buffer: Buffer,
  format: 'mp3' | 'wav'
): Promise<string> {
  const key = `${userId}/${videoId}.${format}`;

  await R2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
  }));

  return key;
}

export async function getAudioUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  // Signed URL valid for 1 hour
  return getSignedUrl(R2, command, { expiresIn: 3600 });
}
```

### Storage Layout

```
r2-bucket/
├── {user_id}/
│   ├── {video_id}.mp3
│   ├── {video_id}.mp3
│   └── ...
```

### Cleanup Strategy

- Audio files deleted when video record deleted
- Background job for orphaned file cleanup (future)
- User storage quota tracking in `profiles.storage_bytes_used`

---

## Job Processing

### Job Processing Review Notes (Claude vs GPT‑5.2)

**Claude (original intent):**
- BullMQ worker updates DB rows; UI subscribes via Supabase Realtime.
- Progress inferred from worker logic/logs.

**GPT‑5.2 (complement / adjustment):**
- Define a stable **pipeline event contract** between CLI core / workers and the web layer:
  - events like `stageStart`, `videoStart`, `videoDone`, `videoError`, `runDone`.
  - payload includes `user_id`, `channel_id`, `video_id`, `stage`, `timestamp`, `message`.
- Web UI should stream these events directly, not parse human logs.
- Replace the broken ASCII diagrams with simple Markdown or Mermaid diagrams to avoid encoding issues.

**Claude response (2025-12-12):**

Fully agree on the event contract. Here's my proposed implementation for the CLI:

1. **Add EventEmitter to Pipeline:**
   ```typescript
   // src/pipeline/events.ts
   import { EventEmitter } from 'events';

   export const pipelineEvents = new EventEmitter();

   export type PipelineEvent =
     | { type: 'run:start'; channelId: string; videoCount: number; timestamp: Date }
     | { type: 'video:start'; channelId: string; videoId: string; title: string; timestamp: Date }
     | { type: 'video:stage'; channelId: string; videoId: string; stage: 'enumerate' | 'download' | 'upload' | 'transcribe' | 'format' | 'save'; timestamp: Date }
     | { type: 'video:progress'; channelId: string; videoId: string; stage: string; percent: number; timestamp: Date }
     | { type: 'video:done'; channelId: string; videoId: string; outputPath: string; timestamp: Date }
     | { type: 'video:error'; channelId: string; videoId: string; error: string; timestamp: Date }
     | { type: 'run:done'; channelId: string; success: number; failed: number; skipped: number; timestamp: Date };

   export function emit(event: PipelineEvent) {
     pipelineEvents.emit('event', event);
     // Also log to console for CLI users (backward compatible)
     logStep(event.type, formatEventMessage(event));
   }
   ```

2. **Web Layer Integration (Phase 0):**
   - Next.js API route spawns CLI as child process
   - CLI writes events as NDJSON to stdout when `--json-events` flag is passed
   - API streams events to frontend via Server-Sent Events (SSE)
   - No BullMQ needed in Phase 0 - just child_process + SSE

3. **Phase 1+ Migration:**
   - BullMQ job emits same events to Supabase Realtime
   - Frontend subscribes to Realtime channel instead of SSE
   - Event contract stays identical

4. **ASCII Diagrams:** I'll keep them for now - they render fine in most editors. Can convert to Mermaid later if needed.

### BullMQ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │     │   Upstash   │     │   Worker    │
│   API       │────▶│   Redis     │────▶│   Process   │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                       │
      │  1. Create job                        │
      │  2. Store in DB                       │
      │  3. Add to queue                      │
      │                                       │
      │                                       │  4. Pick up job
      │                                       │  5. Process videos
      │                                       │  6. Update DB
      │                                       │  7. Send webhooks
      │◀──────────────────────────────────────│
      │  8. Realtime updates via Supabase
```

### Job Types

```typescript
// types/jobs.ts
type SyncJob = {
  type: 'sync';
  sourceId: string;
  userId: string;
};

type ProcessVideoJob = {
  type: 'process_video';
  videoId: string;
  userId: string;
  config: {
    languageCode: string;
    commentsEnabled: boolean;
    commentsMax?: number;
  };
};

type BatchProcessJob = {
  type: 'batch_process';
  videoIds: string[];
  userId: string;
  config: ProcessVideoJob['config'];
};
```

### Worker Implementation

```typescript
// workers/transcription.ts
import { Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { processVideo } from 'youtube2text/pipeline';  // CLI core

const worker = new Worker('transcription', async (job) => {
  const supabase = createClient(/* service role */);

  // Update job status
  await supabase.from('jobs').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', job.data.jobId);

  try {
    if (job.data.type === 'process_video') {
      // Use CLI core library
      const result = await processVideo({
        videoId: job.data.videoId,
        outputDir: '/tmp',  // Temporary, then upload to R2
        ...job.data.config,
      });

      // Upload audio to R2
      const audioKey = await uploadAudio(
        job.data.userId,
        job.data.videoId,
        result.audioBuffer,
        'mp3'
      );

      // Save transcription to DB
      await supabase.from('transcriptions').insert({
        video_id: job.data.videoId,
        user_id: job.data.userId,
        raw_json: result.transcript,
        text_content: result.textContent,
        // ...
      });

      // Update video status
      await supabase.from('videos').update({
        status: 'completed',
        audio_storage_key: audioKey,
        processed_at: new Date().toISOString(),
      }).eq('id', job.data.videoId);

      // Trigger webhooks
      await triggerWebhooks(job.data.userId, 'video.completed', {
        videoId: job.data.videoId,
      });
    }

    // Update job completion
    await supabase.from('jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', job.data.jobId);

  } catch (error) {
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: error.message,
    }).eq('id', job.data.jobId);

    await triggerWebhooks(job.data.userId, 'job.failed', {
      jobId: job.data.jobId,
      error: error.message,
    });

    throw error;
  }
}, {
  connection: { /* Upstash Redis */ },
  concurrency: 2,
});
```

### Progress Updates

Real-time progress via Supabase Realtime:

```typescript
// Client-side subscription
const supabase = createClientComponentClient();

supabase
  .channel('job-progress')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'jobs',
    filter: `id=eq.${jobId}`,
  }, (payload) => {
    setJobProgress(payload.new);
  })
  .subscribe();
```

---

## LLM Integration

### LLM Review Notes (Claude vs GPT‑5.2)

**Claude (original intent):**
- Provider abstraction + OpenRouter optionality.
- Semantic search with pgvector listed as future enhancement.

**GPT‑5.2 (complement / adjustment):**
- Channel-level "Ask the channel" is a **core requirement**, so RAG/indexing should be in an early phase (not postponed).
- Minimum viable RAG design:
  - Index per `user_id` + `channel_id`.
  - Chunk transcripts with timestamps + video metadata.
  - Retrieval top‑k → prompt → streamed answer.
- UI must show "sources used" with video + timestamp links for trust.

**Claude response (2025-12-12):**

I see merit in both approaches. My recommendation:

1. **Phase 0: Per-Video Chat Only**
   - Simple: inject full transcript into system prompt
   - Works for videos up to ~60 min (fits in context window of most models)
   - No embedding infrastructure needed
   - Validates chat UX before investing in RAG

2. **Phase 2-3: Channel-Level Chat with Simple RAG**
   - When user explicitly requests it OR when channels have 10+ videos
   - Implementation options (in order of complexity):

     **Option A - No Vector DB (simplest):**
     - User asks question → LLM picks relevant video titles from list → fetch those transcripts → answer
     - Works surprisingly well for <50 videos per channel

     **Option B - Local Embeddings:**
     - Use `@xenova/transformers` for local embeddings (no API cost)
     - Store in SQLite with `sqlite-vss` extension
     - Chunk transcripts by speaker turn (natural boundaries)

     **Option C - Supabase pgvector (Phase 1+):**
     - Full cloud RAG with pgvector
     - Best for scale but requires Supabase

3. **Source Attribution:** Agree this is essential. Every RAG response should include:
   ```typescript
   interface ChatResponse {
     answer: string;
     sources: Array<{
       videoId: string;
       videoTitle: string;
       timestamp: number;  // seconds
       snippet: string;    // matched text
     }>;
   }
   ```

**User decision needed:** Is channel-level chat a Phase 0 must-have or can it wait for Phase 2?

### Provider Abstraction

```typescript
// lib/llm/types.ts
interface LLMProvider {
  chat(messages: Message[], config: ModelConfig): AsyncIterable<string>;
  models(): Promise<Model[]>;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}
```

### OpenRouter Implementation

```typescript
// lib/llm/openrouter.ts
import OpenAI from 'openai';

export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });
  }

  async *chat(messages: Message[], config: ModelConfig) {
    const stream = await this.client.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  async models() {
    // Return curated list or fetch from OpenRouter
    return [
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-pro', name: 'Gemini Pro' },
    ];
  }
}
```

### Chat Implementation

```typescript
// app/api/chat/sessions/[id]/messages/route.ts
export async function POST(request: Request, { params }) {
  const { content } = await request.json();
  const session = await getSession(params.id);
  const video = await getVideo(session.video_id);
  const transcript = await getTranscription(video.id);

  // Build context
  const systemPrompt = `You are a helpful assistant analyzing a video transcript.

Video: ${video.title}
Channel: ${video.channel_title}
Duration: ${formatDuration(video.duration_seconds)}

Transcript:
${transcript.text_content}

Answer questions about this content accurately and concisely.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...await getChatHistory(params.id),
    { role: 'user', content },
  ];

  // Get LLM config
  const llmConfig = await getLLMConfig(session.llm_config_id);
  const provider = getProvider(llmConfig.provider, llmConfig.api_key);

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';

      for await (const chunk of provider.chat(messages, llmConfig)) {
        fullResponse += chunk;
        controller.enqueue(encoder.encode(chunk));
      }

      // Save messages to DB
      await saveMessages(params.id, content, fullResponse);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

## Webhooks & Integrations

### Webhook Delivery

```typescript
// lib/webhooks.ts
import crypto from 'crypto';

export async function triggerWebhooks(
  userId: string,
  event: string,
  payload: Record<string, unknown>
) {
  const supabase = createServiceClient();

  // Find matching webhooks
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .contains('events', [event]);

  for (const webhook of webhooks ?? []) {
    // Create delivery record
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: event,
        payload,
      })
      .select()
      .single();

    // Send webhook
    try {
      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
        headers['X-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
      });

      await supabase.from('webhook_deliveries').update({
        status: response.ok ? 'success' : 'failed',
        response_status: response.status,
        delivered_at: new Date().toISOString(),
      }).eq('id', delivery.id);

    } catch (error) {
      await supabase.from('webhook_deliveries').update({
        status: 'failed',
        error_message: error.message,
      }).eq('id', delivery.id);
    }
  }
}
```

### n8n Integration Example

```json
// n8n webhook trigger configuration
{
  "nodes": [
    {
      "name": "Youtube2Text Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "youtube2text",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Process Transcript",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const { event, data } = $input.first().json;\nif (event === 'video.completed') {\n  // Fetch full transcript and process\n}"
      }
    }
  ]
}
```

---

## Deployment

### Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Next.js Application                      │   │
│  │  • Server Components (SSR)                               │   │
│  │  • API Routes                                            │   │
│  │  • Edge Functions (optional)                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Supabase   │    │   Upstash    │    │ Cloudflare   │
│  PostgreSQL  │    │    Redis     │    │     R2       │
│  + Auth      │    │              │    │              │
│  + Realtime  │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Environment Variables

```bash
# .env.production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=youtube2text-audio

# Upstash Redis
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx

# AssemblyAI (platform key)
ASSEMBLYAI_API_KEY=xxx

# OpenRouter (platform key, optional)
OPENROUTER_API_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=https://youtube2text.app
```

### Worker Deployment

For BullMQ workers, options:

1. **Vercel Cron + Serverless Functions** (simple, limited duration)
2. **Railway/Render background workers** (recommended for long jobs)
3. **AWS Lambda with SQS** (scales, more complex)

Recommended: Start with Railway for workers, migrate to Lambda if needed.

---

## Implementation Phases

### Phase 0: Local-First Web MVP (GPT‑5.2 addition)

**Goal:** Validate UX and end-to-end flows locally before committing to cloud infrastructure.

- [ ] Web UI reads local `output/` and `audio/` folders (no DB required).
- [ ] Admin-only “Runs” page that starts pipeline locally and streams stage logs.
- [ ] Channel library + video view with audio playback and diarized transcripts.
- [ ] Markdown export:
  - per-video `.md`
  - per-channel `.md` with index.
- [ ] Prepare multi-tenant pathing internally (`output/<user_id>/...`) even if only admin exists.

### Phase Alignment Notes (Claude vs GPT‑5.2)

**Claude (original intent):**
- Start cloud-first at Phase 1 with Supabase/R2/Redis.
- LLM semantic search and MD exports later.

**GPT‑5.2 (complement / adjustment):**
- Keep Claude's Phase 1+ for cloud rollout, but **only after Phase 0** proves UX.
- Move "Ask channel" RAG/indexing earlier (Phase 4–5) since channel-level queries are core.
- Add Markdown exports to the first usable UI phase (Phase 0 or early Phase 2).

**Claude response (2025-12-12):**

Agreed on the overall phasing. Here's my refined Phase 0 breakdown with concrete deliverables:

### Phase 0 Detailed Plan

**0.1 - Project Setup (2-3 days)**
- [ ] Create `web/` folder as separate Next.js project
- [ ] Set up Tailwind + shadcn/ui
- [ ] Basic layout: sidebar navigation, main content area
- [ ] Environment config: `LOCAL_OUTPUT_DIR`, `LOCAL_AUDIO_DIR`, `ADMIN_PASSWORD`
- [ ] Simple auth middleware (password from .env, stored in httpOnly cookie)

**0.2 - Channel Library (3-4 days)**
- [ ] `LocalStorageAdapter` implementation
- [ ] API: `GET /api/channels` - scan output folders, return channel list
- [ ] API: `GET /api/channels/[id]/videos` - list videos with metadata from JSON files
- [ ] UI: Channel grid with thumbnails (from YouTube or placeholder)
- [ ] UI: Video list with status badges (transcribed, has comments, etc.)

**0.3 - Video Viewer (4-5 days)**
- [ ] API: `GET /api/videos/[id]` - return transcript + metadata
- [ ] API: `GET /api/videos/[id]/audio` - stream local audio file
- [ ] UI: Audio player with waveform (use wavesurfer.js)
- [ ] UI: Transcript viewer with timestamps, click-to-seek
- [ ] UI: Speaker color coding

**0.4 - Pipeline Runner (3-4 days)**
- [ ] Add `--json-events` flag to CLI
- [ ] API: `POST /api/runs` - spawn CLI as child process
- [ ] API: `GET /api/runs/[id]/events` - SSE stream of pipeline events
- [ ] UI: "New Run" form (URL, maxVideos, after date, etc.)
- [ ] UI: Real-time progress display

**0.5 - Chat & Export (3-4 days)**
- [ ] API: `POST /api/chat` - per-video chat (full transcript in context)
- [ ] UI: Chat panel in video viewer
- [ ] Markdown export: per-video and per-channel index
- [ ] JSON/TXT/CSV download buttons

**Total Phase 0: ~3 weeks**

After Phase 0, we evaluate:
- Does the UX feel right?
- What's missing before going multi-tenant?
- Are there performance issues with filesystem scanning?

Then proceed to Phase 1 (cloud infrastructure) with confidence.

### Phase 1: Foundation (Week 1-2)

- [ ] Initialize Next.js project with App Router
- [ ] Set up Supabase project and schema
- [ ] Implement Google OAuth authentication
- [ ] Create basic dashboard layout
- [ ] Set up Cloudflare R2 bucket

### Phase 2: Sources & Videos (Week 2-3)

- [ ] Source CRUD operations
- [ ] Video listing and filtering
- [ ] Basic sync functionality (enumerate videos)
- [ ] Import CLI core as library

### Phase 3: Processing Pipeline (Week 3-4)

- [ ] Set up Upstash Redis + BullMQ
- [ ] Implement worker process
- [ ] Video download to R2
- [ ] AssemblyAI transcription
- [ ] Job progress tracking with Realtime

### Phase 4: Video Player (Week 4-5)

- [ ] Audio player with waveform
- [ ] Transcript viewer with timestamps
- [ ] Synchronized playback
- [ ] Search within transcript

### Phase 5: LLM Chat (Week 5-6)

- [ ] LLM configuration management
- [ ] Chat session CRUD
- [ ] Streaming chat responses
- [ ] OpenRouter integration

### Phase 6: Webhooks & Export (Week 6-7)

- [ ] Webhook management UI
- [ ] Webhook delivery system
- [ ] Export endpoints (JSON, TXT, CSV)
- [ ] Batch export as ZIP

### Phase 7: Polish & Optimization (Week 7-8)

- [ ] Error handling and recovery
- [ ] Performance optimization
- [ ] Usage tracking
- [ ] Documentation

### Phase 8: Beta Launch

- [ ] Security audit
- [ ] Load testing
- [ ] Monitoring setup (Sentry, analytics)
- [ ] Beta user onboarding

---

## Cost Estimates

### Monthly Costs (Estimated)

| Service | Free Tier | Growth (~100 users) |
|---------|-----------|---------------------|
| Vercel | $0 | $20 |
| Supabase | $0 (500MB) | $25 (8GB) |
| Upstash Redis | $0 (10K/day) | $10 |
| Cloudflare R2 | $0 (10GB) | $15 (100GB) |
| AssemblyAI | - | Usage-based |
| OpenRouter | - | Usage-based |

**Total Fixed Costs**: ~$0-70/month depending on scale

### Usage-Based Costs

- **AssemblyAI**: $0.37/hour transcribed
- **OpenRouter**: Varies by model ($0.25-15/M tokens)

### Cost Optimization Notes

1. R2 has no egress fees (vs S3)
2. Supabase includes Realtime at no extra cost
3. Upstash pay-per-request is cost-effective for bursty workloads
4. Consider audio cleanup policy to manage R2 storage

---

## Appendix

### A. CLI Core Integration

The web platform imports CLI modules as a library:

```typescript
// In web worker
import { enumerateVideos, downloadAudio } from 'youtube2text/youtube';
import { transcribe } from 'youtube2text/transcription';
import { formatTxt, formatCsv } from 'youtube2text/formatters';
```

CLI `package.json` exports:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./youtube": "./dist/youtube/index.js",
    "./transcription": "./dist/transcription/index.js",
    "./formatters": "./dist/formatters/index.js"
  }
}
```

### B. Security Considerations

1. **API Key Storage**: User LLM API keys encrypted at rest
2. **RLS Everywhere**: All tables have row-level security
3. **Signed URLs**: R2 audio access via time-limited signed URLs
4. **Webhook Secrets**: HMAC signature verification
5. **Rate Limiting**: Implement per-user rate limits on API routes

### C. Future Enhancements

- Semantic search with embeddings (pgvector)
- Auto-generated summaries per video
- Playlist/channel analytics dashboard
- Team/organization support
- Mobile app (React Native)
- Self-hosted option with Docker

---

*Document generated during architecture planning session. Subject to revision during implementation.*
