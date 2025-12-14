import Link from "next/link";
import { apiGetJson } from "../lib/api";
import type { RunsResponse, RunRecord } from "../lib/types";

function statusClass(status: RunRecord["status"]): string {
  if (status === "done") return "pill ok";
  if (status === "error") return "pill bad";
  if (status === "running") return "pill warn";
  return "pill";
}

export default async function Page() {
  const data = await apiGetJson<RunsResponse>("/runs");
  return (
    <div>
      <h1 style={{ margin: "0 0 12px 0" }}>Runs</h1>
      <div className="grid">
        {data.runs.map((run) => (
          <div key={run.runId} className="card">
            <div className="row">
              <Link href={`/runs/${run.runId}`}>{run.runId}</Link>
              <span className={statusClass(run.status)}>{run.status}</span>
            </div>
            <div className="muted" style={{ marginTop: 8, wordBreak: "break-word" }}>
              {run.inputUrl}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {run.channelTitle ? `${run.channelTitle} (${run.channelId ?? "?"})` : run.channelId}
            </div>
            {run.stats && (
              <div className="muted" style={{ marginTop: 8 }}>
                {run.stats.succeeded} ok, {run.stats.skipped} skipped, {run.stats.failed} failed /
                {` ${run.stats.total} total`}
              </div>
            )}
            {run.error && (
              <div className="muted" style={{ marginTop: 8, color: "#fecaca" }}>{run.error}</div>
            )}
          </div>
        ))}
      </div>
      {data.runs.length === 0 && <p className="muted">No runs yet. Start one via CLI or API.</p>}
    </div>
  );
}

