"use client";

import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="card">
            <h1 className="m0 mb10">Something went wrong</h1>
            <p className="muted mb12">
              If the API is down, start it with <code>npm run dev:api</code> (or{" "}
              <code>docker compose up</code>) and retry.
            </p>
            <pre className="preWrap">{error.message}</pre>
            <div className="flexWrap mt10">
              <button onClick={() => reset()} className="button">
                Retry
              </button>
              <Link href="/" className="button secondary">
                Back to Runs
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
