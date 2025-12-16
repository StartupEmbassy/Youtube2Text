import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WatchlistStore } from "../src/api/watchlist.js";

test("WatchlistStore add/list/get/update/remove roundtrip", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-watchlist-"));
  const store = new WatchlistStore(dir);

  const entry = await store.add({ channelUrl: " https://www.youtube.com/@SomeChannel " });
  assert.ok(entry.id);
  assert.equal(entry.channelUrl, "https://www.youtube.com/@SomeChannel");
  assert.equal(entry.enabled, true);

  const all = await store.list();
  assert.equal(all.length, 1);

  const got = await store.get(entry.id);
  assert.ok(got);
  assert.equal(got.id, entry.id);

  const updated = await store.update(entry.id, { enabled: false, intervalMinutes: 15 });
  assert.ok(updated);
  assert.equal(updated.enabled, false);
  assert.equal(updated.intervalMinutes, 15);

  const removed = await store.remove(entry.id);
  assert.equal(removed, true);
  const empty = await store.list();
  assert.equal(empty.length, 0);
});

