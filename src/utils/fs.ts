import { createWriteStream, promises as fs } from "node:fs";
import { dirname } from "node:path";

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

export async function writeJson(path: string, data: unknown) {
  await ensureDir(dirname(path));
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

export async function writeText(path: string, text: string) {
  await ensureDir(dirname(path));
  await fs.writeFile(path, text, "utf8");
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
