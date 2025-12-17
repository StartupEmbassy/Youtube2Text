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

function withEnv(key: string | undefined, fn: () => Promise<void>) {
  const prev = process.env.Y2T_API_KEY;
  if (key === undefined) delete process.env.Y2T_API_KEY;
  else process.env.Y2T_API_KEY = key;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.Y2T_API_KEY;
    else process.env.Y2T_API_KEY = prev;
  });
}

test("GET /metrics returns Prometheus text when auth is not configured", async () => {
  await withEnv(undefined, async () => {
    const dir = mkdtempSync(join(tmpdir(), "y2t-metrics-"));
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
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /^text\/plain/);
      const text = await res.text();
      assert.match(text, /y2t_build_info\{version="/);
      assert.match(text, /y2t_runs\{status="/);
      assert.match(text, /y2t_watchlist_entries /);
      assert.match(text, /y2t_scheduler_running /);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

test("GET /metrics requires X-API-Key when Y2T_API_KEY is set", async () => {
  await withEnv("secret", async () => {
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
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

