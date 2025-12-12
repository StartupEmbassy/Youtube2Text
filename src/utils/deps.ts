import { execCommand } from "./exec.js";

export async function validateYtDlpInstalled() {
  try {
    const res = await execCommand("yt-dlp", ["--version"]);
    if (res.exitCode !== 0) throw new Error(res.stderr);
  } catch {
    throw new Error(
      "yt-dlp not found. Install it:\n" +
        "  pip install yt-dlp\n" +
        "  or visit: https://github.com/yt-dlp/yt-dlp"
    );
  }
}

