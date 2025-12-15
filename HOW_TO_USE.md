# How to Use Youtube2Text

This is a practical usage guide for this repository (not a scaffold).

Most users should start with `README.md`. If you are integrating this into another system, also read `INTEGRATION.md`.

## What you can do

- Run the CLI to transcribe a channel/playlist/video URL into local artifacts.
- Run the local HTTP API runner to start runs and stream progress via SSE.
- Use the Next.js admin UI (minimal) as a local control panel over the API.
- Deploy API+Web via Docker Compose (still CLI-compatible; CLI is not removed).

## Quickstart (CLI)

1) Install dependencies:

```powershell
npm install
```

2) Configure AssemblyAI:

```powershell
$env:ASSEMBLYAI_API_KEY="your_key_here"
```

3) Run a URL:

```powershell
npm run dev -- https://www.youtube.com/@SomeChannel
```

Outputs go to `output/` and `audio/`.

Note: the Library page shows channel avatars when available. These are best-effort from yt-dlp metadata (stored in `output/<channelDir>/_channel.json`). If a channel folder was created before avatars existed (or before v0.9.2), rerun that channel (or any video from it) once to populate the thumbnail URL.

## Quickstart (API + Web in dev)

Terminal 1:

```powershell
$env:ASSEMBLYAI_API_KEY="your_key_here"
npm run dev:api
```

Terminal 2:

```powershell
cd web
npm install
npm run dev
```

Open:
- Web UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

## Quickstart (Docker Compose)

```powershell
$env:ASSEMBLYAI_API_KEY="your_key_here"
$env:Y2T_API_KEY="your_admin_key_here"   # optional but recommended on servers
docker compose up --build
```

## Auth (important)

- If `Y2T_API_KEY` is unset, the API is unauthenticated (local/dev friendly).
- If `Y2T_API_KEY` is set, you must send `X-API-Key` to the API (except `GET /health`).

The web UI does not expose the key to the browser; it proxies API calls via `/api/*`.

## Integration

See `INTEGRATION.md` for:
- planning runs with `POST /runs/plan`
- webhooks via `callbackUrl`
- artifact download patterns
- an n8n flow template

## Operational docs

- API contract/types: `docs/operations/API_CONTRACT.md`
- Roadmap/architecture: `docs/ARCHITECTURE.md`
- LLM handoff and decisions: `docs/llm/HANDOFF.md`, `docs/llm/DECISIONS.md`
