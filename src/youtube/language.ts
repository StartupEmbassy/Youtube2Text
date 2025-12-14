import { logStep, logWarn } from "../utils/logger.js";
import { fetchVideoMetadata, YoutubeVideoMetadata } from "./metadata.js";

function mapToAssemblyAiLanguageCode(ytLang: string): string {
  const primary = ytLang.split("-")[0]?.toLowerCase() ?? ytLang.toLowerCase();
  const map: Record<string, string> = {
    en: "en_us",
    es: "es",
    fr: "fr",
    de: "de",
    pt: "pt",
    it: "it",
    nl: "nl",
  };
  return map[primary] ?? primary;
}

function pickFirstLanguageKey(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = Object.keys(obj as Record<string, unknown>).filter(Boolean);
  if (keys.length === 0) return undefined;
  keys.sort();
  return keys[0];
}

export async function detectLanguageCode(
  videoUrl: string,
  ytDlpCommand: string,
  ytDlpExtraArgs: string[],
  defaultLanguageCode: string
): Promise<{ languageCode: string; detected: boolean; source?: string }> {
  const metadata: YoutubeVideoMetadata | undefined = await fetchVideoMetadata(
    videoUrl,
    ytDlpCommand,
    ytDlpExtraArgs
  );

  const autoCaptionsLang = pickFirstLanguageKey(metadata?.automatic_captions);
  if (autoCaptionsLang) {
    const languageCode = mapToAssemblyAiLanguageCode(autoCaptionsLang);
    logStep("language", `Detected: ${languageCode} (auto_captions)`);
    return { languageCode, detected: true, source: "automatic_captions" };
  }

  const subtitlesLang = pickFirstLanguageKey(metadata?.subtitles);
  if (subtitlesLang) {
    const languageCode = mapToAssemblyAiLanguageCode(subtitlesLang);
    logStep("language", `Detected: ${languageCode} (subtitles)`);
    return { languageCode, detected: true, source: "subtitles" };
  }

  logWarn(`Language undetected -> using default: ${defaultLanguageCode}`);
  return { languageCode: defaultLanguageCode, detected: false };
}

