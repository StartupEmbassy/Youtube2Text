import test from "node:test";
import assert from "node:assert/strict";
import { extractChannelThumbnailUrl } from "../src/youtube/channel.js";

test("extractChannelThumbnailUrl prefers yt3 channel images from thumbnails", () => {
  const url = extractChannelThumbnailUrl({
    thumbnails: [
      { url: "https://i.ytimg.com/vi/abc/mqdefault.jpg", width: 320, height: 180 },
      { url: "https://yt3.googleusercontent.com/some-avatar=s88-c-k-c0x00ffffff-no-rj", width: 88, height: 88 },
      { url: "https://yt3.googleusercontent.com/some-banner=w1060-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj", width: 1060, height: 596 },
    ],
  });
  assert.ok(url?.includes("yt3.googleusercontent.com"));
});

test("extractChannelThumbnailUrl ignores video thumbnail field when not a channel image", () => {
  const url = extractChannelThumbnailUrl({
    thumbnail: "https://i.ytimg.com/vi_webp/abc/maxresdefault.webp",
    thumbnails: [],
  });
  assert.equal(url, undefined);
});

