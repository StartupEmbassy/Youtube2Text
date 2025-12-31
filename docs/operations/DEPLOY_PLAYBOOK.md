# Deploy Playbook (Single-Tenant Admin)

This playbook documents a pragmatic server deployment for Youtube2Text as a single-tenant (admin-only) service.
It does not replace the CLI: the CLI remains fully operational and can be run separately.

## Goals

- Run API + Web via Docker Compose on a server.
- Keep secrets out of the browser (web proxies API calls).
- Make the deployment safe by default: require an API key, restrict CORS, and lock down webhooks.

## Prerequisites

- Docker + Docker Compose on the server
- An AssemblyAI API key (when `sttProvider=assemblyai`)
- An OpenAI API key (when `sttProvider=openai_whisper`)
- A domain name + TLS termination (recommended)

## Required environment

- `ASSEMBLYAI_API_KEY` (required when `sttProvider=assemblyai`)
- `OPENAI_API_KEY` or `Y2T_OPENAI_API_KEY` (required when `sttProvider=openai_whisper`)

## Strongly recommended (servers)

- `Y2T_API_KEY` (required; enforces `X-API-Key` on all API endpoints except `GET /health`)
- `Y2T_CORS_ORIGINS` (comma-separated exact origin allowlist)
  - Example: `https://y2t.example.com`
- `Y2T_WEBHOOK_ALLOWED_DOMAINS` (comma-separated allowlist for `callbackUrl`)
- `Y2T_WEBHOOK_MAX_AGE_SECONDS` (adds `X-Y2T-Max-Age` for replay protection)
- `Y2T_MAX_BODY_BYTES` (request body limit, default 1,000,000)
- `Y2T_AUTH_FAIL_MAX` + `Y2T_AUTH_FAIL_WINDOW_MS` (rate limit auth failures)
- `Y2T_TRUST_PROXY=true` (if running behind a trusted reverse proxy; uses `X-Forwarded-For`/`X-Real-IP`)
- `Y2T_API_KEY_MAX_BYTES` (cap `X-API-Key` header length; default 256)
- `Y2T_RATE_LIMIT_WRITE_MAX` + `Y2T_RATE_LIMIT_WINDOW_MS` (rate limit write endpoints; defaults 60 / 60000ms)
- `Y2T_RATE_LIMIT_READ_MAX` + `Y2T_RATE_LIMIT_READ_WINDOW_MS` (rate limit read endpoints; defaults 300 / 60000ms)
- `Y2T_RATE_LIMIT_HEALTH_MAX` + `Y2T_RATE_LIMIT_HEALTH_WINDOW_MS` (throttle deep health checks; defaults 30 / 60000ms)
- `Y2T_SSE_MAX_CLIENTS` (cap concurrent SSE connections; default 1000, `0` disables)
- `Y2T_REQUEST_TIMEOUT_MS` (global request timeout for non-SSE requests)
- `Y2T_RUN_TIMEOUT_MINUTES` (safety net for stuck runs)
- `Y2T_MAX_BUFFERED_EVENTS_PER_RUN` (SSE replay buffer size; default 1000)
- `Y2T_API_PERSIST_DIR` (override persisted runs dir; default `output/_runs/`)
- `Y2T_SHUTDOWN_TIMEOUT_SECONDS` (graceful shutdown wait; default 60)
- `Y2T_WATCHLIST_ALLOW_ANY_URL` (allow non-channel/playlist watchlist URLs; default false)
- `Y2T_WEBHOOK_SECRET` (HMAC signature for webhooks; optional)
- `Y2T_WEBHOOK_RETRIES` (webhook retries; default 3)
- `Y2T_WEBHOOK_TIMEOUT_MS` (per-attempt webhook timeout; default 5000)
- `NEXT_PUBLIC_Y2T_API_BASE_URL` (web browser API base URL; must be publicly reachable)

If `Y2T_API_KEY` is missing, the API server will refuse to start (unless you explicitly set `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local development only).
If you expose the API port publicly in that state, anyone can call it.

## Optional ops knobs (Phase 2.2)

- `Y2T_API_PERSIST_RUNS` (default: true)
- `Y2T_API_PERSIST_DIR` (default: `output/_runs/`)
- `Y2T_RETENTION_RUNS_DAYS` (default: 30; `-1` disables)
- `Y2T_RETENTION_AUDIO_DAYS` (default: 7; `-1` disables)
- `Y2T_MAX_AUDIO_MB` (cap audio size before splitting; provider limit applies if lower)
- `Y2T_SPLIT_OVERLAP_SECONDS` (overlap seconds between split chunks; default 2)

Retention never deletes transcripts under `output/<channelDir>/*`.
It only deletes operational run persistence (`output/_runs/*`) and old audio cache files (`audio/*`).

Non-secret defaults:
- The API/web UI can persist non-secret defaults to `output/_settings.json` via `GET/PATCH /settings`.
- This file is safe to keep on disk (no secrets) and is persisted via the `output/` volume mount.

## Ports and exposure (recommended)

- Expose the Web UI to the Internet (TLS): `:3000`
- Keep the API private (no public exposure) when possible:
  - If you must expose it, enforce `Y2T_API_KEY` and restrict `Y2T_CORS_ORIGINS`.

## Reverse proxy (recommended)

Terminate TLS in a reverse proxy (Caddy/Nginx/Traefik) and forward:
- `https://y2t.example.com/` -> web container `:3000`
- Optionally: do not expose the API port at all; the web UI proxies `/api/*`.

## Health and ops

- Basic health: `GET /health`
- Deep health (deps + disk + persistence): `GET /health?deep=true`
- Manual retention cleanup: `POST /maintenance/cleanup`

## Periodic maintenance (cron example)

Retention cleanup is safe by default (it never deletes transcripts under `output/<channelDir>/*`), but you still need to run it periodically on long-lived servers.

Linux cron example (daily at 03:15):

```cron
15 3 * * * curl -sS -X POST "http://127.0.0.1:8787/maintenance/cleanup" -H "X-API-Key: $Y2T_API_KEY" >/dev/null 2>&1
```

Notes:
- If `Y2T_API_KEY` is set on the server (required by default), clients must include the header.
- If the API is not exposed publicly, run this on the same host/container network (or via your reverse proxy if you intentionally expose it).

## Suggested deployment steps (high level)

1) Copy `docker-compose.yml` to your server.
2) Provide env vars (shell env or `.env` loaded by compose):
   - `ASSEMBLYAI_API_KEY`
   - `Y2T_API_KEY` (recommended)
   - `Y2T_CORS_ORIGINS` (recommended)
3) Run: `docker compose up --build -d`
4) Verify:
   - Web loads at your domain
   - `GET /health?deep=true` reports `ok: true`
5) Periodically check disk usage and retention settings.
