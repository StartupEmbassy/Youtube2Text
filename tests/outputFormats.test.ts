import test from "node:test";
import assert from "node:assert/strict";
import { formatMd } from "../src/formatters/md.js";
import { formatJsonl } from "../src/formatters/jsonl.js";

test("formatMd includes headings and timestamps", () => {
  const transcript = {
    id: "t1",
    status: "completed",
    utterances: [
      { speaker: "A", start: 0, end: 1500, text: "Hello world" },
      { speaker: "B", start: 2000, end: 3500, text: "Second line" },
    ],
  };

  const md = formatMd(transcript, {
    channelId: "UC123",
    channelTitle: "My Channel",
    title: "My Video",
    description: "This is a description.",
    url: "https://www.youtube.com/watch?v=abc",
    uploadDate: "20250101",
    languageCode: "es",
    languageSource: "yt-dlp",
  });

  assert.match(md, /^# My Video/m);
  assert.match(md, /^## Description/m);
  assert.match(md, /^## Transcript/m);
  assert.match(md, /^### \[00:00:00 - 00:00:01\] Speaker A/m);
  assert.match(md, /^### \[00:00:02 - 00:00:03\] Speaker B/m);
});

test("formatJsonl emits one JSON object per line", () => {
  const transcript = {
    id: "t1",
    status: "completed",
    utterances: [
      { speaker: "A", start: 0, end: 1500, text: "Hello world" },
      { speaker: "B", start: 2000, end: 3500, text: "Second line" },
    ],
  };

  const out = formatJsonl(transcript, {
    videoId: "abc",
    url: "https://www.youtube.com/watch?v=abc",
    title: "My Video",
    channelId: "UC123",
    channelTitle: "My Channel",
    languageCode: "es",
    languageConfidence: 0.9,
  });

  const lines = out.split("\n");
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]!) as any;
  assert.equal(first.type, "utterance");
  assert.equal(first.index, 1);
  assert.equal(first.speaker, "A");
  assert.equal(first.text, "Hello world");
  assert.equal(first.videoId, "abc");
  assert.equal(first.channelId, "UC123");
  assert.equal(first.languageCode, "es");
  assert.equal(first.startSeconds, 0);
  assert.equal(first.endSeconds, 1.5);
});

test("formatJsonl falls back to transcript.text when utterances missing", () => {
  const transcript = { id: "t1", status: "completed", text: "Hello" };
  const out = formatJsonl(transcript, { videoId: "abc" });
  const lines = out.split("\n");
  assert.equal(lines.length, 1);
  const obj = JSON.parse(lines[0]!) as any;
  assert.equal(obj.type, "text");
  assert.equal(obj.text, "Hello");
  assert.equal(obj.videoId, "abc");
});

