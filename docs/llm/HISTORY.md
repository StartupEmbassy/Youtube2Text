# LLM Change History

Append new entries at the top so the most recent activity is easiest to find. Follow the required format:

YYYY-MM-DD - <LLM_NAME> - <Brief summary> - Files: [list of touched files] - Version impact: <yes/no + details>

## Log

2025-12-12 - GPT-5.2 - Add optional runs.yaml for multi-run execution, update CLI/README, and fix TS build narrowing - Files: [README.md, src/cli/index.ts, src/config/runs.ts, src/config/index.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Ignore runs.yaml/yml in git and accept runs.yml fallback; clarify YAML structure in README - Files: [.gitignore, README.md, src/config/runs.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Implement user/Claude hardening: add .env/config/runs examples, ignore outputs, buffer upload, yt-dlp preflight check, date debug, CLI --version; defer parallel runs and root-array YAML - Files: [.env.example, config.yaml.example, runs.yaml.example, .gitignore, README.md, src/transcription/assemblyai/http.ts, src/utils/deps.ts, src/pipeline/run.ts, src/utils/date.ts, src/cli/index.ts, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Pivot to accept root-array runs.yaml after user error; update loader and docs accordingly - Files: [src/config/runs.ts, README.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Normalize user runs.yml to recommended `{runs: [...]}` structure for clarity - Files: [runs.yml, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

2025-12-12 - GPT-5.2 - Scaffold and implement MVP 1 local pipeline (yt-dlp audio download, AssemblyAI diarization, json/txt/csv storage, CLI) and align README audio path - Files: [package.json, tsconfig.json, README.md, src/cli/index.ts, src/pipeline/run.ts, src/config/*, src/youtube/*, src/transcription/*, src/formatters/*, src/storage/*, src/utils/*, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: yes (initial package.json 0.1.0)

2025-12-12 - GPT-5.2 - Adapt project documentation to Youtube2Text scope - Files: [README.md, LLM_START_HERE.md, docs/PROJECT_CONTEXT.md, docs/STRUCTURE.md, docs/llm/HANDOFF.md, docs/llm/HISTORY.md] - Version impact: no

### Example Entry Format

```
2025-01-15 - Claude - Add authentication module with JWT support - Files: [src/auth/jwt.js, src/auth/middleware.js, tests/auth.test.js, docs/llm/HANDOFF.md] - Version impact: yes (src/auth/jwt.js -> 1.1.0, breaking change requires new ENV var JWT_SECRET)
```

### Your Project History

Start logging your changes below. Remove the example above once you have real entries.

---

- 2025-01-01 - ExampleLLM - Initial project setup from LLM-DocKit scaffold - Files: [README.md, LLM_START_HERE.md, docs/PROJECT_CONTEXT.md] - Version impact: no
