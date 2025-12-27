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

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "y2t-settings-"));
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
    deps: {
      planRun: async (_url: string, cfg: any) => ({ maxNewVideosSeen: cfg.maxNewVideos ?? null }),
    },
  });
  await listenServer(server);
  const port = (server.address() as any).port as number;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("GET /settings returns effective values and a stable settingsPath", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/settings`, { headers: { "x-api-key": "test" } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(typeof body.outputDir, "string");
    assert.match(body.settingsPath, /_settings\.json$/);
    assert.equal(typeof body.settings, "object");
    assert.equal(typeof body.effective, "object");
    assert.equal(typeof body.sources, "object");
    assert.equal(typeof body.sources.maxNewVideos, "string");
  });
});

test("PATCH /settings persists and influences /runs/plan effective config", async () => {
  await withServer(async (baseUrl) => {
    const patch = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ settings: { maxNewVideos: 1 } }),
    });
    assert.equal(patch.status, 200);
    const patchedBody = (await patch.json()) as any;
    assert.equal(patchedBody.sources.maxNewVideos, "settingsFile");

    const plan1 = await fetch(`${baseUrl}/runs/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc" }),
    });
    assert.equal(plan1.status, 200);
    const planBody1 = (await plan1.json()) as any;
    assert.equal(planBody1.plan.maxNewVideosSeen, 1);

    const plan2 = await fetch(`${baseUrl}/runs/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc", maxNewVideos: 2 }),
    });
    assert.equal(plan2.status, 200);
    const planBody2 = (await plan2.json()) as any;
    assert.equal(planBody2.plan.maxNewVideosSeen, 2);
  });
});

test("PATCH /settings clamps numeric ranges and normalizes languageCode", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({
        settings: {
          concurrency: 999,
          pollIntervalMs: 50,
          downloadRetries: 50,
          commentsMax: 9999,
          catalogMaxAgeHours: 99999,
          languageDetection: "manual",
          languageCode: "EN-US",
        },
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.settings.concurrency, 10);
    assert.equal(body.settings.pollIntervalMs, 1000);
    assert.equal(body.settings.downloadRetries, 10);
    assert.equal(body.settings.commentsMax, 2000);
    assert.equal(body.settings.catalogMaxAgeHours, 8760);
    assert.equal(body.settings.languageCode, "en_us");
  });
});

test("PATCH /settings rejects invalid afterDate", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ settings: { afterDate: "2024-99-99" } }),
    });
    assert.equal(res.status, 400);
  });
});
