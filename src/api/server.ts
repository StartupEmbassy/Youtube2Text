import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import type { AppConfig } from "../config/schema.js";
import { RunManager } from "./runManager.js";
import { badRequest, json, notFound, readJsonBody } from "./http.js";
import { getLastEventId, initSse, writeSseEvent } from "./sse.js";

type ServerOptions = {
  port: number;
  host: string;
  maxBufferedEventsPerRun: number;
  persistRuns: boolean;
  persistDir?: string;
};

function setCors(res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,last-event-id");
}

function segments(req: IncomingMessage): string[] {
  const url = req.url ?? "/";
  const parsed = parseUrl(url, true);
  const pathname = parsed.pathname ?? "/";
  return pathname.split("/").filter(Boolean);
}

export async function startApiServer(config: AppConfig, opts: ServerOptions) {
  const manager = new RunManager(config, {
    maxBufferedEventsPerRun: opts.maxBufferedEventsPerRun,
    persistRuns: opts.persistRuns,
    persistDir: opts.persistDir,
  });
  await manager.init();

  const server = createServer(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const seg = segments(req);

    try {
      if (req.method === "GET" && seg.length === 1 && seg[0] === "health") {
        json(res, 200, { ok: true, service: "youtube2text-api" });
        return;
      }

      if (req.method === "GET" && seg.length === 1 && seg[0] === "runs") {
        json(res, 200, { runs: manager.listRuns() });
        return;
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
        const configOverrides = (body as any).config;
        if (typeof url !== "string" || url.trim().length === 0) {
          badRequest(res, "Missing url");
          return;
        }
        const record = manager.createRun({ url, force, config: configOverrides });
        manager.startRun(record.runId, { url, force, config: configOverrides });
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

      return notFound(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: "internal_error", message });
    }
  });

  server.listen(opts.port, opts.host);
  return { server, manager };
}
