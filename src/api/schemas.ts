import { z } from "zod";

const optionalString = () =>
  z.preprocess((value) => (value === null ? undefined : value), z.string().optional());
const optionalBoolean = () =>
  z.preprocess((value) => (value === null ? undefined : value), z.boolean().optional());

function clampInt(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}

const optionalClampedInt = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value !== "number" || !Number.isFinite(value)) return value;
      return clampInt(Math.trunc(value), min, max);
    },
    z.number().int().min(min).max(max).optional()
  );

const optionalClampedIntOrNull = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === null) return null;
      if (value === undefined) return undefined;
      if (typeof value !== "number" || !Number.isFinite(value)) return value;
      return clampInt(Math.trunc(value), min, max);
    },
    z.union([z.number().int().min(min).max(max), z.literal(null)]).optional()
  );

const optionalIsoDateOrEmpty = () =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value !== "string") return value;
      return value.trim();
    },
    z
      .union([
        z.literal(""),
        z.string().refine((v) => isValidIsoDate(v), {
          message: "must be YYYY-MM-DD",
        }),
      ])
      .optional()
  );

export const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});

export const watchlistCreateSchema = z.object({
  channelUrl: z.string().min(1),
  intervalMinutes: optionalClampedInt(1, 10080),
  enabled: optionalBoolean(),
});

export const watchlistUpdateSchema = z.object({
  intervalMinutes: optionalClampedIntOrNull(1, 10080),
  enabled: optionalBoolean(),
});

export const runPlanSchema = z.object({
  url: z.string().min(1),
  force: optionalBoolean(),
  maxNewVideos: optionalClampedInt(1, 5000),
  afterDate: optionalIsoDateOrEmpty(),
  config: z.record(z.unknown()).optional(),
});

export const runCreateSchema = z.object({
  url: z.string().min(1),
  force: optionalBoolean(),
  maxNewVideos: optionalClampedInt(1, 5000),
  afterDate: optionalIsoDateOrEmpty(),
  callbackUrl: optionalString(),
  config: z.record(z.unknown()).optional(),
});

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
export type WatchlistCreateInput = z.infer<typeof watchlistCreateSchema>;
export type WatchlistUpdateInput = z.infer<typeof watchlistUpdateSchema>;
export type RunPlanInput = z.infer<typeof runPlanSchema>;
export type RunCreateInput = z.infer<typeof runCreateSchema>;
