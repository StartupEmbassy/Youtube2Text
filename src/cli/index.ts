#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, loadRunsFile } from "../config/index.js";
import { logError } from "../utils/logger.js";
import { runPipeline } from "../pipeline/run.js";
import { JsonLinesEventEmitter } from "../pipeline/jsonlEmitter.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf8")
);

const program = new Command();

program
  .name("youtube2text")
  .version(pkg.version)
  .argument("[url]", "YouTube channel, playlist, or video URL")
  .option(
    "--maxNewVideos <n>",
    "Maximum NEW (unprocessed) videos to process",
    (v) => Number(v)
  )
  .option("--after <date>", "Only videos after YYYY-MM-DD")
  .option("--outDir <path>", "Output directory")
  .option("--audioDir <path>", "Audio directory")
  .option(
    "--filenameStyle <style>",
    "Output filename style: id | id_title | title_id"
  )
  .option("--audioFormat <fmt>", "mp3 or wav")
  .option(
    "--sttProvider <provider>",
    "Speech-to-text provider (assemblyai | openai_whisper)"
  )
  .option("--openaiWhisperModel <name>", "OpenAI Whisper model (default whisper-1)")
  .option("--maxAudioMB <n>", "Max audio size before splitting (MB)", (v) => Number(v))
  .option(
    "--splitOverlapSeconds <n>",
    "Overlap seconds between chunks when splitting",
    (v) => Number(v)
  )
  .option("--language <code>", "Language code (used when manual)")
  .option(
    "--languageDetection <mode>",
    "Language detection: auto | manual"
  )
  .option("--concurrency <n>", "Parallel videos", (v) => Number(v))
  .option("--csv", "Enable CSV output")
  .option("--ytDlpPath <path>", "Explicit yt-dlp.exe path override")
  .option(
    "--assemblyAiCreditsCheck <mode>",
    "AssemblyAI credits check: warn | abort | none"
  )
  .option(
    "--assemblyAiMinBalanceMinutes <n>",
    "Warn/abort if remaining credits below N minutes",
    (v) => Number(v)
  )
  .option("--comments", "Fetch video comments via yt-dlp")
  .option(
    "--commentsMax <n>",
    "Limit comments per video when fetching",
    (v) => Number(v)
  )
  .option("--json-events", "Emit JSONL pipeline events to stdout")
  .option("--force", "Reprocess even if outputs exist")
  .parse(process.argv);

type CliOptions = ReturnType<typeof program.opts>;

async function main() {
  const inputUrl = program.args[0] as string | undefined;
  const baseConfig = loadConfig();
  const opts = program.opts<CliOptions>();
  const emitter = opts.jsonEvents ? new JsonLinesEventEmitter() : undefined;
  if (opts.jsonEvents) process.env.Y2T_JSON_EVENTS = "1";

  if (inputUrl) {
    const config = {
      ...baseConfig,
      outputDir: opts.outDir ?? baseConfig.outputDir,
      audioDir: opts.audioDir ?? baseConfig.audioDir,
      filenameStyle:
        (opts.filenameStyle as
          | "id"
          | "id_title"
          | "title_id") ?? baseConfig.filenameStyle,
      audioFormat:
        (opts.audioFormat as "mp3" | "wav") ?? baseConfig.audioFormat,
      sttProvider:
        (opts.sttProvider as "assemblyai" | "openai_whisper") ??
        baseConfig.sttProvider,
      openaiWhisperModel: opts.openaiWhisperModel ?? baseConfig.openaiWhisperModel,
      maxAudioMB: opts.maxAudioMB ?? baseConfig.maxAudioMB,
      splitOverlapSeconds: opts.splitOverlapSeconds ?? baseConfig.splitOverlapSeconds,
      languageDetection:
        (opts.languageDetection as "auto" | "manual") ??
        (opts.language ? "manual" : baseConfig.languageDetection),
      languageCode: opts.language ?? baseConfig.languageCode,
      concurrency: opts.concurrency ?? baseConfig.concurrency,
      maxNewVideos: opts.maxNewVideos ?? baseConfig.maxNewVideos,
      afterDate: opts.after ?? baseConfig.afterDate,
      csvEnabled: opts.csv ?? baseConfig.csvEnabled,
      ytDlpPath: opts.ytDlpPath ?? baseConfig.ytDlpPath,
      assemblyAiCreditsCheck:
        (opts.assemblyAiCreditsCheck as
          | "warn"
          | "abort"
          | "none") ?? baseConfig.assemblyAiCreditsCheck,
      assemblyAiMinBalanceMinutes:
        opts.assemblyAiMinBalanceMinutes ??
        baseConfig.assemblyAiMinBalanceMinutes,
      commentsEnabled: opts.comments ?? baseConfig.commentsEnabled,
      commentsMax: opts.commentsMax ?? baseConfig.commentsMax,
    };

    await runPipeline(inputUrl, config, {
      force: Boolean(opts.force),
      emitter,
    });
    return;
  }

  const runs = loadRunsFile();
  if (!runs) {
    program.help({ error: true });
    return;
  }

  for (const run of runs) {
    const config = {
      ...baseConfig,
      outputDir: run.outDir ?? baseConfig.outputDir,
      audioDir: run.audioDir ?? baseConfig.audioDir,
      filenameStyle: run.filenameStyle ?? baseConfig.filenameStyle,
      audioFormat: run.audioFormat ?? baseConfig.audioFormat,
      sttProvider: run.sttProvider ?? baseConfig.sttProvider,
      openaiWhisperModel: run.openaiWhisperModel ?? baseConfig.openaiWhisperModel,
      maxAudioMB: run.maxAudioMB ?? baseConfig.maxAudioMB,
      splitOverlapSeconds: run.splitOverlapSeconds ?? baseConfig.splitOverlapSeconds,
      languageDetection:
        run.languageDetection ?? baseConfig.languageDetection,
      languageCode: run.languageCode ?? baseConfig.languageCode,
      concurrency: run.concurrency ?? baseConfig.concurrency,
      maxNewVideos: run.maxNewVideos ?? baseConfig.maxNewVideos,
      afterDate: run.after ?? baseConfig.afterDate,
      csvEnabled: run.csvEnabled ?? baseConfig.csvEnabled,
      ytDlpPath: run.ytDlpPath ?? baseConfig.ytDlpPath,
      assemblyAiCreditsCheck:
        run.assemblyAiCreditsCheck ?? baseConfig.assemblyAiCreditsCheck,
      assemblyAiMinBalanceMinutes:
        run.assemblyAiMinBalanceMinutes ??
        baseConfig.assemblyAiMinBalanceMinutes,
      commentsEnabled: run.commentsEnabled ?? baseConfig.commentsEnabled,
      commentsMax: run.commentsMax ?? baseConfig.commentsMax,
    };

    await runPipeline(run.url, config, {
      force: Boolean(run.force),
      emitter,
    });
  }
}

main().catch((error) => {
  logError(
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});
