import { execCommand } from "../utils/exec.js";
import { logWarn, logStep } from "../utils/logger.js";

export type YoutubeVideoMetadata = {
  description?: string;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
  language?: string;
};

export async function fetchVideoMetadata(
  videoUrl: string,
  ytDlpCommand = "yt-dlp",
  ytDlpExtraArgs: string[] = []
): Promise<YoutubeVideoMetadata | undefined> {
  try {
    logStep("meta", `Fetching video metadata for ${videoUrl}`);
    const args = [
      ...ytDlpExtraArgs,
      "--dump-single-json",
      "--no-playlist",
      "--skip-download",
      videoUrl,
    ];
    const result = await execCommand(ytDlpCommand, args);
    if (result.exitCode !== 0) {
      logWarn(`yt-dlp meta failed: ${result.stderr || result.stdout}`);
      return undefined;
    }
    return JSON.parse(result.stdout) as YoutubeVideoMetadata;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    logWarn(`Failed to fetch metadata: ${message}`);
    return undefined;
  }
}

export async function fetchVideoDescription(
  videoUrl: string,
  ytDlpCommand = "yt-dlp",
  ytDlpExtraArgs: string[] = []
): Promise<string | undefined> {
  try {
    const meta = await fetchVideoMetadata(
      videoUrl,
      ytDlpCommand,
      ytDlpExtraArgs
    );
    const desc = meta?.description?.trim();
    return desc && desc.length > 0 ? desc : undefined;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    logWarn(`Failed to fetch description: ${message}`);
    return undefined;
  }
}
