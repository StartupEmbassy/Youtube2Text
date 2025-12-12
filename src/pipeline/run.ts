import pLimit from "p-limit";
import { enumerateVideos, downloadAudio } from "../youtube/index.js";
import { AssemblyAiProvider } from "../transcription/index.js";
import { formatTxt, formatCsv } from "../formatters/index.js";
import {
  getOutputPaths,
  isProcessed,
  saveTranscriptCsv,
  saveTranscriptJson,
  saveTranscriptTxt,
} from "../storage/index.js";
import { logErrorRecord } from "../storage/errors.js";
import { isAfterDate } from "../utils/date.js";
import { logInfo, logWarn } from "../utils/logger.js";
import { AppConfig } from "../config/schema.js";

export async function runPipeline(
  inputUrl: string,
  config: AppConfig,
  options: { force: boolean }
) {
  const listing = await enumerateVideos(inputUrl);
  const filteredVideos = listing.videos
    .filter((v) => isAfterDate(v.uploadDate, config.afterDate))
    .slice(0, config.maxVideos ?? listing.videos.length);

  logInfo(
    `Channel ${listing.channelId} (${filteredVideos.length} videos to process)`
  );

  const provider = new AssemblyAiProvider(config.assemblyAiApiKey);
  const limit = pLimit(config.concurrency);

  await Promise.all(
    filteredVideos.map((video) =>
      limit(async () => {
        const paths = getOutputPaths(listing.channelId, video.id, {
          outputDir: config.outputDir,
          audioDir: config.audioDir,
          audioFormat: config.audioFormat,
        });

        try {
          if (!options.force && (await isProcessed(paths.jsonPath))) {
            logInfo(`Skipping already processed: ${video.id}`);
            return;
          }

          const audioPath = await downloadAudio(
            video.url,
            paths.audioPath,
            config.audioFormat,
            config.downloadRetries
          );

          const transcript = await provider.transcribe(audioPath, {
            languageCode: config.languageCode,
            pollIntervalMs: config.pollIntervalMs,
            maxPollMinutes: config.maxPollMinutes,
            retries: config.transcriptionRetries,
          });

          await saveTranscriptJson(paths.jsonPath, transcript);
          await saveTranscriptTxt(
            paths.txtPath,
            formatTxt(transcript, {
              title: video.title,
              url: video.url,
              uploadDate: video.uploadDate,
            })
          );

          if (config.csvEnabled) {
            await saveTranscriptCsv(
              paths.csvPath,
              formatCsv(transcript)
            );
          }

          logInfo(`Done: ${video.id}`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logWarn(`Failed ${video.id}: ${message}`);
          await logErrorRecord(paths.errorLogPath, {
            videoId: video.id,
            videoUrl: video.url,
            stage: "transcribe",
            message,
            timestamp: new Date().toISOString(),
          });
        }
      })
    )
  );
}

