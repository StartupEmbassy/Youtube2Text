export function tryExtractVideoIdFromUrl(urlString: string): string | undefined {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").trim();
    return id.length > 0 ? id : undefined;
  }
  if (host !== "youtube.com" && host !== "m.youtube.com") return undefined;
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return id.trim().length > 0 ? id.trim() : undefined;
  }
  const m = url.pathname.match(/^\/shorts\/([^/]+)/);
  if (m?.[1]) return m[1];
  return undefined;
}

export type YoutubeUrlKind = "video" | "channel" | "playlist" | "unknown";

export function classifyYoutubeUrl(urlString: string): { kind: YoutubeUrlKind } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { kind: "unknown" };
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return { kind: "video" };
  if (host !== "youtube.com" && host !== "m.youtube.com") return { kind: "unknown" };

  if (url.pathname === "/watch") return { kind: "video" };
  if (url.pathname === "/playlist") {
    const list = (url.searchParams.get("list") ?? "").trim();
    return list.length > 0 ? { kind: "playlist" } : { kind: "unknown" };
  }
  if (url.pathname.startsWith("/shorts/")) return { kind: "video" };
  if (url.pathname.startsWith("/channel/")) {
    const rest = url.pathname.replace("/channel/", "").trim();
    return rest.length > 0 ? { kind: "channel" } : { kind: "unknown" };
  }
  if (url.pathname.startsWith("/@")) return { kind: "channel" };
  if (url.pathname.startsWith("/c/")) return { kind: "channel" };
  if (url.pathname.startsWith("/user/")) return { kind: "channel" };
  return { kind: "unknown" };
}

/**
 * Normalize channel URLs to include /videos suffix.
 * This ensures yt-dlp returns the actual video list instead of channel tabs.
 *
 * Examples:
 * - https://www.youtube.com/channel/UC... → https://www.youtube.com/channel/UC.../videos
 * - https://www.youtube.com/@handle → https://www.youtube.com/@handle/videos
 * - https://www.youtube.com/@handle/videos → unchanged
 * - https://www.youtube.com/playlist?list=... → unchanged (not a channel)
 */
export function normalizeChannelUrlForEnumeration(urlString: string): string {
  const { kind } = classifyYoutubeUrl(urlString);
  if (kind !== "channel") return urlString;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return urlString;
  }

  // Already has /videos suffix
  if (url.pathname.endsWith("/videos")) return urlString;

  // Remove trailing slash and append /videos
  url.pathname = url.pathname.replace(/\/$/, "") + "/videos";
  return url.toString();
}
