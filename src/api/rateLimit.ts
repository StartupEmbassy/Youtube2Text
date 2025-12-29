export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type Bucket = {
  lastRefill: number;
  tokens: number;
};

export type RateLimiter = {
  check(key: string): RateLimitDecision;
};

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

function clampInt(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

export function getRateLimitConfigFromEnv(): RateLimitConfig {
  const windowMs = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_WINDOW_MS, 60_000), 1_000, 3_600_000);
  const maxRequests = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_WRITE_MAX, 60), 0, 10_000);
  return { windowMs, maxRequests };
}

export function getReadRateLimitConfigFromEnv(): RateLimitConfig {
  const windowMs = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_READ_WINDOW_MS, 60_000), 1_000, 3_600_000);
  const maxRequests = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_READ_MAX, 300), 0, 100_000);
  return { windowMs, maxRequests };
}

export function getHealthRateLimitConfigFromEnv(): RateLimitConfig {
  const windowMs = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_HEALTH_WINDOW_MS, 60_000), 1_000, 3_600_000);
  const maxRequests = clampInt(parseEnvInt(process.env.Y2T_RATE_LIMIT_HEALTH_MAX, 30), 0, 10_000);
  return { windowMs, maxRequests };
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter | undefined {
  if (config.maxRequests <= 0) return undefined;

  const buckets = new Map<string, Bucket>();
  const cleanupIntervalMs = Math.max(60_000, Math.min(config.windowMs, 300_000));
  const cleanup = setInterval(() => {
    const now = Date.now();
    const expiryMs = config.windowMs * 2;
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > expiryMs) {
        buckets.delete(key);
      }
    }
  }, cleanupIntervalMs);
  cleanup.unref?.();

  return {
    check: (key: string): RateLimitDecision => {
      const now = Date.now();
      const refillRatePerMs = config.maxRequests / config.windowMs;
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { lastRefill: now, tokens: config.maxRequests - 1 });
        return { allowed: true };
      }
      const elapsed = now - bucket.lastRefill;
      if (elapsed > 0) {
        const refill = elapsed * refillRatePerMs;
        bucket.tokens = Math.min(config.maxRequests, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
      }
      const missingTokens = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(missingTokens / refillRatePerMs);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, retryAfterSeconds };
    },
  };
}
