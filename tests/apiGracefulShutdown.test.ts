import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { RunManager } from "../src/api/runManager.js";
import { gracefulShutdown } from "../src/api/graceful.js";

async function listen(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
}

test("gracefulShutdown stops scheduler and cancels active runs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-shutdown-"));
  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });

  const manager = new RunManager(config, {
    maxBufferedEventsPerRun: 200,
    persistRuns: false,
    deps: {
      runPipeline: async (_url, _cfg, opts) =>
        new Promise<void>((resolve) => {
          if (opts.abortSignal?.aborted) return resolve();
          opts.abortSignal?.addEventListener("abort", () => resolve());
        }),
    },
  });
  await manager.init();

  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.end("ok");
  });
  await listen(server);

  const run = manager.createRun({ url: "https://example.com", force: false });
  manager.startRun(run.runId, { url: "https://example.com", force: false });

  let stopped = false;
  const scheduler = {
    stop: () => {
      stopped = true;
    },
  };

  const result = await gracefulShutdown({
    server,
    manager,
    scheduler,
    shutdownTimeoutMs: 2000,
  });

  assert.equal(result.timedOut, false);
  assert.equal(stopped, true);
  const updated = manager.getRun(run.runId);
  assert.equal(updated?.status, "cancelled");
});
