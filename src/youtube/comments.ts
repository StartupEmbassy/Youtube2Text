import { execCommand } from "../utils/exec.js";
import { logStep, logWarn } from "../utils/logger.js";

type YtDlpCommentsMeta = {
  comments?: unknown[];
};

export async function fetchVideoComments(
  videoUrl: string,
  ytDlpCommand = "yt-dlp",
  maxComments?: number
): Promise<unknown[] | undefined> {
  try {
    logStep("comments", `Fetching comments for ${videoUrl}`);
    const args = [
      "--dump-single-json",
      "--no-playlist",
      "--write-comments",
      "--skip-download",
      videoUrl,
    ];
    const result = await execCommand(ytDlpCommand, args);
    if (result.exitCode !== 0) {
      logWarn(
        `yt-dlp comments failed: ${result.stderr || result.stdout}`
      );
      return undefined;
    }
    const meta = JSON.parse(result.stdout) as YtDlpCommentsMeta;
    const comments = meta.comments ?? [];
    if (
      typeof maxComments === "number" &&
      maxComments > 0 &&
      comments.length > maxComments
    ) {
      return comments.slice(0, maxComments);
    }
    return comments;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    logWarn(`Failed to fetch comments: ${message}`);
    return undefined;
  }
}

