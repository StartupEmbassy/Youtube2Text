import test from "node:test";
import assert from "node:assert/strict";
import { _test } from "../src/youtube/catalogCache.js";

test("catalog cache mergeNewestFirst prepends and dedupes by id", () => {
  const cached = [
    { id: "id3", title: "3", url: "u3" },
    { id: "id2", title: "2", url: "u2" },
    { id: "id1", title: "1", url: "u1" },
  ];
  const newest = [
    { id: "id5", title: "5", url: "u5" },
    { id: "id4", title: "4", url: "u4" },
    { id: "id3", title: "3-new", url: "u3" },
  ];

  const merged = _test.mergeNewestFirst(cached as any, newest as any);
  assert.deepEqual(
    merged.map((v: any) => v.id),
    ["id5", "id4", "id3", "id2", "id1"]
  );
});

