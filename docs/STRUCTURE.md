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
+- audio/           # generated
+- .github/
+- ...
`

## Directory Descriptions

| Path | Purpose | Notes |
|------|---------|-------|
| docs/ | Central documentation, policies, and runbooks | Required |
| docs/llm/ | LLM-specific handoff/history/decisions | Required |
| docs/operations/ | Runbooks and operational procedures | Recommended |
| src/ | Application source code | Required |
| scripts/ | Utility scripts (dev, release, ops) | Optional |
| tests/ | Automated tests | Recommended |
| output/ | Pipeline results by channel/video | Generated |
| audio/ | Downloaded audio artifacts | Generated |
| .github/ | Issue/PR templates and workflows | Optional |

## `src/` Modules (planned, current)

- `src/cli/` - CLI entrypoints and orchestration.
- `src/config/` - configuration loading from `.env` and optional `config.yaml`/`runs.yaml`.
- `src/youtube/` - enumeration/metadata/download wrappers around `yt-dlp`.
- `src/transcription/` - provider interface and AssemblyAI implementation.
- `src/formatters/` - `.txt` and optional `.csv` generation from transcript JSON.
- `src/storage/` - output layout, idempotency checks, and persistence helpers.
- `src/retry/` - shared retry/backoff utilities.
- `src/pipeline/` - the orchestrated pipeline with event emission.

## Naming Conventions

- Canonical identifiers: YouTube `channel_id` and `video_id`.
- Outputs live under `output/<channel_title_slug>__<channel_id>/`.
- File basenames are configurable (see `FILENAME_STYLE` in README).
- Generated directories (`output/`, `audio/`) should not be committed.
- Environment variables are uppercase with underscores (e.g., `ASSEMBLYAI_API_KEY`).

## Onboarding Notes

1. Read `README.md` for usage and configuration.
2. Review `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` for roadmap.
3. Read `docs/llm/README.md` and then `docs/llm/HANDOFF.md` before coding.
