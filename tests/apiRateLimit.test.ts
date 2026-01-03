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

test("write rate limit returns 429 after exceeding max", async () => {
  await withEnv("Y2T_RATE_LIMIT_WRITE_MAX", "2", async () => {
    await withEnv("Y2T_RATE_LIMIT_WINDOW_MS", "60000", async () => {
      const dir = mkdtempSync(join(tmpdir(), "y2t-rate-limit-"));
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

      const body1 = { channelUrl: "https://www.youtube.com/channel/UC123" };
      const body2 = { channelUrl: "https://www.youtube.com/channel/UC456" };
      const body3 = { channelUrl: "https://www.youtube.com/channel/UC789" };

      try {
        const res1 = await fetch(`http://127.0.0.1:${port}/watchlist`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
          body: JSON.stringify(body1),
        });
        assert.equal(res1.status, 201);

        const res2 = await fetch(`http://127.0.0.1:${port}/watchlist`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
          body: JSON.stringify(body2),
        });
        assert.equal(res2.status, 201);

        const res3 = await fetch(`http://127.0.0.1:${port}/watchlist`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
          body: JSON.stringify(body3),
        });
        assert.equal(res3.status, 429);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});

test("read rate limit returns 429 after exceeding max", async () => {
  await withEnv("Y2T_RATE_LIMIT_READ_MAX", "1", async () => {
    await withEnv("Y2T_RATE_LIMIT_READ_WINDOW_MS", "60000", async () => {
      await withEnv("Y2T_RATE_LIMIT_WRITE_MAX", "0", async () => {
        const dir = mkdtempSync(join(tmpdir(), "y2t-read-limit-"));
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
          const res1 = await fetch(`http://127.0.0.1:${port}/runs`, {
            headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
          });
          assert.equal(res1.status, 200);

          const res2 = await fetch(`http://127.0.0.1:${port}/runs`, {
            headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
          });
          assert.equal(res2.status, 429);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      });
    });
  });
});

test("deep health rate limit returns 429 after exceeding max", async () => {
  await withEnv("Y2T_RATE_LIMIT_HEALTH_MAX", "1", async () => {
    await withEnv("Y2T_RATE_LIMIT_HEALTH_WINDOW_MS", "60000", async () => {
      const dir = mkdtempSync(join(tmpdir(), "y2t-health-limit-"));
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
        const res1 = await fetch(`http://127.0.0.1:${port}/health?deep=true`, {
          headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
        });
        assert.equal(res1.status, 200);

        const res2 = await fetch(`http://127.0.0.1:${port}/health?deep=true`, {
          headers: { "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
        });
        assert.equal(res2.status, 429);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
