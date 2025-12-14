import { promises as fs } from "node:fs";
import { join, basename as pathBasename, extname } from "node:path";
import { StorageAdapter, ChannelInfo, VideoInfo } from "./adapter.js";
import { ChannelMeta, OutputPaths, VideoMeta } from "./index.js";
import { parseChannelDirName, parseVideoIdFromBaseName } from "./naming.js";
import { TranscriptJson } from "../transcription/types.js";

const CHANNEL_META_FILENAME = "_channel.json";

function isTranscriptJsonFile(fileName: string): boolean {
  return (
    fileName.endsWith(".json") &&
    !fileName.endsWith(".comments.json") &&
    !fileName.endsWith(".meta.json") &&
    fileName !== CHANNEL_META_FILENAME
  );
}

function baseNameNoExt(fileName: string): string {
  return fileName.slice(0, fileName.length - extname(fileName).length);
}

async function tryReadJson<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export class FileSystemStorageAdapter implements StorageAdapter {
  constructor(
    private dirs: { outputDir: string; audioDir: string; audioFormat: string }
  ) {}

  async listChannels(): Promise<ChannelInfo[]> {
    const entries = await fs.readdir(this.dirs.outputDir, {
      withFileTypes: true,
    });
    const channels: ChannelInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const channelDirName = entry.name;
      const metaPath = join(
        this.dirs.outputDir,
        channelDirName,
        CHANNEL_META_FILENAME
      );
      const meta = await tryReadJson<ChannelMeta>(metaPath);
      const parsed = parseChannelDirName(channelDirName);
      channels.push({
        channelId: meta?.channelId ?? parsed.channelId,
        channelTitle: meta?.channelTitle ?? parsed.channelTitleSlug,
        channelDirName,
        metaPath: meta ? metaPath : undefined,
      });
    }

    return channels;
  }

  async listVideos(channelDirName: string): Promise<VideoInfo[]> {
    const channelDir = join(this.dirs.outputDir, channelDirName);
    const entries = await fs.readdir(channelDir, { withFileTypes: true });

    const videos: VideoInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!isTranscriptJsonFile(entry.name)) continue;

      const baseName = baseNameNoExt(entry.name);
      const metaPath = join(channelDir, `${baseName}.meta.json`);
      const meta = await tryReadJson<VideoMeta>(metaPath);
      const videoId = meta?.videoId ?? parseVideoIdFromBaseName(baseName);

      const paths: OutputPaths = {
        jsonPath: join(channelDir, `${baseName}.json`),
        txtPath: join(channelDir, `${baseName}.txt`),
        csvPath: join(channelDir, `${baseName}.csv`),
        commentsPath: join(channelDir, `${baseName}.comments.json`),
        metaPath,
        channelMetaPath: join(channelDir, CHANNEL_META_FILENAME),
        errorLogPath: join(channelDir, `_errors.jsonl`),
        audioPath: join(
          this.dirs.audioDir,
          channelDirName,
          `${baseName}.${this.dirs.audioFormat}`
        ),
      };

      videos.push({
        videoId,
        title: meta?.title,
        basename: baseName,
        metaPath: meta ? metaPath : undefined,
        paths,
        meta,
      });
    }

    return videos;
  }

  async readChannelMeta(
    channelDirName: string
  ): Promise<ChannelMeta | undefined> {
    const metaPath = join(
      this.dirs.outputDir,
      channelDirName,
      CHANNEL_META_FILENAME
    );
    return await tryReadJson<ChannelMeta>(metaPath);
  }

  async readVideoMeta(path: string): Promise<VideoMeta | undefined> {
    return await tryReadJson<VideoMeta>(path);
  }

  async readTranscriptJson(path: string): Promise<TranscriptJson> {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw) as TranscriptJson;
  }

  async readText(path: string): Promise<string> {
    return await fs.readFile(path, "utf8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  getAudioPath(paths: OutputPaths): string {
    return paths.audioPath;
  }
}
