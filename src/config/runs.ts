import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";

const runSchema = z.object({
  url: z.string().url(),
  maxVideos: z.number().int().positive().optional(),
  after: z.string().optional(),
  outDir: z.string().optional(),
  audioDir: z.string().optional(),
  audioFormat: z.enum(["mp3", "wav"]).optional(),
  languageCode: z.string().optional(),
  concurrency: z.number().int().positive().optional(),
  csvEnabled: z.boolean().optional(),
  force: z.boolean().optional(),
});

const runsFileSchema = z.union([
  z.object({ runs: z.array(runSchema).min(1) }),
  z.array(runSchema).min(1),
]);

export type RunItem = z.infer<typeof runSchema>;

export function loadRunsFile(
  path = "runs.yaml"
): RunItem[] | undefined {
  let fullPath = resolve(path);
  if (!existsSync(fullPath) && path === "runs.yaml") {
    const alt = resolve("runs.yml");
    if (existsSync(alt)) fullPath = alt;
  }
  if (!existsSync(fullPath)) return undefined;
  const raw = readFileSync(fullPath, "utf8");
  const parsed = YAML.parse(raw);
  const validated = runsFileSchema.parse(parsed);
  return Array.isArray(validated) ? validated : validated.runs;
}
