import { join } from "node:path";
import { promises as fs } from "node:fs";
import { ensureDir, fileExists, writeJson } from "../utils/fs.js";
import { enumerateVideos } from "./enumerate.js";
import type { YoutubeListing, YoutubeVideo } from "./types.js";
import { classifyYoutubeUrl } from "./url.js";

type ChannelCatalog = {
  version: 1;
  channelId: string;
  channelTitle?: string;
  inputUrl: string;
  retrievedAt: string;
  complete: boolean;
  videos: YoutubeVideo[];
};

type EnumerateDeps = {
  ytDlpCommand: string;
  ytDlpExtraArgs: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function catalogPath(outputDir: string, channelId: string): string {
  return join(outputDir, "_catalog", `${channelId}.json`);
}

async function readCatalog(path: string): Promise<ChannelCatalog | undefined> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const json = JSON.parse(raw) as ChannelCatalog;
    if (json?.version !== 1) return undefined;
    if (typeof json.channelId !== "string") return undefined;
    if (!Array.isArray(json.videos)) return undefined;
    return json;
  } catch {
    return undefined;
  }
}

function uniqById(videos: YoutubeVideo[]): YoutubeVideo[] {
  const seen = new Set<string>();
  const out: YoutubeVideo[] = [];
  for (const v of videos) {
    if (!v?.id) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}

function mergeNewestFirst(cached: YoutubeVideo[], newestSlice: YoutubeVideo[]): YoutubeVideo[] {
  // Expected order: newest -> oldest.
  // Prepend newestSlice, keep cached tail, dedupe by id.
  return uniqById([...newestSlice, ...cached]);
}

function includesVideoId(videos: YoutubeVideo[], id: string | undefined): boolean {
  if (!id) return false;
  return videos.some((v) => v.id === id);
}

async function enumerateChannelHead(
  inputUrl: string,
  deps: EnumerateDeps,
  playlistEnd: number
): Promise<YoutubeListing> {
  return enumerateVideos(inputUrl, deps.ytDlpCommand, deps.ytDlpExtraArgs, { playlistEnd });
}

async function enumerateChannelFull(inputUrl: string, deps: EnumerateDeps): Promise<YoutubeListing> {
  return enumerateVideos(inputUrl, deps.ytDlpCommand, deps.ytDlpExtraArgs);
}

/**
 * Exact channel listing with caching:
 * - First time for a channelId: full enumeration (expensive) + persist catalog.
 * - Subsequent calls: incremental refresh by fetching N newest items and merging into cached catalog.
 *   If more than N new videos exist, N grows until the previous head is observed; otherwise, falls back to full.
 */
export async function getListingWithCatalogCache(
  inputUrl: string,
  outputDir: string,
  deps: EnumerateDeps,
  options?: { newestChunk?: number; newestChunkMax?: number; maxAgeHours?: number }
): Promise<YoutubeListing> {
  const kind = classifyYoutubeUrl(inputUrl).kind;
  if (kind !== "channel") {
    return enumerateVideos(inputUrl, deps.ytDlpCommand, deps.ytDlpExtraArgs);
  }

  const newestChunk = options?.newestChunk ?? 200;
  const newestChunkMax = options?.newestChunkMax ?? 5000;
  const maxAgeHours = typeof options?.maxAgeHours === "number" ? options.maxAgeHours : 168;

  // Step 1: identify channelId cheaply (playlist-end 1).
  const head = await enumerateChannelHead(inputUrl, deps, 1);
  const channelId = head.channelId;
  const path = catalogPath(outputDir, channelId);

  // Step 2: no cache -> do full enumeration and persist.
  if (!(await fileExists(path))) {
    const full = await enumerateChannelFull(inputUrl, deps);
    await ensureDir(join(outputDir, "_catalog"));
    await writeJson(path, {
      version: 1,
      channelId: full.channelId,
      channelTitle: full.channelTitle,
      inputUrl,
      retrievedAt: nowIso(),
      complete: true,
      videos: full.videos,
    } satisfies ChannelCatalog);
    return full;
  }

  const cached = await readCatalog(path);
  if (!cached || cached.channelId !== channelId || !cached.complete) {
    const full = await enumerateChannelFull(inputUrl, deps);
    await ensureDir(join(outputDir, "_catalog"));
    await writeJson(path, {
      version: 1,
      channelId: full.channelId,
      channelTitle: full.channelTitle,
      inputUrl,
      retrievedAt: nowIso(),
      complete: true,
      videos: full.videos,
    } satisfies ChannelCatalog);
    return full;
  }

  // Step 2.5: TTL - force full enumeration if catalog is too old.
  if (maxAgeHours > 0) {
    const retrieved = Date.parse(cached.retrievedAt);
    if (Number.isFinite(retrieved)) {
      const ageHours = (Date.now() - retrieved) / 3600000;
      if (ageHours > maxAgeHours) {
        const full = await enumerateChannelFull(inputUrl, deps);
        await ensureDir(join(outputDir, "_catalog"));
        await writeJson(path, {
          version: 1,
          channelId: full.channelId,
          channelTitle: full.channelTitle,
          inputUrl,
          retrievedAt: nowIso(),
          complete: true,
          videos: full.videos,
        } satisfies ChannelCatalog);
        return full;
      }
    }
  }

  // Step 3: incremental refresh.
  const previousHeadId = cached.videos[0]?.id;
  let chunk = newestChunk;
  let newestListing: YoutubeListing | undefined;
  while (chunk <= newestChunkMax) {
    newestListing = await enumerateChannelHead(inputUrl, deps, chunk);
    if (includesVideoId(newestListing.videos, previousHeadId)) break;
    chunk = Math.min(newestChunkMax, chunk * 2);
    if (chunk === newestChunkMax) {
      // If we still don't see the previous head at max chunk, fall back to full enumeration.
      newestListing = undefined;
      break;
    }
  }

  if (!newestListing) {
    const full = await enumerateChannelFull(inputUrl, deps);
    await ensureDir(join(outputDir, "_catalog"));
    await writeJson(path, {
      version: 1,
      channelId: full.channelId,
      channelTitle: full.channelTitle,
      inputUrl,
      retrievedAt: nowIso(),
      complete: true,
      videos: full.videos,
    } satisfies ChannelCatalog);
    return full;
  }

  const mergedVideos = mergeNewestFirst(cached.videos, newestListing.videos);
  await writeJson(path, {
    version: 1,
    channelId,
    channelTitle: newestListing.channelTitle ?? cached.channelTitle,
    inputUrl,
    retrievedAt: nowIso(),
    complete: true,
    videos: mergedVideos,
  } satisfies ChannelCatalog);

  return {
    channelId,
    channelTitle: newestListing.channelTitle ?? cached.channelTitle,
    videos: mergedVideos,
  };
}

// Exported for unit tests.
export const _test = { mergeNewestFirst };
