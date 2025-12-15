import { enumerateVideos } from "../youtube/enumerate.js";
import type { YoutubeListing } from "../youtube/types.js";
import type { AppConfig } from "../config/schema.js";
import { isAfterDate } from "../utils/date.js";
import { validateYtDlpInstalled } from "../utils/deps.js";
import { makeVideoBaseName } from "../storage/naming.js";
import { getOutputPaths, isProcessed } from "../storage/index.js";

export type PlannedVideo = {
  id: string;
  title: string;
  url: string;
  uploadDate?: string;
  basename: string;
  processed: boolean;
};

export type RunPlan = {
  inputUrl: string;
  force: boolean;
  channelId: string;
  channelTitle?: string;
  totalVideos: number;
  alreadyProcessed: number;
  toProcess: number;
  filters: {
    afterDate?: string;
    maxVideos?: number;
  };
  videos: PlannedVideo[];
};

type IsProcessedFn = (jsonPath: string) => Promise<boolean>;

export async function planFromListing(
  inputUrl: string,
  listing: YoutubeListing,
  config: AppConfig,
  options: { force: boolean },
  deps?: { isProcessed?: IsProcessedFn }
): Promise<RunPlan> {
  const filteredVideos = listing.videos
    .filter((v) => isAfterDate(v.uploadDate, config.afterDate))
    .slice(0, config.maxVideos ?? listing.videos.length);

  const planned = filteredVideos.map((video) => {
    const basename = makeVideoBaseName(video.id, video.title, config.filenameStyle);
    const paths = getOutputPaths(
      listing.channelId,
      listing.channelTitle,
      video.id,
      video.title,
      {
        outputDir: config.outputDir,
        audioDir: config.audioDir,
        audioFormat: config.audioFormat,
      },
      { filenameStyle: config.filenameStyle }
    );
    return { video, basename, jsonPath: paths.jsonPath };
  });

  const check = deps?.isProcessed ?? isProcessed;
  const processedFlags = options.force
    ? new Array(planned.length).fill(false)
    : await Promise.all(planned.map((p) => check(p.jsonPath)));

  const videos: PlannedVideo[] = planned.map((p, idx) => ({
    id: p.video.id,
    title: p.video.title,
    url: p.video.url,
    uploadDate: p.video.uploadDate,
    basename: p.basename,
    processed: Boolean(processedFlags[idx]),
  }));

  const alreadyProcessed = videos.filter((v) => v.processed).length;
  const totalVideos = videos.length;

  return {
    inputUrl,
    force: options.force,
    channelId: listing.channelId,
    channelTitle: listing.channelTitle,
    totalVideos,
    alreadyProcessed,
    toProcess: totalVideos - alreadyProcessed,
    filters: {
      afterDate: config.afterDate,
      maxVideos: config.maxVideos,
    },
    videos,
  };
}

export async function planRun(
  inputUrl: string,
  config: AppConfig,
  options: { force: boolean }
): Promise<RunPlan> {
  const ytDlpCommand = await validateYtDlpInstalled(config.ytDlpPath);
  const ytDlpExtraArgs = config.ytDlpExtraArgs ?? [];
  const listing = await enumerateVideos(inputUrl, ytDlpCommand, ytDlpExtraArgs);
  return planFromListing(inputUrl, listing, config, options);
}

