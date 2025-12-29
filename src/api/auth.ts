import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { getClientIp } from "./ip.js";

type AuthLimitDecision = { allowed: boolean; retryAfterSeconds?: number };

type AuthLimitBucket = { windowStart: number; count: number };

type ApiKeyLengthDecision = { ok: true } | { ok: false; reason: string };

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

function safeEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  const maxLen = Math.max(a.length, b.length);
  const ap = Buffer.alloc(maxLen);
  const bp = Buffer.alloc(maxLen);
  a.copy(ap);
  b.copy(bp);
  const equal = timingSafeEqual(ap, bp);
  return equal && a.length === b.length;
}

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function getApiKeyMaxBytes(): number {
  const raw = parseEnvInt(process.env.Y2T_API_KEY_MAX_BYTES, 256);
  const min = 32;
  const max = 4096;
  if (raw < min) return min;
  if (raw > max) return max;
  return raw;
}

let authFailureLimiter: { check: (key: string) => AuthLimitDecision } | undefined;
let authFailureCleanupTimer: NodeJS.Timeout | undefined;

function getAuthFailureLimiter() {
  if (authFailureLimiter) return authFailureLimiter;
  const windowMs = Math.max(1000, parseEnvInt(process.env.Y2T_AUTH_FAIL_WINDOW_MS, 60_000));
  const maxRequests = Math.max(0, parseEnvInt(process.env.Y2T_AUTH_FAIL_MAX, 30));
  if (maxRequests <= 0) return undefined;

  const buckets = new Map<string, AuthLimitBucket>();
  const cleanupIntervalMs = Math.max(60_000, Math.min(windowMs, 300_000));
  authFailureCleanupTimer = setInterval(() => {
    const now = Date.now();
    const expiryMs = windowMs * 2;
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.windowStart > expiryMs) {
        buckets.delete(key);
      }
    }
  }, cleanupIntervalMs);
  authFailureCleanupTimer.unref?.();
  authFailureLimiter = {
    check: (key: string): AuthLimitDecision => {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { windowStart: now, count: 1 });
        return { allowed: true };
      }
      const elapsed = now - bucket.windowStart;
      if (elapsed >= windowMs) {
        bucket.windowStart = now;
        bucket.count = 1;
        return { allowed: true };
      }
      if (bucket.count >= maxRequests) {
        const retryAfterMs = windowMs - elapsed;
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
        return { allowed: false, retryAfterSeconds };
      }
      bucket.count += 1;
      return { allowed: true };
    },
  };
  return authFailureLimiter;
}

export function resetAuthFailureLimiterForTests(): void {
  authFailureLimiter = undefined;
  if (authFailureCleanupTimer) {
    clearInterval(authFailureCleanupTimer);
    authFailureCleanupTimer = undefined;
  }
}

function sendTooManyRequests(res: ServerResponse, retryAfterSeconds?: number): void {
  res.statusCode = 429;
  if (retryAfterSeconds) res.setHeader("retry-after", String(retryAfterSeconds));
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "rate_limited", message: "Too many auth failures" }));
}

function sendBadRequest(res: ServerResponse, message: string): void {
  res.statusCode = 400;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "bad_request", message }));
}

export function sendUnauthorized(res: ServerResponse): void {
  res.statusCode = 401;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "unauthorized", message: "Missing or invalid X-API-Key" }));
}

function validateApiKeyLength(provided: string): ApiKeyLengthDecision {
  const maxBytes = getApiKeyMaxBytes();
  if (Buffer.byteLength(provided, "utf8") > maxBytes) {
    return { ok: false, reason: `X-API-Key too long (max ${maxBytes} bytes)` };
  }
  return { ok: true };
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
  if (provided) {
    const lengthOk = validateApiKeyLength(provided);
    if (!lengthOk.ok) {
      sendBadRequest(res, lengthOk.reason);
      return false;
    }
  }
  if (!provided || !safeEqual(expected, provided)) {
    const limiter = getAuthFailureLimiter();
    if (limiter) {
      const key = `ip:${getClientIp(req)}`;
      const decision = limiter.check(key);
      if (!decision.allowed) {
        sendTooManyRequests(res, decision.retryAfterSeconds);
        return false;
      }
    }
    sendUnauthorized(res);
    return false;
  }
  return true;
}
