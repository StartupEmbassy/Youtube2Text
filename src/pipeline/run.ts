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
import { validateYtDlpInstalled } from "../utils/deps.js";
import { InsufficientCreditsError } from "../transcription/assemblyai/errors.js";

type AssemblyAiAccountResponse = Record<string, unknown> & {
  credit_balance?: number;
  audio_minutes_remaining?: number;
  minutes_remaining?: number;
  audio_seconds_remaining?: number;
};

function getCreditsMinutesRemaining(
  account: AssemblyAiAccountResponse
): number | undefined {
  if (typeof account.audio_minutes_remaining === "number") {
    return account.audio_minutes_remaining;
  }
  if (typeof account.minutes_remaining === "number") {
    return account.minutes_remaining;
  }
  if (typeof account.audio_seconds_remaining === "number") {
    return account.audio_seconds_remaining / 60;
  }
  if (typeof account.credit_balance === "number") {
    return account.credit_balance;
  }
  return undefined;
}

export async function runPipeline(
  inputUrl: string,
  config: AppConfig,
  options: { force: boolean }
) {
  const ytDlpCommand = await validateYtDlpInstalled(config.ytDlpPath);
  let stopAll = false;
  if (config.assemblyAiCreditsCheck !== "none") {
    try {
      const provider = new AssemblyAiProvider(config.assemblyAiApiKey);
      const account = (await provider.getAccount()) as AssemblyAiAccountResponse;
      const minutesRemaining = getCreditsMinutesRemaining(account);
      if (minutesRemaining !== undefined) {
        logInfo(
          `AssemblyAI balance: ~${minutesRemaining.toFixed(
            1
          )} minutes remaining`
        );
        if (
          minutesRemaining < config.assemblyAiMinBalanceMinutes &&
          config.assemblyAiCreditsCheck === "abort"
        ) {
          throw new Error(
            `AssemblyAI credits below threshold (${config.assemblyAiMinBalanceMinutes} min). Aborting run.`
          );
        }
        if (
          minutesRemaining < config.assemblyAiMinBalanceMinutes &&
          config.assemblyAiCreditsCheck === "warn"
        ) {
          logWarn(
            `Low AssemblyAI credits: ~${minutesRemaining.toFixed(
              1
            )} min remaining (< ${config.assemblyAiMinBalanceMinutes} min)`
          );
        }
      } else {
        logWarn(
          "AssemblyAI account balance unavailable; continuing without credits check."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logWarn(
        `AssemblyAI credits check failed (${message}); continuing.`
      );
    }
  }

  const listing = await enumerateVideos(inputUrl, ytDlpCommand);
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
        if (stopAll) {
          logWarn(`Skipping due to prior fatal error: ${video.id}`);
          return;
        }
        const paths = getOutputPaths(
          listing.channelId,
          video.id,
          video.title,
          {
            outputDir: config.outputDir,
            audioDir: config.audioDir,
            audioFormat: config.audioFormat,
          },
          { filenameStyle: config.filenameStyle }
        );

        try {
          if (!options.force && (await isProcessed(paths.jsonPath))) {
            logInfo(`Skipping already processed: ${video.id}`);
            return;
          }

          const audioPath = await downloadAudio(
            video.url,
            paths.audioPath,
            config.audioFormat,
            config.downloadRetries,
            ytDlpCommand
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
          if (error instanceof InsufficientCreditsError) {
            stopAll = true;
            logWarn(
              `Stopping run: AssemblyAI credits exhausted while processing ${video.id}`
            );
            throw error;
          }
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
