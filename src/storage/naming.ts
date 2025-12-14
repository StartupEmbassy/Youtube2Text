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
  const parts = baseName.split("__");
  return (parts.length >= 2 ? parts[parts.length - 1] : baseName) as string;
}
