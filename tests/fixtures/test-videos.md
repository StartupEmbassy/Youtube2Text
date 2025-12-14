# Test Videos for Language Detection

Short videos in different languages for testing language detection and transcription.

## Test Suite

| Language | Code | Video URL | Duration | Notes |
|----------|------|-----------|----------|-------|
| Spanish | es | https://www.youtube.com/watch?v=cYb0Mb_pI_8 | ~3 min | User provided |
| English | en_us | https://www.youtube.com/watch?v=dQw4w9WgXcQ | 3:33 | Rick Astley - Never Gonna Give You Up |
| French | fr | https://www.youtube.com/shorts/007P3HSf5vg | | |
| German | de | https://www.youtube.com/shorts/NDsa8eSdEXo | | |
| Chinese | zh | https://www.youtube.com/watch?v=GBbgCupe6hg | | Mandarin |

## Usage

```bash
# Test single video
npx tsx src/cli/index.ts --maxVideos 1 "VIDEO_URL"

# Test with JSON events
npx tsx src/cli/index.ts --maxVideos 1 --json-events "VIDEO_URL"

# Force reprocess
npx tsx src/cli/index.ts --maxVideos 1 --force "VIDEO_URL"
```

## Expected Behavior

1. Language should be auto-detected from `automatic_captions` or `subtitles`
2. If no captions available, falls back to config `languageCode` (default: `en_us`)
3. Detected language logged: `[language] Detected: es (automatic_captions)`
