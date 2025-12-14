# Decisions (Rationale)

Keep this file stable and relatively compact. Put "why" here (tradeoffs, rejected options, pitfalls).

All content should be ASCII-only to avoid Windows encoding issues.

## D-001 - CLI independence (non-negotiable)

Decision:
- The CLI must remain fully operational even as service/web layers are added.

Rationale:
- CLI is the primary workflow today and must stay usable for bulk channel transcription.
- Web/API should be a thin shell around the same core pipeline, not a replacement.

Implications:
- Core modules must not import web code.
- Runners (CLI/API) should be separable.

## D-002 - Scope: public videos only (no cookies)

Decision:
- Do not support members-only/private videos. Do not implement cookie ingestion/refresh.

Rationale:
- Operational/security complexity is high and not needed for the intended use (public channels).

Implications:
- When yt-dlp cannot access content, mark it as failed with a clear reason and continue.

## D-003 - Language detection priority chain

Problem:
- Forcing `en_us` makes non-English videos transcribe poorly.
- A naive approach that picks the first key from `automatic_captions` can pick bogus languages (YouTube lists many possible auto-caption languages).

Decision:
- Use this priority chain when `languageDetection=auto`:
  1. `metadata.language` (most reliable; declared language)
  2. `subtitles` (manually uploaded)
  3. `automatic_captions` (filtered to AssemblyAI-supported codes only)
  4. if still undetected: use AssemblyAI Automatic Language Detection (ALD)
  5. only if ALD is disabled: fallback to configured default (`languageCode`, e.g. `en_us`)

Rationale:
- No new dependencies.
- Avoids false positives like detecting a Spanish video as `ab`.

AssemblyAI-supported whitelist:
- `en`, `en_au`, `en_uk`, `en_us`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `hi`, `ja`, `zh`, `fi`, `ko`, `pl`, `ru`, `tr`, `uk`, `vi`

Test fixtures:
- See `tests/fixtures/test-videos.md`.

## D-004 - yt-dlp extra args default must be empty

Problem:
- YouTube upstream changes can require additional tokens for some player clients (e.g. android/ios), breaking public downloads.

Decision:
- Default `ytDlpExtraArgs` to `[]`.
- Use `["--extractor-args","youtube:player_client=default"]` only as an opt-in workaround when EJS warnings occur.

Rationale:
- Lets yt-dlp select fallback clients automatically (best compatibility).
- Avoids hardcoding a client that may require extra tokens.

## D-005 - Interfaces: what to abstract now vs later

Implemented now (needed for Phase 0 -> Phase 1 layering):
- `StorageAdapter`: web needs to read `output/` without duplicating path logic.
- `PipelineEventEmitter`: service/web needs structured events; do not parse logs.
- `InsufficientCreditsError`: avoid coupling pipeline control flow to AssemblyAI-specific errors.

Deferred (YAGNI until a second implementation exists):
- YouTube resolver abstraction beyond yt-dlp
- Audio extractor abstraction
- Formatter abstraction (txt/csv/json)

## D-006 - AssemblyAI ALD fallback when yt-dlp has no language

Problem:
- Some videos have no YouTube language metadata (`language` field is null, no subtitles, no automatic_captions).
- Example: Chinese educational videos often lack this data.
- Current D-003 priority chain falls back to default (e.g. `en_us`), causing poor transcription.

Solution:
- Use AssemblyAI Automatic Language Detection (ALD) as a fallback when YouTube metadata is unavailable.
- ALD is enabled via `language_detection: true` in the transcription request.
- Supports 99 languages (more than our 20-language whitelist).
- Docs: https://www.assemblyai.com/docs/speech-to-text/speech-recognition#automatic-language-detection

Implementation sketch:
```typescript
// In transcription request when YouTube detection fails:
if (!detected) {
  transcriptParams.language_detection = true;
  // Do NOT set language_code when using ALD
}
```

Tradeoffs:
- Pro: Works for any spoken language without manual config.
- Pro: No additional API cost (same price per minute).
- Con: Slightly longer processing time (ALD analyzes first ~60s of audio).
- Con: Cannot use language_code hint; ALD decides autonomously.

Decision status: IMPLEMENTED.

Test case: Chinese video `https://www.youtube.com/watch?v=GBbgCupe6hg` (yt-dlp language is null / no usable captions).

Validation results (2025-12-14):
| Language | Video URL | `language` field | Mapped | Status |
|----------|-----------|------------------|--------|--------|
| Spanish | cYb0Mb_pI_8 | `es-US` | `es` | OK |
| English | sYlHLNZ0E8A | `en` | `en_us` | OK |
| French | VRKw5Vk_iWM | `fr` | `fr` | OK |
| German | o5HLxhvJmJo | `de` | `de` | OK |
| Chinese | ixkRmNhpoGQ | `null` | fallback | NEEDS ALD |
