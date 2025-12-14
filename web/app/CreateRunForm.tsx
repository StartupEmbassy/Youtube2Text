"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RunCreateResponse } from "../lib/apiSchema";

type Props = {
  apiBaseUrl: string;
};

export function CreateRunForm({ apiBaseUrl }: Props) {
  const [url, setUrl] = useState("");
  const [force, setForce] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed, force }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /runs failed: ${res.status} ${text}`);
      }
      const body = (await res.json()) as RunCreateResponse;
      const runId: string | undefined = body?.run?.runId;
      if (runId) {
        router.push(`/runs/${runId}`);
      } else {
        setStatus("done");
        setMessage("Run created. Refresh to see it in the list.");
        setUrl("");
        setForce(false);
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
          type="submit"
          disabled={status === "submitting" || url.trim().length === 0}
          className="button"
        >
          {status === "submitting" ? "Starting..." : "Start"}
        </button>
      </div>
      {message && (
        <div className={`muted mt10 ${status === "error" ? "textBad" : ""}`}>
          {message}
        </div>
      )}
    </form>
  );
}
