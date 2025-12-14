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

function renderParagraph(text: string, width: number): string {
  return wrapText(text, width).join("\n");
}

function renderMetaList(meta: {
  url: string;
  uploadDate?: string;
  channelId?: string;
  channelTitle?: string;
  languageCode?: string;
  languageSource?: "yt-dlp" | "auto-detected";
  languageConfidence?: number;
}): string[] {
  const items: string[] = [];
  if (meta.channelTitle || meta.channelId) {
    const channel = meta.channelTitle ? `${meta.channelTitle}` : `${meta.channelId}`;
    items.push(`- Channel: ${channel}`);
  }
  if (meta.channelId) items.push(`- Channel ID: ${meta.channelId}`);
  items.push(`- URL: ${meta.url}`);
  if (meta.uploadDate) items.push(`- Date: ${meta.uploadDate}`);

  if (meta.languageCode) {
    if (
      meta.languageSource === "auto-detected" &&
      meta.languageConfidence !== undefined
    ) {
      const pct = Math.round(meta.languageConfidence * 100);
      items.push(
        `- Language: ${meta.languageCode} (auto-detected, ${pct}% confidence)`
      );
    } else if (meta.languageSource) {
      items.push(`- Language: ${meta.languageCode} (${meta.languageSource})`);
    } else {
      items.push(`- Language: ${meta.languageCode}`);
    }
  }

  return items;
}

export function formatMd(
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

  const lines: string[] = [];
  lines.push(`# ${meta.title}`);
  lines.push("");
  lines.push(...renderMetaList(meta));

  if (meta.description) {
    lines.push("");
    lines.push("## Description");
    lines.push("");
    lines.push(renderParagraph(meta.description, wrapWidth));
  }

  lines.push("");
  lines.push("## Transcript");
  lines.push("");

  const utterances = transcript.utterances ?? [];
  for (const u of utterances) {
    const speakerLabel =
      u.speaker === undefined ? "Speaker" : `Speaker ${u.speaker}`;
    const startTs = formatTimestamp(u.start);
    const endTs = formatTimestamp(u.end);
    const timeLabel =
      timestamps && (startTs || endTs)
        ? `${startTs ?? "??:??:??"} - ${endTs ?? "??:??:??"}`
        : "";
    const heading = timeLabel
      ? `### [${timeLabel}] ${speakerLabel}`
      : `### ${speakerLabel}`;
    lines.push(heading);
    lines.push("");
    lines.push(renderParagraph(u.text ?? "", wrapWidth));
    lines.push("");
  }

  if (utterances.length === 0) {
    lines.push(renderParagraph(transcript.text ?? "", wrapWidth));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

