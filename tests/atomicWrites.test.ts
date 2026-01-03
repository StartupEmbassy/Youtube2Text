import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJson, writeText } from "../src/utils/fs.js";

test("writeJson writes valid JSON on repeated writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-atomic-"));
  const path = join(dir, "data.json");
  await writeJson(path, { ok: true, count: 1 });
  await writeJson(path, { ok: true, count: 2 });
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as { ok: boolean; count: number };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.count, 2);
});

test("writeText overwrites atomically", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-atomic-"));
  const path = join(dir, "note.txt");
  await writeText(path, "first");
  await writeText(path, "second");
  const raw = readFileSync(path, "utf8");
  assert.equal(raw, "second");
});
