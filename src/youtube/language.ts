import { logStep, logWarn } from "../utils/logger.js";
import { fetchVideoMetadata, YoutubeVideoMetadata } from "./metadata.js";

// AssemblyAI supported language codes
// https://www.assemblyai.com/docs/concepts/supported-languages
const ASSEMBLYAI_SUPPORTED = new Set([
  "en", "en_au", "en_uk", "en_us",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "hi",
  "ja",
  "zh",
  "fi",
  "ko",
  "pl",
  "ru",
  "tr",
  "uk",
  "vi",
]);

const YT_TO_ASSEMBLYAI: Record<string, string> = {
  en: "en_us",
  "en-us": "en_us",
  "en-gb": "en_uk",
  "en-au": "en_au",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  it: "it",
  nl: "nl",
  hi: "hi",
  ja: "ja",
  zh: "zh",
  "zh-hans": "zh",
  "zh-hant": "zh",
  fi: "fi",
  ko: "ko",
  pl: "pl",
  ru: "ru",
  tr: "tr",
  uk: "uk",
  vi: "vi",
};

export function mapToAssemblyAiLanguageCode(ytLang: string): string | undefined {
  const normalized = ytLang.toLowerCase();
  const direct = YT_TO_ASSEMBLYAI[normalized];
  if (direct) return direct;

  const primary = normalized.split("-")[0] ?? normalized;
  const primaryMapped = YT_TO_ASSEMBLYAI[primary];
  if (primaryMapped) return primaryMapped;

  if (ASSEMBLYAI_SUPPORTED.has(primary)) {
    return primary;
  }
  return undefined; // Not supported
}

export function normalizeAssemblyAiLanguageCode(input: string): string | undefined {
  return mapToAssemblyAiLanguageCode(input);
}

export function isAssemblyAiLanguageCode(input: string): boolean {
  return mapToAssemblyAiLanguageCode(input) !== undefined;
}

function pickSupportedLanguageKey(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = Object.keys(obj as Record<string, unknown>);
  // Find first key that maps to a supported AssemblyAI language
  for (const key of keys) {
    if (mapToAssemblyAiLanguageCode(key)) {
      return key;
    }
  }
  return undefined;
}

export function chooseLanguageCodeFromMetadata(
  metadata: YoutubeVideoMetadata | undefined,
  defaultLanguageCode: string
): { languageCode: string; detected: boolean; source?: string } {
  // Priority 1: Use the video's primary language field (most reliable)
  if (metadata?.language) {
    const mapped = mapToAssemblyAiLanguageCode(metadata.language);
    if (mapped) {
      return {
        languageCode: mapped,
        detected: true,
        source: "language",
      };
    }
  }

  // Priority 2: Check subtitles (manually uploaded, more reliable than auto)
  const subtitlesLang = pickSupportedLanguageKey(metadata?.subtitles);
  if (subtitlesLang) {
    const mapped = mapToAssemblyAiLanguageCode(subtitlesLang);
    if (mapped) {
      return {
        languageCode: mapped,
        detected: true,
        source: "subtitles",
      };
    }
  }

  // Priority 3: Check automatic_captions (least reliable - YouTube generates all languages)
  const autoCaptionsLang = pickSupportedLanguageKey(metadata?.automatic_captions);
  if (autoCaptionsLang) {
    const mapped = mapToAssemblyAiLanguageCode(autoCaptionsLang);
    if (mapped) {
      return {
        languageCode: mapped,
        detected: true,
        source: "automatic_captions",
      };
    }
  }

  return { languageCode: defaultLanguageCode, detected: false };
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

  const selection = chooseLanguageCodeFromMetadata(
    metadata,
    defaultLanguageCode
  );
  if (selection.detected) {
    logStep("language", `Detected: ${selection.languageCode} (${selection.source})`);
    return selection;
  }

  return selection;
}
