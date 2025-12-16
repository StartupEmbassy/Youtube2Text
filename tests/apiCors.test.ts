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
  const dir = mkdtempSync(join(tmpdir(), "y2t-cors-"));
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
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("CORS defaults to allow any origin when Y2T_CORS_ORIGINS is unset", async () => {
  const prev = process.env.Y2T_CORS_ORIGINS;
  delete process.env.Y2T_CORS_ORIGINS;
  try {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { Origin: "https://example.com" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
    });
  } finally {
    if (prev === undefined) delete process.env.Y2T_CORS_ORIGINS;
    else process.env.Y2T_CORS_ORIGINS = prev;
  }
});

test("CORS allowlist only allows configured origins", async () => {
  const prev = process.env.Y2T_CORS_ORIGINS;
  process.env.Y2T_CORS_ORIGINS = "https://allowed.example, http://localhost:3000";
  try {
    await withServer(async (baseUrl) => {
      const allowed = await fetch(`${baseUrl}/health`, {
        headers: { Origin: "https://allowed.example" },
      });
      assert.equal(allowed.status, 200);
      assert.equal(
        allowed.headers.get("access-control-allow-origin"),
        "https://allowed.example"
      );

      const blocked = await fetch(`${baseUrl}/health`, {
        headers: { Origin: "https://blocked.example" },
      });
      assert.equal(blocked.status, 200);
      assert.equal(blocked.headers.get("access-control-allow-origin"), null);
    });
  } finally {
    if (prev === undefined) delete process.env.Y2T_CORS_ORIGINS;
    else process.env.Y2T_CORS_ORIGINS = prev;
  }
});

