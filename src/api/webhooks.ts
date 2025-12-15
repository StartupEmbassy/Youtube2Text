import { createHmac } from "node:crypto";
import type { RunRecord } from "./runManager.js";

export type RunWebhookEvent =
  | { type: "run:done"; run: RunRecord; timestamp: string }
  | { type: "run:error"; run: RunRecord; timestamp: string };

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

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
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
  if (params.secret && params.secret.trim().length > 0) {
    const payload = `${params.timestamp}.${params.body}`;
    const sig = createHmac("sha256", params.secret).update(payload).digest("hex");
    headers["x-y2t-signature"] = `sha256=${sig}`;
  }
  return headers;
}

export async function deliverWebhook(
  callbackUrl: string,
  event: RunWebhookEvent,
  deps?: { fetch?: typeof fetch }
): Promise<WebhookDeliveryResult> {
  const f = deps?.fetch ?? fetch;
  if (!isHttpUrl(callbackUrl)) {
    return {
      ok: false,
      error: "Invalid callbackUrl (must be http/https)",
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

