export class InsufficientCreditsError extends Error {
  name = "InsufficientCreditsError";
  constructor(message: string) {
    super(message);
  }
}

