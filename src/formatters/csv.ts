import { TranscriptJson } from "../transcription/types.js";

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""');
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
        escapeCsv(u.text ?? ""),
      ].join(",")
    ),
  ];
  return lines.join("\n");
}

