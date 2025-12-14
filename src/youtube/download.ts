import { basename, dirname, join } from "node:path";
import { execCommand } from "../utils/exec.js";
import { ensureDir, fileExists } from "../utils/fs.js";
import { retry } from "../utils/retry.js";
import { logStep } from "../utils/logger.js";

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
        throw new Error(result.stderr || result.stdout);
      }
    },
    { retries, baseDelayMs: 1500, maxDelayMs: 15000 }
  );

  return outputPath;
}
