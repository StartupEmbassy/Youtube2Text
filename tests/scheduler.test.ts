import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { RunManager } from "../src/api/runManager.js";
import { WatchlistStore } from "../src/api/watchlist.js";
import { Scheduler } from "../src/api/scheduler.js";
import type { RunPlan } from "../src/pipeline/plan.js";

test("Scheduler trigger creates runs only when plan.toProcess > 0 and respects maxConcurrentRuns", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-scheduler-"));
  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });

  const manager = new RunManager(config, { maxBufferedEventsPerRun: 10, persistRuns: false });
  await manager.init();

  const store = new WatchlistStore(dir);
  const e1 = await store.add({ channelUrl: "https://www.youtube.com/@a" });
  const e2 = await store.add({ channelUrl: "https://www.youtube.com/@b" });

  const planFn = async (url: string): Promise<RunPlan> => ({
    inputUrl: url,
    force: false,
    channelId: "UC123",
    channelTitle: "Chan",
    totalVideos: 1,
    alreadyProcessed: 0,
    toProcess: 1,
    filters: {},
    videos: [{ id: "v", title: "t", url: "u", basename: "b", processed: false }],
  });

  const scheduler = new Scheduler(
    { enabled: false, intervalMinutes: 60, maxConcurrentRuns: 1 },
    manager,
    store,
    planFn,
    (req) => manager.createRun(req),
    () => {
      // no-op: do not start pipeline in unit tests
    }
  );

  const res = await scheduler.triggerOnce();
  assert.equal(res.runsCreated, 1);
  assert.equal(res.checked, 2);

  const after = await store.list();
  const a = after.find((x) => x.id === e1.id)!;
  const b = after.find((x) => x.id === e2.id)!;
  assert.ok(a.lastCheckedAt);
  assert.ok(b.lastCheckedAt);
  assert.ok(a.lastRunId || b.lastRunId);
  assert.ok(!(a.lastRunId && b.lastRunId));

  const runs = manager.listRuns();
  assert.equal(runs.length, 1);
});

test("Scheduler trigger does not create run when plan.toProcess == 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-scheduler-0-"));
  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });

  const manager = new RunManager(config, { maxBufferedEventsPerRun: 10, persistRuns: false });
  await manager.init();

  const store = new WatchlistStore(dir);
  await store.add({ channelUrl: "https://www.youtube.com/@a" });

  const planFn = async (url: string): Promise<RunPlan> => ({
    inputUrl: url,
    force: false,
    channelId: "UC123",
    channelTitle: "Chan",
    totalVideos: 1,
    alreadyProcessed: 1,
    toProcess: 0,
    filters: {},
    videos: [{ id: "v", title: "t", url: "u", basename: "b", processed: true }],
  });

  const scheduler = new Scheduler(
    { enabled: false, intervalMinutes: 60, maxConcurrentRuns: 1 },
    manager,
    store,
    planFn,
    (req) => manager.createRun(req),
    () => {}
  );

  const res = await scheduler.triggerOnce();
  assert.equal(res.runsCreated, 0);
  assert.equal(manager.listRuns().length, 0);
});

