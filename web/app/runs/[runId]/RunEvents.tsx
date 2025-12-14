"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  apiBaseUrl: string;
  runId: string;
};

type EventItem = { id: number; type: string; data: unknown };

export function RunEvents({ apiBaseUrl, runId }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [connected, setConnected] = useState(false);
  const lastIdRef = useRef<number>(0);

  const url = useMemo(() => `${apiBaseUrl}/runs/${runId}/events`, [apiBaseUrl, runId]);

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
      <div className="row" style={{ marginBottom: 10 }}>
        <strong>Events</strong>
        <span className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      <pre className="preWrap">
        {events.map((e) => `${e.id} ${e.type} ${JSON.stringify(e.data)}`).join("\n")}
      </pre>
    </div>
  );
}
