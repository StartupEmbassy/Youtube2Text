"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelRunButton(props: {
  runId: string;
  status: string;
  cancelRequested?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  if (props.status !== "running") return null;

  const disabled = busy || props.cancelRequested;

  async function onCancel() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(props.runId)}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cancel failed: ${res.status} ${text}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="button secondary" type="button" disabled={disabled} onClick={onCancel}>
        {props.cancelRequested ? "Cancelling..." : busy ? "Cancelling..." : "Cancel"}
      </button>
      {error && <div className="muted mt8 textBad break">{error}</div>}
    </div>
  );
}

