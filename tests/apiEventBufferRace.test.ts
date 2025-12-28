import test from "node:test";
import assert from "node:assert/strict";
import { EventBuffer } from "../src/api/eventBuffer.js";
import type { PipelineEvent } from "../src/pipeline/events.js";

test("EventBuffer handles interleaved append/list without id collisions", async () => {
  const buf = new EventBuffer<PipelineEvent>(50);

  const appendTasks = Array.from({ length: 200 }, (_v, i) =>
    Promise.resolve().then(() =>
      buf.append({ type: "run:error", error: String(i), timestamp: "t" })
    )
  );
  const listTasks = Array.from({ length: 40 }, () =>
    Promise.resolve().then(() => buf.listAfter(0))
  );

  await Promise.all([...appendTasks, ...listTasks]);

  const ids = buf.listAfter(0).map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
  for (let i = 1; i < ids.length; i += 1) {
    assert.ok(ids[i]! > ids[i - 1]!);
  }
});
