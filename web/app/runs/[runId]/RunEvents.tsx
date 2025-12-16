"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  runId: string;
};

type EventItem = { id: number; type: string; data: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function tsShort(iso: unknown): string {
  if (typeof iso !== "string") return "";
  if (iso.length < 19) return iso;
  return iso.slice(11, 19);
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function formatEventLine(item: EventItem): string {
  const data = isRecord(item.data) ? item.data : undefined;
  const t = tsShort(data?.timestamp);

  const idx = data ? getNumber(data, "index") : undefined;
  const total = data ? getNumber(data, "total") : undefined;
  const idxPart = idx && total ? ` ${idx}/${total}` : "";

  const videoId = data ? getString(data, "videoId") : undefined;
  const stage = data ? getString(data, "stage") : undefined;

  if (item.type === "run:start") {
    const channelTitle = data ? getString(data, "channelTitle") : undefined;
    const channelId = data ? getString(data, "channelId") : undefined;
    const remaining = data ? getNumber(data, "remaining") : undefined;
    const already = data ? getNumber(data, "alreadyProcessed") : undefined;
    const totalVideos = data ? getNumber(data, "totalVideos") : undefined;
    const channel = channelTitle ? `${channelTitle} (${channelId ?? "?"})` : channelId ?? "?";
    return `${t} run:start channel=${channel} total=${totalVideos ?? "?"} already=${already ?? "?"} remaining=${remaining ?? "?"}`;
  }

  if (item.type === "video:start") {
    const title = data ? getString(data, "title") : undefined;
    return `${t} video:start${idxPart} ${videoId ?? "?"} ${title ?? ""}`.trimEnd();
  }

  if (item.type === "video:stage") {
    return `${t} video:stage${idxPart} ${videoId ?? "?"} ${stage ?? "?"}`;
  }

  if (item.type === "video:skip") {
    const reason = data ? getString(data, "reason") : undefined;
    const completed = data ? getNumber(data, "completed") : undefined;
    const remaining = data ? getNumber(data, "remaining") : undefined;
    return `${t} video:skip${idxPart} ${videoId ?? "?"} reason=${reason ?? "?"} completed=${completed ?? "?"} remaining=${remaining ?? "?"}`;
  }

  if (item.type === "video:done") {
    const completed = data ? getNumber(data, "completed") : undefined;
    const remaining = data ? getNumber(data, "remaining") : undefined;
    return `${t} video:done${idxPart} ${videoId ?? "?"} completed=${completed ?? "?"} remaining=${remaining ?? "?"}`;
  }

  if (item.type === "video:error") {
    const err = data ? getString(data, "error") : undefined;
    const completed = data ? getNumber(data, "completed") : undefined;
    const remaining = data ? getNumber(data, "remaining") : undefined;
    return `${t} video:error${idxPart} ${videoId ?? "?"} stage=${stage ?? "?"} error=${err ?? "?"} completed=${completed ?? "?"} remaining=${remaining ?? "?"}`;
  }

  if (item.type === "run:done") {
    const succeeded = data ? getNumber(data, "succeeded") : undefined;
    const failed = data ? getNumber(data, "failed") : undefined;
    const skipped = data ? getNumber(data, "skipped") : undefined;
    const total = data ? getNumber(data, "total") : undefined;
    return `${t} run:done total=${total ?? "?"} ok=${succeeded ?? "?"} skipped=${skipped ?? "?"} failed=${failed ?? "?"}`;
  }

  if (item.type === "run:cancelled") {
    const succeeded = data ? getNumber(data, "succeeded") : undefined;
    const failed = data ? getNumber(data, "failed") : undefined;
    const skipped = data ? getNumber(data, "skipped") : undefined;
    const total = data ? getNumber(data, "total") : undefined;
    return `${t} run:cancelled total=${total ?? "?"} ok=${succeeded ?? "?"} skipped=${skipped ?? "?"} failed=${failed ?? "?"}`;
  }

  if (item.type === "run:error") {
    const err = data ? getString(data, "error") : undefined;
    return `${t} run:error ${err ?? ""}`.trimEnd();
  }

  return `${t} ${item.type} ${JSON.stringify(item.data)}`.trimEnd();
}

export function RunEvents({ runId }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [connected, setConnected] = useState(false);
  const lastIdRef = useRef<number>(0);

  const url = useMemo(() => `/api/runs/${encodeURIComponent(runId)}/events`, [runId]);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);

    const handler = (event: MessageEvent) => {
      const id = Number.parseInt((event as any).lastEventId || "0", 10) || 0;
      lastIdRef.current = Math.max(lastIdRef.current, id);
      let parsed: unknown = event.data;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        // ignore
      }
      setEvents((prev) => [...prev.slice(-999), { id, type: event.type, data: parsed }]);
    };

    es.onmessage = handler;

    const anyEs = es as any;
    anyEs.addEventListener("run:start", handler);
    anyEs.addEventListener("run:done", handler);
    anyEs.addEventListener("run:cancelled", handler);
    anyEs.addEventListener("run:error", handler);
    anyEs.addEventListener("video:start", handler);
    anyEs.addEventListener("video:stage", handler);
    anyEs.addEventListener("video:done", handler);
    anyEs.addEventListener("video:error", handler);
    anyEs.addEventListener("video:skip", handler);

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [url]);

  return (
    <div>
      <div className="row mb10">
        <strong>Events</strong>
        <div className="flexWrap">
          <span className={`pill ${connected ? "ok" : "bad"}`}>
            {connected ? "connected" : "disconnected"}
          </span>
          <button className="button secondary" type="button" onClick={() => setEvents([])}>
            Clear
          </button>
        </div>
      </div>
      <pre className="preWrap">
        {events.map((e) => `${e.id} ${formatEventLine(e)}`).join("\n")}
      </pre>
    </div>
  );
}
