import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseLanguageCodeFromMetadata,
  mapToAssemblyAiLanguageCode,
} from "../src/youtube/language.js";

test("mapToAssemblyAiLanguageCode maps common languages", () => {
  assert.equal(mapToAssemblyAiLanguageCode("en"), "en_us");
  assert.equal(mapToAssemblyAiLanguageCode("en-US"), "en_us");
  assert.equal(mapToAssemblyAiLanguageCode("es"), "es");
  assert.equal(mapToAssemblyAiLanguageCode("es-419"), "es");
  assert.equal(mapToAssemblyAiLanguageCode("zh-Hans"), "zh");
});

test("mapToAssemblyAiLanguageCode returns undefined for unsupported languages", () => {
  assert.equal(mapToAssemblyAiLanguageCode("ab"), undefined);
  assert.equal(mapToAssemblyAiLanguageCode("xyz"), undefined);
});

test("chooseLanguageCodeFromMetadata prefers language field over captions", () => {
  const selection = chooseLanguageCodeFromMetadata(
    {
      language: "es-US",
      automatic_captions: { ab: {}, zh: {}, en: {} },
      subtitles: { fr: {} },
    },
    "en_us"
  );
  assert.equal(selection.detected, true);
  assert.equal(selection.source, "language");
  assert.equal(selection.languageCode, "es");
});

test("chooseLanguageCodeFromMetadata prefers subtitles over automatic_captions", () => {
  const selection = chooseLanguageCodeFromMetadata(
    {
      automatic_captions: { ab: {}, zh: {}, en: {} },
      subtitles: { fr: {} },
    },
    "en_us"
  );
  assert.equal(selection.detected, true);
  assert.equal(selection.source, "subtitles");
  assert.equal(selection.languageCode, "fr");
});

test("chooseLanguageCodeFromMetadata falls back to subtitles", () => {
  const selection = chooseLanguageCodeFromMetadata(
    { subtitles: { fr: {} } },
    "en_us"
  );
  assert.equal(selection.detected, true);
  assert.equal(selection.source, "subtitles");
  assert.equal(selection.languageCode, "fr");
});

test("chooseLanguageCodeFromMetadata returns default when nothing available", () => {
  const selection = chooseLanguageCodeFromMetadata(undefined, "en_us");
  assert.equal(selection.detected, false);
  assert.equal(selection.languageCode, "en_us");
});

test("chooseLanguageCodeFromMetadata returns default when only unsupported languages", () => {
  const selection = chooseLanguageCodeFromMetadata(
    { automatic_captions: { ab: {}, xyz: {} } },
    "en_us"
  );
  assert.equal(selection.detected, false);
  assert.equal(selection.languageCode, "en_us");
});
