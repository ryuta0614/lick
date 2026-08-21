/** Base class for all Social Growth OS domain errors. */
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class PlatformAuthError extends AppError {
  readonly code = "PLATFORM_AUTH_ERROR";
}

export class PlatformRateLimitError extends AppError {
  readonly code = "PLATFORM_RATE_LIMIT_ERROR";
  constructor(message: string, public readonly retryAfterMs?: number, cause?: unknown) {
    super(message, cause);
  }
}

export class PlatformValidationError extends AppError {
  readonly code = "PLATFORM_VALIDATION_ERROR";
}

export class AIGenerationError extends AppError {
  readonly code = "AI_GENERATION_ERROR";
}

export class ContentValidationError extends AppError {
  readonly code = "CONTENT_VALIDATION_ERROR";
}

export class PublishError extends AppError {
  readonly code = "PUBLISH_ERROR";
}

/** True for errors that are safe to retry with backoff (e.g. 429s). */
export function isRetryableError(error: unknown): boolean {
  return error instanceof PlatformRateLimitError;
}
