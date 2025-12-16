"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlobalRunEvent, RunRecord } from "../lib/apiSchema";

type Props = {
  initialRuns: RunRecord[];
};

function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

function tryExtractVideoId(urlString: string | undefined): string | undefined {
  if (!urlString) return undefined;
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").trim();
    return id.length > 0 ? id : undefined;
  }
  if (host !== "youtube.com" && host !== "m.youtube.com") return undefined;
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return id.trim().length > 0 ? id.trim() : undefined;
  }
  const m = url.pathname.match(/^\/shorts\/([^/]+)/);
  if (m?.[1]) return m[1];
  return undefined;
}

function displayTitle(run: RunRecord): string {
  if (run.previewTitle && run.previewTitle.trim().length > 0) return run.previewTitle;
  if (run.channelTitle && run.channelTitle.trim().length > 0) return run.channelTitle;
  if (run.inputUrl && run.inputUrl.trim().length > 0) return run.inputUrl;
  return "Run";
}

function statusClass(status: RunRecord["status"]): string {
  if (status === "done") return "pill ok";
  if (status === "error") return "pill bad";
  if (status === "running") return "pill warn";
  if (status === "cancelled") return "pill";
  return "pill";
}

function upsertRun(runs: RunRecord[], run: RunRecord): RunRecord[] {
  const idx = runs.findIndex((r) => r.runId === run.runId);
  const next = idx >= 0 ? [...runs.slice(0, idx), run, ...runs.slice(idx + 1)] : [run, ...runs];
  next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return next;
}

export function RunsLive({ initialRuns }: Props) {
  const [runs, setRuns] = useState<RunRecord[]>(initialRuns);
  const [connected, setConnected] = useState(false);
  const url = useMemo(() => `/api/events`, []);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handler = (event: MessageEvent) => {
      let parsed: unknown = event.data;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const e = parsed as GlobalRunEvent;
      if (!e || typeof e !== "object") return;
      if (!("run" in e)) return;
      const run = (e as any).run as RunRecord | undefined;
      if (!run?.runId) return;
      setRuns((prev) => upsertRun(prev, run));
    };

    const anyEs = es as any;
    anyEs.addEventListener("run:created", handler);
    anyEs.addEventListener("run:updated", handler);

    return () => es.close();
  }, [url]);

  return (
    <div>
      <div className="row mb10">
        <span className="muted">Live</span>
        <span className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "connected" : "disconnected"}
        </span>
      </div>

      <div className="grid">
        {runs.map((run) => (
          <div key={run.runId} className="card">
            {(run.previewVideoId || tryExtractVideoId(run.inputUrl)) && (
              <Link href={`/runs/${run.runId}`} className="thumb mb10">
                <img
                  src={youtubeThumb(run.previewVideoId ?? (tryExtractVideoId(run.inputUrl) as string))}
                  alt={run.previewTitle ?? "Video thumbnail"}
                  loading="lazy"
                />
              </Link>
            )}
            <div className="row">
              <Link className="break" href={`/runs/${run.runId}`}>
                <strong>{displayTitle(run)}</strong>
              </Link>
              <span className={statusClass(run.status)}>{run.status}</span>
            </div>

            <div className="muted mt8 mono break">{run.runId}</div>
            {run.inputUrl && <div className="muted mt8 break">{run.inputUrl}</div>}

            {run.channelDirName && (
              <div className="mt8">
                <Link className="button secondary" href={`/library/${encodeURIComponent(run.channelDirName)}`}>
                  Open downloads
                </Link>
              </div>
            )}

            {run.stats && (
              <div className="muted mt8">
                {run.stats.succeeded} ok, {run.stats.skipped} skipped, {run.stats.failed} failed /
                {` ${run.stats.total} total`}
              </div>
            )}
            {run.error && <div className="muted mt8 textBad">{run.error}</div>}
          </div>
        ))}
      </div>

      {runs.length === 0 && <p className="muted">No runs yet. Start one via the form above.</p>}
    </div>
  );
}
