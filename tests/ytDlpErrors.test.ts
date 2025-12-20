import test from "node:test";
import assert from "node:assert/strict";
import { parseYtDlpFailure } from "../src/youtube/ytDlpErrors.js";

test("parseYtDlpFailure classifies members-only videos as non-retryable access errors", () => {
  const info = parseYtDlpFailure({
    stderr:
      "ERROR: [youtube] abc123: Join this channel to get access to members-only content like this video, and other exclusive perks.",
  });
  assert.ok(info);
  assert.equal(info.kind, "access");
  assert.equal(info.reason, "members_only");
  assert.equal(info.retryable, false);
});

test("parseYtDlpFailure classifies EJS warning-only output (no hint)", () => {
  const info = parseYtDlpFailure({
    stderr:
      "WARNING: [youtube] No supported JavaScript runtime could be found. YouTube extraction without a JS runtime has been deprecated.",
  });
  assert.ok(info);
  assert.equal(info.kind, "unknown");
  assert.equal(info.reason, "unknown");
  assert.equal(info.hint, undefined);
});

test("parseYtDlpFailure classifies 429 as retryable transient", () => {
  const info = parseYtDlpFailure({
    stderr: "ERROR: HTTP Error 429: Too Many Requests",
  });
  assert.ok(info);
  assert.equal(info.kind, "transient");
  assert.equal(info.reason, "rate_limited");
  assert.equal(info.retryable, true);
});
