import Link from "next/link";
import { apiBaseUrlClient, apiGetJson } from "../../../lib/api";
import type { RunRecord } from "../../../lib/apiSchema";
import { RunEvents } from "./RunEvents";

type RunResponse = { run: RunRecord };
type ArtifactsResponse = { run: RunRecord; artifacts: unknown };

function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

export default async function RunPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const base = apiBaseUrlClient();
  const runData = await apiGetJson<RunResponse>(`/runs/${runId}`);
  const artifactsData = await apiGetJson<ArtifactsResponse>(`/runs/${runId}/artifacts`);
  const channelLink = runData.run.channelDirName
    ? `/library/${encodeURIComponent(runData.run.channelDirName)}`
    : undefined;

  return (
    <div>
      <div className="row mb12">
        <h1 className="m0">Run</h1>
        <div className="flexWrap">
          {channelLink && (
            <Link href={channelLink} className="button secondary">
              Open downloads
            </Link>
          )}
          <Link href="/" className="pill">
            Back
          </Link>
        </div>
      </div>

      <div className="card mb12">
        {runData.run.previewVideoId && (
          <a
            className="thumb lg mb10"
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(runData.run.previewVideoId)}`}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={youtubeThumb(runData.run.previewVideoId)}
              alt={runData.run.previewTitle ?? "Video thumbnail"}
              loading="lazy"
            />
          </a>
        )}
        {runData.run.previewTitle && (
          <>
            <div className="muted">Title</div>
            <div className="break">{runData.run.previewTitle}</div>
            <div className="spacer10" />
          </>
        )}
        <div className="muted">Run ID</div>
        <div className="mono">{runData.run.runId}</div>
        <div className="spacer10" />
        <div className="muted">Input URL</div>
        <div className="break">{runData.run.inputUrl}</div>
        {runData.run.channelTitle && <div className="spacer10" />}
        {runData.run.channelTitle && <div className="muted">Channel</div>}
        {runData.run.channelTitle && <div>{runData.run.channelTitle}</div>}
        <div className="spacer10" />
        <div className="muted">Status</div>
        <div>{runData.run.status}</div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="row mb10">
            <strong>Artifacts</strong>
            {channelLink && (
              <Link className="pill" href={channelLink}>
                Library
              </Link>
            )}
          </div>
          <pre className="preWrap">{JSON.stringify(artifactsData.artifacts, null, 2)}</pre>
        </div>
        <div className="card">
          <RunEvents apiBaseUrl={base} runId={runId} />
        </div>
      </div>
    </div>
  );
}
