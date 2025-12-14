"use client";

import { useState } from "react";

type Props = {
  apiBaseUrl: string;
};

export function CreateRunForm({ apiBaseUrl }: Props) {
  const [url, setUrl] = useState("");
  const [force, setForce] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [message, setMessage] = useState<string>("");

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
      setStatus("done");
      setMessage("Run created. Refresh to see it in the list.");
      setUrl("");
      setForce(false);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <strong>Start a run</strong>
        <span className="pill">POST /runs</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/@channel | playlist | video"
          style={{
            flex: "1 1 520px",
            minWidth: 260,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.18)",
            background: "rgba(2, 6, 23, 0.7)",
            color: "inherit",
          }}
        />
        <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          force
        </label>
        <button
          type="submit"
          disabled={status === "submitting" || url.trim().length === 0}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.18)",
            background: "rgba(15, 23, 42, 0.7)",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {status === "submitting" ? "Starting..." : "Start"}
        </button>
      </div>
      {message && (
        <div className="muted" style={{ marginTop: 10, color: status === "error" ? "#fecaca" : undefined }}>
          {message}
        </div>
      )}
    </form>
  );
}

