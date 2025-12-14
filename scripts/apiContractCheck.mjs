import { spawn } from "node:child_process";

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

async function gitDiffNames(paths) {
  return await new Promise((resolve, reject) => {
    const args = ["diff", "--name-only", "--", ...paths];
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        const files = out
          .split(/\r?\n/g)
          .map((s) => s.trim())
          .filter(Boolean);
        resolve(files);
      } else {
        reject(new Error(`git ${args.join(" ")} exited with ${code}\n${err}`));
      }
    });
  });
}

const specPath = "openapi.yaml";
const generatedPath = "web/lib/apiTypes.gen.ts";

await run(npmCmd, ["run", "api:spec:validate"]);
await run(npmCmd, ["run", "api:types:generate"]);

const diff = await gitDiffNames([specPath, generatedPath]);
if (diff.length > 0) {
  process.stderr.write(
    [
      "[contract-check] Contract drift detected (spec and generated types are not in sync).",
      "Fix: run `npm run api:types:generate` and commit the updated generated file, and ensure `openapi.yaml` is correct.",
      "",
      "Diff files:",
      ...diff.map((f) => `- ${f}`),
      "",
    ].join("\n") + "\n",
  );
  process.exitCode = 1;
}
