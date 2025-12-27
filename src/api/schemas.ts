import { z } from "zod";

export const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});

export const watchlistCreateSchema = z.object({
  channelUrl: z.string().min(1),
  intervalMinutes: z.number().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const watchlistUpdateSchema = z.object({
  intervalMinutes: z.number().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const runPlanSchema = z.object({
  url: z.string().min(1),
  force: z.boolean().optional(),
  maxNewVideos: z.number().optional(),
  afterDate: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export const runCreateSchema = z.object({
  url: z.string().min(1),
  force: z.boolean().optional(),
  maxNewVideos: z.number().optional(),
  afterDate: z.string().optional(),
  callbackUrl: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
export type WatchlistCreateInput = z.infer<typeof watchlistCreateSchema>;
export type WatchlistUpdateInput = z.infer<typeof watchlistUpdateSchema>;
export type RunPlanInput = z.infer<typeof runPlanSchema>;
export type RunCreateInput = z.infer<typeof runCreateSchema>;
