import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import YAML from "yaml";
import { configSchema, AppConfig } from "./schema.js";

type PartialConfig = Partial<Record<keyof AppConfig, unknown>>;

function loadYamlConfig(path: string): PartialConfig {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  return YAML.parse(raw) ?? {};
}

function loadEnvConfig(): PartialConfig {
  dotenv.config();
  const env = process.env;
  return {
    assemblyAiApiKey: env.ASSEMBLYAI_API_KEY,
    outputDir: env.OUTPUT_DIR,
    audioDir: env.AUDIO_DIR,
    audioFormat: env.AUDIO_FORMAT,
    languageCode: env.LANGUAGE_CODE,
    concurrency: env.CONCURRENCY ? Number(env.CONCURRENCY) : undefined,
    maxVideos: env.MAX_VIDEOS ? Number(env.MAX_VIDEOS) : undefined,
    afterDate: env.AFTER_DATE,
    csvEnabled: env.CSV_ENABLED === "true",
    pollIntervalMs: env.POLL_INTERVAL_MS
      ? Number(env.POLL_INTERVAL_MS)
      : undefined,
    maxPollMinutes: env.MAX_POLL_MINUTES
      ? Number(env.MAX_POLL_MINUTES)
      : undefined,
    downloadRetries: env.DOWNLOAD_RETRIES
      ? Number(env.DOWNLOAD_RETRIES)
      : undefined,
    transcriptionRetries: env.TRANSCRIPTION_RETRIES
      ? Number(env.TRANSCRIPTION_RETRIES)
      : undefined,
    ytDlpPath: env.YT_DLP_PATH || env.YTDLP_PATH
  };
}

export function loadConfig(configPath = "config.yaml"): AppConfig {
  const yamlConfig = loadYamlConfig(resolve(configPath));
  const envConfig = loadEnvConfig();
  const merged = { ...yamlConfig, ...envConfig };
  return configSchema.parse(merged);
}
