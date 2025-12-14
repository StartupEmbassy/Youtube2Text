export type AssemblyAiCreateTranscriptRequestBody = {
  audio_url: string;
  speaker_labels: boolean;
  language_code?: string;
  language_detection?: boolean;
  language_confidence_threshold?: number;
};

export function buildCreateTranscriptRequestBody(input: {
  audioUrl: string;
  languageCode?: string;
  languageDetection?: boolean;
  languageConfidenceThreshold?: number;
}): AssemblyAiCreateTranscriptRequestBody {
  const body: AssemblyAiCreateTranscriptRequestBody = {
    audio_url: input.audioUrl,
    speaker_labels: true,
  };

  if (input.languageDetection) {
    body.language_detection = true;
    if (typeof input.languageConfidenceThreshold === "number") {
      body.language_confidence_threshold = input.languageConfidenceThreshold;
    }
    return body;
  }

  if (input.languageCode) {
    body.language_code = input.languageCode;
  }

  return body;
}

