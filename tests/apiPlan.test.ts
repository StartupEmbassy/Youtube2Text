import test from "node:test";
import assert from "node:assert/strict";
import { planFromListing } from "../src/pipeline/plan.js";

test("planFromListing counts processed vs remaining (force=false)", async () => {
  const plan = await planFromListing(
    "https://example.com/channel",
    {
      channelId: "C1",
      channelTitle: "Channel",
      videos: [
        { id: "a", title: "A", url: "u1", uploadDate: "20240101" },
        { id: "b", title: "B", url: "u2", uploadDate: "20240102" },
        { id: "c", title: "C", url: "u3", uploadDate: "20240103" },
      ],
    },
    {
      assemblyAiApiKey: "test",
      outputDir: "output",
      audioDir: "audio",
      filenameStyle: "title_id",
      audioFormat: "mp3",
      languageDetection: "auto",
      languageCode: "en_us",
      concurrency: 1,
      csvEnabled: false,
      assemblyAiCreditsCheck: "none",
      assemblyAiMinBalanceMinutes: 60,
      commentsEnabled: false,
      pollIntervalMs: 5000,
      maxPollMinutes: 60,
      downloadRetries: 0,
      transcriptionRetries: 0,
      ytDlpExtraArgs: [],
    },
    { force: false },
    { isProcessed: async (jsonPath) => jsonPath.includes("__b.json") }
  );

  assert.equal(plan.totalVideos, 3);
  assert.equal(plan.alreadyProcessed, 1);
  assert.equal(plan.toProcess, 2);
  assert.equal(plan.videos.find((v) => v.id === "b")?.processed, true);
});

test("planFromListing treats everything as unprocessed when force=true", async () => {
  const plan = await planFromListing(
    "https://example.com/channel",
    {
      channelId: "C1",
      channelTitle: "Channel",
      videos: [{ id: "a", title: "A", url: "u1", uploadDate: "20240101" }],
    },
    {
      assemblyAiApiKey: "test",
      outputDir: "output",
      audioDir: "audio",
      filenameStyle: "title_id",
      audioFormat: "mp3",
      languageDetection: "auto",
      languageCode: "en_us",
      concurrency: 1,
      csvEnabled: false,
      assemblyAiCreditsCheck: "none",
      assemblyAiMinBalanceMinutes: 60,
      commentsEnabled: false,
      pollIntervalMs: 5000,
      maxPollMinutes: 60,
      downloadRetries: 0,
      transcriptionRetries: 0,
      ytDlpExtraArgs: [],
    },
    { force: true },
    { isProcessed: async () => true }
  );

  assert.equal(plan.totalVideos, 1);
  assert.equal(plan.alreadyProcessed, 0);
  assert.equal(plan.toProcess, 1);
  assert.equal(plan.videos[0]?.processed, false);
});
