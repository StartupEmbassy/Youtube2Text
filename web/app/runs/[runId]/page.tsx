import Link from "next/link";
import { apiBaseUrl, apiGetJson } from "../../../lib/api";
import type { RunRecord } from "../../../lib/types";
import { RunEvents } from "./RunEvents";

type RunResponse = { run: RunRecord };
type ArtifactsResponse = { run: RunRecord; artifacts: unknown };

export default async function RunPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const base = apiBaseUrl();
  const runData = await apiGetJson<RunResponse>(`/runs/${runId}`);
  const artifactsData = await apiGetJson<ArtifactsResponse>(`/runs/${runId}/artifacts`);

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Run</h1>
        <Link href="/" className="pill">
          Back
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="muted">Run ID</div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" }}>
          {runData.run.runId}
        </div>
        <div style={{ height: 10 }} />
        <div className="muted">Input URL</div>
        <div style={{ wordBreak: "break-word" }}>{runData.run.inputUrl}</div>
        <div style={{ height: 10 }} />
        <div className="muted">Status</div>
        <div>{runData.run.status}</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <strong>Artifacts</strong>
            {runData.run.channelDirName && (
              <Link className="pill" href={`/library/${encodeURIComponent(runData.run.channelDirName)}`}>
                Open channel
              </Link>
            )}
          </div>
          <pre>{JSON.stringify(artifactsData.artifacts, null, 2)}</pre>
        </div>
        <div className="card">
          <RunEvents apiBaseUrl={process.env.NEXT_PUBLIC_Y2T_API_BASE_URL ?? base} runId={runId} />
        </div>
      </div>
    </div>
  );
}

