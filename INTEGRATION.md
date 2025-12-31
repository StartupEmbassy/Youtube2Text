# Integration Guide (API-first)

This document is for integrating Youtube2Text into other systems (n8n, custom backends, cron, etc.).
It does not replace the CLI.

## URLs and Auth

Default local API:
- `http://127.0.0.1:8787`

The server refuses to start unless `Y2T_API_KEY` is set (use `Y2T_ALLOW_INSECURE_NO_API_KEY=true` for local development only).
When `Y2T_API_KEY` is set, all endpoints require `X-API-Key` (except `GET /health`).
If the API sits behind a trusted reverse proxy, set `Y2T_TRUST_PROXY=true` so rate limiting uses `X-Forwarded-For` / `X-Real-IP`.
`Y2T_API_KEY_MAX_BYTES` caps the `X-API-Key` header size (default 256).

Example (PowerShell):

```powershell
$env:Y2T_API_KEY="your_admin_key"
curl -H "X-API-Key: $env:Y2T_API_KEY" http://127.0.0.1:8787/runs
```

## Core endpoints

### 1) Health

```bash
curl http://127.0.0.1:8787/health
```

### 1b) Settings (optional non-secret defaults)

The API can persist non-secret defaults to `output/_settings.json` (never secrets).
These settings affect planning and runs unless overridden per-run.

Precedence:
`output/_settings.json` (lowest) < `config.yaml` < `.env` (highest) < per-run overrides.

Fetch current settings + effective values:

```bash
curl -sS http://127.0.0.1:8787/settings
```

The response also includes `sources` per field (`env`, `config.yaml`, `settingsFile`, `default`, `unset`) so UIs can explain where each effective value comes from.

Update settings (send `null` to clear a key):

```bash
curl -sS -X PATCH http://127.0.0.1:8787/settings \
  -H "Content-Type: application/json" \
  -d '{"settings":{"maxNewVideos":10,"afterDate":"2024-01-01","csvEnabled":true}}'
```

### 2) Plan a run (no transcription)

Use this to avoid wasted credits. It enumerates and counts what is already processed.

```bash
curl -sS -X POST http://127.0.0.1:8787/runs/plan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/@SomeChannel","force":false,"maxNewVideos":10,"afterDate":"2024-01-01"}'
```

Response includes:
- `plan.totalVideos`
- `plan.alreadyProcessed`
- `plan.unprocessed` (total unprocessed under filters)
- `plan.toProcess` (selected for this run; capped by `maxNewVideos`)
- `plan.videos[]` with `processed: true|false` (full list under filters)
- `plan.selectedVideos[]` (the videos that will be processed)

### 3) Start a run

```bash
curl -sS -X POST http://127.0.0.1:8787/runs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/@SomeChannel","force":false,"maxNewVideos":10,"afterDate":"2024-01-01"}'
```

Notes:
- For single-video URLs, `POST /runs` is cache-first: if artifacts already exist and `force=false`, it returns a `done` run immediately (no download/transcribe).
- For channel/playlist runs, idempotency is handled by per-video skip checks.

## Error responses (common)

Most endpoints can return these errors (JSON):

| Status | error | Meaning |
|--------|-------|---------|
| 400 | `bad_request` | Validation failed (invalid inputs, header too long, bad date, etc.) |
| 401 | `unauthorized` | Missing or invalid `X-API-Key` |
| 404 | `not_found` | Resource not found |
| 408 | `timeout` | Request timed out (`Y2T_REQUEST_TIMEOUT_MS`) |
| 413 | `payload_too_large` | JSON body exceeds `Y2T_MAX_BODY_BYTES` |
| 429 | `rate_limited` | Rate limit exceeded (see Retry-After) |
| 500 | `server_error` | Internal error (sanitized message) |

### 3b) Cancel a run

Cancellation is cooperative. In-flight work may finish, but the run will stop as soon as practical and end with `status: cancelled`.

```bash
curl -sS -X POST http://127.0.0.1:8787/runs/<RUN_ID>/cancel
```

### 4) Observe progress

SSE (run events):
- `GET /runs/{runId}/events`

Global SSE (run list updates):
- `GET /events`
Use `Y2T_SSE_MAX_CLIENTS` to cap concurrent SSE connections (default 1000, `0` disables).
Use `Y2T_REQUEST_TIMEOUT_MS` to bound non-SSE request time (default 30000, `0` disables).

Example (bash/curl):

```bash
curl -N http://127.0.0.1:8787/runs/<RUN_ID>/events
```

### 4b) Fetch recent run logs (JSON)

If you cannot use SSE (or want a quick debug snapshot), fetch the recent buffered events as JSON:

```bash
curl -sS "http://127.0.0.1:8787/runs/<RUN_ID>/logs?tail=200"
```

### 5) Get produced artifacts

List artifacts for a run:

```bash
curl -sS http://127.0.0.1:8787/runs/<RUN_ID>/artifacts
```

Download artifacts (direct):
- `GET /library/channels/{channelDirName}/videos/{basename}/txt`
- `GET /library/channels/{channelDirName}/videos/{basename}/md`
- `GET /library/channels/{channelDirName}/videos/{basename}/jsonl`
- `GET /library/channels/{channelDirName}/videos/{basename}/json`
- `GET /library/channels/{channelDirName}/videos/{basename}/comments`
- `GET /library/channels/{channelDirName}/videos/{basename}/audio`

Example:

```bash
curl -L "http://127.0.0.1:8787/library/channels/<CHANNEL_DIR>/videos/<BASENAME>/md" -o transcript.md
```

## Webhooks (callbackUrl)

`POST /runs` supports `callbackUrl`. When the run ends, the API sends a POST webhook:
- `type: "run:done"` when status becomes `done`
- `type: "run:error"` when status becomes `error`
- `type: "run:cancelled"` when status becomes `cancelled`

Payload:

```json
{
  "type": "run:done",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "run": { "runId": "...", "status": "done", "...": "..." }
}
```

Signature (optional):
- If `Y2T_WEBHOOK_SECRET` is set, the API includes:
  - `X-Y2T-Timestamp` (ISO)
  - `X-Y2T-Event` (event name, e.g. `run:done`)
  - `Content-Type: application/json; charset=utf-8`
  - `X-Y2T-Signature` (`sha256=<hex>`) where HMAC-SHA256 is computed over:
    - `${timestamp}.${body}`
  - If `Y2T_WEBHOOK_MAX_AGE_SECONDS` is set, the API also includes `X-Y2T-Max-Age`.
    Use it (or your own fixed window) to reject old/replayed requests.

Retry policy:
- Retries for `429`, `5xx`, and network errors.
- Configure with:
  - `Y2T_WEBHOOK_RETRIES` (default `3`)
  - `Y2T_WEBHOOK_TIMEOUT_MS` (default `5000`)
- Redirects are not followed (to prevent SSRF).

Recommended replay protection (receiver):
- Parse `X-Y2T-Timestamp` and reject if older than `X-Y2T-Max-Age` seconds.
- Verify `X-Y2T-Signature` against the raw request body.

## n8n (suggested flow)

Goal: run -> wait -> fetch artifacts -> send to next system.

1) HTTP Request: `POST /runs/plan`
   - If `plan.toProcess == 0`, do nothing (or fetch artifacts directly).
2) HTTP Request: `POST /runs` (optionally set `callbackUrl` to your n8n webhook URL)
3) If using `callbackUrl`:
   - n8n Webhook Trigger receives `run:done` / `run:error`
4) HTTP Request: `GET /runs/{runId}/artifacts`
5) HTTP Request: download `md` and/or `jsonl` for each video and pass to the next workflow step.

## Docker notes

- For server-to-server calls inside the compose network, use `Y2T_API_BASE_URL=http://youtube2text-api:8787`.
- For browser-visible URLs, prefer going through the web UI `http://localhost:3000` which proxies `/api/*` to the API and does not expose secrets to the browser.

## Monitoring (Prometheus)

The API exposes a Prometheus-compatible metrics endpoint:

- `GET /metrics` (text/plain; version=0.0.4; charset=utf-8)

If `Y2T_API_KEY` is set, include `X-API-Key: ...`.

## Watchlist URL safety

The watchlist is meant for recurring sources (channels/playlists). By default, `POST /watchlist` rejects single-video URLs.
Override (not recommended): set `Y2T_WATCHLIST_ALLOW_ANY_URL=true`.

## Channel avatars in Library (best-effort)

The web UI Library page can show a small channel avatar.

How it works:
- The pipeline stores `channelThumbnailUrl` in `output/<channelDirName>/_channel.json` (best-effort from yt-dlp channel metadata).
- The API exposes it in `GET /library/channels`.

If you already have a channel folder created before this feature existed (or before v0.9.2), rerun that channel (or any video from it) once to populate the field.
