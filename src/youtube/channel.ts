import { logWarn } from "../utils/logger.js";
import { execCommand } from "../utils/exec.js";

type ThumbnailCandidate = { url?: unknown; width?: unknown; height?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function isLikelyChannelImageUrl(url: string): boolean {
  return (
    url.includes("yt3.googleusercontent.com") ||
    url.includes("yt3.ggpht.com") ||
    url.includes("yt3.")
  );
}

function bestFromThumbnails(thumbnails: unknown): string | undefined {
  if (!Array.isArray(thumbnails)) return undefined;
  const parsed: ThumbnailCandidate[] = thumbnails
    .filter((t) => isRecord(t))
    .map((t) => ({
      url: (t as any).url,
      width: (t as any).width,
      height: (t as any).height,
    }));
  const usableAll = parsed
    .map((t) => ({
      url: typeof t.url === "string" ? t.url : undefined,
      width: typeof t.width === "number" ? t.width : 0,
      height: typeof t.height === "number" ? t.height : 0,
    }))
    .filter((t) => !!t.url);
  if (usableAll.length === 0) return undefined;

  const channelCandidates = usableAll.filter((t) =>
    isLikelyChannelImageUrl(t.url as string)
  );
  const usable = channelCandidates.length > 0 ? channelCandidates : usableAll;

  usable.sort((a, b) => (a.width * a.height < b.width * b.height ? 1 : -1));
  return usable[0]!.url as string;
}

export function extractChannelThumbnailUrl(meta: unknown): string | undefined {
  if (!isRecord(meta)) return undefined;

  const direct =
    getString(meta, "channel_thumbnail") ||
    getString(meta, "uploader_avatar") ||
    getString(meta, "avatar") ||
    getString(meta, "thumbnail");
  if (direct && isLikelyChannelImageUrl(direct)) return direct;

  const thumbs = bestFromThumbnails(meta.thumbnails);
  if (thumbs) return thumbs;

  return undefined;
}

export function safeChannelThumbnailUrl(meta: unknown): string | undefined {
  try {
    return extractChannelThumbnailUrl(meta);
  } catch (err) {
    logWarn(
      `Failed to extract channel thumbnail: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}

export type YoutubeChannelMetadata = Record<string, unknown>;

export async function fetchChannelMetadata(
  channelUrl: string,
  ytDlpCommand = "yt-dlp",
  ytDlpExtraArgs: string[] = []
): Promise<YoutubeChannelMetadata | undefined> {
  try {
    const args = [
      ...ytDlpExtraArgs,
      "--dump-single-json",
      "--flat-playlist",
      "--skip-download",
      channelUrl,
    ];
    const result = await execCommand(ytDlpCommand, args);
    if (result.exitCode !== 0) {
      logWarn(`yt-dlp channel meta failed: ${result.stderr || result.stdout}`);
      return undefined;
    }
    return JSON.parse(result.stdout) as YoutubeChannelMetadata;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(`Failed to fetch channel metadata: ${message}`);
    return undefined;
  }
}
