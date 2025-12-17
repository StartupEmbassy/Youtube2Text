import test from "node:test";
import assert from "node:assert";
import { normalizeChannelUrlForEnumeration, classifyYoutubeUrl } from "../src/youtube/url.js";

test("normalizeChannelUrlForEnumeration adds /videos to channel URLs", () => {
  // Channel URLs should get /videos appended
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/channel/UCxxxxxx"),
    "https://www.youtube.com/channel/UCxxxxxx/videos"
  );
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/@SomeHandle"),
    "https://www.youtube.com/@SomeHandle/videos"
  );
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/c/SomeChannel"),
    "https://www.youtube.com/c/SomeChannel/videos"
  );
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/user/SomeUser"),
    "https://www.youtube.com/user/SomeUser/videos"
  );
});

test("normalizeChannelUrlForEnumeration preserves /videos if already present", () => {
  // URLs that already have /videos should not be modified
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/@SomeHandle/videos"),
    "https://www.youtube.com/@SomeHandle/videos"
  );
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/channel/UCxxxxxx/videos"),
    "https://www.youtube.com/channel/UCxxxxxx/videos"
  );
});

test("normalizeChannelUrlForEnumeration does not modify non-channel URLs", () => {
  // Video URLs should be unchanged
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://youtu.be/dQw4w9WgXcQ"),
    "https://youtu.be/dQw4w9WgXcQ"
  );

  // Playlist URLs should be unchanged
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/playlist?list=PLxxxxxx"),
    "https://www.youtube.com/playlist?list=PLxxxxxx"
  );

  // Shorts URLs should be unchanged
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/shorts/abc123"),
    "https://www.youtube.com/shorts/abc123"
  );
});

test("normalizeChannelUrlForEnumeration handles trailing slashes", () => {
  // Trailing slashes should be handled correctly
  assert.strictEqual(
    normalizeChannelUrlForEnumeration("https://www.youtube.com/@SomeHandle/"),
    "https://www.youtube.com/@SomeHandle/videos"
  );
});
