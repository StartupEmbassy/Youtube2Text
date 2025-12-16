import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type WatchlistEntry = {
  id: string;
  channelUrl: string;
  channelId?: string;
  channelTitle?: string;
  intervalMinutes?: number;
  enabled: boolean;
  lastCheckedAt?: string;
  lastRunId?: string;
  createdAt: string;
};

export type WatchlistFile = {
  version: 1;
  updatedAt: string;
  entries: WatchlistEntry[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeChannelUrl(url: string): string {
  return url.trim();
}

export class WatchlistStore {
  constructor(private outputDir: string) {}

  private path(): string {
    return join(this.outputDir, "_watchlist.json");
  }

  async load(): Promise<WatchlistFile> {
    try {
      const raw = await fs.readFile(this.path(), "utf8");
      const parsed = JSON.parse(raw) as WatchlistFile;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
        return { version: 1, updatedAt: nowIso(), entries: [] };
      }
      return parsed;
    } catch {
      return { version: 1, updatedAt: nowIso(), entries: [] };
    }
  }

  async save(file: WatchlistFile): Promise<void> {
    const out: WatchlistFile = {
      version: 1,
      updatedAt: nowIso(),
      entries: file.entries,
    };
    await fs.mkdir(this.outputDir, { recursive: true });
    const tmp = `${this.path()}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 2), "utf8");
    await fs.rename(tmp, this.path());
  }

  async list(): Promise<WatchlistEntry[]> {
    const file = await this.load();
    return file.entries;
  }

  async add(input: {
    channelUrl: string;
    intervalMinutes?: number;
    enabled?: boolean;
  }): Promise<WatchlistEntry> {
    if (!isNonEmptyString(input.channelUrl)) {
      throw new Error("Missing channelUrl");
    }
    const file = await this.load();
    const entry: WatchlistEntry = {
      id: randomUUID(),
      channelUrl: normalizeChannelUrl(input.channelUrl),
      intervalMinutes:
        typeof input.intervalMinutes === "number"
          ? Math.trunc(input.intervalMinutes)
          : undefined,
      enabled: input.enabled === undefined ? true : Boolean(input.enabled),
      createdAt: nowIso(),
    };
    file.entries.push(entry);
    await this.save(file);
    return entry;
  }

  async get(id: string): Promise<WatchlistEntry | undefined> {
    const file = await this.load();
    return file.entries.find((e) => e.id === id);
  }

  async update(
    id: string,
    patch: Partial<Pick<WatchlistEntry, "intervalMinutes" | "enabled">>
  ): Promise<WatchlistEntry | undefined> {
    const file = await this.load();
    const entry = file.entries.find((e) => e.id === id);
    if (!entry) return undefined;
    if (patch.intervalMinutes !== undefined) {
      entry.intervalMinutes =
        patch.intervalMinutes === null
          ? undefined
          : Math.trunc(Number(patch.intervalMinutes));
    }
    if (patch.enabled !== undefined) {
      entry.enabled = Boolean(patch.enabled);
    }
    await this.save(file);
    return entry;
  }

  async upsert(entry: WatchlistEntry): Promise<void> {
    const file = await this.load();
    const idx = file.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) file.entries[idx] = entry;
    else file.entries.push(entry);
    await this.save(file);
  }

  async remove(id: string): Promise<boolean> {
    const file = await this.load();
    const before = file.entries.length;
    file.entries = file.entries.filter((e) => e.id !== id);
    const removed = file.entries.length !== before;
    if (removed) await this.save(file);
    return removed;
  }
}

