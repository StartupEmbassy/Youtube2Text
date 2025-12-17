"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RunArtifactsResponse, VideoInfo } from "../../../lib/apiSchema";

function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

async function fetchArtifacts(runId: string): Promise<RunArtifactsResponse> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/artifacts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /runs/${runId}/artifacts failed: ${res.status}`);
  return (await res.json()) as RunArtifactsResponse;
}

export function RunArtifactsLive({
  runId,
  initialChannelDirName,
  initialVideos,
}: {
  runId: string;
  initialChannelDirName?: string;
  initialVideos?: VideoInfo[];
}) {
  const [channelDirName, setChannelDirName] = useState<string | undefined>(initialChannelDirName);
  const [videos, setVideos] = useState<VideoInfo[]>(initialVideos ?? []);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const url = useMemo(() => `/api/runs/${encodeURIComponent(runId)}/events`, [runId]);
  const refreshTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const inflight = useRef(false);

  async function refresh() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const data = await fetchArtifacts(runId);
      setChannelDirName(data.artifacts?.channelDirName);
      setVideos(data.artifacts?.videos ?? []);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inflight.current = false;
    }
  }

  function scheduleRefresh() {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = undefined;
      void refresh();
    }, 500);
  }

  useEffect(() => {
    // Fetch once on mount so the page updates as soon as channelDirName/videos are known.
    void refresh();

    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handler = () => {
      scheduleRefresh();
    };

    const anyEs = es as any;
    anyEs.addEventListener("run:start", handler);
    anyEs.addEventListener("run:done", handler);
    anyEs.addEventListener("run:cancelled", handler);
    anyEs.addEventListener("run:error", handler);
    anyEs.addEventListener("video:done", handler);
    anyEs.addEventListener("video:skip", handler);
    anyEs.addEventListener("video:error", handler);

    return () => {
      es.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const libraryLink = channelDirName ? `/library/${encodeURIComponent(channelDirName)}` : undefined;

  return (
    <div>
      <div className="row mb10">
        <strong>Downloads</strong>
        <div className="flexWrap">
          <span className={`pill ${connected ? "ok" : "bad"}`}>
            {connected ? "live" : "offline"}
          </span>
          {libraryLink && (
            <Link className="pill" href={libraryLink}>
              Library
            </Link>
          )}
          <button className="button secondary" type="button" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="muted textBad mb10 break">{error}</div> : null}

      {!channelDirName ? (
        <p className="muted">No channel artifacts yet (channelDirName unknown).</p>
      ) : videos.length > 0 ? (
        <div className="grid">
          {videos.map((v) => (
            <div key={v.basename} className="card">
              <div className="row">
                <strong className="break">{v.title ?? v.videoId}</strong>
                <span className="pill">{v.videoId}</span>
              </div>
              <div className="spacer10" />
              <a
                className="thumb sm mb10"
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src={youtubeThumb(v.videoId)} alt={v.title ?? v.videoId} loading="lazy" />
              </a>
              <div className="row">
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/txt`}
                  target="_blank"
                  rel="noreferrer"
                >
                  TXT
                </a>
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  MD
                </a>
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/jsonl`}
                  target="_blank"
                  rel="noreferrer"
                >
                  JSONL
                </a>
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/json`}
                  target="_blank"
                  rel="noreferrer"
                >
                  JSON
                </a>
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/comments`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Comments
                </a>
                <a
                  href={`/api/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/audio`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Audio
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No artifacts yet.</p>
      )}
    </div>
  );
}
