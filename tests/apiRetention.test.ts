import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import {
  cleanupAudioCache,
  cleanupPersistedRuns,
} from "../src/api/retention.js";

test("cleanupPersistedRuns deletes old run directories based on run.json timestamps", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-retention-runs-"));
  const persistDir = join(dir, "_runs");
  await fs.mkdir(persistDir, { recursive: true });

  const now = Date.parse("2025-01-31T00:00:00.000Z");
  const oldTs = "2024-12-01T00:00:00.000Z";
  const newTs = "2025-01-30T00:00:00.000Z";

  const oldDir = join(persistDir, "old");
  const newDir = join(persistDir, "new");
  await fs.mkdir(oldDir, { recursive: true });
  await fs.mkdir(newDir, { recursive: true });
  await fs.writeFile(join(oldDir, "run.json"), JSON.stringify({ createdAt: oldTs }), "utf8");
  await fs.writeFile(join(newDir, "run.json"), JSON.stringify({ createdAt: newTs }), "utf8");

  const res = await cleanupPersistedRuns(persistDir, 30, now);
  assert.equal(res.deleted, 1);
  assert.equal(res.kept, 1);

  await assert.rejects(() => fs.stat(oldDir));
  await fs.stat(newDir);
});

test("cleanupAudioCache deletes old audio files by mtime (mp3/wav)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-retention-audio-"));
  const audioDir = join(dir, "audio");
  await fs.mkdir(audioDir, { recursive: true });

  const now = Date.parse("2025-01-31T00:00:00.000Z");
  const cutoffMs = now - 7 * 24 * 60 * 60 * 1000;

  const oldFile = join(audioDir, "old.mp3");
  const newFile = join(audioDir, "new.wav");
  await fs.writeFile(oldFile, "x", "utf8");
  await fs.writeFile(newFile, "x", "utf8");

  // Set mtimes: old before cutoff, new after cutoff.
  await fs.utimes(oldFile, new Date(cutoffMs - 1000), new Date(cutoffMs - 1000));
  await fs.utimes(newFile, new Date(cutoffMs + 1000), new Date(cutoffMs + 1000));

  const res = await cleanupAudioCache(audioDir, 7, now);
  assert.equal(res.deletedFiles, 1);
  assert.equal(res.keptFiles, 1);

  await assert.rejects(() => fs.stat(oldFile));
  await fs.stat(newFile);
});

