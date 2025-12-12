const NO_COLOR =
  process.env.NO_COLOR === "1" ||
  process.env.NO_COLOR === "true" ||
  process.env.FORCE_COLOR === "0";

function color(code: string, text: string): string {
  if (NO_COLOR) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

const dim = (t: string) => color("2", t);
const cyan = (t: string) => color("36", t);
const green = (t: string) => color("32", t);
const yellow = (t: string) => color("33", t);
const red = (t: string) => color("31;1", t);

export function logInfo(message: string) {
  process.stdout.write(`${cyan("[info]")} ${message}\n`);
}

export function logWarn(message: string) {
  process.stderr.write(`${yellow("[warn]")} ${message}\n`);
}

export function logError(message: string) {
  process.stderr.write(`${red("[error]")} ${message}\n`);
}

export function logStep(stage: string, message: string) {
  process.stdout.write(`${dim(`[${stage}]`)} ${message}\n`);
}
