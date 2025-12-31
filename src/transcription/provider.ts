import type { SttProviderId } from "../config/schema.js";
import { TranscriptJson, TranscriptionOptions } from "./types.js";

export type ProviderCapabilities = {
  maxAudioBytes?: number;
  supportsDiarization: boolean;
};

export interface TranscriptionProvider {
  name: SttProviderId;
  transcribe(audioPath: string, opts: TranscriptionOptions): Promise<TranscriptJson>;
  getCapabilities(): ProviderCapabilities;
  getAccount?: () => Promise<Record<string, unknown>>;
}
