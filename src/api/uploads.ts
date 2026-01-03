import { createWriteStream, promises as fs } from "node:fs";
import { extname, join, basename as pathBasename } from "node:path";
import { randomUUID } from "node:crypto";
import busboy from "busboy";
import type { FileInfo } from "busboy";
import type { IncomingMessage } from "node:http";
import { ensureDir, sanitizeFilename, writeJson } from "../utils/fs.js";

export type AudioUploadMeta = {
  audioId: string;
  title: string;
  originalFilename: string;
  contentType?: string;
  bytes: number;
  ext: string;
  createdAt: string;
};

export type AudioUploadResult = {
  meta: AudioUploadMeta;
  audioPath: string;
  metaPath: string;
};

export type AudioUploadErrorCode =
  | "invalid_content_type"
  | "missing_file"
  | "unsupported_extension"
  | "too_large"
  | "too_many_files"
  | "timeout"
  | "write_error";

export class AudioUploadError extends Error {
  constructor(
    public code: AudioUploadErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AudioUploadError";
  }
}

type UploadOptions = {
  audioDir: string;
  outputDir: string;
  maxBytes: number;
  allowedExts: string[];
  timeoutMs?: number;
};

function normalizeExt(ext: string): string {
  if (!ext) return "";
  return ext.startsWith(".") ? ext.slice(1).toLowerCase() : ext.toLowerCase();
}

function defaultTitleFromFilename(filename: string): string {
  const base = pathBasename(filename, extname(filename));
  return sanitizeFilename(base, { maxLength: 80 });
}

function normalizeTitle(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  return sanitizeFilename(trimmed, { maxLength: 80 });
}

export async function handleAudioUpload(
  req: IncomingMessage,
  options: UploadOptions
): Promise<AudioUploadResult> {
  const contentType = req.headers["content-type"];
  const normalizedType = typeof contentType === "string" ? contentType.toLowerCase() : "";
  if (!normalizedType.startsWith("multipart/form-data")) {
    throw new AudioUploadError(
      "invalid_content_type",
      "Expected multipart/form-data"
    );
  }

  const audioId = randomUUID();
  const uploadDir = join(options.audioDir, "_uploads");
  const metaDir = join(options.outputDir, "_uploads");
  await ensureDir(uploadDir);
  await ensureDir(metaDir);

  let filePath: string | undefined;
  let meta: AudioUploadMeta | undefined;
  let totalBytes = 0;
  let fileCount = 0;
  let fieldTitle: string | undefined;
  let fileWriteError: Error | undefined;
  let fileReceived = false;
  let fileDone: Promise<void> | undefined;

  const allowed = new Set(options.allowedExts.map((ext) => normalizeExt(ext)));

  return await new Promise<AudioUploadResult>((resolve, reject) => {
    const timeoutMs = Math.max(0, options.timeoutMs ?? 120_000);
    let timeout: NodeJS.Timeout | undefined;
    const bb = busboy({
      headers: req.headers,
      limits: { fileSize: options.maxBytes, files: 1 },
    });

    const fail = (err: Error) => {
      if (timeout) clearTimeout(timeout);
      bb.removeAllListeners();
      req.unpipe(bb);
      bb.destroy();
      if (filePath) {
        fs.unlink(filePath).catch(() => undefined);
      }
      reject(err);
    };

    bb.on("file", (_name: string, file: NodeJS.ReadableStream, info: FileInfo) => {
      fileCount += 1;
      fileReceived = true;
      if (fileCount > 1) {
        file.resume();
        fail(new AudioUploadError("too_many_files", "Only one file is allowed"));
        return;
      }

      const filename = info.filename || "audio";
      const ext = normalizeExt(extname(filename));
      if (!ext || !allowed.has(ext)) {
        file.resume();
        fail(
          new AudioUploadError(
            "unsupported_extension",
            `Unsupported audio extension: ${ext || "none"}`
          )
        );
        return;
      }

      const createdAt = new Date().toISOString();
      const fallbackTitle = defaultTitleFromFilename(filename);
      const title = normalizeTitle(fieldTitle, fallbackTitle);
      const contentTypeValue = info.mimeType || undefined;
      const safeExt = ext;
      filePath = join(uploadDir, `${audioId}.${safeExt}`);
      const writeStream = createWriteStream(filePath);
      fileDone = new Promise<void>((resolve, reject) => {
        writeStream.on("close", resolve);
        writeStream.on("error", reject);
      });

      file.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
      });
      file.on("limit", () => {
        fail(
          new AudioUploadError(
            "too_large",
            `Upload exceeds ${Math.ceil(options.maxBytes / (1024 * 1024))}MB`
          )
        );
      });
      file.on("error", (err: Error) => {
        fail(new AudioUploadError("write_error", err.message));
      });

      writeStream.on("error", (err: Error) => {
        fileWriteError = err;
      });
      writeStream.on("close", () => {
        if (fileWriteError) {
          fail(new AudioUploadError("write_error", fileWriteError.message));
          return;
        }
        meta = {
          audioId,
          title,
          originalFilename: filename,
          contentType: contentTypeValue,
          bytes: totalBytes,
          ext: safeExt,
          createdAt,
        };
      });

      file.pipe(writeStream);
    });

    bb.on("field", (name: string, value: string) => {
      if (name === "title" && typeof value === "string") {
        fieldTitle = value;
        if (meta) {
          meta.title = normalizeTitle(fieldTitle, meta.title);
        }
      }
    });

    bb.on("filesLimit", () => {
      fail(new AudioUploadError("too_many_files", "Only one file is allowed"));
    });

    bb.on("error", (err: Error) => {
      fail(new AudioUploadError("write_error", err.message));
    });

    bb.on("finish", async () => {
      if (timeout) clearTimeout(timeout);
      if (!fileReceived) {
        fail(new AudioUploadError("missing_file", "No audio file uploaded"));
        return;
      }

      try {
        await fileDone;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fail(new AudioUploadError("write_error", message));
        return;
      }

      if (!meta || !filePath) {
        fail(new AudioUploadError("write_error", "Upload did not finalize"));
        return;
      }

      if (fieldTitle) {
        meta.title = normalizeTitle(fieldTitle, meta.title);
      }

      const metaPath = join(metaDir, `${audioId}.json`);
      try {
        await writeJson(metaPath, meta);
        resolve({ meta, audioPath: filePath, metaPath });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fail(new AudioUploadError("write_error", message));
      }
    });

    req.pipe(bb);

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        fail(new AudioUploadError("timeout", "Upload timed out"));
      }, timeoutMs);
      timeout.unref?.();
    }
  });
}

export async function readAudioUpload(
  audioDir: string,
  outputDir: string,
  audioId: string
): Promise<AudioUploadResult | undefined> {
  const metaPath = join(outputDir, "_uploads", `${audioId}.json`);
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    const meta = JSON.parse(raw) as AudioUploadMeta;
    const audioPath = join(audioDir, "_uploads", `${audioId}.${meta.ext}`);
    await fs.access(audioPath);
    return { meta, audioPath, metaPath };
  } catch {
    return undefined;
  }
}
