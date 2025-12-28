import type { Server } from "node:http";
import type { RunManager } from "./runManager.js";
import type { Scheduler } from "./scheduler.js";

export type GracefulShutdownDeps = {
  server: Server;
  manager: RunManager;
  scheduler?: Scheduler;
  shutdownTimeoutMs: number;
};

export async function gracefulShutdown({
  server,
  manager,
  scheduler,
  shutdownTimeoutMs,
}: GracefulShutdownDeps): Promise<{ timedOut: boolean }> {
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
  const ok = await manager.waitForIdle(Math.max(0, Math.trunc(shutdownTimeoutMs)));
  return { timedOut: !ok };
}
