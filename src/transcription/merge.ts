import { TranscriptJson, TranscriptUtterance } from "./types.js";

export type ChunkTranscript = {
  transcript: TranscriptJson;
  startSeconds: number;
  overlapSeconds: number;
};

function trimOverlap(
  utterance: TranscriptUtterance,
  overlapMs: number
): TranscriptUtterance | undefined {
  if (overlapMs <= 0) return utterance;
  const start = typeof utterance.start === "number" ? utterance.start : undefined;
  const end = typeof utterance.end === "number" ? utterance.end : undefined;

  if (end !== undefined && end <= overlapMs) {
    return undefined;
  }
  if (start !== undefined && start < overlapMs) {
    return { ...utterance, start: overlapMs };
  }
  return utterance;
}

export function mergeChunkTranscripts(chunks: ChunkTranscript[]): TranscriptJson {
  const mergedUtterances: TranscriptUtterance[] = [];
  const fallbackTextParts: string[] = [];
  let languageCode: string | undefined;
  let provider: string | undefined;
  let languageConfidence: number | undefined;

  for (const chunk of chunks) {
    if (!languageCode && typeof chunk.transcript.language_code === "string") {
      languageCode = chunk.transcript.language_code;
    }
    if (!provider && typeof chunk.transcript.provider === "string") {
      provider = chunk.transcript.provider;
    }
    if (
      languageConfidence === undefined &&
      typeof chunk.transcript.language_confidence === "number"
    ) {
      languageConfidence = chunk.transcript.language_confidence;
    }

    if (typeof chunk.transcript.text === "string") {
      fallbackTextParts.push(chunk.transcript.text);
    }

    const offsetMs = Math.round(chunk.startSeconds * 1000);
    const overlapMs = Math.round(chunk.overlapSeconds * 1000);
    const utterances = chunk.transcript.utterances ?? [];
    for (const u of utterances) {
      const trimmed = trimOverlap(u, overlapMs);
      if (!trimmed) continue;
      const start =
        typeof trimmed.start === "number" ? trimmed.start + offsetMs : trimmed.start;
      const end = typeof trimmed.end === "number" ? trimmed.end + offsetMs : trimmed.end;
      mergedUtterances.push({ ...trimmed, start, end });
    }
  }

  const mergedText =
    mergedUtterances.length > 0
      ? mergedUtterances.map((u) => u.text ?? "").join(" ").trim()
      : fallbackTextParts.join(" ").trim();

  return {
    id: `merged-${Date.now()}`,
    status: "completed",
    text: mergedText.length > 0 ? mergedText : undefined,
    utterances: mergedUtterances,
    language_code: languageCode,
    language_confidence: languageConfidence,
    provider,
  };
}
