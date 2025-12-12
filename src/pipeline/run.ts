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
  saveVideoMetaJson,
  saveChannelMetaJson,
} from "../storage/index.js";
import { logErrorRecord } from "../storage/errors.js";
import { isAfterDate } from "../utils/date.js";
import { logInfo, logWarn, logStep } from "../utils/logger.js";
import { AppConfig } from "../config/schema.js";
import { validateYtDlpInstalled } from "../utils/deps.js";
import { InsufficientCreditsError } from "../transcription/errors.js";
import { PipelineEventEmitter, PipelineStage } from "./events.js";

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
  options: { force: boolean; emitter?: PipelineEventEmitter }
) {
  const ytDlpCommand = await validateYtDlpInstalled(config.ytDlpPath);
  let stopAll = false;
  const emitter = options.emitter;
  const nowIso = () => new Date().toISOString();
  const emitStage = (
    stage: PipelineStage,
    videoId: string,
    index: number,
    total: number
  ) => {
    emitter?.emit({
      type: "video:stage",
      videoId,
      stage,
      index,
      total,
      timestamp: nowIso(),
    });
  };
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
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  if (!options.force) {
    const processedFlags = await Promise.all(
      videoJobs.map((j) => isProcessed(j.paths.jsonPath))
    );
    alreadyProcessedByIndex.push(...processedFlags);
    completedVideos = processedFlags.filter(Boolean).length;
    skipped = completedVideos;
  } else {
    alreadyProcessedByIndex.push(
      ...new Array(videoJobs.length).fill(false)
    );
  }

  logStep(
    "progress",
    `Channel ${listing.channelId}: ${completedVideos}/${totalVideos} videos already processed (${totalVideos - completedVideos} remaining)`
  );

  emitter?.emit({
    type: "run:start",
    inputUrl,
    channelId: listing.channelId,
    channelTitle: listing.channelTitle,
    totalVideos,
    alreadyProcessed: completedVideos,
    remaining: totalVideos - completedVideos,
    timestamp: nowIso(),
  });

  if (totalVideos > 0) {
    const channelMetaPath = videoJobs[0]?.paths.channelMetaPath;
    if (channelMetaPath) {
      await saveChannelMetaJson(channelMetaPath, {
        channelId: listing.channelId,
        channelTitle: listing.channelTitle,
        inputUrl,
        updatedAt: nowIso(),
      });
    }
  }

  const provider = new AssemblyAiProvider(config.assemblyAiApiKey);
  const limit = pLimit(config.concurrency);

  try {
    await Promise.all(
      videoJobs.map(({ video, paths, index }) =>
        limit(async () => {
          if (stopAll) {
            skipped += 1;
            const remaining = totalVideos - completedVideos;
            logWarn(
              `Skipping due to prior fatal error: Video ${index}/${totalVideos} (${video.id})`
            );
            emitter?.emit({
              type: "video:skip",
              videoId: video.id,
              reason: "stopped",
              index,
              total: totalVideos,
              completed: completedVideos,
              remaining,
              timestamp: nowIso(),
            });
            return;
          }

          const markFinished = (
            label: "done" | "failed",
            errorMessage?: string
          ) => {
            completedVideos += 1;
            if (label === "done") succeeded += 1;
            if (label === "failed") failed += 1;
            const remaining = totalVideos - completedVideos;
            logStep(
              "progress",
              `Video ${index}/${totalVideos} ${label}: ${completedVideos}/${totalVideos} videos completed (${remaining} remaining)`
            );
            if (label === "done") {
              emitter?.emit({
                type: "video:done",
                videoId: video.id,
                index,
                total: totalVideos,
                completed: completedVideos,
                remaining,
                timestamp: nowIso(),
              });
            }
            if (label === "failed") {
              emitter?.emit({
                type: "video:error",
                videoId: video.id,
                error: errorMessage ?? "Unknown error",
                stage: "transcribe",
                index,
                total: totalVideos,
                completed: completedVideos,
                remaining,
                timestamp: nowIso(),
              });
            }
          };

          try {
            if (!options.force && alreadyProcessedByIndex[index - 1]) {
              const remaining = totalVideos - completedVideos;
              logStep(
                "skip",
                `Video ${index}/${totalVideos} already processed: ${video.id} (${completedVideos}/${totalVideos} completed)`
              );
              emitter?.emit({
                type: "video:skip",
                videoId: video.id,
                reason: "already_processed",
                index,
                total: totalVideos,
                completed: completedVideos,
                remaining,
                timestamp: nowIso(),
              });
              return;
            }

            emitter?.emit({
              type: "video:start",
              videoId: video.id,
              title: video.title,
              url: video.url,
              index,
              total: totalVideos,
              timestamp: nowIso(),
            });

            emitStage("download", video.id, index, totalVideos);
            const audioPath = await downloadAudio(
              video.url,
              paths.audioPath,
              config.audioFormat,
              config.downloadRetries,
              ytDlpCommand
            );

            emitStage("transcribe", video.id, index, totalVideos);
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
                if (
                  options.force ||
                  !(await isProcessed(paths.commentsPath))
                ) {
                  emitStage("comments", video.id, index, totalVideos);
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

            emitStage("save", video.id, index, totalVideos);
            await saveTranscriptJson(paths.jsonPath, transcript);
            await saveVideoMetaJson(paths.metaPath, {
              videoId: video.id,
              title: video.title,
              url: video.url,
              uploadDate: video.uploadDate,
              description,
              channelId: listing.channelId,
              channelTitle: listing.channelTitle,
              filenameStyle: config.filenameStyle,
              audioFormat: config.audioFormat,
              languageCode: config.languageCode,
              createdAt: nowIso(),
            });
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

            emitStage("format", video.id, index, totalVideos);
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
            markFinished("failed", message);
          }
        })
      )
    );

    emitter?.emit({
      type: "run:done",
      channelId: listing.channelId,
      total: totalVideos,
      succeeded,
      failed,
      skipped,
      timestamp: nowIso(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitter?.emit({
      type: "run:error",
      channelId: listing.channelId,
      error: message,
      timestamp: nowIso(),
    });
    throw error;
  }
}
