import type { IncomingMessage } from "node:http";

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(",");
  return undefined;
}

function normalizeIp(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 0) return trimmed.slice(1, end);
  }
  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1 && trimmed.includes(".")) {
    return trimmed.split(":")[0];
  }
  return trimmed;
}

function parseForwardedFor(value: string): string | undefined {
  const first = value.split(",")[0];
  if (!first) return undefined;
  return normalizeIp(first);
}

function isTrustProxyEnabled(): boolean {
  const raw = process.env.Y2T_TRUST_PROXY;
  return typeof raw === "string" && raw.trim().toLowerCase() === "true";
}

export function getClientIp(req: IncomingMessage): string {
  if (isTrustProxyEnabled()) {
    const forwarded = getHeader(req, "x-forwarded-for");
    const forwardedIp = forwarded ? parseForwardedFor(forwarded) : undefined;
    if (forwardedIp) return forwardedIp;
    const realIp = getHeader(req, "x-real-ip");
    const normalizedRealIp = realIp ? normalizeIp(realIp) : undefined;
    if (normalizedRealIp) return normalizedRealIp;
  }
  return req.socket.remoteAddress ?? "unknown";
}
