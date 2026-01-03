import type { AppConfig } from "../config/schema.js";
import type { TranscriptionProvider } from "./provider.js";
import { AssemblyAiProvider } from "./assemblyai/index.js";
import { OpenAiWhisperProvider } from "./openai/index.js";

export function createTranscriptionProvider(config: AppConfig): TranscriptionProvider {
  switch (config.sttProvider) {
    case "assemblyai":
      if (!config.assemblyAiApiKey) {
        throw new Error("assemblyAiApiKey is required when sttProvider=assemblyai");
      }
      return new AssemblyAiProvider(
        config.assemblyAiApiKey,
        undefined,
        config.providerTimeoutMs
      );
    case "openai_whisper":
      if (!config.openaiApiKey) {
        throw new Error("openaiApiKey is required when sttProvider=openai_whisper");
      }
      return new OpenAiWhisperProvider(
        config.openaiApiKey,
        config.openaiWhisperModel,
        config.providerTimeoutMs
      );
    default:
      throw new Error(`Unsupported sttProvider: ${config.sttProvider}`);
  }
}
