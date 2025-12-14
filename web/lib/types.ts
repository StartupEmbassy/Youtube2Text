export type RunStatus = "queued" | "running" | "done" | "error";

export type RunRecord = {
  runId: string;
  status: RunStatus;
  inputUrl: string;
  force: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  channelId?: string;
  channelTitle?: string;
  channelDirName?: string;
  stats?: { succeeded: number; failed: number; skipped: number; total: number };
};

export type RunsResponse = { runs: RunRecord[] };

export type ChannelInfo = {
  channelId: string;
  channelTitle?: string;
  channelDirName: string;
  metaPath?: string;
};

export type ChannelsResponse = { channels: ChannelInfo[] };

export type VideoInfo = {
  videoId: string;
  title?: string;
  basename: string;
  metaPath?: string;
  paths: {
    jsonPath: string;
    txtPath: string;
    csvPath: string;
    commentsPath: string;
    metaPath: string;
    channelMetaPath: string;
    errorLogPath: string;
    audioPath: string;
  };
  meta?: {
    videoId: string;
    title?: string;
    channelId?: string;
    channelTitle?: string;
    channelUrl?: string;
    videoUrl?: string;
    description?: string;
    publishedAt?: string;
    languageCode?: string;
    languageDetection?: string;
    languageConfidence?: number;
  };
};

export type VideosResponse = { channelDirName: string; videos: VideoInfo[] };

