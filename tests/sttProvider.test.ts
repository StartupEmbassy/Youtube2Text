import assert from "node:assert/strict";
import { test } from "node:test";
import { configSchema } from "../src/config/schema.js";

test("sttProvider=openai_whisper requires OpenAI key", () => {
  assert.throws(() => {
    configSchema.parse({
      sttProvider: "openai_whisper",
    });
  });
});

test("sttProvider=openai_whisper accepts OpenAI key", () => {
  const config = configSchema.parse({
    sttProvider: "openai_whisper",
    openaiApiKey: "test",
  });
  assert.equal(config.sttProvider, "openai_whisper");
  assert.equal(config.openaiWhisperModel, "whisper-1");
});
