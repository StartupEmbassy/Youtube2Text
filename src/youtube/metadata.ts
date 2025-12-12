import { execCommand } from "../utils/exec.js";
import { logWarn, logStep } from "../utils/logger.js";

type YtDlpVideoMeta = {
  description?: string;
};

export async function fetchVideoDescription(
  videoUrl: string,
  ytDlpCommand = "yt-dlp"
): Promise<string | undefined> {
  try {
    logStep("meta", `Fetching video description for ${videoUrl}`);
    const args = ["--dump-single-json", "--no-playlist", videoUrl];
    const result = await execCommand(ytDlpCommand, args);
    if (result.exitCode !== 0) {
      logWarn(`yt-dlp meta failed: ${result.stderr || result.stdout}`);
      return undefined;
    }
    const meta = JSON.parse(result.stdout) as YtDlpVideoMeta;
    const desc = meta.description?.trim();
    return desc && desc.length > 0 ? desc : undefined;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    logWarn(`Failed to fetch description: ${message}`);
    return undefined;
  }
}

