import { z } from "zod";

export const configSchema = z.object({
  assemblyAiApiKey: z.string().min(1),
  outputDir: z.string().default("output"),
  audioDir: z.string().default("audio"),
  filenameStyle: z.enum(["id", "id_title", "title_id"]).default("title_id"),
  audioFormat: z.enum(["mp3", "wav"]).default("mp3"),
  languageCode: z.string().default("en_us"),
  concurrency: z.number().int().positive().default(2),
  maxVideos: z.number().int().positive().optional(),
  afterDate: z.string().optional(),
  csvEnabled: z.boolean().default(false),
  assemblyAiCreditsCheck: z
    .enum(["warn", "abort", "none"])
    .default("warn"),
  assemblyAiMinBalanceMinutes: z.number().int().positive().default(60),
  pollIntervalMs: z.number().int().positive().default(5000),
  maxPollMinutes: z.number().int().positive().default(60),
  downloadRetries: z.number().int().nonnegative().default(2),
  transcriptionRetries: z.number().int().nonnegative().default(2),
  ytDlpPath: z.string().optional()
});

export type AppConfig = z.infer<typeof configSchema>;
