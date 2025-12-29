import test from "node:test";
import assert from "node:assert/strict";
import { buildWebhookHeaders, deliverWebhook } from "../src/api/webhooks.js";

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

test("buildWebhookHeaders omits signature when secret is missing", () => {
  const headers = buildWebhookHeaders({
    secret: "",
    timestamp: "2025-01-01T00:00:00.000Z",
    body: "{\"ok\":true}",
    eventType: "run:done",
  });
  assert.equal(headers["x-y2t-signature"], undefined);
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

test("deliverWebhook retries on 429 and succeeds", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return { ok: calls >= 2, status: calls >= 2 ? 200 : 429 } as any;
  };
  process.env.Y2T_WEBHOOK_RETRIES = "1";
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

test("deliverWebhook blocks localhost/private IP callbackUrl", async () => {
  const res = await deliverWebhook(
    "http://127.0.0.1/hook",
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
    { fetch: (async () => ({ ok: true, status: 200 })) as any }
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /not allowed/i);
});

test("deliverWebhook enforces allowed domain list when configured", async () => {
  await withEnv("Y2T_WEBHOOK_ALLOWED_DOMAINS", "example.com", async () => {
    const ok = await deliverWebhook(
      "https://sub.example.com/hook",
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
      { fetch: (async () => ({ ok: true, status: 200 })) as any }
    );
    assert.equal(ok.ok, true);

    const blocked = await deliverWebhook(
      "https://other.com/hook",
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
      { fetch: (async () => ({ ok: true, status: 200 })) as any }
    );
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /allowlist/i);
  });
});
