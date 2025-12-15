import test from "node:test";
import assert from "node:assert/strict";
import { buildWebhookHeaders, deliverWebhook } from "../src/api/webhooks.js";

test("buildWebhookHeaders includes signature when secret is set", () => {
  const headers = buildWebhookHeaders({
    secret: "secret",
    timestamp: "2025-01-01T00:00:00.000Z",
    body: "{\"ok\":true}",
    eventType: "run:done",
  });
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["x-y2t-event"], "run:done");
  assert.ok(headers["x-y2t-signature"]?.startsWith("sha256="));
  assert.equal(headers["x-y2t-timestamp"], "2025-01-01T00:00:00.000Z");
});

test("deliverWebhook retries on 500 and succeeds", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return { ok: calls >= 2, status: calls >= 2 ? 200 : 500 } as any;
  };
  process.env.Y2T_WEBHOOK_RETRIES = "2";
  process.env.Y2T_WEBHOOK_TIMEOUT_MS = "2000";
  const res = await deliverWebhook(
    "https://example.com/hook",
    {
      type: "run:done",
      timestamp: new Date().toISOString(),
      run: {
        runId: "r1",
        status: "done",
        inputUrl: "u",
        force: false,
        createdAt: new Date().toISOString(),
      } as any,
    },
    { fetch: fakeFetch as any }
  );
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
});

test("deliverWebhook does not retry on 400", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return { ok: false, status: 400 } as any;
  };
  process.env.Y2T_WEBHOOK_RETRIES = "5";
  process.env.Y2T_WEBHOOK_TIMEOUT_MS = "2000";
  const res = await deliverWebhook(
    "https://example.com/hook",
    {
      type: "run:error",
      timestamp: new Date().toISOString(),
      run: {
        runId: "r1",
        status: "error",
        inputUrl: "u",
        force: false,
        createdAt: new Date().toISOString(),
        error: "x",
      } as any,
    },
    { fetch: fakeFetch as any }
  );
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
  assert.equal(calls, 1);
});

