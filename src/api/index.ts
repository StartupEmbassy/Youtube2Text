import { loadConfig } from "../config/index.js";
import { logInfo, logError } from "../utils/logger.js";
import { startApiServer } from "./server.js";
import { runRetentionCleanup } from "./retention.js";
import { join } from "node:path";

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
const host = process.env.HOST ?? "127.0.0.1";
const maxBufferedEventsPerRun = process.env.Y2T_MAX_BUFFERED_EVENTS_PER_RUN
  ? Number(process.env.Y2T_MAX_BUFFERED_EVENTS_PER_RUN)
  : 5000;
const persistRuns =
  process.env.Y2T_API_PERSIST_RUNS === undefined
    ? true
    : process.env.Y2T_API_PERSIST_RUNS !== "false";
const persistDir = process.env.Y2T_API_PERSIST_DIR;
const shutdownTimeoutSeconds = process.env.Y2T_SHUTDOWN_TIMEOUT_SECONDS
  ? Number(process.env.Y2T_SHUTDOWN_TIMEOUT_SECONDS)
  : 60;

if (!Number.isFinite(port) || port <= 0) {
  logError(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}
if (!Number.isFinite(shutdownTimeoutSeconds) || shutdownTimeoutSeconds < 0) {
  logError(`Invalid Y2T_SHUTDOWN_TIMEOUT_SECONDS: ${process.env.Y2T_SHUTDOWN_TIMEOUT_SECONDS}`);
  process.exit(1);
}

async function main() {
  const config = loadConfig();
  const { server, manager, scheduler } = await startApiServer(config, {
    port,
    host,
    maxBufferedEventsPerRun,
    persistRuns,
    persistDir,
  });
  logInfo(`API listening on http://${host}:${port}`);

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeoutMs = Math.max(0, Math.trunc(shutdownTimeoutSeconds * 1000));
    logInfo(`Graceful shutdown (${signal}): stopping scheduler and requesting cancellation...`);
    try {
      scheduler?.stop();
    } catch {
      // ignore
    }
    try {
      for (const run of manager.listRuns()) {
        if (run.status === "queued" || run.status === "running") {
          manager.cancelRun(run.runId);
        }
      }
    } catch {
      // ignore
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    const ok = await manager.waitForIdle(timeoutMs);
    if (!ok) {
      logInfo(`Graceful shutdown timeout reached after ${shutdownTimeoutSeconds}s; exiting.`);
    }
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Best-effort retention cleanup (Phase 2.2). Never deletes transcripts; only run persistence and audio cache.
  void (async () => {
    try {
      const effectivePersistDir = persistRuns
        ? (persistDir ?? join(config.outputDir, "_runs"))
        : undefined;
      const result = await runRetentionCleanup({
        persistDir: effectivePersistDir,
        audioDir: config.audioDir,
      });
      if (result.runs.enabled || result.audio.enabled) {
        logInfo(
          `Retention cleanup: runs deleted=${result.runs.deleted}, audio deleted=${result.audio.deletedFiles}`
        );
      }
    } catch {
      // best-effort only
    }
  })();
}

main().catch((error) => {
  logError(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
