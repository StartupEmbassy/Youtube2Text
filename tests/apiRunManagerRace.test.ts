import test from "node:test";
import assert from "node:assert/strict";
import { configSchema } from "../src/config/schema.js";
import { RunManager } from "../src/api/runManager.js";

function baseConfig() {
  return configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: "output",
    audioDir: "audio",
  });
}

test("RunManager tolerates concurrent listEventsAfter during pipeline events", async () => {
  const manager = new RunManager(baseConfig(), {
    maxBufferedEventsPerRun: 200,
    persistRuns: false,
    deps: {
      runPipeline: async (_url, _cfg, opts) => {
        const emitter = opts.emitter!;
        emitter.emit({
          type: "run:start",
          inputUrl: _url,
          channelId: "C1",
          channelTitle: "Chan",
          totalVideos: 10,
          alreadyProcessed: 0,
          remaining: 10,
          timestamp: new Date().toISOString(),
        });
        for (let i = 0; i < 20; i += 1) {
          await Promise.resolve();
          emitter.emit({
            type: "video:stage",
            videoId: `v${i}`,
            stage: "download",
            index: i + 1,
            total: 20,
            timestamp: new Date().toISOString(),
          });
        }
        emitter.emit({
          type: "run:done",
          channelId: "C1",
          total: 20,
          succeeded: 20,
          failed: 0,
          skipped: 0,
          timestamp: new Date().toISOString(),
        });
      },
    },
  });
  await manager.init();

  const run = manager.createRun({ url: "https://example.com", force: false });
  manager.startRun(run.runId, { url: "https://example.com", force: false });

  const listTasks = Array.from({ length: 50 }, () =>
    Promise.resolve().then(() => manager.listEventsAfter(run.runId, 0))
  );

  const idle = await manager.waitForIdle(5000);
  await Promise.all(listTasks);
  assert.equal(idle, true);

  const ids = manager.listEventsAfter(run.runId, 0).map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
  for (let i = 1; i < ids.length; i += 1) {
    assert.ok(ids[i]! > ids[i - 1]!);
  }
});

test("RunManager handles concurrent global events and listGlobalEventsAfter", async () => {
  const manager = new RunManager(baseConfig(), {
    maxBufferedEventsPerRun: 200,
    persistRuns: false,
  });
  await manager.init();

  const createTasks = Array.from({ length: 40 }, (_v, i) =>
    Promise.resolve().then(() =>
      manager.createRun({ url: `https://example.com/${i}`, force: false })
    )
  );
  const listTasks = Array.from({ length: 20 }, () =>
    Promise.resolve().then(() => manager.listGlobalEventsAfter(0))
  );

  await Promise.all([...createTasks, ...listTasks]);

  const ids = manager.listGlobalEventsAfter(0).map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
  for (let i = 1; i < ids.length; i += 1) {
    assert.ok(ids[i]! > ids[i - 1]!);
  }
  assert.equal(ids.length, 40);
});
