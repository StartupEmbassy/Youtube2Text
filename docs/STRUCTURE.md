# Repository Structure Guide

This document describes the intended repository layout for Youtube2Text.

## Top-Level Layout
`
<PROJECT_ROOT>/
+- README.md
+- LLM_START_HERE.md
+- docs/
+- src/
+- scripts/
+- tests/
+- output/          # generated
+- cache/           # generated (audio)
+- .github/
+- ...
`

## Directory Descriptions
| Path | Purpose | Notes |
|------|---------|-------|
| docs/ | Central documentation, policies, and runbooks | Required |
| docs/llm/ | Handoff and history for LLM contributors | Required |
| docs/operations/ | Runbooks and operational procedures | Recommended |
| src/ | Application source code | Required |
| scripts/ | Utility scripts (dev, release, ops) | Optional |
| tests/ | Automated tests | Recommended |
| output/ | Pipeline results by channel/video | Generated |
| cache/ | Downloaded audio artifacts | Generated |
| .github/ | Issue/PR templates and workflows | Optional |

## Custom Modules or Packages

Planned `src/` modules (subject to refinement during implementation):

- `src/cli/` — CLI entrypoints and orchestration.
- `src/config/` — configuration loading from `.env` and optional `config.yaml`.
- `src/youtube/` — video enumeration and audio download wrappers around `yt-dlp`.
- `src/transcription/` — provider interface and AssemblyAI implementation.
- `src/formatters/` — `.txt` and optional `.csv` generation from transcript JSON.
- `src/storage/` — output layout, idempotency checks, and persistence helpers.
- `src/retry/` — shared retry/backoff utilities.

## Naming Conventions

- Use YouTube `channel_id` and `video_id` as canonical identifiers.
- Output files: `<video_id>.json`, `<video_id>.txt`, `<video_id>.csv`.
- Generated directories (`output/`, `cache/`) should not be committed.
- Environment variables are uppercase with underscores (e.g., `ASSEMBLYAI_API_KEY`).

## Onboarding Notes

1. Read `README.md` for the project overview and pipeline intent.
2. Review `docs/PROJECT_CONTEXT.md` for architecture and milestones.
3. Check `docs/llm/HANDOFF.md` for current work state before coding.
