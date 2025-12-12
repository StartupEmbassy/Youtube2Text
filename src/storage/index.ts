import { join } from "node:path";
import { fileExists, sanitizeFilename, writeJson, writeText } from "../utils/fs.js";
import { TranscriptJson } from "../transcription/types.js";

export type OutputPaths = {
  jsonPath: string;
  txtPath: string;
  csvPath: string;
  errorLogPath: string;
  audioPath: string;
};

export function getOutputPaths(
  channelId: string,
  videoId: string,
  videoTitle: string,
  dirs: { outputDir: string; audioDir: string; audioFormat: string }
): OutputPaths {
  const titleSlug = sanitizeFilename(videoTitle, { maxLength: 60 });
  const baseName = `${videoId}__${titleSlug}`;
  return {
    jsonPath: join(dirs.outputDir, channelId, `${baseName}.json`),
    txtPath: join(dirs.outputDir, channelId, `${baseName}.txt`),
    csvPath: join(dirs.outputDir, channelId, `${baseName}.csv`),
    errorLogPath: join(dirs.outputDir, channelId, `_errors.jsonl`),
    audioPath: join(dirs.audioDir, channelId, `${baseName}.${dirs.audioFormat}`),
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
