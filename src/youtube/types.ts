export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  uploadDate?: string;
};

export type YoutubeListing = {
  channelId: string;
  channelTitle?: string;
  videos: YoutubeVideo[];
};

