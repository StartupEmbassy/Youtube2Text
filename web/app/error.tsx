"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            background: "radial-gradient(1200px 800px at 20% 10%, #111827, #0b0f19)",
            color: "#e5e7eb",
            minHeight: "100vh",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              background: "rgba(15, 23, 42, 0.7)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h1 style={{ margin: "0 0 10px 0" }}>Something went wrong</h1>
            <p style={{ margin: "0 0 12px 0", color: "#9ca3af" }}>
              If the API is down, start it with <code>npm run dev:api</code> (or{" "}
              <code>docker compose up</code>) and retry.
            </p>
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "rgba(2, 6, 23, 0.7)",
                overflow: "auto",
              }}
            >
              {error.message}
            </pre>
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
              <Link
                href="/"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  background: "rgba(15, 23, 42, 0.3)",
                }}
              >
                Back to Runs
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

