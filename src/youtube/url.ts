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

