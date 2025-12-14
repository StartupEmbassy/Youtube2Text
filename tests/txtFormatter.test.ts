import test from "node:test";
import assert from "node:assert/strict";
import { formatTxt } from "../src/formatters/txt.js";

test("formatTxt includes channel/title/description headers and timestamps", () => {
  const transcript = {
    id: "t1",
    status: "completed",
    utterances: [
      { speaker: "A", start: 0, end: 1500, text: "Hello world" },
      { speaker: "B", start: 2000, end: 3500, text: "Second line" },
    ],
  };

  const txt = formatTxt(transcript, {
    channelId: "UC123",
    channelTitle: "My Channel",
    title: "My Video",
    description: "This is a description.",
    url: "https://www.youtube.com/watch?v=abc",
    uploadDate: "20250101",
  });

  assert.match(txt, /^Channel: My Channel/m);
  assert.match(txt, /^Channel ID: UC123/m);
  assert.match(txt, /^Title: My Video/m);
  assert.match(txt, /^Description: This is a description\./m);
  assert.match(txt, /^\[00:00:00 - 00:00:01 Speaker A\] Hello world/m);
  assert.match(txt, /^\[00:00:02 - 00:00:03 Speaker B\] Second line/m);
});

test("formatTxt includes language from yt-dlp", () => {
  const transcript = { id: "t1", status: "completed", utterances: [] };
  const txt = formatTxt(transcript, {
    title: "Video",
    url: "https://example.com",
    languageCode: "es",
    languageSource: "yt-dlp",
  });
  assert.match(txt, /^Language: es \(yt-dlp\)/m);
});

test("formatTxt includes language from auto-detection with confidence", () => {
  const transcript = { id: "t1", status: "completed", utterances: [] };
  const txt = formatTxt(transcript, {
    title: "Video",
    url: "https://example.com",
    languageCode: "zh",
    languageSource: "auto-detected",
    languageConfidence: 0.9672,
  });
  assert.match(txt, /^Language: zh \(auto-detected, 97% confidence\)/m);
});

