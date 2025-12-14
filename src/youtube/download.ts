import { basename, dirname, join } from "node:path";
import { execCommand } from "../utils/exec.js";
import { ensureDir, fileExists } from "../utils/fs.js";
import { retry } from "../utils/retry.js";
import { logStep } from "../utils/logger.js";
import { YtDlpError, parseYtDlpFailure } from "./ytDlpErrors.js";

export async function downloadAudio(
  videoUrl: string,
  outputPath: string,
  audioFormat: "mp3" | "wav",
  retries: number,
  ytDlpCommand = "yt-dlp",
  ytDlpExtraArgs: string[] = []
): Promise<string> {
  await ensureDir(dirname(outputPath));
  const targetDir = dirname(outputPath);
  const filenameNoExt = basename(outputPath, "." + audioFormat);
  const template = join(targetDir, `${filenameNoExt}.%(ext)s`);

  if (await fileExists(outputPath)) {
    return outputPath;
  }

  await retry(
    async () => {
      logStep("download", `Downloading audio: ${videoUrl}`);
      const args = [
        ...ytDlpExtraArgs,
        "-f",
        "ba",
        "-x",
        "--audio-format",
        audioFormat,
        "-o",
        template,
        videoUrl,
      ];
      const result = await execCommand(ytDlpCommand, args);
      if (result.exitCode !== 0) {
        const parsed = parseYtDlpFailure(result);
        if (parsed) {
          const info =
            (parsed.kind === "unknown" || parsed.kind === "transient") &&
            parsed.retryable &&
            !parsed.hint
              ? {
                  ...parsed,
                  hint: 'If this persists, try: YT_DLP_EXTRA_ARGS=["--extractor-args","youtube:player_client=default"]',
                }
              : parsed;
          throw new YtDlpError(info, { stderr: result.stderr, stdout: result.stdout });
        }
        throw new Error(result.stderr || result.stdout);
      }
    },
    {
      retries,
      baseDelayMs: 1500,
      maxDelayMs: 15000,
      shouldRetry: (error) =>
        !(error instanceof YtDlpError) || error.info.retryable,
    }
  );

  return outputPath;
}
