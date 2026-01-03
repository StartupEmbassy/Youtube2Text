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

test("GET /library/channels rejects path-traversal channelDirName", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-lib-sec-"));
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

  try {
    const res = await fetch(`http://127.0.0.1:${port}/library/channels/..%2F..` , {
      headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

