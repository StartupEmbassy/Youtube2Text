import test from "node:test";
import assert from "node:assert/strict";
import {
  makeChannelDirName,
  parseChannelDirName,
  makeVideoBaseName,
  parseVideoIdFromBaseName,
} from "../src/storage/naming.js";

test("channel dir naming roundtrip keeps channelId", () => {
  const dir = makeChannelDirName("UC123", "My Great Channel");
  assert.match(dir, /^My-Great-Channel__UC123$/);

  const parsed = parseChannelDirName(dir);
  assert.equal(parsed.channelId, "UC123");
  assert.equal(parsed.channelTitleSlug, "My-Great-Channel");
});

test("video basename includes id for id_title/title_id", () => {
  const videoId = "7j_NE6Pjv-E";
  const idTitle = makeVideoBaseName(videoId, "Hello World", "id_title");
  assert.equal(idTitle, `${videoId}__Hello-World`);

  const titleId = makeVideoBaseName(videoId, "Hello World", "title_id");
  assert.equal(titleId, `Hello-World__${videoId}`);
  assert.equal(parseVideoIdFromBaseName(titleId), videoId);
});

test("video basename for style id is just id", () => {
  const videoId = "7j_NE6Pjv-E";
  const base = makeVideoBaseName(videoId, "Ignored", "id");
  assert.equal(base, videoId);
  assert.equal(parseVideoIdFromBaseName(base), videoId);
});
