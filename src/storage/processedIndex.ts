import { join } from "node:path";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import { parseChannelDirName, parseVideoIdFromBaseName } from "./naming.js";

function isReservedDir(name: string): boolean {
  return name.startsWith("_") || name.startsWith(".");
}

function isTranscriptJsonFile(name: string): boolean {
  if (!name.endsWith(".json")) return false;
  if (name.startsWith("_")) return false;
  if (name.endsWith(".meta.json")) return false;
  if (name.endsWith(".comments.json")) return false;
  return true;
}

/**
 * Build a set of processed YouTube video IDs by scanning output directories for a channelId.
 * This avoids per-video `fs.stat` checks across the full channel listing.
 */
export async function buildProcessedVideoIdSet(
  outputDir: string,
  channelId: string
): Promise<Set<string>> {
  const processed = new Set<string>();
  let dirEntries: Dirent[];
  try {
    dirEntries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch {
    return processed;
  }

  const channelDirs = dirEntries
    .filter((d) => d.isDirectory() && !isReservedDir(d.name))
    .filter((d) => parseChannelDirName(d.name).channelId === channelId)
    .map((d) => d.name);

  for (const dirName of channelDirs) {
    const channelPath = join(outputDir, dirName);
    let files: Dirent[];
    try {
      files = await fs.readdir(channelPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const f of files) {
      if (!f.isFile()) continue;
      if (!isTranscriptJsonFile(f.name)) continue;
      const baseName = f.name.slice(0, -".json".length);
      const id = parseVideoIdFromBaseName(baseName);
      if (id) processed.add(id);
    }
  }

  return processed;
}
