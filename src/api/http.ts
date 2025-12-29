import { IncomingMessage, ServerResponse } from "node:http";

export class BodyTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BodyTooLargeError";
  }
}

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function getMaxBodyBytes(): number {
  const raw = parseEnvInt(process.env.Y2T_MAX_BODY_BYTES, 1_000_000);
  return Math.max(1_024, raw);
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const maxBytes = getMaxBodyBytes();
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new BodyTooLargeError(`Request body too large (max ${maxBytes} bytes)`);
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) return undefined;
  return JSON.parse(raw) as unknown;
}

export function json(
  res: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body, null, 2);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(payload);
}

export function notFound(res: ServerResponse): void {
  json(res, 404, { error: "not_found" });
}

export function badRequest(res: ServerResponse, message: string): void {
  json(res, 400, { error: "bad_request", message });
}

export function payloadTooLarge(res: ServerResponse, message: string): void {
  json(res, 413, { error: "payload_too_large", message });
}
