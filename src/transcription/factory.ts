import type { AppConfig } from "../config/schema.js";
import type { TranscriptionProvider } from "./provider.js";
import { AssemblyAiProvider } from "./assemblyai/index.js";

export function createTranscriptionProvider(config: AppConfig): TranscriptionProvider {
  switch (config.sttProvider) {
    case "assemblyai":
      return new AssemblyAiProvider(config.assemblyAiApiKey);
    default:
      throw new Error(`Unsupported sttProvider: ${config.sttProvider}`);
  }
}
