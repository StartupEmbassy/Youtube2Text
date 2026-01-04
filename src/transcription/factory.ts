import type { AppConfig } from "../config/schema.js";
import type { TranscriptionProvider } from "./provider.js";
import { AssemblyAiProvider } from "./assemblyai/index.js";
import { OpenAiWhisperProvider } from "./openai/index.js";
import { getAssemblyAiCapabilities } from "./assemblyai/index.js";
import { MultiKeyProvider } from "./loadBalancer.js";

export function createTranscriptionProvider(config: AppConfig): TranscriptionProvider {
  switch (config.sttProvider) {
    case "assemblyai":
      if (!config.assemblyAiApiKey && (!config.assemblyAiApiKeys || config.assemblyAiApiKeys.length === 0)) {
        throw new Error("assemblyAiApiKey or assemblyAiApiKeys is required when sttProvider=assemblyai");
      }
      {
        const keys = [
          ...(config.assemblyAiApiKeys ?? []),
          ...(config.assemblyAiApiKey ? [config.assemblyAiApiKey] : []),
        ].map((key) => key.trim()).filter((key) => key.length > 0);
        const uniqueKeys = Array.from(new Set(keys));
        if (uniqueKeys.length > 1) {
          return new MultiKeyProvider(
            uniqueKeys,
            (key) => new AssemblyAiProvider(key, undefined, config.providerTimeoutMs),
            getAssemblyAiCapabilities(),
            {
              failureThreshold: config.assemblyAiKeyFailureThreshold,
              cooldownMs: config.assemblyAiKeyCooldownMs,
            }
          );
        }
        const key = uniqueKeys[0];
        if (!key) {
          throw new Error("assemblyAiApiKey or assemblyAiApiKeys is required when sttProvider=assemblyai");
        }
        return new AssemblyAiProvider(key, undefined, config.providerTimeoutMs);
      }
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
