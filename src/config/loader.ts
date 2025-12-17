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
  let ytDlpExtraArgs: unknown = undefined;
  if (env.YT_DLP_EXTRA_ARGS) {
    try {
      ytDlpExtraArgs = JSON.parse(env.YT_DLP_EXTRA_ARGS);
    } catch {
      ytDlpExtraArgs = undefined;
    }
  }
  return {
    assemblyAiApiKey: env.ASSEMBLYAI_API_KEY,
    outputDir: env.OUTPUT_DIR,
    audioDir: env.AUDIO_DIR,
    filenameStyle: env.FILENAME_STYLE,
    audioFormat: env.AUDIO_FORMAT,
    languageDetection: env.LANGUAGE_DETECTION,
    languageCode: env.LANGUAGE_CODE,
    concurrency: env.CONCURRENCY ? Number(env.CONCURRENCY) : undefined,
    maxNewVideos: env.MAX_NEW_VIDEOS ? Number(env.MAX_NEW_VIDEOS) : undefined,
    afterDate: env.AFTER_DATE,
    csvEnabled: env.CSV_ENABLED === "true",
    assemblyAiCreditsCheck: env.ASSEMBLYAI_CREDITS_CHECK,
    assemblyAiMinBalanceMinutes: env.ASSEMBLYAI_MIN_BALANCE_MINUTES
      ? Number(env.ASSEMBLYAI_MIN_BALANCE_MINUTES)
      : undefined,
    commentsEnabled: env.COMMENTS_ENABLED === "true",
    commentsMax: env.COMMENTS_MAX ? Number(env.COMMENTS_MAX) : undefined,
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
    ytDlpPath: env.YT_DLP_PATH || env.YTDLP_PATH,
    ytDlpExtraArgs,
  };
}

function filterUndefined(obj: PartialConfig): PartialConfig {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

export function loadConfig(configPath = "config.yaml"): AppConfig {
  const yamlConfig = loadYamlConfig(resolve(configPath));
  const envConfig = filterUndefined(loadEnvConfig());
  const merged = { ...yamlConfig, ...envConfig };
  return configSchema.parse(merged);
}
