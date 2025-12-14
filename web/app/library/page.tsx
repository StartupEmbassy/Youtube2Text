import Link from "next/link";
import { apiGetJson } from "../../lib/api";
import type { ChannelsResponse } from "../../lib/apiSchema";

export default async function LibraryPage() {
  const data = await apiGetJson<ChannelsResponse>("/library/channels");

  return (
    <div>
      <h1 className="title">Library</h1>
      <div className="grid">
        {data.channels.map((c) => (
          <div key={c.channelDirName} className="card">
            <div className="row">
              <Link href={`/library/${encodeURIComponent(c.channelDirName)}`}>
                {c.channelTitle ?? c.channelDirName}
              </Link>
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
