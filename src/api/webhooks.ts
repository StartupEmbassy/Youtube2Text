import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { RunRecord } from "./runManager.js";

export type RunWebhookEvent =
  | { type: "run:done"; run: RunRecord; timestamp: string }
  | { type: "run:error"; run: RunRecord; timestamp: string }
  | { type: "run:cancelled"; run: RunRecord; timestamp: string };

export type WebhookDeliveryResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string; retryable: boolean };

function isHttpUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseAllowedDomains(): string[] {
  const raw = process.env.Y2T_WEBHOOK_ALLOWED_DOMAINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function isPrivateIpv4(host: string): boolean {
  if (host.startsWith("10.")) return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  if (host.startsWith("0.")) return true;
  const parts = host.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return false;
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7
  if (normalized.startsWith("fe80")) return true; // link-local
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host === "metadata.google.internal") return true;
  const ip = isIP(host);
  if (ip === 4) return isPrivateIpv4(host);
  if (ip === 6) return isPrivateIpv6(host);
  return false;
}

function isPrivateIp(address: string): boolean {
  const ip = isIP(address);
  if (ip === 4) return isPrivateIpv4(address);
  if (ip === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      const v4 = normalized.slice("::ffff:".length);
      return isPrivateIpv4(v4);
    }
    return isPrivateIpv6(address);
  }
  return false;
}

function matchesAllowedDomain(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const base = allowed.toLowerCase().replace(/\.$/, "");
  if (host === base) return true;
  return host.endsWith(`.${base}`);
}

type ResolveHostFn = (hostname: string) => Promise<string[]>;

async function defaultResolveHost(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

async function isAllowedWebhookUrl(
  urlString: string,
  resolveHost: ResolveHostFn
): Promise<{ ok: boolean; error?: string }> {
  if (!isHttpUrl(urlString)) {
    return { ok: false, error: "Invalid callbackUrl (must be http/https)" };
  }
  const url = new URL(urlString);
  const hostname = url.hostname;
  if (!hostname || isBlockedHostname(hostname)) {
    return { ok: false, error: "callbackUrl host is not allowed" };
  }
  const allowlist = parseAllowedDomains();
  if (allowlist.length > 0) {
    const ok = allowlist.some((allowed) => matchesAllowedDomain(hostname, allowed));
    if (!ok) return { ok: false, error: "callbackUrl host not in allowlist" };
  }
  try {
    const resolved = await resolveHost(hostname);
    if (resolved.some((addr) => isPrivateIp(addr))) {
      return { ok: false, error: "callbackUrl resolves to a blocked IP" };
    }
  } catch (err) {
    return {
      ok: false,
      error: `callbackUrl host resolution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ok: true };
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function getWebhookMaxAgeSeconds(): number | undefined {
  const value = parseIntEnv("Y2T_WEBHOOK_MAX_AGE_SECONDS", 0);
  return value > 0 ? value : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoffMs(attemptIndex: number): number {
  const base = 500;
  const exp = Math.min(4, attemptIndex);
  const ms = base * Math.pow(2, exp);
  const jitter = Math.floor(Math.random() * 200);
  return ms + jitter;
}

export function buildWebhookHeaders(params: {
  secret?: string;
  timestamp: string;
  body: string;
  eventType: RunWebhookEvent["type"];
}): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-y2t-event": params.eventType,
    "x-y2t-timestamp": params.timestamp,
  };
  const maxAgeSeconds = getWebhookMaxAgeSeconds();
  if (maxAgeSeconds) {
    headers["x-y2t-max-age"] = String(maxAgeSeconds);
  }
  if (params.secret && params.secret.trim().length > 0) {
    const payload = `${params.timestamp}.${params.body}`;
    const sig = createHmac("sha256", params.secret).update(payload).digest("hex");
    headers["x-y2t-signature"] = `sha256=${sig}`;
  }
  return headers;
}

export function verifyWebhookSignature(params: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  maxAgeSeconds?: number;
  nowMs?: number;
}): { ok: boolean; error?: string } {
  if (!params.secret || params.secret.trim().length === 0) {
    return { ok: false, error: "Missing secret" };
  }
  const expectedPrefix = "sha256=";
  if (!params.signature.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid signature format" };
  }
  const sigHex = params.signature.slice(expectedPrefix.length);
  const payload = `${params.timestamp}.${params.body}`;
  const expected = createHmac("sha256", params.secret).update(payload).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sigHex, "hex");
  const maxLen = Math.max(a.length, b.length);
  const ap = Buffer.alloc(maxLen);
  const bp = Buffer.alloc(maxLen);
  a.copy(ap);
  b.copy(bp);
  if (!timingSafeEqual(ap, bp) || a.length !== b.length) {
    return { ok: false, error: "Signature mismatch" };
  }

  const tsMs = Date.parse(params.timestamp);
  if (!Number.isFinite(tsMs)) {
    return { ok: false, error: "Invalid timestamp" };
  }
  const maxAgeSeconds =
    params.maxAgeSeconds ?? getWebhookMaxAgeSeconds() ?? undefined;
  if (maxAgeSeconds && maxAgeSeconds > 0) {
    const nowMs = params.nowMs ?? Date.now();
    const ageMs = Math.abs(nowMs - tsMs);
    if (ageMs > maxAgeSeconds * 1000) {
      return { ok: false, error: "Timestamp outside allowed window" };
    }
  }

  return { ok: true };
}

export async function deliverWebhook(
  callbackUrl: string,
  event: RunWebhookEvent,
  deps?: { fetch?: typeof fetch; resolveHost?: ResolveHostFn }
): Promise<WebhookDeliveryResult> {
  const f = deps?.fetch ?? fetch;
  const resolveHost = deps?.resolveHost ?? defaultResolveHost;
  const allowed = await isAllowedWebhookUrl(callbackUrl, resolveHost);
  if (!allowed.ok) {
    return {
      ok: false,
      error: allowed.error ?? "Invalid callbackUrl",
      retryable: false,
    };
  }

  const secret = process.env.Y2T_WEBHOOK_SECRET;
  const retries = Math.max(0, parseIntEnv("Y2T_WEBHOOK_RETRIES", 3));
  const timeoutMs = Math.max(1000, parseIntEnv("Y2T_WEBHOOK_TIMEOUT_MS", 5000));

  const body = JSON.stringify(event);
  const headers = buildWebhookHeaders({
    secret,
    timestamp: event.timestamp,
    body,
    eventType: event.type,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await f(callbackUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
        redirect: "error",
      });
      clearTimeout(timeout);

      if (res.ok) return { ok: true, status: res.status };

      const status = res.status;
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt === retries) {
        return {
          ok: false,
          status,
          error: `HTTP ${status}`,
          retryable,
        };
      }
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          retryable: true,
        };
      }
    }

    await delay(jitteredBackoffMs(attempt));
  }

  return { ok: false, error: "Exhausted retries", retryable: true };
}

export async function deliverRunTerminalWebhook(
  run: RunRecord,
  eventType: RunWebhookEvent["type"]
): Promise<WebhookDeliveryResult | undefined> {
  if (!run.callbackUrl) return undefined;
  const event: RunWebhookEvent = {
    type: eventType,
    run,
    timestamp: new Date().toISOString(),
  };
  return deliverWebhook(run.callbackUrl, event);
}
