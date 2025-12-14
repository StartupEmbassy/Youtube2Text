import Link from "next/link";
import { apiBaseUrl, apiGetJson } from "../../../lib/api";
import type { VideosResponse, VideoInfo } from "../../../lib/types";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default async function ChannelPage({
  params,
}: {
  params: { channelDirName: string };
}) {
  const channelDirName = decodeURIComponent(params.channelDirName);
  const data = await apiGetJson<VideosResponse>(
    `/library/channels/${encodeURIComponent(channelDirName)}/videos`,
  );
  const base = apiBaseUrl();

  const renderVideo = (v: VideoInfo) => {
    const meta = v.meta;
    const desc = meta?.description?.trim();
    const videoUrl = meta?.videoUrl;
    return (
      <div key={v.basename} className="card">
        <div className="row">
          <strong>{v.title ?? meta?.title ?? v.videoId}</strong>
          <span className="pill">{v.videoId}</span>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          {videoUrl ? (
            <a href={videoUrl} target="_blank" rel="noreferrer">
              {videoUrl}
            </a>
          ) : (
            v.basename
          )}
        </div>
        {desc && <div className="muted" style={{ marginTop: 8 }}>{truncate(desc, 220)}</div>}
        <div style={{ height: 10 }} />
        <div className="row">
          <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/txt`} target="_blank" rel="noreferrer">
            TXT
          </a>
          <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/json`} target="_blank" rel="noreferrer">
            JSON
          </a>
          <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/audio`} target="_blank" rel="noreferrer">
            Audio
          </a>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Channel</h1>
        <Link className="pill" href="/library">
          Back
        </Link>
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>
        {channelDirName}
      </div>
      <div className="grid">{data.videos.map(renderVideo)}</div>
      {data.videos.length === 0 && <p className="muted">No videos found.</p>}
    </div>
  );
}

