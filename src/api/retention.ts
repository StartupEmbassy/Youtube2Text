import { promises as fs } from "node:fs";
import { join } from "node:path";

export type RetentionConfig = {
  runsDays: number; // -1 disables
  audioDays: number; // -1 disables
};

export type RetentionResult = {
  nowIso: string;
  runs: { enabled: boolean; days: number; deleted: number; kept: number; errors: number };
  audio: { enabled: boolean; days: number; deletedFiles: number; keptFiles: number; errors: number };
};

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function loadRetentionConfigFromEnv(): RetentionConfig {
  return {
    runsDays: toInt(process.env.Y2T_RETENTION_RUNS_DAYS, 30),
    audioDays: toInt(process.env.Y2T_RETENTION_AUDIO_DAYS, 7),
  };
}

function cutoffMs(days: number, nowMs: number): number {
  return nowMs - days * 24 * 60 * 60 * 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function listDirs(path: string): Promise<string[]> {
  const entries = await fs.readdir(path, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => join(path, e.name));
}

async function listFilesRecursive(path: string): Promise<string[]> {
  const entries = await fs.readdir(path, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = join(path, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFilesRecursive(p)));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function parseIsoMs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

async function runDirTimestampMs(dir: string): Promise<number | undefined> {
  try {
    const runJson = join(dir, "run.json");
    const raw = await fs.readFile(runJson, "utf8");
    const parsed = JSON.parse(raw);
    if (isRecord(parsed)) {
      return (
        parseIsoMs(parsed.finishedAt) ??
        parseIsoMs(parsed.startedAt) ??
        parseIsoMs(parsed.createdAt)
      );
    }
    return undefined;
  } catch {
    try {
      const stat = await fs.stat(dir);
      return stat.mtimeMs;
    } catch {
      return undefined;
    }
  }
}

export async function cleanupPersistedRuns(
  persistDir: string,
  days: number,
  nowMs = Date.now()
): Promise<{ deleted: number; kept: number; errors: number }> {
  if (days < 0) return { deleted: 0, kept: 0, errors: 0 };
  let deleted = 0;
  let kept = 0;
  let errors = 0;
  const cutoff = cutoffMs(days, nowMs);

  try {
    const runDirs = await listDirs(persistDir);
    for (const dir of runDirs) {
      const ts = await runDirTimestampMs(dir);
      if (ts !== undefined && ts < cutoff) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
          deleted += 1;
        } catch {
          errors += 1;
        }
      } else {
        kept += 1;
      }
    }
  } catch {
    errors += 1;
  }

  return { deleted, kept, errors };
}

function isAudioFile(path: string): boolean {
  return path.endsWith(".mp3") || path.endsWith(".wav") || path.endsWith(".m4a");
}

export async function cleanupAudioCache(
  audioDir: string,
  days: number,
  nowMs = Date.now()
): Promise<{ deletedFiles: number; keptFiles: number; errors: number }> {
  if (days < 0) return { deletedFiles: 0, keptFiles: 0, errors: 0 };
  let deletedFiles = 0;
  let keptFiles = 0;
  let errors = 0;
  const cutoff = cutoffMs(days, nowMs);

  try {
    const files = await listFilesRecursive(audioDir);
    for (const file of files) {
      if (!isAudioFile(file)) continue;
      try {
        const stat = await fs.stat(file);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(file, { force: true });
          deletedFiles += 1;
        } else {
          keptFiles += 1;
        }
      } catch {
        errors += 1;
      }
    }
  } catch {
    errors += 1;
  }

  return { deletedFiles, keptFiles, errors };
}

export async function runRetentionCleanup(opts: {
  persistDir?: string;
  audioDir: string;
  config?: RetentionConfig;
  nowMs?: number;
}): Promise<RetentionResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const cfg = opts.config ?? loadRetentionConfigFromEnv();

  const runsEnabled = !!opts.persistDir && cfg.runsDays >= 0;
  const audioEnabled = cfg.audioDays >= 0;

  const runs = runsEnabled
    ? await cleanupPersistedRuns(opts.persistDir!, cfg.runsDays, nowMs)
    : { deleted: 0, kept: 0, errors: 0 };
  const audio = audioEnabled
    ? await cleanupAudioCache(opts.audioDir, cfg.audioDays, nowMs)
    : { deletedFiles: 0, keptFiles: 0, errors: 0 };

  return {
    nowIso: new Date(nowMs).toISOString(),
    runs: {
      enabled: runsEnabled,
      days: cfg.runsDays,
      deleted: runs.deleted,
      kept: runs.kept,
      errors: runs.errors,
    },
    audio: {
      enabled: audioEnabled,
      days: cfg.audioDays,
      deletedFiles: audio.deletedFiles,
      keptFiles: audio.keptFiles,
      errors: audio.errors,
    },
  };
}
