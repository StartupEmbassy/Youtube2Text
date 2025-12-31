import { AssemblyAiClient } from "./client.js";
import { TranscriptionProvider, type ProviderCapabilities } from "../provider.js";
import { TranscriptJson, TranscriptionOptions } from "../types.js";

const DEFAULT_MAX_AUDIO_BYTES = 5 * 1024 * 1024 * 1024;

export function getAssemblyAiCapabilities(
  maxAudioBytesOverride?: number
): ProviderCapabilities {
  return {
    maxAudioBytes: maxAudioBytesOverride ?? DEFAULT_MAX_AUDIO_BYTES,
    supportsDiarization: true,
  };
}

export class AssemblyAiProvider implements TranscriptionProvider {
  name: "assemblyai" = "assemblyai";
  private client: AssemblyAiClient;
  private maxAudioBytesOverride?: number;

  constructor(apiKey: string, maxAudioBytesOverride?: number) {
    this.client = new AssemblyAiClient(apiKey);
    this.maxAudioBytesOverride = maxAudioBytesOverride;
  }

  getAccount(): Promise<Record<string, unknown>> {
    return this.client.getAccount();
  }

  getCapabilities(): ProviderCapabilities {
    return getAssemblyAiCapabilities(this.maxAudioBytesOverride);
  }

  transcribe(audioPath: string, opts: TranscriptionOptions): Promise<TranscriptJson> {
    return this.client.transcribe(audioPath, opts);
  }
}
