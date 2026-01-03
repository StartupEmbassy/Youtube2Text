import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { handleAudioUpload } from "../src/api/uploads.js";

test("POST /audio stores upload and returns metadata", async () => {
  const dir = mkdtempSync(join(tmpdir(), "y2t-audio-upload-"));
  const audioDir = join(dir, "audio");
  const outputDir = dir;

  try {
    const boundary = "----y2tformboundary";
    const payload = Buffer.from(
      [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="sample.mp3"\r\n`,
        `Content-Type: audio/mpeg\r\n\r\n`,
        `hello\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="title"\r\n\r\n`,
        `Sample audio\r\n`,
        `--${boundary}--\r\n`,
      ].join(""),
      "utf8"
    );

    const server = http.createServer((req, res) => {
      handleAudioUpload(req, {
        audioDir,
        outputDir,
        maxBytes: 1024 * 1024,
        allowedExts: ["mp3", "wav", "m4a", "ogg", "flac"],
      })
        .then((result) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(result.meta));
        })
        .catch((err) => {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            })
          );
        });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = http.request(
          {
            method: "POST",
            hostname: "127.0.0.1",
            port,
            path: "/audio",
            headers: {
              "content-type": `multipart/form-data; boundary=${boundary}`,
              "content-length": String(payload.length),
            },
          },
          (res) => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () =>
              resolve({ status: res.statusCode ?? 0, body: data })
            );
          }
        );
        req.on("error", reject);
        req.end(payload);
      }
    );

    server.close();

    if (response.status !== 200) {
      throw new Error(
        `Upload failed (${response.status}): ${response.body || "no body"}`
      );
    }

    const meta = JSON.parse(response.body) as {
      audioId: string;
      title: string;
      ext: string;
    };
    assert.ok(meta.audioId);
    assert.equal(meta.title, "Sample-audio");
    assert.equal(meta.ext, "mp3");

    const audioPath = join(audioDir, "_uploads", `${meta.audioId}.mp3`);
    const metaPath = join(outputDir, "_uploads", `${meta.audioId}.json`);
    await fs.access(audioPath);
    await fs.access(metaPath);
  } finally {
    // no server cleanup needed
  }
});
