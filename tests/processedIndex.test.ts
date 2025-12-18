import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProcessedVideoIdSet } from "../src/storage/processedIndex.js";

test("buildProcessedVideoIdSet scans all channel dirs for a channelId and extracts ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "y2t-processed-"));
  const outputDir = join(root, "output");
  await mkdir(outputDir, { recursive: true });

  const channelId = "UC_TEST_CHANNEL";
  const dirA = join(outputDir, `Some-Name__${channelId}`);
  const dirB = join(outputDir, channelId);
  await mkdir(dirA, { recursive: true });
  await mkdir(dirB, { recursive: true });

  const id1 = "7j_NE6Pjv-E";
  const id2 = "0os0_qL9Ids";
  const id3 = "QTqdnmN-qqE";

  await writeFile(join(dirA, `${id1}.json`), "{}");
  await writeFile(join(dirA, `${id2}__Title.json`), "{}"); // id_title style
  await writeFile(join(dirB, `Title__${id3}.json`), "{}"); // title_id style

  await writeFile(join(dirA, `${id1}.meta.json`), "{}");
  await writeFile(join(dirA, `${id1}.comments.json`), "{}");
  await writeFile(join(dirA, `_channel.json`), "{}");

  const set = await buildProcessedVideoIdSet(outputDir, channelId);
  assert.equal(set.has(id1), true);
  assert.equal(set.has(id2), true);
  assert.equal(set.has(id3), true);
  assert.equal(set.size, 3);
});

