import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { startApiServer } from "../src/api/server.js";
import { createRunPersistence, writeRunRecord, appendEvent } from "../src/api/persistence.js";

async function listenServer(server: any): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve) => server.once("listening", resolve));
}

test("GET /runs/:id/logs returns tail events as JSON", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-logs-"));
  const persistDir = join(dir, "_runs");

  const runId = "00000000-0000-0000-0000-000000000000";
  const p = createRunPersistence(persistDir);
  await writeRunRecord(p, {
    runId,
    status: "queued",
    inputUrl: "https://example.com",
    force: false,
    createdAt: new Date().toISOString(),
  } as any);
  await appendEvent(p, runId, {
    id: 1,
    event: {
      type: "run:start",
      inputUrl: "https://example.com",
      channelId: "UC123",
      channelTitle: "Chan",
      totalVideos: 1,
      alreadyProcessed: 0,
      remaining: 1,
      timestamp: "t1",
    },
  });
  await appendEvent(p, runId, {
    id: 2,
    event: { type: "run:done", channelId: "UC123", total: 1, succeeded: 1, failed: 0, skipped: 0, timestamp: "t2" },
  });

  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });
  const { server } = await startApiServer(config, {
    host: "127.0.0.1",
    port: 0,
    maxBufferedEventsPerRun: 50,
    persistRuns: true,
    persistDir,
  });
  await listenServer(server);
  const port = (server.address() as any).port as number;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/runs/${runId}/logs?tail=10`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.run.runId, runId);
    assert.equal(body.events.length, 2);
    assert.equal(body.events[0].id, 1);
    assert.equal(body.events[0].event.type, "run:start");
    assert.equal(body.events[1].id, 2);
    assert.equal(body.events[1].event.type, "run:done");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

