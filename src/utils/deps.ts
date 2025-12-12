import { execCommand } from "./exec.js";
import { fileExists } from "./fs.js";

async function tryCommand(cmd: string): Promise<boolean> {
  const res = await execCommand(cmd, ["--version"]);
  return res.exitCode === 0;
}

export async function resolveYtDlpCommand(): Promise<string> {
  const envPath =
    process.env.YT_DLP_PATH || process.env.YTDLP_PATH || undefined;
  if (envPath) {
    try {
      if (await fileExists(envPath) && (await tryCommand(envPath))) {
        return envPath;
      }
    } catch {
      // fall through
    }
  }

  try {
    if (await tryCommand("yt-dlp")) return "yt-dlp";
  } catch {
    // fall through
  }

  try {
    if (await tryCommand("yt-dlp.exe")) return "yt-dlp.exe";
  } catch {
    // fall through
  }

  try {
    const res = await execCommand("where.exe", ["yt-dlp"]);
    const firstLine = res.stdout.split(/\r?\n/)[0]?.trim();
    if (firstLine && (await fileExists(firstLine))) {
      if (await tryCommand(firstLine)) return firstLine;
    }
  } catch {
    // fall through
  }

  try {
    const res = await execCommand("powershell", [
      "-NoProfile",
      "-Command",
      "(Get-Command yt-dlp).Source",
    ]);
    const candidate = res.stdout.trim();
    if (candidate && (await fileExists(candidate))) {
      if (await tryCommand(candidate)) return candidate;
    }
  } catch {
    // fall through
  }

  try {
    const res = await execCommand("pwsh", [
      "-NoProfile",
      "-Command",
      "(Get-Command yt-dlp).Source",
    ]);
    const candidate = res.stdout.trim();
    if (candidate && (await fileExists(candidate))) {
      if (await tryCommand(candidate)) return candidate;
    }
  } catch {
    // fall through
  }

  throw new Error(
    "yt-dlp not found. Install it:\n" +
      "  pip install yt-dlp\n" +
      "  or visit: https://github.com/yt-dlp/yt-dlp\n" +
      "If installed via winget, restart your shell so PATH is updated.\n" +
      "You can also set YT_DLP_PATH to the full yt-dlp.exe path."
  );
}

export async function validateYtDlpInstalled(): Promise<string> {
  return resolveYtDlpCommand();
}
