export async function retry<T>(
  operation: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; maxDelayMs: number }
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= opts.retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === opts.retries) break;
      const delay = Math.min(
        opts.baseDelayMs * 2 ** attempt,
        opts.maxDelayMs
      );
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }

  throw lastError;
}

