import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { startApiServer } from "../src/api/server.js";
import { makeChannelDirName } from "../src/storage/naming.js";
import type { RunPlan } from "../src/pipeline/plan.js";

async function listenServer(server: any): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve) => server.once("listening", resolve));
}

async function waitUntil(fn: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Timed out");
}

test("Cache-first run backfills channelThumbnailUrl when missing (fire-and-forget)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-cachefirst-thumb-"));
  const config = configSchema.parse({
    assemblyAiApiKey: "test",
    outputDir: dir,
    audioDir: join(dir, "audio"),
  });

  const channelId = "UC123";
  const channelTitle = "Chan";
  const channelDirName = makeChannelDirName(channelId, channelTitle);
  const channelDir = join(dir, channelDirName);
  mkdirSync(channelDir, { recursive: true });
  const metaPath = join(channelDir, "_channel.json");
  writeFileSync(metaPath, JSON.stringify({ channelId, channelTitle }, null, 2), "utf8");

  const stubPlanRun = async (_url: string): Promise<RunPlan> => ({
    inputUrl: _url,
    force: false,
    channelId,
    channelTitle,
    totalVideos: 1,
    alreadyProcessed: 1,
    toProcess: 0,
    filters: {},
    videos: [
      {
        id: "abc",
        title: "Title",
        url: _url,
        basename: "title__abc",
        processed: true,
      },
    ],
  });

  const { server } = await startApiServer(config, {
    host: "127.0.0.1",
    port: 0,
    maxBufferedEventsPerRun: 10,
    persistRuns: false,
    deps: {
      planRun: (async (url: string, _cfg: any, _opts: any) => stubPlanRun(url)) as any,
      fetchChannelMetadata: (async () => ({}) as any) as any,
      safeChannelThumbnailUrl: (() => "https://example.com/avatar.jpg") as any,
    },
  });
  await listenServer(server);
  const port = (server.address() as any).port as number;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test-api-key-aaaaaaaaaaaaaaaaaaaaaa" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abc", force: false }),
    });
    assert.equal(res.status, 201);

    await waitUntil(() => {
      try {
        const raw = readFileSync(metaPath, "utf8");
        const parsed = JSON.parse(raw) as any;
        return typeof parsed.channelThumbnailUrl === "string" && parsed.channelThumbnailUrl.length > 0;
      } catch {
        return false;
      }
    });

    const raw = readFileSync(metaPath, "utf8");
    const parsed = JSON.parse(raw) as any;
    assert.equal(parsed.channelId, channelId);
    assert.equal(parsed.channelTitle, channelTitle);
    assert.equal(parsed.channelThumbnailUrl, "https://example.com/avatar.jpg");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
