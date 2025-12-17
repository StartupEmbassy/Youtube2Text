"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  SchedulerStatus,
  SchedulerStatusResponse,
  SchedulerTriggerResponse,
  RunCreateResponse,
  RunPlanResponse,
  WatchlistEntry,
  WatchlistEntryResponse,
  WatchlistListResponse,
} from "../../lib/apiSchema";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

function pillClass(ok: boolean): string {
  return ok ? "pill ok" : "pill bad";
}

function formatIso(iso?: string): string {
  if (!iso) return "-";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString();
}

function minutesToHoursString(minutes?: number): string {
  if (minutes === undefined) return "";
  const hours = minutes / 60;
  if (!Number.isFinite(hours)) return "";
  const rounded = Math.round(hours * 100) / 100;
  return String(rounded);
}

export function WatchlistClient({
  initialEntries,
  initialScheduler,
}: {
  initialEntries: WatchlistEntry[];
  initialScheduler: SchedulerStatus;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<WatchlistEntry[]>(initialEntries);
  const [scheduler, setScheduler] = useState<SchedulerStatus>(initialScheduler);
  const [error, setError] = useState<string | undefined>(undefined);
  const [addingUrl, setAddingUrl] = useState<string>("");
  const [addingInterval, setAddingInterval] = useState<string>("");
  const [addingEnabled, setAddingEnabled] = useState<boolean>(true);
  const [lastTrigger, setLastTrigger] = useState<{ checked: number; runsCreated: number } | undefined>(
    undefined
  );
  const [busyEntryIds, setBusyEntryIds] = useState<Set<string>>(new Set());

  const intervalDraftById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.id, minutesToHoursString(e.intervalMinutes));
    return map;
  }, [entries]);

  const [intervalEdits, setIntervalEdits] = useState<Record<string, string>>({});
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        (a.channelTitle || a.channelUrl).localeCompare(b.channelTitle || b.channelUrl)
      ),
    [entries]
  );

  async function refreshAll() {
    setError(undefined);
    const [watchlist, schedulerStatus] = await Promise.all([
      apiJson<WatchlistListResponse>("/api/watchlist"),
      apiJson<SchedulerStatusResponse>("/api/scheduler/status"),
    ]);
    setEntries(watchlist.entries);
    setScheduler(schedulerStatus.status);
  }

  async function addEntry() {
    setError(undefined);
    const body: any = { channelUrl: addingUrl, enabled: addingEnabled };
    if (addingInterval.trim().length > 0) {
      const hours = Number(addingInterval);
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("intervalHours must be a positive number (or empty to use global default)");
      }
      body.intervalMinutes = Math.trunc(hours * 60);
    }
    const res = await apiJson<WatchlistEntryResponse>("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setEntries((prev) => [...prev, res.entry]);
    setAddingUrl("");
    setAddingInterval("");
    setAddingEnabled(true);
  }

  async function patchEntry(id: string, patch: Record<string, unknown>) {
    setError(undefined);
    const res = await apiJson<WatchlistEntryResponse>(`/api/watchlist/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setEntries((prev) => prev.map((e) => (e.id === id ? res.entry : e)));
  }

  async function runEntryNow(entry: WatchlistEntry) {
    setError(undefined);
    setBusyEntryIds((prev) => new Set(prev).add(entry.id));
    try {
      const plan = await apiJson<RunPlanResponse>("/api/runs/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: entry.channelUrl, force: false }),
      });
      if (plan.plan.toProcess === 0) {
        await refreshAll();
        return;
      }
      const created = await apiJson<RunCreateResponse>("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: entry.channelUrl, force: false }),
      });
      router.push(`/runs/${created.run.runId}`);
    } finally {
      setBusyEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  }

  function intervalValueFor(id: string): string {
    if (Object.prototype.hasOwnProperty.call(intervalEdits, id)) return intervalEdits[id] ?? "";
    return intervalDraftById.get(id) ?? "";
  }

  async function saveInterval(entry: WatchlistEntry) {
    const raw = intervalValueFor(entry.id).trim();
    if (raw.length === 0) {
      await patchEntry(entry.id, { intervalMinutes: null });
      setIntervalEdits((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      return;
    }
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("intervalHours must be a positive number (or empty to use global default)");
    }
    await patchEntry(entry.id, { intervalMinutes: Math.trunc(hours * 60) });
    setIntervalEdits((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
  }

  async function deleteEntry(id: string) {
    setError(undefined);
    await apiJson(`/api/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function schedulerAction(path: string) {
    setError(undefined);
    const res = await apiJson<SchedulerStatusResponse>(path, { method: "POST" });
    setScheduler(res.status);
  }

  async function triggerScheduler() {
    setError(undefined);
    const res = await apiJson<SchedulerTriggerResponse>("/api/scheduler/trigger", { method: "POST" });
    setScheduler(res.status);
    setLastTrigger(res.result);
    await refreshAll();
  }

  return (
    <div className="stack">
      {error ? (
        <div className="card textBad">
          <div className="mb8">
            <strong>Error</strong>
          </div>
          <div className="break mono">{error}</div>
          <div className="spacer10" />
          <button className="button secondary" onClick={() => refreshAll()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="card">
        <div className="row mb10">
          <h2 className="m0">Scheduler</h2>
          <button className="button secondary" onClick={() => refreshAll()}>
            Refresh
          </button>
        </div>
        <div className="flexWrap mb10">
          <span className={pillClass(Boolean(scheduler.enabled))}>
            enabled: {String(Boolean(scheduler.enabled))}
          </span>
          <span className={pillClass(Boolean(scheduler.running))}>
            running: {String(Boolean(scheduler.running))}
          </span>
          <span className="pill">
            interval: {Math.round((scheduler.intervalMinutes / 60) * 100) / 100}h
          </span>
          <span className="pill">max concurrent: {scheduler.maxConcurrentRuns}</span>
        </div>
        <div className="flexWrap">
          <button className="button" onClick={() => schedulerAction("/api/scheduler/start")}>
            Start
          </button>
          <button className="button" onClick={() => schedulerAction("/api/scheduler/stop")}>
            Stop
          </button>
          <button className="button secondary" onClick={() => triggerScheduler()}>
            Trigger once
          </button>
          <span className="muted">
            last tick: {formatIso(scheduler.lastTickAt)} | next tick: {formatIso(scheduler.nextTickAt)}
          </span>
        </div>
        {lastTrigger ? (
          <div className="mt10 muted">
            Last trigger: checked {lastTrigger.checked}, created {lastTrigger.runsCreated} runs.
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 className="m0 mb10">Add</h2>
        <div className="flexWrap">
          <input
            className="input"
            placeholder="https://www.youtube.com/@SomeChannel (or playlist URL)"
            value={addingUrl}
            onChange={(e) => setAddingUrl(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: "0 0 180px" }}
            placeholder="interval (hours)"
            value={addingInterval}
            onChange={(e) => setAddingInterval(e.target.value)}
          />
          <label className="inlineRow muted" style={{ whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={addingEnabled}
              onChange={(e) => setAddingEnabled(e.target.checked)}
            />
            enabled
          </label>
          <button
            className="button"
            disabled={addingUrl.trim().length === 0}
            onClick={() => addEntry().catch((e) => setError(String(e?.message ?? e)))}
          >
            Add
          </button>
        </div>
        <div className="spacer10" />
        <div className="muted">
          By default, the API only accepts channel/playlist URLs for the watchlist (set
          <span className="mono"> Y2T_WATCHLIST_ALLOW_ANY_URL=true</span> to override).
        </div>
      </div>

      <div className="card">
        <div className="row mb10">
          <h2 className="m0">Entries</h2>
          <span className="muted">{entries.length} total</span>
        </div>

        {sorted.length === 0 ? <div className="muted">No entries yet.</div> : null}

        <div className="stack mt10">
          {sorted.map((e) => (
            <div key={e.id} className="card" style={{ padding: 12 }}>
              <div className="row mb8">
                <div style={{ minWidth: 0 }}>
                  <div className="break">
                    <strong>{e.channelTitle || e.channelUrl}</strong>
                  </div>
                  <div className="muted break mono">{e.channelUrl}</div>
                </div>
                <div className="flexWrap">
                  <button
                    className="button"
                    disabled={busyEntryIds.has(e.id)}
                    onClick={() =>
                      runEntryNow(e).catch((err) => setError(String(err?.message ?? err)))
                    }
                  >
                    {busyEntryIds.has(e.id) ? "Working..." : "Run now"}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      deleteEntry(e.id).catch((err) => setError(String(err?.message ?? err)))
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flexWrap">
                <label className="inlineRow muted" style={{ whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={e.enabled}
                    onChange={(ev) =>
                      patchEntry(e.id, { enabled: ev.target.checked }).catch((err) =>
                        setError(String(err?.message ?? err))
                      )
                    }
                  />
                  enabled
                </label>

                <div className="inlineRow">
                  <span className="pill">interval (hours)</span>
                  <input
                    className="input"
                    style={{ flex: "0 0 140px", minWidth: 120 }}
                    placeholder="global"
                    value={intervalValueFor(e.id)}
                    onChange={(ev) =>
                      setIntervalEdits((prev) => ({ ...prev, [e.id]: ev.target.value }))
                    }
                  />
                  <button
                    className="button secondary"
                    onClick={() => saveInterval(e).catch((err) => setError(String(err?.message ?? err)))}
                  >
                    Save
                  </button>
                </div>
                <span className="pill">created: {formatIso(e.createdAt)}</span>
                <span className="pill">last checked: {formatIso(e.lastCheckedAt)}</span>

                {e.lastRunId ? (
                  <span className="pill">
                    last run:{" "}
                    <Link href={`/runs/${e.lastRunId}`} className="mono">
                      {e.lastRunId}
                    </Link>
                  </span>
                ) : (
                  <span className="pill">last run: -</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
