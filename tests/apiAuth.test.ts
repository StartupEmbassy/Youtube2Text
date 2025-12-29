import test from "node:test";
import assert from "node:assert/strict";
import { requireApiKey, resetAuthFailureLimiterForTests } from "../src/api/auth.js";

class FakeResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  end(chunk?: string) {
    if (typeof chunk === "string") this.body += chunk;
  }
}

function withEnv(key: string | undefined, fn: () => void) {
  const prevKey = process.env.Y2T_API_KEY;
  const prevInsecure = process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
  if (key === undefined) {
    delete process.env.Y2T_API_KEY;
  } else {
    process.env.Y2T_API_KEY = key;
  }
  // Always disable insecure mode during tests to ensure consistent behavior
  delete process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
  try {
    fn();
  } finally {
    if (prevKey === undefined) delete process.env.Y2T_API_KEY;
    else process.env.Y2T_API_KEY = prevKey;
    if (prevInsecure === undefined) delete process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
    else process.env.Y2T_ALLOW_INSECURE_NO_API_KEY = prevInsecure;
  }
}

test("requireApiKey returns 500 when Y2T_API_KEY is unset (server misconfigured)", () => {
  withEnv(undefined, () => {
    const res = new FakeResponse();
    const ok = requireApiKey({ url: "/runs", headers: {} } as any, res as any);
    assert.equal(ok, false);
    assert.equal(res.statusCode, 500);
    assert.match(res.body, /server_misconfigured/i);
  });
});

test("requireApiKey allows /health without key", () => {
  withEnv("secret", () => {
    const res = new FakeResponse();
    const ok = requireApiKey({ url: "/health", headers: {} } as any, res as any);
    assert.equal(ok, true);
  });
});

test("requireApiKey rejects missing key", () => {
  withEnv("secret", () => {
    const res = new FakeResponse();
    const ok = requireApiKey({ url: "/runs", headers: {} } as any, res as any);
    assert.equal(ok, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body, /unauthorized/);
  });
});

test("requireApiKey rejects wrong key", () => {
  withEnv("secret", () => {
    const res = new FakeResponse();
    const ok = requireApiKey(
      { url: "/runs", headers: { "x-api-key": "nope" } } as any,
      res as any
    );
    assert.equal(ok, false);
    assert.equal(res.statusCode, 401);
  });
});

test("requireApiKey accepts correct key", () => {
  withEnv("secret", () => {
    const res = new FakeResponse();
    const ok = requireApiKey(
      { url: "/runs", headers: { "x-api-key": "secret" } } as any,
      res as any
    );
    assert.equal(ok, true);
    assert.equal(res.statusCode, 200);
  });
});

test("requireApiKey rate limits repeated failures", () => {
  withEnv("secret", () => {
    const prevMax = process.env.Y2T_AUTH_FAIL_MAX;
    const prevWindow = process.env.Y2T_AUTH_FAIL_WINDOW_MS;
    process.env.Y2T_AUTH_FAIL_MAX = "1";
    process.env.Y2T_AUTH_FAIL_WINDOW_MS = "60000";
    resetAuthFailureLimiterForTests();
    try {
      const req = { url: "/runs", headers: { "x-api-key": "bad" }, socket: { remoteAddress: "1.2.3.4" } } as any;

      const res1 = new FakeResponse();
      const ok1 = requireApiKey(req, res1 as any);
      assert.equal(ok1, false);
      assert.equal(res1.statusCode, 401);

      const res2 = new FakeResponse();
      const ok2 = requireApiKey(req, res2 as any);
      assert.equal(ok2, false);
      assert.equal(res2.statusCode, 429);
    } finally {
      if (prevMax === undefined) delete process.env.Y2T_AUTH_FAIL_MAX;
      else process.env.Y2T_AUTH_FAIL_MAX = prevMax;
      if (prevWindow === undefined) delete process.env.Y2T_AUTH_FAIL_WINDOW_MS;
      else process.env.Y2T_AUTH_FAIL_WINDOW_MS = prevWindow;
      resetAuthFailureLimiterForTests();
    }
  });
});
