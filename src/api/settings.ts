import type { AppConfig } from "../config/schema.js";
import {
  applySettingsToConfig,
  pickNonSecretSettings,
  readSettingsFile,
  sanitizeNonSecretSettings,
  settingsPath,
  writeSettingsFile,
  type NonSecretSettingSource,
  type NonSecretSettings,
} from "../config/settings.js";
import { loadConfigSourceSnapshots } from "../config/loader.js";

export type SettingsGetResponse = {
  outputDir: string;
  settingsPath: string;
  updatedAt?: string;
  settings: Partial<NonSecretSettings>;
  effective: NonSecretSettings;
  sources: Record<keyof NonSecretSettings, NonSecretSettingSource>;
};

export type SettingsPatchRequest = {
  // Values may be null to clear optional fields.
  settings: Partial<Record<keyof NonSecretSettings, unknown>> & Record<string, unknown>;
};

export async function getSettingsResponse(baseConfig: AppConfig): Promise<SettingsGetResponse> {
  const file = await readSettingsFile(baseConfig.outputDir);
  const settings = sanitizeNonSecretSettings(file?.settings);
  const effectiveConfig = applySettingsToConfig(baseConfig, settings);
  const effective = pickNonSecretSettings(effectiveConfig);
  const sources = computeNonSecretSettingSources(baseConfig.outputDir, effective);
  return {
    outputDir: baseConfig.outputDir,
    settingsPath: settingsPath(baseConfig.outputDir),
    updatedAt: file?.updatedAt,
    settings,
    effective,
    sources,
  };
}

export async function patchSettings(
  baseConfig: AppConfig,
  req: SettingsPatchRequest
): Promise<SettingsGetResponse> {
  const current = await readSettingsFile(baseConfig.outputDir);
  const currentSettings = sanitizeNonSecretSettings(current?.settings);

  // Allow null to clear a key (by deleting).
  const cleanedInput = { ...(req.settings ?? {}) };
  for (const [k, v] of Object.entries(cleanedInput)) {
    if (v === null) delete cleanedInput[k];
  }

  const updates = sanitizeNonSecretSettings(cleanedInput);
  const merged = { ...currentSettings, ...updates };
  await writeSettingsFile(baseConfig.outputDir, merged);
  return getSettingsResponse(baseConfig);
}

function computeNonSecretSettingSources(
  outputDir: string,
  effective: NonSecretSettings
): Record<keyof NonSecretSettings, NonSecretSettingSource> {
  const { settingsConfig, yamlConfig, envConfig } = loadConfigSourceSnapshots("config.yaml", {
    outputDirOverride: outputDir,
  });

  const envHas = (key: keyof NonSecretSettings): boolean => {
    const envVar = envVarForSetting(key);
    if (!envVar) return false;
    return process.env[envVar] !== undefined;
  };

  const sourceFor = (key: keyof NonSecretSettings): NonSecretSettingSource => {
    // env wins (if the env var is set and it produced a defined config value)
    if (envHas(key) && (envConfig as any)[key] !== undefined) return "env";
    // yaml wins over settings file
    if ((yamlConfig as any)[key] !== undefined) return "config.yaml";
    // settings file is lowest
    if ((settingsConfig as any)[key] !== undefined) return "settingsFile";
    // otherwise: schema default or unset optional
    return (effective as any)[key] === undefined ? "unset" : "default";
  };

  const keys: (keyof NonSecretSettings)[] = [
    "filenameStyle",
    "audioFormat",
    "languageDetection",
    "languageCode",
    "concurrency",
    "maxNewVideos",
    "afterDate",
    "csvEnabled",
    "commentsEnabled",
    "commentsMax",
    "pollIntervalMs",
    "maxPollMinutes",
    "downloadRetries",
    "transcriptionRetries",
    "catalogMaxAgeHours",
  ];

  const out: Partial<Record<keyof NonSecretSettings, NonSecretSettingSource>> = {};
  for (const k of keys) out[k] = sourceFor(k);
  return out as Record<keyof NonSecretSettings, NonSecretSettingSource>;
}

function envVarForSetting(key: keyof NonSecretSettings): string | undefined {
  switch (key) {
    case "filenameStyle":
      return "FILENAME_STYLE";
    case "audioFormat":
      return "AUDIO_FORMAT";
    case "languageDetection":
      return "LANGUAGE_DETECTION";
    case "languageCode":
      return "LANGUAGE_CODE";
    case "concurrency":
      return "CONCURRENCY";
    case "maxNewVideos":
      return "MAX_NEW_VIDEOS";
    case "afterDate":
      return "AFTER_DATE";
    case "csvEnabled":
      return "CSV_ENABLED";
    case "commentsEnabled":
      return "COMMENTS_ENABLED";
    case "commentsMax":
      return "COMMENTS_MAX";
    case "pollIntervalMs":
      return "POLL_INTERVAL_MS";
    case "maxPollMinutes":
      return "MAX_POLL_MINUTES";
    case "downloadRetries":
      return "DOWNLOAD_RETRIES";
    case "transcriptionRetries":
      return "TRANSCRIPTION_RETRIES";
    case "catalogMaxAgeHours":
      return "Y2T_CATALOG_MAX_AGE_HOURS";
    default:
      return undefined;
  }
}
