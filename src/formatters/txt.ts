import { TranscriptJson } from "../transcription/types.js";

export function formatTxt(
  transcript: TranscriptJson,
  meta: { title: string; url: string; uploadDate?: string }
): string {
  const headerLines = [
    `Title: ${meta.title}`,
    `URL: ${meta.url}`,
    meta.uploadDate ? `Date: ${meta.uploadDate}` : undefined,
    "---",
  ].filter(Boolean) as string[];

  const utterances = transcript.utterances ?? [];
  const bodyLines = utterances.map((u) => {
    const speakerLabel =
      u.speaker === undefined ? "Speaker" : `Speaker ${u.speaker}`;
    return `[${speakerLabel}] ${u.text ?? ""}`.trim();
  });

  return [...headerLines, ...bodyLines].join("\n");
}

