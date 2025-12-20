import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import YAML from "yaml";
import { configSchema, AppConfig } from "./schema.js";
import { readSettingsFileSync } from "./settings.js";

type PartialConfig = Partial<Record<keyof AppConfig, unknown>>;

function loadYamlConfig(path: string): PartialConfig {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  return YAML.parse(raw) ?? {};
}

function loadEnvConfig(): PartialConfig {
  dotenv.config();
  const env = process.env;
  const parseOptionalBool = (raw: string | undefined): boolean | undefined => {
    if (raw === undefined) return undefined;
    const v = raw.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  };
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
    csvEnabled: parseOptionalBool(env.CSV_ENABLED),
    assemblyAiCreditsCheck: env.ASSEMBLYAI_CREDITS_CHECK,
    assemblyAiMinBalanceMinutes: env.ASSEMBLYAI_MIN_BALANCE_MINUTES
      ? Number(env.ASSEMBLYAI_MIN_BALANCE_MINUTES)
      : undefined,
    commentsEnabled: parseOptionalBool(env.COMMENTS_ENABLED),
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
    catalogMaxAgeHours: env.Y2T_CATALOG_MAX_AGE_HOURS
      ? Number(env.Y2T_CATALOG_MAX_AGE_HOURS)
      : undefined,
    ytDlpPath: env.YT_DLP_PATH || env.YTDLP_PATH,
  };
}

function filterUndefined(obj: PartialConfig): PartialConfig {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

export type ConfigSourceSnapshots = {
  outputDirCandidate: string;
  settingsFile: ReturnType<typeof readSettingsFileSync>;
  settingsConfig: PartialConfig;
  yamlConfig: PartialConfig;
  envConfig: PartialConfig;
};

export function loadConfigSourceSnapshots(
  configPath = "config.yaml",
  opts?: { outputDirOverride?: string }
): ConfigSourceSnapshots {
  const yamlConfig = loadYamlConfig(resolve(configPath));
  const envConfig = filterUndefined(loadEnvConfig());

  const outputDirCandidate =
    typeof opts?.outputDirOverride === "string" && opts.outputDirOverride.length > 0
      ? opts.outputDirOverride
      : (typeof envConfig.outputDir === "string" && envConfig.outputDir.length > 0
          ? envConfig.outputDir
          : typeof yamlConfig.outputDir === "string" && (yamlConfig.outputDir as string).length > 0
            ? (yamlConfig.outputDir as string)
            : "output");

  const settingsFile = readSettingsFileSync(outputDirCandidate);
  const settingsConfig = settingsFile?.settings ?? {};

  return {
    outputDirCandidate,
    settingsFile,
    settingsConfig,
    yamlConfig,
    envConfig,
  };
}

export function loadConfig(configPath = "config.yaml"): AppConfig {
  const { settingsConfig, yamlConfig, envConfig } = loadConfigSourceSnapshots(configPath);

  // Precedence: settings (lowest) < config.yaml < .env (highest)
  const merged = { ...settingsConfig, ...yamlConfig, ...envConfig };
  return configSchema.parse(merged);
}
