import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileSystemStorageAdapter } from "../src/storage/fsAdapter.js";

test("FileSystemStorageAdapter.listChannels skips reserved _* directories", async () => {
  const root = mkdtempSync(join(tmpdir(), "y2t-storage-"));
  try {
    const outputDir = join(root, "output");
    const audioDir = join(root, "audio");
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(audioDir, { recursive: true });

    mkdirSync(join(outputDir, "_runs"), { recursive: true });
    mkdirSync(join(outputDir, "_tmp"), { recursive: true });

    const channelDir = "some-channel__UC123";
    mkdirSync(join(outputDir, channelDir), { recursive: true });
    writeFileSync(join(outputDir, channelDir, "video__abc123.json"), "{}\n");

    const adapter = new FileSystemStorageAdapter({
      outputDir,
      audioDir,
      audioFormat: "mp3",
    });
    const channels = await adapter.listChannels();

    assert.equal(channels.length, 1);
    assert.equal(channels[0]!.channelDirName, channelDir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

