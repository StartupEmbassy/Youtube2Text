import type { ServerResponse, IncomingMessage } from "node:http";

export function getLastEventId(req: IncomingMessage): number {
  const header = req.headers["last-event-id"];
  const value =
    typeof header === "string" ? header : Array.isArray(header) ? header[0] : "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function initSse(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "text/event-stream; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.setHeader("x-accel-buffering", "no");
}

export function writeSseEvent(res: ServerResponse, input: { id: number; event: string; data: unknown }): void {
  res.write(`id: ${input.id}\n`);
  res.write(`event: ${input.event}\n`);
  res.write(`data: ${JSON.stringify(input.data)}\n\n`);
}

