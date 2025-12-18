import { z } from "zod";

export const configSchema = z.object({
  assemblyAiApiKey: z.string().min(1),
  outputDir: z.string().default("output"),
  audioDir: z.string().default("audio"),
  filenameStyle: z.enum(["id", "id_title", "title_id"]).default("title_id"),
  audioFormat: z.enum(["mp3", "wav"]).default("mp3"),
  languageDetection: z.enum(["auto", "manual"]).default("auto"),
  languageCode: z.string().default("en_us"),
  concurrency: z.number().int().positive().default(2),
  maxNewVideos: z.number().int().positive().optional(),
  afterDate: z.string().optional(),
  csvEnabled: z.boolean().default(false),
  assemblyAiCreditsCheck: z
    .enum(["warn", "abort", "none"])
    .default("warn"),
  assemblyAiMinBalanceMinutes: z.number().int().positive().default(60),
  commentsEnabled: z.boolean().default(false),
  commentsMax: z.number().int().positive().optional(),
  pollIntervalMs: z.number().int().positive().default(5000),
  maxPollMinutes: z.number().int().positive().default(60),
  downloadRetries: z.number().int().nonnegative().default(2),
  transcriptionRetries: z.number().int().nonnegative().default(2),
  // Channel catalog cache TTL for exact planning. When exceeded, we force a full refresh.
  // Set <= 0 to disable TTL (cache never expires).
  catalogMaxAgeHours: z.number().int().default(168),
  ytDlpPath: z.string().optional(),
  ytDlpExtraArgs: z.array(z.string()).default([]),
});

export type AppConfig = z.infer<typeof configSchema>;
