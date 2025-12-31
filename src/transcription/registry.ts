import type { SttProviderId } from "../config/schema.js";
import type { ProviderCapabilities } from "./provider.js";
import { getAssemblyAiCapabilities } from "./assemblyai/index.js";
import { getOpenAiWhisperCapabilities } from "./openai/index.js";

export type ProviderCapability = ProviderCapabilities & { id: SttProviderId };

export function listProviderCapabilities(): ProviderCapability[] {
  return [
    { id: "assemblyai", ...getAssemblyAiCapabilities() },
    { id: "openai_whisper", ...getOpenAiWhisperCapabilities() },
  ];
}
