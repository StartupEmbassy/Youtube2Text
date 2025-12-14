"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlobalRunEvent, RunRecord } from "../lib/types";

type Props = {
  apiBaseUrl: string;
  initialRuns: RunRecord[];
};

function statusClass(status: RunRecord["status"]): string {
  if (status === "done") return "pill ok";
  if (status === "error") return "pill bad";
  if (status === "running") return "pill warn";
  return "pill";
}

function upsertRun(runs: RunRecord[], run: RunRecord): RunRecord[] {
  const idx = runs.findIndex((r) => r.runId === run.runId);
  const next = idx >= 0 ? [...runs.slice(0, idx), run, ...runs.slice(idx + 1)] : [run, ...runs];
  next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return next;
}

export function RunsLive({ apiBaseUrl, initialRuns }: Props) {
  const [runs, setRuns] = useState<RunRecord[]>(initialRuns);
  const [connected, setConnected] = useState(false);
  const url = useMemo(() => `${apiBaseUrl}/events`, [apiBaseUrl]);

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
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted">Live</span>
        <span className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "connected" : "disconnected"}
        </span>
      </div>

      <div className="grid">
        {runs.map((run) => (
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

      {runs.length === 0 && <p className="muted">No runs yet. Start one via the form above.</p>}
    </div>
  );
}

