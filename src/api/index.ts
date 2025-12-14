import { loadConfig } from "../config/index.js";
import { logInfo, logError } from "../utils/logger.js";
import { startApiServer } from "./server.js";

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
}

main().catch((error) => {
  logError(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
