import { randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import { basename, dirname, join } from "node:path";

export function sanitizeFilename(
  input: string,
  options?: { maxLength?: number }
): string {
  const maxLength = options?.maxLength ?? 60;
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = normalized
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/[^\w\s-]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, maxLength);

  return slug.length > 0 ? slug : "untitled";
}

export async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

function tmpPathFor(path: string) {
  const dir = dirname(path);
  const base = basename(path);
  return join(dir, `.${base}.tmp-${randomUUID()}`);
}

async function replaceFileAtomic(tmpPath: string, finalPath: string) {
  try {
    await fs.rename(tmpPath, finalPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EEXIST" || code === "EPERM" || code === "EBUSY") {
      await fs.rm(finalPath, { force: true });
      await fs.rename(tmpPath, finalPath);
      return;
    }
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {
      // ignore cleanup failures
    }
    throw error;
  }
}

export async function writeJson(path: string, data: unknown) {
  await ensureDir(dirname(path));
  const tmp = tmpPathFor(path);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await replaceFileAtomic(tmp, path);
}

export async function writeText(path: string, text: string) {
  await ensureDir(dirname(path));
  const tmp = tmpPathFor(path);
  await fs.writeFile(tmp, text, "utf8");
  await replaceFileAtomic(tmp, path);
}

export async function appendLine(path: string, line: string) {
  await ensureDir(dirname(path));
  await fs.appendFile(path, line + "\n", "utf8");
}

export async function fileExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export function streamToFile(
  readable: NodeJS.ReadableStream,
  path: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(path);
    readable.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}
