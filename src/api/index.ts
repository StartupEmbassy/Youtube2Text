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

if (!Number.isFinite(port) || port <= 0) {
  logError(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

async function main() {
  const config = loadConfig();
  await startApiServer(config, {
    port,
    host,
    maxBufferedEventsPerRun,
    persistRuns,
    persistDir,
  });
  logInfo(`API listening on http://${host}:${port}`);

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
