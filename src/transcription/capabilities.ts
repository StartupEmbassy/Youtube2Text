export type ProviderCapabilities = {
  id: "assemblyai" | "openai_whisper";
  maxAudioBytes: number;
  supportsDiarization: boolean;
};

export const PROVIDER_CAPABILITIES: ProviderCapabilities[] = [
  {
    id: "assemblyai",
    maxAudioBytes: 5_000_000_000,
    supportsDiarization: true,
  },
  {
    id: "openai_whisper",
    maxAudioBytes: 25_000_000,
    supportsDiarization: false,
  },
];

export function getProviderCapabilities(
  id: ProviderCapabilities["id"]
): ProviderCapabilities | undefined {
  return PROVIDER_CAPABILITIES.find((provider) => provider.id === id);
}

export function listProviderCapabilities(): ProviderCapabilities[] {
  return [...PROVIDER_CAPABILITIES];
}
