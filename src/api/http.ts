import { IncomingMessage, ServerResponse } from "node:http";

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

