import { join } from "node:path";
import type { AppConfig } from "../config/schema.js";
import {
  fileExists,
  sanitizeFilename,
  writeJson,
  writeText,
} from "../utils/fs.js";
import { TranscriptJson } from "../transcription/types.js";

export type OutputPaths = {
  jsonPath: string;
  txtPath: string;
  csvPath: string;
  commentsPath: string;
  errorLogPath: string;
  audioPath: string;
};

export function getOutputPaths(
  channelId: string,
  channelTitle: string | undefined,
  videoId: string,
  videoTitle: string,
  dirs: { outputDir: string; audioDir: string; audioFormat: string },
  options?: { filenameStyle?: AppConfig["filenameStyle"] }
): OutputPaths {
  const channelSlug = channelTitle
    ? sanitizeFilename(channelTitle, { maxLength: 60 })
    : undefined;
  const channelDirName = channelSlug
    ? `${channelSlug}__${channelId}`
    : channelId;
  const titleSlug = sanitizeFilename(videoTitle, { maxLength: 60 });
  const style = options?.filenameStyle ?? "title_id";
  let baseName = videoId;
  if (style === "id_title") baseName = `${videoId}__${titleSlug}`;
  if (style === "title_id") baseName = `${titleSlug}__${videoId}`;
  return {
    jsonPath: join(dirs.outputDir, channelDirName, `${baseName}.json`),
    txtPath: join(dirs.outputDir, channelDirName, `${baseName}.txt`),
    csvPath: join(dirs.outputDir, channelDirName, `${baseName}.csv`),
    commentsPath: join(
      dirs.outputDir,
      channelDirName,
      `${baseName}.comments.json`
    ),
    errorLogPath: join(dirs.outputDir, channelDirName, `_errors.jsonl`),
    audioPath: join(
      dirs.audioDir,
      channelDirName,
      `${baseName}.${dirs.audioFormat}`
    ),
  };
}

export async function isProcessed(jsonPath: string): Promise<boolean> {
  return fileExists(jsonPath);
}

export async function saveTranscriptJson(
  path: string,
  transcript: TranscriptJson
) {
  await writeJson(path, transcript);
}

export async function saveTranscriptTxt(path: string, text: string) {
  await writeText(path, text);
}

export async function saveTranscriptCsv(path: string, csv: string) {
  await writeText(path, csv);
}

export async function saveVideoCommentsJson(path: string, comments: unknown[]) {
  await writeJson(path, { comments });
}
