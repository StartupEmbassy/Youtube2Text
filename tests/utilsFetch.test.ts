import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { fetchWithTimeout, isAbortError } from "../src/utils/fetch.js";

test("isAbortError detects AbortError by name", () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  assert.equal(isAbortError(err), true);
  assert.equal(isAbortError(new Error("nope")), false);
  assert.equal(isAbortError(null), false);
});

test("fetchWithTimeout aborts slow responses", async () => {
  const server = createServer((_req, res) => {
    setTimeout(() => {
      res.statusCode = 200;
      res.end("ok");
    }, 100);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port as number;
  const url = `http://127.0.0.1:${port}/slow`;
  try {
    await fetchWithTimeout(url, { method: "GET" }, 10);
    assert.fail("expected timeout");
  } catch (error) {
    assert.equal(isAbortError(error), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("fetchWithTimeout returns response when under timeout", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port as number;
  const url = `http://127.0.0.1:${port}/fast`;
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, 1000);
    const text = await res.text();
    assert.equal(text, "ok");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
