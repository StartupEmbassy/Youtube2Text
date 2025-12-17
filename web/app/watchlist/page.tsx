import { apiGetJson } from "../../lib/api";
import type { SchedulerStatusResponse, WatchlistListResponse } from "../../lib/apiSchema";
import { WatchlistClient } from "./WatchlistClient";

export default async function WatchlistPage() {
  const [watchlist, scheduler] = await Promise.all([
    apiGetJson<WatchlistListResponse>("/watchlist"),
    apiGetJson<SchedulerStatusResponse>("/scheduler/status"),
  ]);

  return (
    <div>
      <h1 className="title">Watchlist</h1>
      <WatchlistClient initialEntries={watchlist.entries} initialScheduler={scheduler.status} />
    </div>
  );
}

