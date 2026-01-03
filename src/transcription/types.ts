export type TranscriptUtterance = {
  speaker?: string | number;
  start?: number;
  end?: number;
  text?: string;
};

export type TranscriptJson = {
  id: string;
  status: string;
  text?: string;
  utterances?: TranscriptUtterance[];
  [key: string]: unknown;
};

export type TranscriptionOptions = {
  languageCode?: string;
  languageDetection?: boolean;
  languageConfidenceThreshold?: number;
  pollIntervalMs: number;
  maxPollMinutes: number;
  retries: number;
  providerTimeoutMs: number;
};
