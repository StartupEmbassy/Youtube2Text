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
import { tryExtractVideoIdFromUrl } from "../youtube/url.js";
import { fetchChannelMetadata, safeChannelThumbnailUrl } from "../youtube/index.js";
import { join } from "node:path";
import { getDeepHealth, getHealth } from "./health.js";
import { runRetentionCleanup } from "./retention.js";

type ServerOptions = {
  port: number;
  host: string;
  maxBufferedEventsPerRun: number;
  persistRuns: boolean;
  persistDir?: string;
};

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

  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
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
  const manager = new RunManager(config, {
    maxBufferedEventsPerRun: opts.maxBufferedEventsPerRun,
    persistRuns: opts.persistRuns,
    persistDir: opts.persistDir,
  });
  await manager.init();

  const storage = new FileSystemStorageAdapter({
    outputDir: config.outputDir,
    audioDir: config.audioDir,
    audioFormat: config.audioFormat,
  });

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

      if (req.method === "GET" && seg.length === 1 && seg[0] === "runs") {
        json(res, 200, { runs: manager.listRuns() });
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
        const configOverrides = (body as any).config;
        if (typeof url !== "string" || url.trim().length === 0) {
          badRequest(res, "Missing url");
          return;
        }
        const sanitizedOverrides = sanitizeConfigOverrides(configOverrides);
        const mergedConfig = { ...config, ...sanitizedOverrides };
        const plan = await planRun(url, mergedConfig, { force });
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
        const callbackUrl = (body as any).callbackUrl;
        const configOverrides = (body as any).config;
        if (typeof url !== "string" || url.trim().length === 0) {
          badRequest(res, "Missing url");
          return;
        }
        if (callbackUrl !== undefined && typeof callbackUrl !== "string") {
          badRequest(res, "Invalid callbackUrl");
          return;
        }
        const mergedConfig = { ...config, ...sanitizeConfigOverrides(configOverrides) };

        if (!force) {
          const videoId = tryExtractVideoIdFromUrl(url);
          if (videoId) {
            const plan = await planRun(url, mergedConfig, { force: false });
            if (plan.totalVideos === 1 && plan.toProcess === 0) {
              const record = manager.createCachedRun(
                { url, force: false, callbackUrl, config: configOverrides },
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
                    const channelMeta = await fetchChannelMetadata(channelUrl);
                    const thumbnailUrl = safeChannelThumbnailUrl(channelMeta);
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
                },
              });
              return;
            }
          }
        }

        const record = manager.createRun({ url, force, callbackUrl, config: configOverrides });
        manager.startRun(record.runId, { url, force, callbackUrl, config: configOverrides });
        json(res, 201, {
          run: record,
          links: {
            run: `/runs/${record.runId}`,
            events: `/runs/${record.runId}/events`,
            artifacts: `/runs/${record.runId}/artifacts`,
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
  return { server, manager };
}
