#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, loadRunsFile } from "../config/index.js";
import { logError } from "../utils/logger.js";
import { runPipeline } from "../pipeline/run.js";
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
  .argument("[url]", "YouTube channel or playlist URL")
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
  const inputUrl = program.args[0] as string | undefined;
  const baseConfig = loadConfig();
  const opts = program.opts<CliOptions>();

  if (inputUrl) {
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
      audioFormat: run.audioFormat ?? baseConfig.audioFormat,
      languageCode: run.languageCode ?? baseConfig.languageCode,
      concurrency: run.concurrency ?? baseConfig.concurrency,
      maxVideos: run.maxVideos ?? baseConfig.maxVideos,
      afterDate: run.after ?? baseConfig.afterDate,
      csvEnabled: run.csvEnabled ?? baseConfig.csvEnabled,
    };

    await runPipeline(run.url, config, { force: Boolean(run.force) });
  }
}

main().catch((error) => {
  logError(
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});
