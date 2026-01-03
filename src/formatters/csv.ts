import { TranscriptJson } from "../transcription/types.js";

function neutralizeFormula(value: string): string {
  if (!value) return value;
  if (/^[\t\r\n ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsv(value: string) {
  const safe = neutralizeFormula(value);
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function formatCsv(transcript: TranscriptJson): string {
  const utterances = transcript.utterances ?? [];
  const lines = [
    "speaker,start_ms,end_ms,text",
    ...utterances.map((u) =>
      [
        u.speaker ?? "",
        u.start ?? "",
        u.end ?? "",
        u.text ?? "",
      ]
        .map((value) => escapeCsv(String(value)))
        .join(",")
    ),
  ];
  return lines.join("\n");
}
