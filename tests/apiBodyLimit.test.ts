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

test("POST /runs/plan rejects oversized JSON body with 413", async () => {
  await withEnv("Y2T_MAX_BODY_BYTES", "200", async () => {
    const dir = mkdtempSync(join(tmpdir(), "y2t-body-"));
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
      deps: { planRun: async () => ({}) as any },
    });
    await listenServer(server);
    const port = (server.address() as any).port as number;

    try {
      const payload = {
        url: "https://www.youtube.com/watch?v=abc",
        config: { padding: "x".repeat(2000) },
      };
      const res = await fetch(`http://127.0.0.1:${port}/runs/plan`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 413);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
