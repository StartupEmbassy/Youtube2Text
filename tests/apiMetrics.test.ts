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

test("API server refuses to start without Y2T_API_KEY (secure by default)", async () => {
  const prevKey = process.env.Y2T_API_KEY;
  const prevAllow = process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
  delete process.env.Y2T_API_KEY;
  delete process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;

  try {
    const dir = mkdtempSync(join(tmpdir(), "y2t-metrics-noauth-"));
    const config = configSchema.parse({
      assemblyAiApiKey: "test",
      outputDir: dir,
      audioDir: join(dir, "audio"),
    });

    await assert.rejects(
      () =>
        startApiServer(config, {
          host: "127.0.0.1",
          port: 0,
          maxBufferedEventsPerRun: 10,
          persistRuns: true,
          persistDir: join(dir, "_runs"),
        }),
      /Y2T_API_KEY is required/i
    );
  } finally {
    if (prevKey === undefined) delete process.env.Y2T_API_KEY;
    else process.env.Y2T_API_KEY = prevKey;
    if (prevAllow === undefined) delete process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
    else process.env.Y2T_ALLOW_INSECURE_NO_API_KEY = prevAllow;
  }
});

test("GET /metrics requires X-API-Key when Y2T_API_KEY is set", async () => {
  const prev = process.env.Y2T_API_KEY;
  process.env.Y2T_API_KEY = "test-api-key-aaaaaaaaaaaaaaaaaaaaaa";

  const dir = mkdtempSync(join(tmpdir(), "y2t-metrics-auth-"));
  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });

  const { server } = await startApiServer(config, {
    host: "127.0.0.1",
    port: 0,
    maxBufferedEventsPerRun: 10,
    persistRuns: true,
    persistDir: join(dir, "_runs"),
  });
  await listenServer(server);
  const port = (server.address() as any).port as number;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(res.status, 401);

    const ok = await fetch(`http://127.0.0.1:${port}/metrics`, {
      headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
    });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("content-type") ?? "", /^text\/plain/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prev === undefined) delete process.env.Y2T_API_KEY;
    else process.env.Y2T_API_KEY = prev;
  }
});
