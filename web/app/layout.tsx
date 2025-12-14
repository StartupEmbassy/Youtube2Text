import type { ReactNode } from "react";
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Youtube2Text Admin",
  description: "Local-first admin UI for Youtube2Text",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="nav">
            <strong>Youtube2Text</strong>
            <Link href="/">Runs</Link>
            <Link href="/library">Library</Link>
            <span className="muted mlAuto">
              API: {process.env.NEXT_PUBLIC_Y2T_API_BASE_URL ?? "http://127.0.0.1:8787"}
            </span>
          </div>
          <div className="spacer14" />
          {children}
        </div>
      </body>
    </html>
  );
}
