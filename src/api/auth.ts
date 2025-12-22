import type { IncomingMessage, ServerResponse } from "node:http";

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(",");
  return undefined;
}

export function getExpectedApiKey(): string | undefined {
  const key = process.env.Y2T_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

export function isInsecureModeEnabled(): boolean {
  const val = process.env.Y2T_ALLOW_INSECURE_NO_API_KEY;
  return typeof val === "string" && val.trim().toLowerCase() === "true";
}

export function isPublicPath(req: IncomingMessage): boolean {
  const url = req.url ?? "/";
  return url === "/health" || url.startsWith("/health?");
}

export function extractProvidedApiKey(req: IncomingMessage): string | undefined {
  const header = getHeader(req, "x-api-key");
  if (header && header.trim().length > 0) return header.trim();
  return undefined;
}

export function sendUnauthorized(res: ServerResponse): void {
  res.statusCode = 401;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "unauthorized", message: "Missing or invalid X-API-Key" }));
}

export function requireApiKey(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = getExpectedApiKey();
  if (!expected) {
    // No API key configured - allow if insecure mode is enabled
    if (isInsecureModeEnabled()) return true;
    // Should be prevented by startApiServer() validation, but keep a safe fallback.
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "server_misconfigured", message: "Y2T_API_KEY is required" }));
    return false;
  }
  if (isPublicPath(req)) return true;
  const provided = extractProvidedApiKey(req);
  if (!provided || provided !== expected) {
    sendUnauthorized(res);
    return false;
  }
  return true;
}
