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
    { buildProcessedVideoIdSet: async () => new Set(["b"]) }
  );

  assert.equal(plan.totalVideos, 3);
  assert.equal(plan.alreadyProcessed, 1);
  assert.equal(plan.unprocessed, 2);
  assert.equal(plan.toProcess, 2);
  assert.equal(plan.videos.find((v) => v.id === "b")?.processed, true);
  assert.deepEqual(
    plan.selectedVideos.map((v) => v.id),
    ["a", "c"]
  );
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
    { buildProcessedVideoIdSet: async () => new Set(["a"]) }
  );

  assert.equal(plan.totalVideos, 1);
  assert.equal(plan.alreadyProcessed, 0);
  assert.equal(plan.unprocessed, 1);
  assert.equal(plan.toProcess, 1);
  assert.equal(plan.videos[0]?.processed, false);
  assert.equal(plan.selectedVideos[0]?.id, "a");
});

test("planFromListing maxNewVideos applies after skipping already processed", async () => {
  const plan = await planFromListing(
    "https://example.com/channel",
    {
      channelId: "C1",
      channelTitle: "Channel",
      videos: [
        { id: "a", title: "A", url: "u1", uploadDate: "20240101" },
        { id: "b", title: "B", url: "u2", uploadDate: "20240102" },
        { id: "c", title: "C", url: "u3", uploadDate: "20240103" },
        { id: "d", title: "D", url: "u4", uploadDate: "20240104" },
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
      maxNewVideos: 2,
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
    {
      buildProcessedVideoIdSet: async () => new Set(["a", "b"]),
    }
  );

  assert.equal(plan.totalVideos, 4);
  assert.equal(plan.alreadyProcessed, 2);
  assert.equal(plan.unprocessed, 2);
  assert.equal(plan.toProcess, 2);
  assert.deepEqual(
    plan.selectedVideos.map((v) => v.id),
    ["c", "d"]
  );
});
