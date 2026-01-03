import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { startApiServer } from "../src/api/server.js";

async function listenServer(server: any): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve) => server.once("listening", resolve));
}

function withEnv(name: string, value: string | undefined, fn: () => Promise<void> | void) {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) delete process.env[name];
      else process.env[name] = prev;
    });
}

test("SSE limit rejects extra clients", async () => {
  await withEnv("Y2T_SSE_MAX_CLIENTS", "1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "y2t-sse-limit-"));
    const config = configSchema.parse({
      assemblyAiApiKey: "test",
      outputDir: dir,
      audioDir: join(dir, "audio"),
    });

    const { server } = await startApiServer(config, {
      host: "127.0.0.1",
      port: 0,
      maxBufferedEventsPerRun: 10,
      persistRuns: false,
    });
    await listenServer(server);
    const port = (server.address() as any).port as number;

    const controller = new AbortController();
    let res1: Response | undefined;
    try {
      res1 = await fetch(`http://127.0.0.1:${port}/events`, {
        headers: { accept: "text/event-stream", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
        signal: controller.signal,
      });
      assert.equal(res1.status, 200);

      const res2 = await fetch(`http://127.0.0.1:${port}/events`, {
        headers: { accept: "text/event-stream", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
      });
      assert.equal(res2.status, 429);
    } finally {
      controller.abort();
      if (res1?.body) {
        try {
          await res1.body.cancel();
        } catch {
          // Ignore stream cancellation errors during shutdown.
        }
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
