import { TranscriptJson, TranscriptionOptions } from "./types.js";

export interface TranscriptionProvider {
  name: string;
  transcribe(audioPath: string, opts: TranscriptionOptions): Promise<TranscriptJson>;
  getAccount?: () => Promise<Record<string, unknown>>;
}
