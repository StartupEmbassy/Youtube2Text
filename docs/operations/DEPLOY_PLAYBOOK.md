# Deploy Playbook (Single-Tenant Admin)

This playbook documents a pragmatic server deployment for Youtube2Text as a single-tenant (admin-only) service.
It does not replace the CLI: the CLI remains fully operational and can be run separately.

## Goals

- Run API + Web via Docker Compose on a server.
- Keep secrets out of the browser (web proxies API calls).
- Make the deployment safe by default: require an API key and restrict CORS.

## Prerequisites

- Docker + Docker Compose on the server
- An AssemblyAI API key
- A domain name + TLS termination (recommended)

## Required environment

- `ASSEMBLYAI_API_KEY` (required for transcription)

## Strongly recommended (servers)

- `Y2T_API_KEY` (required; enforces `X-API-Key` on all API endpoints except `GET /health`)
- `Y2T_CORS_ORIGINS` (comma-separated exact origin allowlist)
  - Example: `https://y2t.example.com`

If `Y2T_API_KEY` is missing, the API server will refuse to start (unless you explicitly set `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local development only).
If you expose the API port publicly in that state, anyone can call it.

## Optional ops knobs (Phase 2.2)

- `Y2T_API_PERSIST_RUNS` (default: true)
- `Y2T_API_PERSIST_DIR` (default: `output/_runs/`)
- `Y2T_RETENTION_RUNS_DAYS` (default: 30; `-1` disables)
- `Y2T_RETENTION_AUDIO_DAYS` (default: 7; `-1` disables)

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
