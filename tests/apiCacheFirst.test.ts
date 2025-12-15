import test from "node:test";
import assert from "node:assert/strict";
import { RunManager } from "../src/api/runManager.js";
import type { RunPlan } from "../src/pipeline/plan.js";

function baseConfig() {
  return {
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
  } as const;
}

test("RunManager.createCachedRun creates a done run with channelDirName and preview fields", async () => {
  const manager = new RunManager(baseConfig() as any, {
    maxBufferedEventsPerRun: 10,
    persistRuns: false,
  });
  await manager.init();

  const plan: RunPlan = {
    inputUrl: "https://www.youtube.com/watch?v=abc",
    force: false,
    channelId: "UC123",
    channelTitle: "My Channel",
    totalVideos: 1,
    alreadyProcessed: 1,
    toProcess: 0,
    filters: {},
    videos: [
      {
        id: "abc",
        title: "Title",
        url: "https://www.youtube.com/watch?v=abc",
        basename: "title__abc",
        processed: true,
      },
    ],
  };

  const record = manager.createCachedRun({ url: plan.inputUrl, force: false }, plan);
  assert.equal(record.status, "done");
  assert.ok(record.startedAt);
  assert.ok(record.finishedAt);
  assert.equal(record.channelId, "UC123");
  assert.ok(record.channelDirName?.includes("UC123"));
  assert.equal(record.previewVideoId, "abc");
  assert.equal(record.previewTitle, "Title");
  assert.deepEqual(record.stats, { succeeded: 0, failed: 0, skipped: 1, total: 1 });
});

