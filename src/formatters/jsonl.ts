import { TranscriptJson } from "../transcription/types.js";

function toSeconds(ms?: number): number | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return undefined;
  return ms / 1000;
}

export type TranscriptJsonlLine =
  | {
      type: "utterance";
      index: number;
      startSeconds?: number;
      endSeconds?: number;
      speaker?: string | number;
      text: string;
      videoId?: string;
      videoUrl?: string;
      title?: string;
      channelId?: string;
      channelTitle?: string;
      languageCode?: string;
      languageConfidence?: number;
    }
  | {
      type: "text";
      index: 1;
      text: string;
      videoId?: string;
      videoUrl?: string;
      title?: string;
      channelId?: string;
      channelTitle?: string;
      languageCode?: string;
      languageConfidence?: number;
    };

export function formatJsonl(
  transcript: TranscriptJson,
  meta?: {
    videoId?: string;
    url?: string;
    title?: string;
    channelId?: string;
    channelTitle?: string;
    languageCode?: string;
    languageConfidence?: number;
  }
): string {
  const lines: TranscriptJsonlLine[] = [];
  const utterances = transcript.utterances ?? [];

  if (utterances.length > 0) {
    utterances.forEach((u, idx) => {
      lines.push({
        type: "utterance",
        index: idx + 1,
        startSeconds: toSeconds(u.start),
        endSeconds: toSeconds(u.end),
        speaker: u.speaker,
        text: u.text ?? "",
        videoId: meta?.videoId,
        videoUrl: meta?.url,
        title: meta?.title,
        channelId: meta?.channelId,
        channelTitle: meta?.channelTitle,
        languageCode: meta?.languageCode,
        languageConfidence: meta?.languageConfidence,
      });
    });
  } else {
    lines.push({
      type: "text",
      index: 1,
      text: transcript.text ?? "",
      videoId: meta?.videoId,
      videoUrl: meta?.url,
      title: meta?.title,
      channelId: meta?.channelId,
      channelTitle: meta?.channelTitle,
      languageCode: meta?.languageCode,
      languageConfidence: meta?.languageConfidence,
    });
  }

  return lines.map((l) => JSON.stringify(l)).join("\n");
}

