import type { AppConfig } from "../config/schema.js";
import { sanitizeFilename } from "../utils/fs.js";

export function makeChannelDirName(
  channelId: string,
  channelTitle?: string
): string {
  const channelSlug = channelTitle
    ? sanitizeFilename(channelTitle, { maxLength: 60 })
    : undefined;
  return channelSlug ? `${channelSlug}__${channelId}` : channelId;
}

export function parseChannelDirName(dirName: string): {
  channelId: string;
  channelTitleSlug?: string;
} {
  const parts = dirName.split("__");
  if (parts.length >= 2) {
    return {
      channelId: parts[parts.length - 1] as string,
      channelTitleSlug: parts.slice(0, -1).join("__"),
    };
  }
  return { channelId: dirName };
}

export function makeVideoBaseName(
  videoId: string,
  videoTitle: string,
  filenameStyle: AppConfig["filenameStyle"]
): string {
  const titleSlug = sanitizeFilename(videoTitle, { maxLength: 60 });
  if (filenameStyle === "id") return videoId;
  if (filenameStyle === "id_title") return `${videoId}__${titleSlug}`;
  return `${titleSlug}__${videoId}`;
}

export function parseVideoIdFromBaseName(baseName: string): string {
  const trimmed = baseName.trim();
  // Most YouTube video IDs are 11 chars: [A-Za-z0-9_-]{11}
  const idRe = /^[A-Za-z0-9_-]{11}$/;
  if (idRe.test(trimmed)) return trimmed;

  const parts = trimmed.split("__").filter(Boolean);
  const first = parts[0];
  const last = parts.length >= 2 ? parts[parts.length - 1] : undefined;

  const hasDigit = (s: string) => /\d/.test(s);

  if (first && last && idRe.test(first) && idRe.test(last)) {
    // Ambiguous case: both ends look like ids (e.g. title slug happens to be 11 chars).
    // Prefer the candidate that contains digits; titles often do not.
    if (hasDigit(first) && !hasDigit(last)) return first;
    if (hasDigit(last) && !hasDigit(first)) return last;
    // Fallback: prefer the suffix (default filenameStyle is title_id).
    return last;
  }

  // filenameStyle=title_id => "<title>__<id>"
  if (last && idRe.test(last)) return last;

  // filenameStyle=id_title => "<id>__<title>"
  if (first && idRe.test(first)) return first;

  // Fallback: last segment (best-effort)
  return (parts.length >= 1 ? parts[parts.length - 1] : trimmed) as string;
}
