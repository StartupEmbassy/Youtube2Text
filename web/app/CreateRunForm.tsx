"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RunCreateResponse, RunPlanResponse } from "../lib/apiSchema";

function parsePositiveInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

export function CreateRunForm() {
  const [url, setUrl] = useState("");
  const [force, setForce] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [maxNewVideos, setMaxNewVideos] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [plan, setPlan] = useState<RunPlanResponse["plan"] | undefined>(undefined);
  const [planning, setPlanning] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  async function previewPlan() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setPlanning(true);
    setMessage("");
    setStatus("idle");
    try {
      const body: any = { url: trimmed, force };
      const n = parsePositiveInt(maxNewVideos);
      if (n !== undefined) body.maxNewVideos = n;
      if (afterDate.trim().length > 0) body.afterDate = afterDate.trim();

      const res = await fetch(`/api/runs/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /runs/plan failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as RunPlanResponse;
      setPlan(json.plan);
    } catch (err) {
      setPlan(undefined);
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("submitting");
    setMessage("");
    try {
      const body: any = { url: trimmed, force };
      const n = parsePositiveInt(maxNewVideos);
      if (n !== undefined) body.maxNewVideos = n;
      if (afterDate.trim().length > 0) body.afterDate = afterDate.trim();

      const res = await fetch(`/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /runs failed: ${res.status} ${text}`);
      }
      const data = (await res.json()) as RunCreateResponse;
      const runId: string | undefined = data?.run?.runId;
      if (runId) {
        router.push(`/runs/${runId}`);
      } else {
        setStatus("done");
        setMessage("Run created. Refresh to see it in the list.");
        setUrl("");
        setForce(false);
        setMaxNewVideos("");
        setAfterDate("");
        setPlan(undefined);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mb12">
      <div className="row mb10">
        <strong>Start a run</strong>
        <span className="pill">POST /runs</span>
      </div>
      <div className="flexWrap">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/@channel | playlist | video"
          className="input"
        />
        <label className="muted inlineRow">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          force
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "Hide options" : "Advanced options"}
        </button>
        <button
          type="submit"
          disabled={status === "submitting" || url.trim().length === 0}
          className="button"
        >
          {status === "submitting" ? "Starting..." : "Start"}
        </button>
      </div>

      {advanced ? (
        <div className="mt10 stack">
          <div className="flexWrap">
            <input
              className="input"
              style={{ flex: "0 0 220px" }}
              placeholder="max new videos (e.g. 10)"
              value={maxNewVideos}
              onChange={(e) => setMaxNewVideos(e.target.value)}
            />
            <input
              className="input"
              style={{ flex: "0 0 220px" }}
              placeholder="after date (YYYY-MM-DD)"
              value={afterDate}
              onChange={(e) => setAfterDate(e.target.value)}
            />
            <button
              type="button"
              className="button secondary"
              disabled={planning || url.trim().length === 0}
              onClick={() => previewPlan()}
            >
              {planning ? "Planning..." : "Preview plan"}
            </button>
          </div>

          {plan ? (
            <div className="card">
              <div className="row mb8">
                <strong>Plan</strong>
                <span className="pill">POST /runs/plan</span>
              </div>
              <div className="flexWrap">
                <span className="pill">total: {plan.totalVideos}</span>
                <span className="pill ok">processed: {plan.alreadyProcessed}</span>
                <span className="pill warn">unprocessed: {plan.unprocessed}</span>
                <span className="pill">selected: {plan.toProcess}</span>
              </div>
              <div className="spacer10" />
              {plan.selectedVideos && plan.selectedVideos.length > 0 ? (
                <div className="muted">
                  Selected (preview):{" "}
                  <span className="mono">
                    {plan.selectedVideos
                      .slice(0, 8)
                      .map((v) => v.id)
                      .join(", ")}
                    {plan.selectedVideos.length > 8 ? ", ..." : ""}
                  </span>
                </div>
              ) : (
                <div className="muted">No new videos selected.</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {message && (
        <div className={`muted mt10 ${status === "error" ? "textBad" : ""}`}>
          {message}
        </div>
      )}
    </form>
  );
}
