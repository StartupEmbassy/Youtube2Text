"use client";

import Link from "next/link";

export default function LibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card">
      <div className="row">
        <strong>Library error</strong>
        <span className="pill bad">error</span>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        If the API is down, start it and retry.
      </p>
      <pre style={{ marginTop: 10 }}>{error.message}</pre>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.18)",
            background: "rgba(15, 23, 42, 0.7)",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
        <Link className="pill" href="/">
          Back
        </Link>
      </div>
    </div>
  );
}

