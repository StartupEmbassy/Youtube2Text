export function logInfo(message: string) {
  process.stdout.write(message + "\n");
}

export function logWarn(message: string) {
  process.stderr.write("[warn] " + message + "\n");
}

export function logError(message: string) {
  process.stderr.write("[error] " + message + "\n");
}

