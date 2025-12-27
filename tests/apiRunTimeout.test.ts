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

test("RunManager marks run as error when timeout elapses", async () => {
  const manager = new RunManager(baseConfig(), {
    maxBufferedEventsPerRun: 10,
    persistRuns: false,
    runTimeoutMs: 20,
    deps: {
      runPipeline: async (_url, _cfg, opts) =>
        new Promise<void>((resolve) => {
          if (opts?.abortSignal) {
            opts.abortSignal.addEventListener("abort", () => resolve(), { once: true });
          }
        }),
    },
  });

  const run = manager.createRun({ url: "https://www.youtube.com/watch?v=abc" });
  manager.startRun(run.runId, { url: run.inputUrl });

  await new Promise((resolve) => setTimeout(resolve, 60));
  const updated = manager.getRun(run.runId);
  assert.equal(updated?.status, "error");
  assert.match(String(updated?.error ?? ""), /timeout/i);
});
