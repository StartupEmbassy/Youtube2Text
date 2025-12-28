import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystemStorageAdapter } from "../src/storage/fsAdapter.js";

test("listChannels ignores symlinked directories", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "y2t-symlink-"));
  const realDir = join(root, "Real__UC123");
  await mkdir(realDir, { recursive: true });
  await writeFile(join(realDir, "_channel.json"), JSON.stringify({ channelId: "UC123" }), "utf8");

  const linkDir = join(root, "Link__UC999");
  try {
    await symlink(realDir, linkDir, "junction");
  } catch {
    t.skip("symlink/junction not supported on this platform");
    return;
  }

  const adapter = new FileSystemStorageAdapter({
    outputDir: root,
    audioDir: join(root, "audio"),
    audioFormat: "mp3",
  });
  const channels = await adapter.listChannels();
  assert.equal(channels.length, 1);
  assert.equal(channels[0]!.channelId, "UC123");
});
