# API Contract (Phase 1 Step)

This doc is ASCII-only (Windows-safe).

## Goal

When the API grows, we want a single source of truth for endpoints and types, and we want an automated guardrail so the spec and generated types cannot drift.

This is the "Option 2" approach: OpenAPI + generated TypeScript types/client.

## What Exists Now

Files:
- `openapi.yaml` at repo root (authoritative API contract)
- `web/lib/apiTypes.gen.ts` (generated; do not hand-edit)

Scripts (root `package.json`):
- `npm run api:spec:validate`
  - validates that the OpenAPI file is syntactically correct
- `npm run api:types:generate`
  - generates TS types (and optionally a client) into `web/`
- `npm run api:contract:check`
  - runs validate + generate, then fails if regeneration changes the generated types file

CI/discipline rule:
- Any PR/change that modifies an endpoint MUST update `openapi.*` and keep `npm run api:contract:check` passing.

## Why This Prevents Drift

The key is the "check" command that:
1) regenerates the artifacts from the spec
2) asserts regeneration does not change the generated types file

So if someone changes the code but forgets to update the spec, the check will fail.

## When To Run It

Every time you:
- add/remove/rename an endpoint
- change request/response JSON shapes
- change SSE event schema

Run:
- `npm run api:contract:check`

## Scope Of The Current Spec

Start by covering what exists today (Phase 1):
- Health:
  - `GET /health`
- Events:
  - `GET /events` (SSE global run updates)
- Runs:
  - `GET /runs`
  - `POST /runs`
  - `GET /runs/:id`
  - `GET /runs/:id/artifacts`
  - `GET /runs/:id/events` (SSE) (document as `text/event-stream`)
- Library:
  - `GET /library/channels`
  - `GET /library/channels/:channelDirName`
  - `GET /library/channels/:channelDirName/videos`
  - `GET /library/channels/:channelDirName/videos/:basename/:kind`

Future endpoints we likely want (admin-local):
- `POST /runs/:id/cancel`
- `POST /runs/:id/retry`
- `DELETE /runs/:id`
- `GET /config` (sanitized effective config, no secrets)
- `POST /config/validate` (validate run overrides)

## Notes

- CLI is still primary and remains independent. API/Web are shells.
- Multi-tenant auth is Phase 2+. Do not overbuild auth in Phase 1.
