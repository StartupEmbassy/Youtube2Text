import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeChunkTranscripts } from "../src/transcription/merge.js";

test("mergeChunkTranscripts trims overlap and offsets timestamps", () => {
  const merged = mergeChunkTranscripts([
    {
      startSeconds: 0,
      overlapSeconds: 0,
      transcript: {
        id: "t1",
        status: "completed",
        utterances: [
          { start: 0, end: 2000, text: "hello" },
        ],
      },
    },
    {
      startSeconds: 8,
      overlapSeconds: 2,
      transcript: {
        id: "t2",
        status: "completed",
        utterances: [
          { start: 0, end: 1500, text: "hello" },
          { start: 1500, end: 4000, text: "world" },
        ],
      },
    },
  ]);

  assert.equal(merged.utterances?.length, 2);
  assert.equal(merged.utterances?.[0]?.start, 0);
  assert.equal(merged.utterances?.[1]?.start, 10000);
  assert.equal(merged.utterances?.[1]?.end, 12000);
});
