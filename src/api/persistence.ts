import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { RunRecord } from "./runManager.js";
import type { PipelineEvent } from "../pipeline/events.js";
import { ensureDir, writeJson } from "../utils/fs.js";

export type PersistedEventLine = {
  id: number;
  event: PipelineEvent;
};

export type RunPersistence = {
  rootDir: string;
  runDir(runId: string): string;
  runJsonPath(runId: string): string;
  eventsJsonlPath(runId: string): string;
};

const RUN_ID_RE = /^[0-9a-fA-F-]{36}$/;

function isSafeRunId(runId: string): boolean {
  return RUN_ID_RE.test(runId) && !runId.includes("..");
}

function assertSafeRunId(runId: string): void {
  if (!isSafeRunId(runId)) {
    throw new Error(`Invalid runId: ${runId}`);
  }
}

export function createRunPersistence(rootDir: string): RunPersistence {
  return {
    rootDir,
    runDir: (runId) => join(rootDir, runId),
    runJsonPath: (runId) => join(rootDir, runId, "run.json"),
    eventsJsonlPath: (runId) => join(rootDir, runId, "events.jsonl"),
  };
}

export async function writeRunRecord(p: RunPersistence, record: RunRecord) {
  assertSafeRunId(record.runId);
  await ensureDir(p.runDir(record.runId));
  await writeJson(p.runJsonPath(record.runId), record);
}

export async function appendEvent(p: RunPersistence, runId: string, line: PersistedEventLine) {
  assertSafeRunId(runId);
  await ensureDir(p.runDir(runId));
  await fs.appendFile(p.eventsJsonlPath(runId), JSON.stringify(line) + "\n", "utf8");
}

export async function loadPersistedRuns(p: RunPersistence): Promise<RunRecord[]> {
  try {
    const entries = await fs.readdir(p.rootDir, { withFileTypes: true });
    const runs: RunRecord[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const runId = entry.name;
      if (!isSafeRunId(runId)) continue;
      try {
        const raw = await fs.readFile(p.runJsonPath(runId), "utf8");
        runs.push(JSON.parse(raw) as RunRecord);
      } catch {
        continue;
      }
    }
    return runs;
  } catch {
    return [];
  }
}

export async function loadPersistedEventsTail(
  p: RunPersistence,
  runId: string,
  maxLines: number
): Promise<PersistedEventLine[]> {
  assertSafeRunId(runId);
  try {
    const raw = await fs.readFile(p.eventsJsonlPath(runId), "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const tail = lines.slice(Math.max(0, lines.length - maxLines));
    const parsed: PersistedEventLine[] = [];
    for (const line of tail) {
      try {
        parsed.push(JSON.parse(line) as PersistedEventLine);
      } catch {
        continue;
      }
    }
    return parsed;
  } catch {
    return [];
  }
}
