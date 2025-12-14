import Link from "next/link";
import { apiBaseUrlClient, apiGetJson } from "../../../lib/api";
import type { VideosResponse, VideoInfo } from "../../../lib/apiSchema";

function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

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
  const base = apiBaseUrlClient();

  const renderVideo = (v: VideoInfo) => {
    const meta = v.meta;
    const desc = meta?.description?.trim();
    const videoUrl = meta?.videoUrl;
    return (
      <div key={v.basename} className="card">
        <div className="thumbRow">
          <a
            className="thumb"
            href={videoUrl ?? `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`}
            target="_blank"
            rel="noreferrer"
          >
            <img src={youtubeThumb(v.videoId)} alt={v.title ?? meta?.title ?? v.videoId} loading="lazy" />
          </a>
          <div className="break flex1">
            <div className="row">
              <strong className="break">{v.title ?? meta?.title ?? v.videoId}</strong>
              <span className="pill">{v.videoId}</span>
            </div>
            <div className="muted mt8 break">
              {videoUrl ? (
                <a href={videoUrl} target="_blank" rel="noreferrer">
                  {videoUrl}
                </a>
              ) : (
                v.basename
              )}
            </div>
            {desc && <div className="muted mt8">{truncate(desc, 220)}</div>}
            <div className="spacer10" />
            <div className="row">
              <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/txt`} target="_blank" rel="noreferrer">
                TXT
              </a>
              <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/md`} target="_blank" rel="noreferrer">
                MD
              </a>
              <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/json`} target="_blank" rel="noreferrer">
                JSON
              </a>
              <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/jsonl`} target="_blank" rel="noreferrer">
                JSONL
              </a>
              <a href={`${base}/library/channels/${encodeURIComponent(channelDirName)}/videos/${encodeURIComponent(v.basename)}/audio`} target="_blank" rel="noreferrer">
                Audio
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="row mb12">
        <h1 className="m0">Channel</h1>
        <Link className="pill" href="/library">
          Back
        </Link>
      </div>
      <div className="muted mb12">{channelDirName}</div>
      <div className="grid">{data.videos.map(renderVideo)}</div>
      {data.videos.length === 0 && <p className="muted">No videos found.</p>}
    </div>
  );
}
