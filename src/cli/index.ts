#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { logError } from "../utils/logger.js";
import { runPipeline } from "../pipeline/run.js";

const program = new Command();

program
  .name("youtube2text")
  .argument("<url>", "YouTube channel or playlist URL")
  .option("--maxVideos <n>", "Maximum videos to process", (v) => Number(v))
  .option("--after <date>", "Only videos after YYYY-MM-DD")
  .option("--outDir <path>", "Output directory")
  .option("--audioDir <path>", "Audio directory")
  .option("--audioFormat <fmt>", "mp3 or wav")
  .option("--language <code>", "AssemblyAI language code")
  .option("--concurrency <n>", "Parallel videos", (v) => Number(v))
  .option("--csv", "Enable CSV output")
  .option("--force", "Reprocess even if outputs exist")
  .parse(process.argv);

type CliOptions = ReturnType<typeof program.opts>;

async function main() {
  const inputUrl = program.args[0] as string;
  const baseConfig = loadConfig();
  const opts = program.opts<CliOptions>();

  const config = {
    ...baseConfig,
    outputDir: opts.outDir ?? baseConfig.outputDir,
    audioDir: opts.audioDir ?? baseConfig.audioDir,
    audioFormat:
      (opts.audioFormat as "mp3" | "wav") ?? baseConfig.audioFormat,
    languageCode: opts.language ?? baseConfig.languageCode,
    concurrency: opts.concurrency ?? baseConfig.concurrency,
    maxVideos: opts.maxVideos ?? baseConfig.maxVideos,
    afterDate: opts.after ?? baseConfig.afterDate,
    csvEnabled: opts.csv ?? baseConfig.csvEnabled,
  };

  await runPipeline(inputUrl, config, { force: Boolean(opts.force) });
}

main().catch((error) => {
  logError(
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});
