import type { AppConfig } from "../config/schema.js";
import {
  applySettingsToConfig,
  pickNonSecretSettings,
  readSettingsFile,
  sanitizeNonSecretSettings,
  settingsPath,
  writeSettingsFile,
  type NonSecretSettings,
} from "../config/settings.js";

export type SettingsGetResponse = {
  outputDir: string;
  settingsPath: string;
  updatedAt?: string;
  settings: Partial<NonSecretSettings>;
  effective: NonSecretSettings;
};

export type SettingsPatchRequest = {
  // Values may be null to clear optional fields.
  settings: Partial<Record<keyof NonSecretSettings, unknown>> & Record<string, unknown>;
};

export async function getSettingsResponse(baseConfig: AppConfig): Promise<SettingsGetResponse> {
  const file = await readSettingsFile(baseConfig.outputDir);
  const settings = sanitizeNonSecretSettings(file?.settings);
  const effectiveConfig = applySettingsToConfig(baseConfig, settings);
  return {
    outputDir: baseConfig.outputDir,
    settingsPath: settingsPath(baseConfig.outputDir),
    updatedAt: file?.updatedAt,
    settings,
    effective: pickNonSecretSettings(effectiveConfig),
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

