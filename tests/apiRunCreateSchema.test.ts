import test from "node:test";
import assert from "node:assert/strict";
import { runCreateSchema } from "../src/api/schemas.js";

test("runCreateSchema requires url or audioId (not both)", () => {
  const okUrl = runCreateSchema.safeParse({ url: "https://example.com" });
  assert.equal(okUrl.success, true);

  const okAudio = runCreateSchema.safeParse({ audioId: "audio-123" });
  assert.equal(okAudio.success, true);

  const missing = runCreateSchema.safeParse({ force: false });
  assert.equal(missing.success, false);

  const both = runCreateSchema.safeParse({ url: "https://example.com", audioId: "audio-123" });
  assert.equal(both.success, false);
});
