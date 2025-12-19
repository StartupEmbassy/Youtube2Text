import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import { basename as pathBasename } from "node:path";
import { parse as parseUrl } from "node:url";
import type { AppConfig } from "../config/schema.js";
import { RunManager } from "./runManager.js";
import { badRequest, json, notFound, readJsonBody } from "./http.js";
import { getLastEventId, initSse, writeSseEvent } from "./sse.js";
import { FileSystemStorageAdapter, saveChannelMetaJson } from "../storage/index.js";
import { makeChannelDirName } from "../storage/naming.js";
import { requireApiKey } from "./auth.js";
import { sanitizeConfigOverrides } from "./sanitize.js";
import { planRun } from "../pipeline/plan.js";
import { classifyYoutubeUrl, tryExtractVideoIdFromUrl } from "../youtube/url.js";
import { fetchChannelMetadata, safeChannelThumbnailUrl } from "../youtube/index.js";
import { join } from "node:path";
import { getDeepHealth, getHealth } from "./health.js";
import { runRetentionCleanup } from "./retention.js";
import { Scheduler, loadSchedulerConfigFromEnv } from "./scheduler.js";
import { WatchlistStore } from "./watchlist.js";
import { getCatalogMetricsSnapshot } from "../youtube/catalogMetrics.js";
import { getSettingsResponse, patchSettings } from "./settings.js";
import { applySettingsToConfig, readSettingsFile, sanitizeNonSecretSettings } from "../config/settings.js";

type ServerOptions = {
  port: number;
  host: string;
  maxBufferedEventsPerRun: number;
  persistRuns: boolean;
  persistDir?: string;
  deps?: {
    planRun?: typeof planRun;
    fetchChannelMetadata?: typeof fetchChannelMetadata;
    safeChannelThumbnailUrl?: typeof safeChannelThumbnailUrl;
  };
};

function escapePromLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function promLine(name: string, labels: Record<string, string> | undefined, value: number): string {
  const labelPart =
    labels && Object.keys(labels).length > 0
      ?
        "{" +
        Object.entries(labels)
          .map(([k, v]) => `${k}="${escapePromLabelValue(v)}"`)
          .join(",") +
        "}"
      : "";
  return `${name}${labelPart} ${value}`;
}

let cachedBuildVersion: string | undefined;
async function getBuildVersion(): Promise<string> {
  if (cachedBuildVersion) return cachedBuildVersion;
  try {
    const raw = await fs.readFile(join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    cachedBuildVersion = typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    cachedBuildVersion = "unknown";
  }
  return cachedBuildVersion;
}

function setCors(req: IncomingMessage, res: ServerResponse) {
  const raw = process.env.Y2T_CORS_ORIGINS;
  const allowList =
    typeof raw === "string" && raw.trim().length > 0
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["*"];

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const allowsAny = allowList.includes("*");
  const allowsOrigin = !!origin && allowList.includes(origin);

  if (allowsAny) {
    res.setHeader("access-control-allow-origin", "*");
  } else if (allowsOrigin) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }

  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    "content-type,last-event-id,x-api-key"
  );
}

function segments(req: IncomingMessage): string[] {
  const url = req.url ?? "/";
  const parsed = parseUrl(url, true);
  const pathname = parsed.pathname ?? "/";
  return pathname.split("/").filter(Boolean);
}

function decodePathSegment(raw: string): string | undefined {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

function isSafeBaseName(name: string): boolean {
  return name.length > 0 && name === pathBasename(name) && !name.includes("..");
}

function contentTypeForAudioPath(path: string): string {
  if (path.endsWith(".mp3")) return "audio/mpeg";
  if (path.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

async function streamFile(res: ServerResponse, path: string, contentType: string) {
  try {
    const stat = await fs.stat(path);
    res.statusCode = 200;
    res.setHeader("content-type", contentType);
    res.setHeader("content-length", String(stat.size));
    createReadStream(path).pipe(res);
  } catch {
    notFound(res);
  }
}

export async function startApiServer(config: AppConfig, opts: ServerOptions) {
  const planRunFn = opts.deps?.planRun ?? planRun;
  const fetchChannelMetadataFn = opts.deps?.fetchChannelMetadata ?? fetchChannelMetadata;
  const safeChannelThumbnailUrlFn = opts.deps?.safeChannelThumbnailUrl ?? safeChannelThumbnailUrl;

  const manager = new RunManager(config, {
    maxBufferedEventsPerRun: opts.maxBufferedEventsPerRun,
    persistRuns: opts.persistRuns,
    persistDir: opts.persistDir,
  });
  await manager.init();

  const watchlistStore = new WatchlistStore(config.outputDir);
  const schedulerCfg = loadSchedulerConfigFromEnv();
  const scheduler = new Scheduler(
    schedulerCfg,
    manager,
    watchlistStore,
    async (url) => planRunFn(url, await getEffectiveConfig(), { force: false }),
    (req) => manager.createRun(req),
    (runId, req) => manager.startRun(runId, req)
  );
  if (schedulerCfg.enabled) scheduler.start();

  const storage = new FileSystemStorageAdapter({
    outputDir: config.outputDir,
    audioDir: config.audioDir,
    audioFormat: config.audioFormat,
  });

  async function getEffectiveConfig(): Promise<AppConfig> {
    const file = await readSettingsFile(config.outputDir);
    const settings = sanitizeNonSecretSettings(file?.settings);
    return applySettingsToConfig(config, settings);
  }

  const server = createServer(async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!requireApiKey(req, res)) return;

    const seg = segments(req);

    try {
      if (req.method === "GET" && seg.length === 1 && seg[0] === "health") {
        const parsed = parseUrl(req.url ?? "/health", true);
        const deepRaw = parsed.query?.deep;
        const deep =
          deepRaw === "true" ||
          deepRaw === "1" ||
          (Array.isArray(deepRaw) && (deepRaw.includes("true") || deepRaw.includes("1")));
        const body = deep
          ? await getDeepHealth(config, {
              persistRuns: opts.persistRuns,
              persistDir: opts.persistDir,
            })
          : await getHealth(config, {
              persistRuns: opts.persistRuns,
              persistDir: opts.persistDir,
            });
        json(res, 200, body);
        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "metrics") {
        const runs = manager.listRuns();
        const byStatus = new Map<string, number>();
        for (const run of runs) {
          byStatus.set(run.status, (byStatus.get(run.status) ?? 0) + 1);
        }

        const entries = await watchlistStore.list();
        const enabledEntries = entries.filter((e) => e.enabled).length;
        const schedulerStatus = scheduler.status();

        const lines: string[] = [];
        lines.push("# HELP y2t_build_info Build information.");
        lines.push("# TYPE y2t_build_info gauge");
        lines.push(promLine("y2t_build_info", { version: await getBuildVersion() }, 1));

        lines.push("# HELP y2t_runs Runs currently known to the API (persisted runs may be cleaned up by retention).");
        lines.push("# TYPE y2t_runs gauge");
        const knownStatuses = ["queued", "running", "done", "error", "cancelled"];
        for (const status of knownStatuses) {
          lines.push(promLine("y2t_runs", { status }, byStatus.get(status) ?? 0));
        }
        for (const [status, count] of [...byStatus.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          if (knownStatuses.includes(status)) continue;
          lines.push(promLine("y2t_runs", { status }, count));
        }

        lines.push("# HELP y2t_watchlist_entries Watchlist entries currently configured.");
        lines.push("# TYPE y2t_watchlist_entries gauge");
        lines.push(promLine("y2t_watchlist_entries", undefined, entries.length));

        lines.push("# HELP y2t_watchlist_entries_enabled Enabled watchlist entries.");
        lines.push("# TYPE y2t_watchlist_entries_enabled gauge");
        lines.push(promLine("y2t_watchlist_entries_enabled", undefined, enabledEntries));

        lines.push("# HELP y2t_scheduler_running Whether the in-process scheduler loop is running.");
        lines.push("# TYPE y2t_scheduler_running gauge");
        lines.push(promLine("y2t_scheduler_running", undefined, schedulerStatus.running ? 1 : 0));

        lines.push("# HELP y2t_scheduler_next_tick_timestamp_seconds Next scheduler tick time as Unix timestamp.");
        lines.push("# TYPE y2t_scheduler_next_tick_timestamp_seconds gauge");
        const next = schedulerStatus.nextTickAt ? Date.parse(schedulerStatus.nextTickAt) : NaN;
        lines.push(
          promLine(
            "y2t_scheduler_next_tick_timestamp_seconds",
            undefined,
            Number.isFinite(next) ? Math.floor(next / 1000) : 0
          )
        );

        const catalog = getCatalogMetricsSnapshot();
        lines.push("# HELP y2t_catalog_cache_hit_total Catalog cache hits (used cached catalog and attempted incremental refresh).");
        lines.push("# TYPE y2t_catalog_cache_hit_total counter");
        lines.push(promLine("y2t_catalog_cache_hit_total", undefined, catalog.cacheHit));

        lines.push("# HELP y2t_catalog_cache_miss_total Catalog cache misses (no usable cached catalog).");
        lines.push("# TYPE y2t_catalog_cache_miss_total counter");
        lines.push(promLine("y2t_catalog_cache_miss_total", undefined, catalog.cacheMiss));

        lines.push("# HELP y2t_catalog_cache_expired_total Catalog cache expirations (TTL exceeded).");
        lines.push("# TYPE y2t_catalog_cache_expired_total counter");
        lines.push(promLine("y2t_catalog_cache_expired_total", undefined, catalog.cacheExpired));

        lines.push("# HELP y2t_catalog_full_refresh_total Full channel enumerations performed for catalog updates.");
        lines.push("# TYPE y2t_catalog_full_refresh_total counter");
        lines.push(promLine("y2t_catalog_full_refresh_total", undefined, catalog.fullRefresh));

        lines.push("# HELP y2t_catalog_incremental_refresh_total Incremental refresh operations performed for channel catalogs.");
        lines.push("# TYPE y2t_catalog_incremental_refresh_total counter");
        lines.push(promLine("y2t_catalog_incremental_refresh_total", undefined, catalog.incrementalRefresh));

        lines.push("# HELP y2t_catalog_incremental_added_videos_total Number of new videos discovered during incremental refresh.");
        lines.push("# TYPE y2t_catalog_incremental_added_videos_total counter");
        lines.push(promLine("y2t_catalog_incremental_added_videos_total", undefined, catalog.incrementalAddedVideos));

        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
        res.end(`${lines.join("\n")}\n`);
        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "settings") {
        const body = await getSettingsResponse(config);
        json(res, 200, body);
        return;
      }

      if (req.method === "PATCH" && seg.length === 1 && seg[0] === "settings") {
        let body: unknown;
        try {
          body = (await readJsonBody(req)) as unknown;
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }
        if (!body || typeof body !== "object") {
          badRequest(res, "Expected JSON body");
          return;
        }
        if (!(body as any).settings || typeof (body as any).settings !== "object") {
          badRequest(res, "Missing settings");
          return;
        }
        const updated = await patchSettings(config, body as any);
        json(res, 200, updated);
        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "runs") {
        json(res, 200, { runs: manager.listRuns() });
        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "watchlist") {
        const entries = await watchlistStore.list();
        json(res, 200, { entries });
        return;
      }

      if (req.method === "POST" && seg.length === 1 && seg[0] === "watchlist") {
        let body: unknown;
        try {
          body = (await readJsonBody(req)) as unknown;
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }
        const channelUrl = (body as any)?.channelUrl;
        const intervalMinutes = (body as any)?.intervalMinutes;
        const enabled = (body as any)?.enabled;
        if (typeof channelUrl !== "string" || channelUrl.trim().length === 0) {
          badRequest(res, "Missing channelUrl");
          return;
        }
        const allowAny = (process.env.Y2T_WATCHLIST_ALLOW_ANY_URL ?? "").trim().toLowerCase();
        const allowAnyUrl = allowAny === "true" || allowAny === "1" || allowAny === "yes";
        if (!allowAnyUrl) {
          const kind = classifyYoutubeUrl(channelUrl).kind;
          if (kind !== "channel" && kind !== "playlist") {
            badRequest(res, "watchlist.channelUrl must be a YouTube channel or playlist URL (set Y2T_WATCHLIST_ALLOW_ANY_URL=true to override)");
            return;
          }
        }
        const entry = await watchlistStore.add({
          channelUrl,
          intervalMinutes: typeof intervalMinutes === "number" ? intervalMinutes : undefined,
          enabled: enabled === undefined ? undefined : Boolean(enabled),
        });
        json(res, 201, { entry });
        return;
      }

      if (seg.length === 2 && seg[0] === "watchlist") {
        const id = decodePathSegment(seg[1]!);
        if (!id) return badRequest(res, "Invalid id");

        if (req.method === "GET") {
          const entry = await watchlistStore.get(id);
          if (!entry) return notFound(res);
          json(res, 200, { entry });
          return;
        }

        if (req.method === "PATCH") {
          let body: unknown;
          try {
            body = (await readJsonBody(req)) as unknown;
          } catch {
            badRequest(res, "Invalid JSON body");
            return;
          }
          const entry = await watchlistStore.update(id, {
            intervalMinutes: (body as any)?.intervalMinutes,
            enabled: (body as any)?.enabled,
          });
          if (!entry) return notFound(res);
          json(res, 200, { entry });
          return;
        }

        if (req.method === "DELETE") {
          const removed = await watchlistStore.remove(id);
          if (!removed) return notFound(res);
          json(res, 200, { ok: true });
          return;
        }
      }

      if (req.method === "GET" && seg.length === 2 && seg[0] === "scheduler" && seg[1] === "status") {
        json(res, 200, { status: scheduler.status() });
        return;
      }

      if (req.method === "POST" && seg.length === 2 && seg[0] === "scheduler" && seg[1] === "start") {
        scheduler.start();
        json(res, 200, { status: scheduler.status() });
        return;
      }

      if (req.method === "POST" && seg.length === 2 && seg[0] === "scheduler" && seg[1] === "stop") {
        scheduler.stop();
        json(res, 200, { status: scheduler.status() });
        return;
      }

      if (req.method === "POST" && seg.length === 2 && seg[0] === "scheduler" && seg[1] === "trigger") {
        const result = await scheduler.triggerOnce();
        json(res, 200, { result, status: scheduler.status() });
        return;
      }

      if (
        req.method === "POST" &&
        seg.length === 2 &&
        seg[0] === "maintenance" &&
        seg[1] === "cleanup"
      ) {
        const effectivePersistDir = opts.persistRuns
          ? (opts.persistDir ?? join(config.outputDir, "_runs"))
          : undefined;
        const result = await runRetentionCleanup({
          persistDir: effectivePersistDir,
          audioDir: config.audioDir,
        });
        json(res, 200, { retention: result });
        return;
      }

      if (
        req.method === "POST" &&
        seg.length === 2 &&
        seg[0] === "runs" &&
        seg[1] === "plan"
      ) {
        let body: unknown;
        try {
          body = (await readJsonBody(req)) as unknown;
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }
        if (!body || typeof body !== "object") {
          badRequest(res, "Expected JSON body");
          return;
        }
        const url = (body as any).url;
        const force = Boolean((body as any).force);
        const maxNewVideos = (body as any).maxNewVideos;
        const afterDate = (body as any).afterDate;
        const configOverrides = (body as any).config;
        if (typeof url !== "string" || url.trim().length === 0) {
          badRequest(res, "Missing url");
          return;
        }
        if (maxNewVideos !== undefined && typeof maxNewVideos !== "number") {
          badRequest(res, "Invalid maxNewVideos");
          return;
        }
        if (afterDate !== undefined && typeof afterDate !== "string") {
          badRequest(res, "Invalid afterDate");
          return;
        }
        const sanitizedOverrides = sanitizeConfigOverrides(configOverrides);
        const requestOverrides = {
          ...sanitizedOverrides,
          ...(typeof maxNewVideos === "number" ? { maxNewVideos } : {}),
          ...(typeof afterDate === "string" ? { afterDate } : {}),
        };
        const effectiveBase = await getEffectiveConfig();
        const mergedConfig = { ...effectiveBase, ...requestOverrides };
        const plan = await planRunFn(url, mergedConfig, { force });
        json(res, 200, { plan });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 2 &&
        seg[0] === "library" &&
        seg[1] === "channels"
      ) {
        const channels = await storage.listChannels();
        json(res, 200, { channels });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 3 &&
        seg[0] === "library" &&
        seg[1] === "channels"
      ) {
        const channelDirName = decodePathSegment(seg[2]!);
        if (!channelDirName) return badRequest(res, "Invalid channelDirName");
        const meta = await storage.readChannelMeta(channelDirName);
        if (!meta) return notFound(res);
        json(res, 200, { channelDirName, meta });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 4 &&
        seg[0] === "library" &&
        seg[1] === "channels" &&
        seg[3] === "videos"
      ) {
        const channelDirName = decodePathSegment(seg[2]!);
        if (!channelDirName) return badRequest(res, "Invalid channelDirName");
        const videos = await storage.listVideos(channelDirName);
        json(res, 200, { channelDirName, videos });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 6 &&
        seg[0] === "library" &&
        seg[1] === "channels" &&
        seg[3] === "videos"
      ) {
        const channelDirName = decodePathSegment(seg[2]!);
        const baseName = decodePathSegment(seg[4]!);
        const kind = seg[5]!;
        if (!channelDirName) return badRequest(res, "Invalid channelDirName");
        if (!baseName || !isSafeBaseName(baseName)) return badRequest(res, "Invalid basename");

        const videos = await storage.listVideos(channelDirName);
        const video = videos.find((v) => v.basename === baseName);
        if (!video) return notFound(res);

        if (kind === "txt") {
          const exists = await storage.exists(video.paths.txtPath);
          if (!exists) return notFound(res);
          const text = await storage.readText(video.paths.txtPath);
          res.statusCode = 200;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(text);
          return;
        }
        if (kind === "md") {
          const exists = await storage.exists(video.paths.mdPath);
          if (!exists) return notFound(res);
          const text = await storage.readText(video.paths.mdPath);
          res.statusCode = 200;
          res.setHeader("content-type", "text/markdown; charset=utf-8");
          res.end(text);
          return;
        }
        if (kind === "jsonl") {
          const exists = await storage.exists(video.paths.jsonlPath);
          if (!exists) return notFound(res);
          const text = await storage.readText(video.paths.jsonlPath);
          res.statusCode = 200;
          res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
          res.end(text);
          return;
        }
        if (kind === "json") {
          const transcript = await storage.readTranscriptJson(video.paths.jsonPath);
          json(res, 200, transcript);
          return;
        }
        if (kind === "meta") {
          if (!video.paths.metaPath) return notFound(res);
          const meta = await storage.readVideoMeta(video.paths.metaPath);
          if (!meta) return notFound(res);
          json(res, 200, meta);
          return;
        }
        if (kind === "comments") {
          const exists = await storage.exists(video.paths.commentsPath);
          if (!exists) return notFound(res);
          const raw = await storage.readText(video.paths.commentsPath);
          res.statusCode = 200;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(raw);
          return;
        }
        if (kind === "csv") {
          const exists = await storage.exists(video.paths.csvPath);
          if (!exists) return notFound(res);
          const raw = await storage.readText(video.paths.csvPath);
          res.statusCode = 200;
          res.setHeader("content-type", "text/csv; charset=utf-8");
          res.end(raw);
          return;
        }
        if (kind === "audio") {
          const exists = await storage.exists(video.paths.audioPath);
          if (!exists) return notFound(res);
          await streamFile(res, video.paths.audioPath, contentTypeForAudioPath(video.paths.audioPath));
          return;
        }

        return notFound(res);
      }

      if (req.method === "POST" && seg.length === 1 && seg[0] === "runs") {
        let body: unknown;
        try {
          body = (await readJsonBody(req)) as unknown;
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }
        if (!body || typeof body !== "object") {
          badRequest(res, "Expected JSON body");
          return;
        }
        const url = (body as any).url;
        const force = Boolean((body as any).force);
        const maxNewVideos = (body as any).maxNewVideos;
        const afterDate = (body as any).afterDate;
        const callbackUrl = (body as any).callbackUrl;
        const configOverrides = (body as any).config;
        if (typeof url !== "string" || url.trim().length === 0) {
          badRequest(res, "Missing url");
          return;
        }
        if (maxNewVideos !== undefined && typeof maxNewVideos !== "number") {
          badRequest(res, "Invalid maxNewVideos");
          return;
        }
        if (afterDate !== undefined && typeof afterDate !== "string") {
          badRequest(res, "Invalid afterDate");
          return;
        }
        if (callbackUrl !== undefined && typeof callbackUrl !== "string") {
          badRequest(res, "Invalid callbackUrl");
          return;
        }
        const sanitizedOverrides = sanitizeConfigOverrides(configOverrides);
        const requestOverrides = {
          ...sanitizedOverrides,
          ...(typeof maxNewVideos === "number" ? { maxNewVideos } : {}),
          ...(typeof afterDate === "string" ? { afterDate } : {}),
        };
        const effectiveBase = await getEffectiveConfig();
        const mergedConfig = { ...effectiveBase, ...requestOverrides };

        // Ensure runs started by the manager also inherit current settings (without storing secrets).
        const settingsForRun = sanitizeNonSecretSettings((await readSettingsFile(config.outputDir))?.settings);
        const runConfigOverrides = { ...settingsForRun, ...requestOverrides };

        if (!force) {
          const videoId = tryExtractVideoIdFromUrl(url);
          if (videoId) {
            const plan = await planRunFn(url, mergedConfig, { force: false });
            if (plan.totalVideos === 1 && plan.toProcess === 0) {
              const record = manager.createCachedRun(
                { url, force: false, callbackUrl, config: runConfigOverrides },
                plan
              );

              // Best-effort: update channel thumbnail if missing (fire-and-forget)
              void (async () => {
                try {
                  const adapter = new FileSystemStorageAdapter({
                    outputDir: mergedConfig.outputDir,
                    audioDir: mergedConfig.audioDir,
                    audioFormat: mergedConfig.audioFormat,
                  });
                  const channelDirName = makeChannelDirName(plan.channelId, plan.channelTitle);
                  const existingMeta = await adapter.readChannelMeta(channelDirName);
                  // Update if: (1) file doesn't exist, OR (2) file exists but missing thumbnail
                  if (!existingMeta || !existingMeta.channelThumbnailUrl) {
                    const channelUrl = `https://www.youtube.com/channel/${plan.channelId}`;
                    const channelMeta = await fetchChannelMetadataFn(channelUrl);
                    const thumbnailUrl = safeChannelThumbnailUrlFn(channelMeta);
                    if (thumbnailUrl) {
                      const metaPath = join(mergedConfig.outputDir, channelDirName, "_channel.json");
                      await saveChannelMetaJson(metaPath, {
                        channelId: plan.channelId,
                        channelTitle: plan.channelTitle,
                        ...existingMeta,
                        channelThumbnailUrl: thumbnailUrl,
                        channelUrl,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  }
                } catch {
                  // Best-effort only - ignore errors
                }
              })();

              json(res, 201, {
                run: record,
                links: {
                  run: `/runs/${record.runId}`,
                  events: `/runs/${record.runId}/events`,
                  artifacts: `/runs/${record.runId}/artifacts`,
                  cancel: `/runs/${record.runId}/cancel`,
                },
              });
              return;
            }
          }
        }

        const record = manager.createRun({ url, force, callbackUrl, config: runConfigOverrides });
        manager.startRun(record.runId, { url, force, callbackUrl, config: runConfigOverrides });
        json(res, 201, {
          run: record,
          links: {
            run: `/runs/${record.runId}`,
            events: `/runs/${record.runId}/events`,
            artifacts: `/runs/${record.runId}/artifacts`,
            cancel: `/runs/${record.runId}/cancel`,
          },
        });
        return;
      }

      if (req.method === "GET" && seg.length === 2 && seg[0] === "runs") {
        const run = manager.getRun(seg[1]!);
        if (!run) return notFound(res);
        json(res, 200, { run });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 3 &&
        seg[0] === "runs" &&
        seg[2] === "logs"
      ) {
        const runId = seg[1]!;
        const run = manager.getRun(runId);
        if (!run) return notFound(res);

        const parsed = parseUrl(req.url ?? `/runs/${runId}/logs`, true);
        const tailRaw = parsed.query?.tail;
        const tailN =
          typeof tailRaw === "string"
            ? Number.parseInt(tailRaw, 10)
            : Array.isArray(tailRaw) && typeof tailRaw[0] === "string"
              ? Number.parseInt(tailRaw[0], 10)
              : NaN;
        const tail = Number.isFinite(tailN) ? Math.max(1, Math.min(2000, tailN)) : 200;

        const all = manager.listEventsAfter(runId, 0);
        const events = all.slice(Math.max(0, all.length - tail));
        json(res, 200, { run, events });
        return;
      }

      if (
        req.method === "POST" &&
        seg.length === 3 &&
        seg[0] === "runs" &&
        seg[2] === "cancel"
      ) {
        const runId = seg[1]!;
        const run = manager.cancelRun(runId);
        if (!run) return notFound(res);
        json(res, 200, { run });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 3 &&
        seg[0] === "runs" &&
        seg[2] === "artifacts"
      ) {
        const runId = seg[1]!;
        const run = manager.getRun(runId);
        if (!run) return notFound(res);
        const artifacts = await manager.listArtifacts(runId);
        json(res, 200, { run, artifacts });
        return;
      }

      if (
        req.method === "GET" &&
        seg.length === 3 &&
        seg[0] === "runs" &&
        seg[2] === "events"
      ) {
        const runId = seg[1]!;
        const run = manager.getRun(runId);
        if (!run) return notFound(res);

        initSse(res);
        const lastSeenId = getLastEventId(req);
        for (const buffered of manager.listEventsAfter(runId, lastSeenId)) {
          writeSseEvent(res, {
            id: buffered.id,
            event: buffered.event.type,
            data: buffered.event,
          });
        }

        const unsubscribe = manager.subscribe(runId, (buffered) => {
          writeSseEvent(res, {
            id: buffered.id,
            event: buffered.event.type,
            data: buffered.event,
          });
        });

        const heartbeat = setInterval(() => {
          res.write(": ping\n\n");
        }, 15000);

        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });

        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "events") {
        initSse(res);
        const lastSeenId = getLastEventId(req);
        for (const buffered of manager.listGlobalEventsAfter(lastSeenId)) {
          writeSseEvent(res, {
            id: buffered.id,
            event: buffered.event.type,
            data: buffered.event,
          });
        }

        const unsubscribe = manager.subscribeGlobal((buffered) => {
          writeSseEvent(res, {
            id: buffered.id,
            event: buffered.event.type,
            data: buffered.event,
          });
        });

        const heartbeat = setInterval(() => {
          res.write(": ping\n\n");
        }, 15000);

        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });

        return;
      }

      return notFound(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: "internal_error", message });
    }
  });

  server.listen(opts.port, opts.host);
  return { server, manager, scheduler };
}
