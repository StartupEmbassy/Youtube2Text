import { appendLine } from "../utils/fs.js";
import type { PipelineStage } from "../pipeline/events.js";

export type ErrorRecord = {
  videoId: string;
  videoUrl: string;
  stage: PipelineStage;
  message: string;
  timestamp: string;
};

export async function logErrorRecord(path: string, record: ErrorRecord) {
  await appendLine(path, JSON.stringify(record));
}
