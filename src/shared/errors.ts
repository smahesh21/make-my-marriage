export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.", 429);
    this.name = "RateLimitError";
  }
}
