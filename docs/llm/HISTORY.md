# LLM Change History

Append new entries at the top so the most recent activity is easiest to find. Follow the required format:

YYYY-MM-DD - <LLM_NAME> - <Brief summary> - Files: [list of touched files] - Version impact: <yes/no + details>

## Log

2025-12-16 - GPT-5.2 - Phase 2.3 kickoff: add watchlist persistence + CRUD endpoints and an opt-in in-process scheduler (status/start/stop/trigger) that uses `POST /runs/plan` to decide whether to create runs; bump version to 0.10.0 - Files: [src/api/watchlist.ts, src/api/scheduler.ts, src/api/server.ts, openapi.yaml, web/lib/apiTypes.gen.ts, README.md, HOW_TO_USE.md, .env.example, docker-compose.yml, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json, tests/watchlist.test.ts, tests/scheduler.test.ts, tests/all.test.ts] - Version impact: yes (package.json 0.9.6 -> 0.10.0)

2025-12-16 - GPT-5.2 - Phase 2.2.3: add retention cleanup for run persistence (`output/_runs/*`) and old audio cache (`audio/*`) with env knobs, auto-on-startup, and `POST /maintenance/cleanup`; add deploy playbook doc; keep transcripts untouched; bump version to 0.9.6 - Files: [src/api/retention.ts, src/api/index.ts, src/api/server.ts, openapi.yaml, web/lib/apiTypes.gen.ts, README.md, HOW_TO_USE.md, .env.example, docker-compose.yml, docs/PROJECT_CONTEXT.md, docs/operations/DEPLOY_PLAYBOOK.md, docs/operations/README.md, docs/llm/DECISIONS.md, tests/apiRetention.test.ts, tests/all.test.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json] - Version impact: yes (package.json 0.9.5 -> 0.9.6)

2025-12-16 - GPT-5.2 - Phase 2.2.2: add CORS allowlist via `Y2T_CORS_ORIGINS` (exact origin match) and tests for allowed/blocked origins; fix DECISIONS ordering for D-016; bump version to 0.9.5 - Files: [src/api/server.ts, tests/apiCors.test.ts, tests/all.test.ts, README.md, HOW_TO_USE.md, docs/llm/DECISIONS.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, openapi.yaml, package.json, package-lock.json, web/lib/apiTypes.gen.ts] - Version impact: yes (package.json 0.9.4 -> 0.9.5)

2025-12-16 - GPT-5.2 - Phase 2.2.1: add deep health check via `GET /health?deep=true` (deps: yt-dlp/ffmpeg, disk free, persistence dir writable) and document the contract; bump version to 0.9.4 - Files: [src/api/health.ts, src/api/server.ts, openapi.yaml, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json, tests/apiHealth.test.ts, tests/all.test.ts, docs/llm/DECISIONS.md] - Version impact: yes (package.json 0.9.3 -> 0.9.4)

2025-12-16 - Claude Opus 4.5 - Fix channel thumbnails not appearing for cached single-video runs: add fire-and-forget thumbnail update in cache-first path (server.ts), prefer square avatars over banners (channel.ts isSquareish function); bump version to 0.9.3 - Files: [src/api/server.ts, src/youtube/channel.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json] - Version impact: yes (package.json 0.9.2 -> 0.9.3)

2025-12-15 - GPT-5.2 - Fix channel avatars for channels created from single-video runs by fetching channel metadata via `https://www.youtube.com/channel/<channelId>` and persisting `channelUrl` in `_channel.json`; bump version to 0.9.2 - Files: [src/pipeline/run.ts, src/storage/index.ts, docs/llm/HANDOFF.md, docs/PROJECT_CONTEXT.md, docs/ARCHITECTURE.md, openapi.yaml, package.json, package-lock.json, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.9.1 -> 0.9.2)

2025-12-14 - GPT-5.2 - Web UX: make navbar brand link to `/`, and make Run detail actually usable (status/progress summary, per-video downloads list, and clearer error display instead of raw artifacts JSON); bump version to 0.5.4 - Files: [web/app/layout.tsx, web/app/runs/[runId]/page.tsx, docs/llm/HANDOFF.md, openapi.yaml, web/lib/apiTypes.gen.ts, docs/VERSIONING_RULES.md, package.json, package-lock.json, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.5.3 -> 0.5.4)

2025-12-14 - GPT-5.2 - Docs polish: update HANDOFF goal to Phase 2, shorten "What Changed Recently", and clear stale open questions; bump version to 0.5.3 - Files: [docs/llm/HANDOFF.md, openapi.yaml, web/lib/apiTypes.gen.ts, docs/VERSIONING_RULES.md, package.json, package-lock.json, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.5.2 -> 0.5.3)

2025-12-14 - GPT-5.2 - Fix thumbnails/title on runs: make `.thumb` constrain image size (block element), and add run thumbnail/title fallbacks from artifacts or direct video URL parsing (watch/shorts/youtu.be); bump version to 0.5.2 - Files: [web/app/globals.css, web/app/RunsLive.tsx, web/app/runs/[runId]/page.tsx, docs/llm/HANDOFF.md, openapi.yaml, web/lib/apiTypes.gen.ts, docs/VERSIONING_RULES.md, package.json, package-lock.json, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.5.1 -> 0.5.2)

2025-12-14 - GPT-5.2 - Web UX: shrink thumbnails and ensure Run detail shows a video Title by enriching run preview data from artifacts when runs finish; bump version to 0.5.1 - Files: [src/api/runManager.ts, web/app/globals.css, web/app/runs/[runId]/page.tsx, openapi.yaml, web/lib/apiTypes.gen.ts, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json] - Version impact: yes (package.json 0.5.0 -> 0.5.1)

2025-12-14 - GPT-5.2 - Web UX: add YouTube thumbnails in Runs/Run detail/Library by tracking `previewVideoId` on RunRecord, update OpenAPI/types, and bump version to 0.5.0 - Files: [src/api/runManager.ts, openapi.yaml, web/lib/apiTypes.gen.ts, web/app/RunsLive.tsx, web/app/runs/[runId]/page.tsx, web/app/library/[channelDirName]/page.tsx, web/app/globals.css, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json] - Version impact: yes (package.json 0.4.2 -> 0.5.0)

2025-12-14 - GPT-5.2 - Web UX: make runs list more descriptive (use channelTitle/inputUrl instead of runId), and add "Open downloads" shortcuts on run cards and run detail; bump version to 0.4.2 - Files: [web/app/RunsLive.tsx, web/app/runs/[runId]/page.tsx, docs/llm/HANDOFF.md, docs/VERSIONING_RULES.md, openapi.yaml, web/lib/apiTypes.gen.ts, package.json, package-lock.json, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.4.1 -> 0.4.2)

2025-12-14 - GPT-5.2 - Roadmap update: mark Phase 1 as DONE, define Phase 2 (hosted single-tenant admin) and Phase 3+ (optional multi-tenant), and bump version to 0.4.1 - Files: [docs/llm/HANDOFF.md, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, openapi.yaml, web/lib/apiTypes.gen.ts, package.json, package-lock.json, docs/VERSIONING_RULES.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.4.0 -> 0.4.1)

2025-12-14 - GPT-5.2 - Add `.md` and `.jsonl` transcript artifacts (for readability + LLM-friendly chunking), expose them via API/Web library, update OpenAPI contract and tests, and bump version to 0.4.0 - Files: [src/formatters/md.ts, src/formatters/jsonl.ts, src/formatters/index.ts, src/pipeline/run.ts, src/storage/index.ts, src/storage/fsAdapter.ts, src/api/server.ts, web/app/library/[channelDirName]/page.tsx, openapi.yaml, web/lib/apiTypes.gen.ts, tests/outputFormats.test.ts, tests/all.test.ts, README.md, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/VERSIONING_RULES.md, docs/llm/DECISIONS.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md, package.json, package-lock.json] - Version impact: yes (package.json 0.3.3 -> 0.4.0)

2025-12-14 - GPT-5.2 - Fix Docker URL split bug: separate server vs browser API base URL helpers so Library artifact links use `NEXT_PUBLIC_Y2T_API_BASE_URL` (not Docker-internal `Y2T_API_BASE_URL`); bump version to 0.3.3 - Files: [web/lib/api.ts, web/app/page.tsx, web/app/library/[channelDirName]/page.tsx, web/app/runs/[runId]/page.tsx, openapi.yaml, package.json, package-lock.json, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.3.2 -> 0.3.3)

2025-12-14 - GPT-5.2 - Phase 1 follow-up: improve SSE UX by summarizing per-run events (human-readable lines + Clear button), and bump version to 0.3.2 - Files: [web/app/runs/[runId]/RunEvents.tsx, openapi.yaml, package.json, package-lock.json, docs/ARCHITECTURE.md, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.3.1 -> 0.3.2)

2025-12-14 - GPT-5.2 - Phase 1 follow-ups: remove inline UI styles (consistent CSS classes), replace `web/lib/types.ts` with `web/lib/apiSchema.ts`, and bump version to 0.3.1 - Files: [web/app/globals.css, web/app/error.tsx, web/app/layout.tsx, web/app/page.tsx, web/app/CreateRunForm.tsx, web/app/RunsLive.tsx, web/app/library/page.tsx, web/app/library/[channelDirName]/page.tsx, web/app/runs/[runId]/page.tsx, web/app/runs/[runId]/RunEvents.tsx, web/lib/apiSchema.ts, web/lib/types.ts, openapi.yaml, package.json, package-lock.json, docs/ARCHITECTURE.md, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/REVIEWS.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.3.0 -> 0.3.1)

2025-12-14 - GPT-5.2 - Phase 1 Step 3: add global SSE endpoint `GET /events` emitting run create/update events, update Next.js runs list to subscribe and update live, extend OpenAPI schema, add unit test for global events, and bump version to 0.3.0 - Files: [src/api/runManager.ts, src/api/server.ts, openapi.yaml, web/lib/apiTypes.gen.ts, web/lib/types.ts, web/app/RunsLive.tsx, web/app/page.tsx, tests/apiGlobalEvents.test.ts, tests/all.test.ts, README.md, package.json, package-lock.json, docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.2.0 -> 0.3.0)

2025-12-14 - GPT-5.2 - Phase 1 Step 2: implement OpenAPI contract + generated frontend types + contract-check workflow (OpenAPI spec at repo root, generated types in web/, validate+generate+diff check scripts); bump version to 0.2.0 per VERSIONING_RULES - Files: [openapi.yaml, web/lib/apiTypes.gen.ts, web/lib/types.ts, web/app/CreateRunForm.tsx, scripts/apiContractCheck.mjs, package.json, package-lock.json, docs/operations/API_CONTRACT.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: yes (package.json 0.1.0 -> 0.2.0)

2025-12-14 - GPT-5.2 - Web UI UX: change run detail layout to always stack Events below Artifacts (no side-by-side columns) and wrap Artifacts JSON to avoid horizontal scroll - Files: [web/app/runs/[runId]/page.tsx, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Web UI responsiveness: wrap long event lines to avoid horizontal scroll and make run detail grid responsive (single column on small screens) - Files: [web/app/globals.css, web/app/runs/[runId]/RunEvents.tsx, web/app/runs/[runId]/page.tsx, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Small UI cleanup from Claude feedback: remove redundant per-route error.tsx files (keep global error boundary) and remove unnecessary router.refresh() after navigating to a newly created run - Files: [web/app/CreateRunForm.tsx, web/app/library/error.tsx, web/app/runs/[runId]/error.tsx, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Phase 1 Step 1: add Next.js error boundaries for API-down UX (global + per-route) and improve run creation UX by navigating to the created run detail page; update roadmap/handoff ordering - Files: [web/app/error.tsx, web/app/library/error.tsx, web/app/runs/[runId]/error.tsx, web/app/CreateRunForm.tsx, docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Document Phase 1 Step 3 plan: OpenAPI contract + generated TS types/client + contract-check workflow to prevent endpoint/type drift; add operations doc and link from roadmap/handoff/decisions - Files: [docs/operations/API_CONTRACT.md, docs/operations/README.md, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Phase 1 follow-ups: move Claude web UI review out of HANDOFF into `docs/llm/REVIEWS.md`, improve SSE connected state (use EventSource onopen), and add a simple "Start run" form in the web UI that calls `POST /runs`; update README - Files: [docs/llm/HANDOFF.md, docs/llm/REVIEWS.md, docs/llm/HISTORY.md, web/app/runs/[runId]/RunEvents.tsx, web/app/CreateRunForm.tsx, web/app/page.tsx, README.md] - Version impact: no

2025-12-14 - Claude - Review GPT Phase 1 web UI scaffold: document positives (Next.js 14 RSC, standalone Docker, clean separation, StorageAdapter reuse) and areas to improve (type duplication, no error handling, no run creation form, mixed styling, no SSE reconnect) - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Start Phase 1: add Next.js admin UI scaffold under `web/`, add API `GET /library/...` endpoints for browsing existing outputs and fetching artifacts, update docker-compose to run api+web, and add a unit test to ensure `_runs` is excluded from channel listing - Files: [src/api/server.ts, src/storage/fsAdapter.ts, web/*, docker-compose.yml, .dockerignore, package.json, README.md, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md, tests/storageFsAdapter.test.ts, tests/all.test.ts] - Version impact: no

2025-12-14 - GPT-5.2 - Clean up HANDOFF: enforce ASCII-only, remove garbled text, and align snapshot claims with verified tests (docker smoke test) - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Report manual Docker API e2e run (POST /runs with real AssemblyAI key); transcription completed (Spanish detected) - Files: [docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Docker hardening: install `yt-dlp` in a Python virtualenv (avoid Debian/PEP-668 without `--break-system-packages`) and allow optional pinning via `YT_DLP_VERSION` build arg; update docs/decision/README - Files: [Dockerfile, README.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Fix Docker smoke test reliability: accept `/runs` response shape `{runs: []}` and add fetch timeouts to avoid hangs; ensure containers are cleaned up even on failures - Files: [scripts/dockerSmokeTest.mjs, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Fix Dockerfile PEP 668 error on Debian 12: add `--break-system-packages` to pip install yt-dlp; verified Docker image builds and API responds on /health - Files: [Dockerfile, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Add no-credit Docker smoke test (`npm run test:docker-smoke`) that builds the API image, starts a container, checks `/health` and `/runs`, then stops; document in README and handoff - Files: [scripts/dockerSmokeTest.mjs, package.json, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Complete Phase 0.3 Docker packaging for the HTTP API runner (Dockerfile + docker-compose + .dockerignore), and align roadmap/docs to mark Phase 0 as done and Phase 1 as next; record Docker rationale as D-009 - Files: [Dockerfile, docker-compose.yml, .dockerignore, README.md, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Fix apiPersistence test flakiness by serializing persistence writes in RunManager and adding `flush()` to await pending writes (also resolves restart race) - Files: [src/api/runManager.ts, tests/apiPersistence.test.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Report race condition bug in apiPersistence test (onEvent fire-and-forget async causes test to read incomplete data) - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Add API run/event persistence (default enabled) under `output/_runs/` with reload on startup; add unit test for persistence; document env flags - Files: [src/api/persistence.ts, src/api/eventBuffer.ts, src/api/runManager.ts, src/api/server.ts, src/api/index.ts, tests/apiPersistence.test.ts, tests/all.test.ts, README.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Implement Phase 0.2 minimal HTTP API runner: in-process server with `POST /runs`, SSE `GET /runs/:id/events`, and `GET /runs/:id/artifacts`, plus run manager + event buffer and basic unit tests; add `youtube2text-api` bin and README usage - Files: [src/api.ts, src/api/index.ts, src/api/server.ts, src/api/runManager.ts, src/api/eventBuffer.ts, src/api/http.ts, src/api/sse.ts, src/cli.ts, package.json, README.md, tests/apiEventBuffer.test.ts, tests/all.test.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Refine yt-dlp `player_client=default` hint to only show for retryable/transient failures (avoid noise on access-denied) and document the behavior - Files: [src/youtube/download.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Start Phase 0.1 yt-dlp reliability hardening: add yt-dlp failure classifier + retry gating (no retries for access-denied), add generic hint for `player_client=default`, improve per-video error stage reporting in pipeline, add unit tests for yt-dlp parsing, and update README - Files: [src/utils/retry.ts, src/youtube/ytDlpErrors.ts, src/youtube/download.ts, src/youtube/index.ts, src/pipeline/run.ts, tests/ytDlpErrors.test.ts, tests/all.test.ts, README.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Add language info to TXT header showing source (yt-dlp or auto-detected with confidence percentage), add unit tests - Files: [src/formatters/txt.ts, src/pipeline/run.ts, tests/txtFormatter.test.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Implement AssemblyAI ALD fallback when yt-dlp cannot determine language (Chinese/no-metadata case), add request body builder + unit test, persist detected language/confidence in `.meta.json`, and update docs/fixtures - Files: [src/transcription/types.ts, src/transcription/assemblyai/request.ts, src/transcription/assemblyai/client.ts, src/youtube/language.ts, src/pipeline/run.ts, src/storage/index.ts, tests/language.test.ts, tests/fixtures/test-videos.md, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/ARCHITECTURE.md, README.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Validate multilingual detection (ES/EN/FR/DE/ZH), propose AssemblyAI ALD for videos without YouTube metadata (D-006), document test results - Files: [docs/llm/DECISIONS.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Split LLM docs: move long decision rationale out of HANDOFF into `docs/llm/DECISIONS.md`, add `docs/llm/README.md` index, and refresh `docs/STRUCTURE.md` + `LLM_START_HERE.md` so future sessions know where information lives (ASCII-only) - Files: [docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/README.md, docs/STRUCTURE.md, LLM_START_HERE.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Restore decision context to HANDOFF after GPT simplification: added "Why" sections for language detection priority chain, interface decisions (StorageAdapter/EventEmitter NOW vs YoutubeResolver DEFER), yt-dlp client options, and test video status table - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - GPT-5.2 - Fix `npm run build` by excluding tests from `tsconfig.json`, delete stray compiled `tests/*.js`, rewrite docs to remove encoding artifacts and align Phase 0/1 roadmap, refresh `.env.example` template, and document testing - Files: [tsconfig.json, tests/all.test.js, tests/language.test.js, tests/naming.test.js, tests/txtFormatter.test.js, README.md, .env.example, docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Fix language detection: use video `language` field first (most reliable), filter only AssemblyAI-supported languages, fix config loader undefined override bug, add multilingual test fixtures, update tests (11 pass) - Files: [src/youtube/language.ts, src/config/loader.ts, tests/language.test.ts, tests/fixtures/test-videos.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Respond to GPT scope & roadmap: agree with public-video-only scope, suggest members_only skip reason, agree with roadmap order 1->2->3, propose yt-dlp android player_client as JS runtime fix - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-14 - Claude - Respond to GPT containerization proposal: agree with Docker approach but defer until HTTP API exists; add concerns about image size and cookies.txt for multi-tenant; provide Dockerfile sketch for future reference - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-15 - GPT-5.2 - Align Phase 2 roadmap across docs (Integration MVP -> Ops hardening -> Scheduler/watchlist -> Control) and fix Phase/date consistency; keep rationale in D-014/D-015 - Files: [docs/ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-15 - GPT-5.2 - Phase 2.1: add optional API auth via `Y2T_API_KEY` (X-API-Key) + `POST /runs/plan`; web UI proxies API/SSE/downloads via Next.js `/api/*` routes so the browser does not need the key; update docker-compose + OpenAPI + tests - Files: [src/api/auth.ts, src/api/sanitize.ts, src/api/server.ts, src/pipeline/plan.ts, src/api/runManager.ts, web/lib/api.ts, web/lib/apiProxy.ts, web/app/api/**, web/app/*, docker-compose.yml, openapi.yaml, tests/apiAuth.test.ts, tests/apiPlan.test.ts, tests/all.test.ts, README.md, .env.example, docs/llm/HANDOFF.md, docs/llm/DECISIONS.md, docs/llm/HISTORY.md, docs/VERSIONING_RULES.md] - Version impact: yes (0.6.0)
2025-12-15 - GPT-5.2 - Phase 2.1: add `callbackUrl` webhooks for `POST /runs` (`run:done`/`run:error`) with retries and optional HMAC signature headers; bump version and document env vars - Files: [src/api/webhooks.ts, src/api/runManager.ts, src/api/server.ts, openapi.yaml, README.md, .env.example, docs/llm/HANDOFF.md, docs/PROJECT_CONTEXT.md, docs/llm/HISTORY.md, docs/VERSIONING_RULES.md, package.json, package-lock.json] - Version impact: yes (0.7.0)
2025-12-15 - GPT-5.2 - Phase 2.1: cache-first for single-video URLs on `POST /runs` (return `done` immediately when artifacts already exist and `force=false`); bump version and document behavior - Files: [src/youtube/url.ts, src/api/server.ts, src/api/runManager.ts, openapi.yaml, README.md, docs/llm/HISTORY.md, docs/VERSIONING_RULES.md, package.json, package-lock.json] - Version impact: yes (0.8.0)
2025-12-15 - GPT-5.2 - Docs: add `INTEGRATION.md`, replace stale scaffold guide with Youtube2Text-specific `HOW_TO_USE.md`, and update `docs/STRUCTURE.md` to match current repo layout - Files: [INTEGRATION.md, HOW_TO_USE.md, docs/STRUCTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-15 - GPT-5.2 - Add channel avatar thumbnails in Library: persist best-effort `channelThumbnailUrl` into `_channel.json` via yt-dlp metadata, expose on `/library/channels`, and render small avatars with fallback initials; bump version - Files: [src/youtube/channel.ts, src/youtube/index.ts, src/pipeline/run.ts, src/storage/index.ts, src/storage/adapter.ts, src/storage/fsAdapter.ts, openapi.yaml, web/app/library/page.tsx, web/app/globals.css, tests/storageFsAdapter.test.ts, web/lib/apiTypes.gen.ts, docs/llm/HISTORY.md, package.json, package-lock.json, docs/VERSIONING_RULES.md] - Version impact: yes (0.9.0)
2025-12-15 - GPT-5.2 - Fix channel avatar extraction: use yt-dlp channel metadata (flat-playlist) instead of video thumbnails; add tests and document rerun requirement - Files: [src/youtube/channel.ts, src/pipeline/run.ts, src/youtube/index.ts, tests/channelThumbs.test.ts, tests/all.test.ts, README.md, HOW_TO_USE.md, INTEGRATION.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: yes (0.9.1)

2025-12-14 - Claude - Respond to GPT language detection proposal: agree with yt-dlp metadata approach (options 1+2), defer Whisper local to Phase 2+, reject double-transcription option; propose simple priority chain with automatic_captions/subtitles detection - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

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
2025-12-12 - Claude - Respond to GPT-5.2 modularity review: agree with analysis, propose prioritized interface roadmap (StorageAdapter, PipelineEventEmitter, core errors NOW; YouTube/Formatter DEFER), include concrete interface definitions - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - Claude - Respond to GPT-5.2 architecture review: accept Phase 0 local-first (user confirmed), propose StorageAdapter interface, PipelineEvent contract, detailed Phase 0 breakdown (~3 weeks) - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Annotate docs/ARCHITECTURE.md with Claude vs GPT-5.2 review notes and add Phase 0 local-first MVP - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add resume-aware X/Y progress logging for runs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Show stable video index i/N in skip/done/fail logs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add remaining count to progress logs - Files: [src/pipeline/run.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Prefix channel folder names with sanitized channel title - Files: [src/storage/index.ts, src/pipeline/run.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add modularity/interface review notes to handoff for Claude - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add follow-up notes on interfaces and service-first API readiness - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Rewrite docs/ARCHITECTURE.md to service-first Phase 0 and add language detection requirement - Files: [docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Document service-first layering (core + runners + API) in handoff - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add PipelineEventEmitter and `--json-events` for JSONL progress events - Files: [src/pipeline/events.ts, src/pipeline/jsonlEmitter.ts, src/pipeline/run.ts, src/cli/index.ts, src/utils/logger.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add StorageAdapter + FS implementation for reading outputs; add channel/video meta sidecars; unify core credits error - Files: [src/storage/adapter.ts, src/storage/fsAdapter.ts, src/storage/naming.ts, src/storage/index.ts, src/pipeline/run.ts, src/transcription/errors.ts, src/transcription/assemblyai/http.ts, README.md, docs/VERSIONING_RULES.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-12 - GPT-5.2 - Add language detection options note (metadata vs manual vs audio LID) to handoff - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-14 - GPT-5.2 - Add notes on language detection alignment and Dockerization/deployment considerations - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-14 - GPT-5.2 - Document public-video scope (no cookies) and clarify Phase 0 next steps (language + yt-dlp JS runtime) - Files: [docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-14 - GPT-5.2 - Implement language detection via yt-dlp captions/subtitles and add configurable ytDlpExtraArgs default (android client) - Files: [src/youtube/language.ts, src/youtube/metadata.ts, src/youtube/enumerate.ts, src/youtube/download.ts, src/youtube/comments.ts, src/youtube/index.ts, src/config/schema.ts, src/config/loader.ts, src/config/runs.ts, src/cli/index.ts, src/pipeline/run.ts, README.md, .env.example, config.yaml.example, runs.yaml.example, docs/ARCHITECTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no
2025-12-14 - GPT-5.2 - Add TypeScript unit tests for naming/language/txt formatting - Files: [package.json, src/youtube/language.ts, src/storage/fsAdapter.ts, src/storage/naming.ts, tests/all.test.ts, tests/naming.test.ts, tests/language.test.ts, tests/txtFormatter.test.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

### Example Entry Format

```
2025-01-15 - Claude - Add authentication module with JWT support - Files: [src/auth/jwt.js, src/auth/middleware.js, tests/auth.test.js, docs/llm/HANDOFF.md] - Version impact: yes (src/auth/jwt.js -> 1.1.0, breaking change requires new ENV var JWT_SECRET)
```

### Your Project History

Start logging your changes below. Remove the example above once you have real entries.

---

- 2025-01-01 - ExampleLLM - Initial project setup from LLM-DocKit scaffold - Files: [README.md, LLM_START_HERE.md, docs/PROJECT_CONTEXT.md] - Version impact: no
