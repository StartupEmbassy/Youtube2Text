import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function sha256(path) {
  try {
    const buf = await readFile(path);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return undefined;
  }
}

const specPath = "openapi.yaml";
const generatedPath = "web/lib/apiTypes.gen.ts";

await run(npmCmd, ["run", "api:spec:validate"]);
const before = await sha256(generatedPath);
await run(npmCmd, ["run", "api:types:generate"]);
const after = await sha256(generatedPath);

if (!before || !after || before !== after) {
  process.stderr.write(
    [
      "[contract-check] Contract drift detected (generated types were not up-to-date).",
      `Fix: run \`npm run api:types:generate\` and commit the updated \`${generatedPath}\` file (and ensure \`${specPath}\` is updated).`,
      "",
      `Expected: ${generatedPath} does not change when regenerated.`,
    ].join("\n") + "\n",
  );
  process.exitCode = 1;
}
