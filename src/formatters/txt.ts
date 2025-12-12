import { TranscriptJson } from "../transcription/types.js";

function formatTimestamp(ms?: number): string | undefined {
  if (ms === undefined) return undefined;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function wrapText(text: string, width: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

export function formatTxt(
  transcript: TranscriptJson,
  meta: { title: string; url: string; uploadDate?: string },
  options?: { timestamps?: boolean; wrapWidth?: number }
): string {
  const timestamps = options?.timestamps ?? true;
  const wrapWidth = options?.wrapWidth ?? 100;

  const headerLines = [
    `Title: ${meta.title}`,
    `URL: ${meta.url}`,
    meta.uploadDate ? `Date: ${meta.uploadDate}` : undefined,
    "---",
  ].filter(Boolean) as string[];

  const utterances = transcript.utterances ?? [];
  const bodyLines: string[] = [];

  for (const u of utterances) {
    const speakerLabel =
      u.speaker === undefined ? "Speaker" : `Speaker ${u.speaker}`;
    const startTs = formatTimestamp(u.start);
    const endTs = formatTimestamp(u.end);
    const timeLabel =
      timestamps && (startTs || endTs)
        ? `${startTs ?? "??:??:??"} - ${endTs ?? "??:??:??"} `
        : "";

    const prefix = `[${timeLabel}${speakerLabel}] `;
    const wrapped = wrapText(u.text ?? "", wrapWidth);
    if (wrapped.length === 0) {
      bodyLines.push(prefix.trimEnd());
      continue;
    }

    bodyLines.push(prefix + wrapped[0]);
    for (const line of wrapped.slice(1)) {
      bodyLines.push(" ".repeat(prefix.length) + line);
    }
  }

  return [...headerLines, ...bodyLines].join("\n");
}
