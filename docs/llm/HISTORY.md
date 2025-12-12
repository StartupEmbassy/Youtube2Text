# LLM Change History

Append new entries at the top so the most recent activity is easiest to find. Follow the required format:

YYYY-MM-DD - <LLM_NAME> - <Brief summary> - Files: [list of touched files] - Version impact: <yes/no + details>

## Log

2025-12-12 - Claude - Create comprehensive web platform architecture document with multi-tenant design, Supabase schema, R2 storage, BullMQ jobs, LLM chat, webhooks, and 8-phase implementation plan - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - Claude - Respond to GPT's AssemblyAI credits preflight suggestion with implementation recommendations - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - Claude - Document user decision on filename styles: implement id, id_title, title_id options with title_id as default - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - Claude - Review output and suggest filename improvement: include sanitized video title in output filenames for easier identification - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Add optional runs.yaml for multi-run execution, update CLI/README, and fix TS build narrowing - Files: [README.md, src/cli/index.ts, src/config/runs.ts, src/config/index.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Ignore runs.yaml/yml in git and accept runs.yml fallback; clarify YAML structure in README - Files: [.gitignore, README.md, src/config/runs.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Implement user/Claude hardening: add .env/config/runs examples, ignore outputs, buffer upload, yt-dlp preflight check, date debug, CLI --version; defer parallel runs and root-array YAML - Files: [.env.example, config.yaml.example, runs.yaml.example, .gitignore, README.md, src/transcription/assemblyai/http.ts, src/utils/deps.ts, src/pipeline/run.ts, src/utils/date.ts, src/cli/index.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Pivot to accept root-array runs.yaml after user error; update loader and docs accordingly - Files: [src/config/runs.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Normalize user runs.yml to recommended `{runs: [...]}` structure for clarity - Files: [runs.yml, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Document yt-dlp system dependency and future Docker deployment note - Files: [README.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Fix Windows winget alias issue by resolving yt-dlp executable path and passing it through pipeline; add troubleshooting note - Files: [src/utils/deps.ts, src/pipeline/run.ts, src/youtube/enumerate.ts, src/youtube/download.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Broaden yt-dlp resolution for VSCode terminals (env override, where.exe, pwsh fallback) and document YT_DLP_PATH workaround - Files: [src/utils/deps.ts, README.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Add explicit ytDlpPath config/CLI override to bypass VSCode env issues; propagate through pipeline and runs - Files: [src/config/schema.ts, src/config/loader.ts, src/config/runs.ts, src/utils/deps.ts, src/pipeline/run.ts, src/cli/index.ts, README.md, .env.example, runs.yaml.example, config.yaml.example, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Scaffold and implement MVP 1 local pipeline (yt-dlp audio download, AssemblyAI diarization, json/txt/csv storage, CLI) and align README audio path - Files: [package.json, tsconfig.json, README.md, src/cli/index.ts, src/pipeline/run.ts, src/config/*, src/youtube/*, src/transcription/*, src/formatters/*, src/storage/*, src/utils/*, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: yes (initial package.json 0.1.0)

2025-12-12 - GPT-5.2 - Adapt project documentation to Youtube2Text scope - Files: [README.md, LLM_START_HERE.md, docs/PROJECT_CONTEXT.md, docs/STRUCTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Added support for individual YouTube video URLs (fallback enumeration) - Files: [src/youtube/enumerate.ts, README.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add timestamps and line wrapping to TXT output - Files: [src/formatters/txt.ts, README.md, src/pipeline/run.ts, docs/llm/HANDOFF.md] - Version impact: no
2025-12-12 - GPT-5.2 - Document optional title-in-filename suggestion for outputs - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Switch output/audio filenames to include sanitized title slug by default - Files: [src/storage/index.ts, src/utils/fs.ts, src/pipeline/run.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Reorder basename to `<title_slug>__<video_id>` for visual sorting - Files: [src/storage/index.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add AssemblyAI credits preflight suggestion to handoff - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Implement filenameStyle (id/id_title/title_id) and AssemblyAI credits preflight config/CLI - Files: [src/config/schema.ts, src/config/loader.ts, src/config/runs.ts, src/cli/index.ts, src/storage/index.ts, src/utils/fs.ts, src/transcription/assemblyai/client.ts, src/transcription/assemblyai/index.ts, src/pipeline/run.ts, README.md, .env.example, config.yaml.example, runs.yaml.example, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Stop pipeline on AssemblyAI insufficient credits; add colored/prefixed logs - Files: [src/transcription/assemblyai/errors.ts, src/transcription/assemblyai/http.ts, src/pipeline/run.ts, src/utils/logger.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Include channel info in TXT output headers - Files: [src/formatters/txt.ts, src/pipeline/run.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Switch key pipeline logs to logStep for clearer CLI output - Files: [src/youtube/enumerate.ts, src/youtube/download.ts, src/transcription/assemblyai/client.ts, src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add per-stage colors and ASCII icons to logStep output - Files: [src/utils/logger.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Fetch yt-dlp video descriptions and include in TXT headers - Files: [src/youtube/metadata.ts, src/youtube/types.ts, src/youtube/index.ts, src/pipeline/run.ts, src/formatters/txt.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add optional yt-dlp comments extraction and save to sidecar JSON - Files: [src/youtube/comments.ts, src/youtube/index.ts, src/storage/index.ts, src/pipeline/run.ts, src/config/schema.ts, src/config/loader.ts, src/config/runs.ts, src/cli/index.ts, README.md, .env.example, config.yaml.example, runs.yaml.example, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - Claude - Respond to GPT-5.2 architecture review: accept Phase 0 local-first (user confirmed), propose StorageAdapter interface, PipelineEvent contract, detailed Phase 0 breakdown (~3 weeks) - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Annotate docs/ARCHITECTURE.md with Claude vs GPT‑5.2 review notes and add Phase 0 local-first MVP - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add resume-aware X/Y progress logging for runs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Show stable video index i/N in skip/done/fail logs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add remaining count to progress logs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Prefix channel folder names with sanitized channel title - Files: [src/storage/index.ts, src/pipeline/run.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

### Example Entry Format

```
2025-01-15 - Claude - Add authentication module with JWT support - Files: [src/auth/jwt.js, src/auth/middleware.js, tests/auth.test.js, docs/llm/HANDOFF.md] - Version impact: yes (src/auth/jwt.js -> 1.1.0, breaking change requires new ENV var JWT_SECRET)
```

### Your Project History

Start logging your changes below. Remove the example above once you have real entries.

---

- 2025-01-01 - ExampleLLM - Initial project setup from LLM-DocKit scaffold - Files: [README.md, LLM_START_HERE.md, docs/PROJECT_CONTEXT.md] - Version impact: no
