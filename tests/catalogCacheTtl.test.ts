import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getListingWithCatalogCache } from "../src/youtube/catalogCache.js";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

test("catalog cache TTL forces full enumeration when cache is too old", async () => {
  const root = await mkdtemp(join(tmpdir(), "y2t-catalog-"));
  const outputDir = join(root, "output");
  await mkdir(join(outputDir, "_catalog"), { recursive: true });

  const channelId = "UC_TTL_TEST";
  const catalogPath = join(outputDir, "_catalog", `${channelId}.json`);

  await writeFile(
    catalogPath,
    JSON.stringify(
      {
        version: 1,
        channelId,
        channelTitle: "Old Channel",
        inputUrl: `https://www.youtube.com/channel/${channelId}`,
        retrievedAt: isoHoursAgo(200),
        complete: true,
        videos: [{ id: "oldHead", title: "Old", url: "u-old" }],
      },
      null,
      2
    ),
    "utf8"
  );

  let fullCalls = 0;
  let headCalls = 0;

  const listing = await getListingWithCatalogCache(
    `https://www.youtube.com/channel/${channelId}`,
    outputDir,
    { ytDlpCommand: "yt-dlp", ytDlpExtraArgs: [] },
    {
      maxAgeHours: 168,
      enumerate: async (_url, _deps, opts) => {
        if (opts?.playlistEnd === 1) {
          headCalls++;
          return { channelId, channelTitle: "Channel", videos: [{ id: "head", title: "H", url: "u" }] };
        }
        if (opts?.playlistEnd) {
          throw new Error("Unexpected incremental refresh call when TTL should force full refresh");
        }
        fullCalls++;
        return {
          channelId,
          channelTitle: "Channel",
          videos: [
            { id: "new1", title: "N1", url: "u1" },
            { id: "new0", title: "N0", url: "u0" },
          ],
        };
      },
    }
  );

  assert.equal(headCalls, 1);
  assert.equal(fullCalls, 1);
  assert.equal(listing.videos.length, 2);
  assert.equal(listing.videos[0]?.id, "new1");
});

test("catalog cache does incremental refresh when TTL not exceeded", async () => {
  const root = await mkdtemp(join(tmpdir(), "y2t-catalog-"));
  const outputDir = join(root, "output");
  await mkdir(join(outputDir, "_catalog"), { recursive: true });

  const channelId = "UC_TTL_TEST_2";
  const catalogPath = join(outputDir, "_catalog", `${channelId}.json`);

  await writeFile(
    catalogPath,
    JSON.stringify(
      {
        version: 1,
        channelId,
        channelTitle: "Channel",
        inputUrl: `https://www.youtube.com/channel/${channelId}`,
        retrievedAt: isoHoursAgo(2),
        complete: true,
        videos: [
          { id: "oldHead", title: "OldHead", url: "u-oldHead" },
          { id: "old1", title: "Old1", url: "u-old1" },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  let refreshCalls = 0;

  const listing = await getListingWithCatalogCache(
    `https://www.youtube.com/channel/${channelId}`,
    outputDir,
    { ytDlpCommand: "yt-dlp", ytDlpExtraArgs: [] },
    {
      maxAgeHours: 168,
      newestChunk: 2,
      enumerate: async (_url, _deps, opts) => {
        if (opts?.playlistEnd === 1) {
          return { channelId, channelTitle: "Channel", videos: [{ id: "head", title: "H", url: "u" }] };
        }
        if (opts?.playlistEnd === 2) {
          refreshCalls++;
          // Includes previous head ("oldHead") so incremental refresh should stop here.
          return {
            channelId,
            channelTitle: "Channel",
            videos: [
              { id: "new2", title: "New2", url: "u-new2" },
              { id: "oldHead", title: "OldHead", url: "u-oldHead" },
            ],
          };
        }
        throw new Error("Unexpected full enumeration call when TTL is not exceeded");
      },
    }
  );

  assert.equal(refreshCalls, 1);
  assert.deepEqual(
    listing.videos.map((v) => v.id),
    ["new2", "oldHead", "old1"]
  );
});

