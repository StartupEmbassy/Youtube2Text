import type { AppConfig } from "../config/schema.js";
import { configSchema } from "../config/schema.js";

export function sanitizeConfigOverrides(
  overrides: Partial<AppConfig> | undefined
): Partial<AppConfig> {
  if (!overrides) return {};
  const copy: Record<string, unknown> = { ...overrides };
  delete copy.assemblyAiApiKey;
  const parsed = configSchema.partial().safeParse(copy);
  return parsed.success ? parsed.data : {};
}

