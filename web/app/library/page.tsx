import Link from "next/link";
import { apiGetJson } from "../../lib/api";
import type { ChannelsResponse } from "../../lib/apiSchema";

function initials(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "YT";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "Y";
  const b = parts.length > 1 ? parts[1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

export default async function LibraryPage() {
  const data = await apiGetJson<ChannelsResponse>("/library/channels");

  return (
    <div>
      <h1 className="title">Library</h1>
      <div className="grid">
        {data.channels.map((c) => (
          <div key={c.channelDirName} className="card">
            <div className="row">
              <div className="inlineRow">
                {c.channelThumbnailUrl ? (
                  <img
                    className="avatar"
                    src={c.channelThumbnailUrl}
                    alt={c.channelTitle ?? c.channelId}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="avatarFallback" aria-hidden="true">
                    {initials(c.channelTitle)}
                  </div>
                )}
                <Link href={`/library/${encodeURIComponent(c.channelDirName)}`}>
                  {c.channelTitle ?? c.channelDirName}
                </Link>
              </div>
              <span className="pill">{c.channelId}</span>
            </div>
            <div className="muted mt8">
              {c.channelDirName}
            </div>
          </div>
        ))}
      </div>
      {data.channels.length === 0 && (
        <p className="muted">No channels found in output/. Run the pipeline first.</p>
      )}
    </div>
  );
}
