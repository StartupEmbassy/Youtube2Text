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

test("POST /watchlist rejects non-channel/playlist URLs by default", async () => {
  await withEnv("Y2T_WATCHLIST_ALLOW_ANY_URL", undefined, async () => {
    const dir = mkdtempSync(join(tmpdir(), "y2t-watchlist-validate-"));
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
      const res = await fetch(`http://127.0.0.1:${port}/watchlist`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "test" },
        body: JSON.stringify({ channelUrl: "https://www.youtube.com/watch?v=abc" }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(String(body.error ?? ""), "bad_request");
      assert.match(String(body.message ?? ""), /watchlist\.channelUrl/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

test("POST /watchlist accepts any URL when Y2T_WATCHLIST_ALLOW_ANY_URL=true", async () => {
  await withEnv("Y2T_WATCHLIST_ALLOW_ANY_URL", "true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "y2t-watchlist-allowany-"));
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
      const res = await fetch(`http://127.0.0.1:${port}/watchlist`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "test" },
        body: JSON.stringify({ channelUrl: "https://www.youtube.com/watch?v=abc" }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.entry);
      assert.equal(body.entry.channelUrl, "https://www.youtube.com/watch?v=abc");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

test("POST /watchlist accepts null intervalMinutes as unset", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-watchlist-null-"));
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
    const res = await fetch(`http://127.0.0.1:${port}/watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ channelUrl: "https://www.youtube.com/@a", intervalMinutes: null }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.entry.intervalMinutes, undefined);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
