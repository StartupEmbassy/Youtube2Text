import test from "node:test";
import assert from "node:assert/strict";
import { EventBuffer } from "../src/api/eventBuffer.js";
import type { PipelineEvent } from "../src/pipeline/events.js";

test("EventBuffer returns events after last seen id", () => {
  const buf = new EventBuffer<PipelineEvent>(10);
  const e1 = buf.append({ type: "run:error", error: "x", timestamp: "t" });
  const e2 = buf.append({ type: "run:error", error: "y", timestamp: "t" });
  assert.deepEqual(buf.listAfter(0).map((e) => e.id), [e1.id, e2.id]);
  assert.deepEqual(buf.listAfter(e1.id).map((e) => e.id), [e2.id]);
  assert.deepEqual(buf.listAfter(e2.id).map((e) => e.id), []);
});

test("EventBuffer truncates to max size", () => {
  const buf = new EventBuffer<PipelineEvent>(2);
  const e1 = buf.append({ type: "run:error", error: "1", timestamp: "t" });
  const e2 = buf.append({ type: "run:error", error: "2", timestamp: "t" });
  const e3 = buf.append({ type: "run:error", error: "3", timestamp: "t" });
  assert.deepEqual(buf.listAfter(0).map((e) => e.id), [e2.id, e3.id]);
  assert.deepEqual(buf.listAfter(e1.id).map((e) => e.id), [e2.id, e3.id]);
});
