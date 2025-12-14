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

function formatHeaderBlock(
  label: string,
  text: string | undefined,
  wrapWidth: number
): string[] {
  if (!text) return [];
  const wrapped = wrapText(text, wrapWidth);
  if (wrapped.length === 0) return [];
  const lines: string[] = [];
  lines.push(`${label}: ${wrapped[0]}`);
  for (const line of wrapped.slice(1)) {
    lines.push(`  ${line}`);
  }
  return lines;
}

export function formatTxt(
  transcript: TranscriptJson,
  meta: {
    title: string;
    url: string;
    uploadDate?: string;
    channelId?: string;
    channelTitle?: string;
    description?: string;
    languageCode?: string;
    languageSource?: "yt-dlp" | "auto-detected";
    languageConfidence?: number;
  },
  options?: { timestamps?: boolean; wrapWidth?: number }
): string {
  const timestamps = options?.timestamps ?? true;
  const wrapWidth = options?.wrapWidth ?? 100;

  let languageLine: string | undefined;
  if (meta.languageCode) {
    if (meta.languageSource === "auto-detected" && meta.languageConfidence !== undefined) {
      const pct = Math.round(meta.languageConfidence * 100);
      languageLine = `Language: ${meta.languageCode} (auto-detected, ${pct}% confidence)`;
    } else if (meta.languageSource) {
      languageLine = `Language: ${meta.languageCode} (${meta.languageSource})`;
    } else {
      languageLine = `Language: ${meta.languageCode}`;
    }
  }

  const headerLines = [
    meta.channelTitle || meta.channelId
      ? `Channel: ${meta.channelTitle ?? meta.channelId}`
      : undefined,
    meta.channelId ? `Channel ID: ${meta.channelId}` : undefined,
    ...formatHeaderBlock("Title", meta.title, wrapWidth),
    ...formatHeaderBlock("Description", meta.description, wrapWidth),
    `URL: ${meta.url}`,
    meta.uploadDate ? `Date: ${meta.uploadDate}` : undefined,
    languageLine,
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
