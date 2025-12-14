import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { RunRecord } from "./runManager.js";
import type { PipelineEvent } from "../pipeline/events.js";

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

export function createRunPersistence(rootDir: string): RunPersistence {
  return {
    rootDir,
    runDir: (runId) => join(rootDir, runId),
    runJsonPath: (runId) => join(rootDir, runId, "run.json"),
    eventsJsonlPath: (runId) => join(rootDir, runId, "events.jsonl"),
  };
}

export async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

export async function writeRunRecord(p: RunPersistence, record: RunRecord) {
  await ensureDir(p.runDir(record.runId));
  await fs.writeFile(p.runJsonPath(record.runId), JSON.stringify(record, null, 2), "utf8");
}

export async function appendEvent(p: RunPersistence, runId: string, line: PersistedEventLine) {
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

