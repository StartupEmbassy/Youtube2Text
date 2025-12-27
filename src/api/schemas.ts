import { z } from "zod";

const optionalNumber = () =>
  z.preprocess((value) => (value === null ? undefined : value), z.number().optional());
const optionalString = () =>
  z.preprocess((value) => (value === null ? undefined : value), z.string().optional());
const optionalBoolean = () =>
  z.preprocess((value) => (value === null ? undefined : value), z.boolean().optional());

export const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});

export const watchlistCreateSchema = z.object({
  channelUrl: z.string().min(1),
  intervalMinutes: optionalNumber(),
  enabled: optionalBoolean(),
});

export const watchlistUpdateSchema = z.object({
  intervalMinutes: z.number().optional().nullable(),
  enabled: optionalBoolean(),
});

export const runPlanSchema = z.object({
  url: z.string().min(1),
  force: optionalBoolean(),
  maxNewVideos: optionalNumber(),
  afterDate: optionalString(),
  config: z.record(z.unknown()).optional(),
});

export const runCreateSchema = z.object({
  url: z.string().min(1),
  force: optionalBoolean(),
  maxNewVideos: optionalNumber(),
  afterDate: optionalString(),
  callbackUrl: optionalString(),
  config: z.record(z.unknown()).optional(),
});

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
export type WatchlistCreateInput = z.infer<typeof watchlistCreateSchema>;
export type WatchlistUpdateInput = z.infer<typeof watchlistUpdateSchema>;
export type RunPlanInput = z.infer<typeof runPlanSchema>;
export type RunCreateInput = z.infer<typeof runCreateSchema>;
