import { appendLine } from "../utils/fs.js";

export type ErrorRecord = {
  videoId: string;
  videoUrl: string;
  stage: "enumerate" | "download" | "transcribe" | "comments" | "save" | "format";
  message: string;
  timestamp: string;
};

export async function logErrorRecord(path: string, record: ErrorRecord) {
  await appendLine(path, JSON.stringify(record));
}
