import { execCommand } from "../utils/exec.js";
import { logInfo } from "../utils/logger.js";
import { YoutubeListing, YoutubeVideo } from "./types.js";

type YtDlpEntry = {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  upload_date?: string;
};

type YtDlpListing = {
  id?: string;
  channel_id?: string;
  uploader_id?: string;
  title?: string;
  uploader?: string;
  entries?: YtDlpEntry[];
};

function inferChannelId(listing: YtDlpListing, inputUrl: string): string {
  return (
    listing.channel_id ||
    listing.uploader_id ||
    listing.id ||
    inputUrl.replace(/https?:\/\//, "").replace(/[^\w-]+/g, "_")
  );
}

export async function enumerateVideos(inputUrl: string): Promise<YoutubeListing> {
  logInfo(`Enumerating videos from ${inputUrl} ...`);
  const args = ["--flat-playlist", "--dump-single-json", inputUrl];
  const result = await execCommand("yt-dlp", args);
  if (result.exitCode !== 0) {
    throw new Error(`yt-dlp failed: ${result.stderr}`);
  }

  const listing = JSON.parse(result.stdout) as YtDlpListing;
  const channelId = inferChannelId(listing, inputUrl);
  const channelTitle = listing.uploader || listing.title;

  const videos: YoutubeVideo[] =
    listing.entries
      ?.filter((e) => e.id)
      .map((e) => ({
        id: e.id as string,
        title: e.title || e.id || "Untitled",
        url:
          e.webpage_url ||
          e.url ||
          `https://www.youtube.com/watch?v=${e.id}`,
        uploadDate: e.upload_date,
      })) ?? [];

  return { channelId, channelTitle, videos };
}

