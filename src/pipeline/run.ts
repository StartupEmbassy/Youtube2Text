import pLimit from "p-limit";
import {
  enumerateVideos,
  downloadAudio,
  fetchVideoDescription,
  fetchVideoComments,
} from "../youtube/index.js";
import { AssemblyAiProvider } from "../transcription/index.js";
import { formatTxt, formatCsv } from "../formatters/index.js";
import {
  getOutputPaths,
  isProcessed,
  saveTranscriptCsv,
  saveTranscriptJson,
  saveTranscriptTxt,
  saveVideoCommentsJson,
} from "../storage/index.js";
import { logErrorRecord } from "../storage/errors.js";
import { isAfterDate } from "../utils/date.js";
import { logInfo, logWarn, logStep } from "../utils/logger.js";
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
        logStep(
          "credits",
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

  const videoJobs = filteredVideos.map((video, index) => ({
    video,
    index: index + 1,
    paths: getOutputPaths(
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
    ),
  }));

  const totalVideos = videoJobs.length;
  let completedVideos = 0;
  const alreadyProcessedByIndex: boolean[] = [];

  if (!options.force) {
    const processedFlags = await Promise.all(
      videoJobs.map((j) => isProcessed(j.paths.jsonPath))
    );
    alreadyProcessedByIndex.push(...processedFlags);
    completedVideos = processedFlags.filter(Boolean).length;
  } else {
    alreadyProcessedByIndex.push(
      ...new Array(videoJobs.length).fill(false)
    );
  }

  logStep(
    "progress",
    `Channel ${listing.channelId}: ${completedVideos}/${totalVideos} videos already processed (${totalVideos - completedVideos} remaining)`
  );

  const provider = new AssemblyAiProvider(config.assemblyAiApiKey);
  const limit = pLimit(config.concurrency);

  await Promise.all(
    videoJobs.map(({ video, paths, index }) =>
      limit(async () => {
        if (stopAll) {
          logWarn(
            `Skipping due to prior fatal error: Video ${index}/${totalVideos} (${video.id})`
          );
          return;
        }

        const markFinished = (label: string) => {
          completedVideos += 1;
          const remaining = totalVideos - completedVideos;
          logStep(
            "progress",
            `Video ${index}/${totalVideos} ${label}: ${completedVideos}/${totalVideos} videos completed (${remaining} remaining)`
          );
        };

        try {
          if (!options.force && alreadyProcessedByIndex[index - 1]) {
            logStep(
              "skip",
              `Video ${index}/${totalVideos} already processed: ${video.id} (${completedVideos}/${totalVideos} completed)`
            );
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

          const description =
            video.description ??
            (await fetchVideoDescription(video.url, ytDlpCommand));

          if (config.commentsEnabled) {
            try {
              if (options.force || !(await isProcessed(paths.commentsPath))) {
                const comments = await fetchVideoComments(
                  video.url,
                  ytDlpCommand,
                  config.commentsMax
                );
                if (comments) {
                  await saveVideoCommentsJson(
                    paths.commentsPath,
                    comments
                  );
                }
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              logWarn(
                `Comments fetch failed for ${video.id}: ${message}`
              );
            }
          }

          await saveTranscriptJson(paths.jsonPath, transcript);
          await saveTranscriptTxt(
            paths.txtPath,
            formatTxt(transcript, {
              channelId: listing.channelId,
              channelTitle: listing.channelTitle,
              title: video.title,
              url: video.url,
              uploadDate: video.uploadDate,
              description,
            })
          );

          if (config.csvEnabled) {
            await saveTranscriptCsv(
              paths.csvPath,
              formatCsv(transcript)
            );
          }

          logStep("done", `Video ${index}/${totalVideos} done: ${video.id}`);
          markFinished("done");
        } catch (error) {
          if (error instanceof InsufficientCreditsError) {
            stopAll = true;
            logWarn(
              `Stopping run: AssemblyAI credits exhausted while processing Video ${index}/${totalVideos} (${video.id})`
            );
            throw error;
          }
          const message =
            error instanceof Error ? error.message : String(error);
          logWarn(
            `Failed Video ${index}/${totalVideos} (${video.id}): ${message}`
          );
          await logErrorRecord(paths.errorLogPath, {
            videoId: video.id,
            videoUrl: video.url,
            stage: "transcribe",
            message,
            timestamp: new Date().toISOString(),
          });
          markFinished("failed");
        }
      })
    )
  );
}
