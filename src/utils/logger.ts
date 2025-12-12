const NO_COLOR =
  process.env.NO_COLOR === "1" ||
  process.env.NO_COLOR === "true" ||
  process.env.FORCE_COLOR === "0";

function color(code: string, text: string): string {
  if (NO_COLOR) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

const dim = (t: string) => color("2", t);
const bold = (t: string) => color("1", t);
const cyan = (t: string) => color("36", t);
const blue = (t: string) => color("34", t);
const magenta = (t: string) => color("35", t);
const green = (t: string) => color("32", t);
const yellow = (t: string) => color("33", t);
const red = (t: string) => color("31;1", t);

type StageStyle = {
  icon: string;
  colorize: (t: string) => string;
};

const STAGE_STYLES: Record<string, StageStyle> = {
  enumerate: { icon: "LIST", colorize: cyan },
  download: { icon: "DL", colorize: magenta },
  upload: { icon: "UP", colorize: blue },
  transcribe: { icon: "ASR", colorize: green },
  credits: { icon: "CRED", colorize: yellow },
  skip: { icon: "SKIP", colorize: dim },
  done: { icon: "DONE", colorize: (t) => bold(green(t)) },
};

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
  const key = stage.toLowerCase();
  const style = STAGE_STYLES[key];
  const prefixText = style
    ? `[${style.icon} ${key}]`
    : `[${key}]`;
  const prefix = style ? style.colorize(prefixText) : dim(prefixText);
  process.stdout.write(`${prefix} ${message}\n`);
}
