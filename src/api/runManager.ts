import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AppConfig } from "../config/schema.js";
import { runPipeline } from "../pipeline/run.js";
import type { PipelineEvent, PipelineEventEmitter } from "../pipeline/events.js";
import { EventBuffer } from "./eventBuffer.js";
import { FileSystemStorageAdapter } from "../storage/index.js";
import { makeChannelDirName } from "../storage/naming.js";
import { configSchema } from "../config/schema.js";
import {
  appendEvent,
  createRunPersistence,
  loadPersistedEventsTail,
  loadPersistedRuns,
  RunPersistence,
  writeRunRecord,
  ensureDir,
} from "./persistence.js";

export type RunStatus = "queued" | "running" | "done" | "error";

export type RunRecord = {
  runId: string;
  status: RunStatus;
  inputUrl: string;
  force: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  channelId?: string;
  channelTitle?: string;
  channelDirName?: string;
  stats?: { succeeded: number; failed: number; skipped: number; total: number };
};

export type RunCreateRequest = {
  url: string;
  force?: boolean;
  config?: Partial<AppConfig>;
};

export type RunManagerOptions = {
  maxBufferedEventsPerRun: number;
  persistRuns: boolean;
  persistDir?: string;
};

export class RunManager {
  private runs = new Map<string, RunRecord>();
  private buffers = new Map<string, EventBuffer>();
  private listeners = new Map<
    string,
    Set<(buffered: { id: number; event: PipelineEvent }) => void>
  >();
  private persistence?: RunPersistence;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(
    private baseConfig: AppConfig,
    private options: RunManagerOptions
  ) {
    if (options.persistRuns) {
      const dir = options.persistDir ?? join(baseConfig.outputDir, "_runs");
      this.persistence = createRunPersistence(dir);
    }
  }

  async init(): Promise<void> {
    if (!this.persistence) return;
    await ensureDir(this.persistence.rootDir);
    const persisted = await loadPersistedRuns(this.persistence);
    for (const record of persisted) {
      this.runs.set(record.runId, record);
      const buffer = new EventBuffer(this.options.maxBufferedEventsPerRun);
      const events = await loadPersistedEventsTail(
        this.persistence,
        record.runId,
        this.options.maxBufferedEventsPerRun
      );
      let maxId = 0;
      for (const e of events) {
        buffer.appendWithId(e.id, e.event);
        maxId = Math.max(maxId, e.id);
      }
      buffer.setNextId(maxId + 1);
      this.buffers.set(record.runId, buffer);
      this.listeners.set(record.runId, new Set());
    }
  }

  async flush(): Promise<void> {
    await this.persistChain;
  }

  createRun(req: RunCreateRequest): RunRecord {
    const runId = randomUUID();
    const record: RunRecord = {
      runId,
      status: "queued",
      inputUrl: req.url,
      force: Boolean(req.force),
      createdAt: new Date().toISOString(),
    };
    this.runs.set(runId, record);
    this.buffers.set(runId, new EventBuffer(this.options.maxBufferedEventsPerRun));
    this.listeners.set(runId, new Set());
    this.persistRun(record);
    return record;
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  listRuns(): RunRecord[] {
    return Array.from(this.runs.values()).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  }

  subscribe(
    runId: string,
    handler: (buffered: { id: number; event: PipelineEvent }) => void
  ): () => void {
    const set = this.listeners.get(runId);
    if (!set) throw new Error("Unknown run");
    set.add(handler);
    return () => set.delete(handler);
  }

  listEventsAfter(runId: string, lastSeenId: number) {
    const buffer = this.buffers.get(runId);
    if (!buffer) throw new Error("Unknown run");
    return buffer.listAfter(lastSeenId);
  }

  async listArtifacts(runId: string) {
    const run = this.getRun(runId);
    if (!run) throw new Error("Unknown run");
    if (!run.channelDirName) {
      return { channelDirName: undefined, videos: [] as unknown[] };
    }
    const adapter = new FileSystemStorageAdapter({
      outputDir: this.baseConfig.outputDir,
      audioDir: this.baseConfig.audioDir,
      audioFormat: this.baseConfig.audioFormat,
    });
    const videos = await adapter.listVideos(run.channelDirName);
    return {
      channelDirName: run.channelDirName,
      channelId: run.channelId,
      channelTitle: run.channelTitle,
      videos,
    };
  }

  startRun(runId: string, req: RunCreateRequest): void {
    const run = this.getRun(runId);
    if (!run) throw new Error("Unknown run");
    if (run.status !== "queued") throw new Error("Run already started");

    const sanitizedOverrides = this.sanitizeOverrides(req.config);
    const config = { ...this.baseConfig, ...sanitizedOverrides };
    const emitter: PipelineEventEmitter = {
      emit: (event) => this.onEvent(runId, event),
    };

    run.status = "running";
    run.startedAt = new Date().toISOString();
    this.persistRun(run);

    void runPipeline(req.url, config, { force: Boolean(req.force), emitter })
      .then(() => {
        const updated = this.runs.get(runId);
        if (!updated) return;
        if (updated.status === "running") {
          updated.status = "done";
          updated.finishedAt = new Date().toISOString();
          this.persistRun(updated);
        }
      })
      .catch((error) => {
        const updated = this.runs.get(runId);
        if (!updated) return;
        updated.status = "error";
        updated.finishedAt = new Date().toISOString();
        updated.error = error instanceof Error ? error.message : String(error);
        this.persistRun(updated);
      });
  }

  private onEvent(runId: string, event: PipelineEvent) {
    const buffer = this.buffers.get(runId);
    if (!buffer) return;
    const buffered = buffer.append(event);
    this.persistEvent(runId, buffered.id, event);

    const run = this.runs.get(runId);
    if (run) {
      if (event.type === "run:start") {
        run.channelId = event.channelId;
        run.channelTitle = event.channelTitle;
        run.channelDirName = makeChannelDirName(event.channelId, event.channelTitle);
        this.persistRun(run);
      }
      if (event.type === "run:done") {
        run.stats = {
          succeeded: event.succeeded,
          failed: event.failed,
          skipped: event.skipped,
          total: event.total,
        };
        this.persistRun(run);
      }
      if (event.type === "run:error") {
        run.error = event.error;
        this.persistRun(run);
      }
    }

    const handlers = this.listeners.get(runId);
    if (!handlers) return;
    for (const handler of handlers) handler(buffered);
  }

  private sanitizeOverrides(overrides: Partial<AppConfig> | undefined) {
    if (!overrides) return {};
    const copy: Record<string, unknown> = { ...overrides };
    delete copy.assemblyAiApiKey;
    const parsed = configSchema.partial().safeParse(copy);
    return parsed.success ? parsed.data : {};
  }

  private enqueuePersist(task: () => Promise<void>) {
    this.persistChain = this.persistChain.then(task).catch(() => {});
  }

  private persistRun(record: RunRecord) {
    if (!this.persistence) return;
    this.enqueuePersist(() => writeRunRecord(this.persistence!, record));
  }

  private persistEvent(runId: string, id: number, event: PipelineEvent) {
    if (!this.persistence) return;
    this.enqueuePersist(() => appendEvent(this.persistence!, runId, { id, event }));
  }
}
