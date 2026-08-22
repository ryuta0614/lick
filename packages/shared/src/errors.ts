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

/** 5xx responses and network-level failures talking to a platform API. Safe to retry with backoff. */
export class PlatformServerError extends AppError {
  readonly code = "PLATFORM_SERVER_ERROR";
}

/**
 * The platform does not (or not verifiably) support this operation via its
 * official API. Used instead of guessing at undocumented behavior
 * (CLAUDE.md section 35: "create an adapter interface and TODO, rather than
 * guessing").
 */
export class PlatformUnsupportedOperationError extends AppError {
  readonly code = "PLATFORM_UNSUPPORTED_OPERATION";
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

/**
 * True for errors that are safe to retry with backoff (e.g. 429s, 5xx,
 * network failures). Everything else — including PublishError, used for
 * ambiguous "we don't know if the remote call succeeded" states — is
 * treated as non-retryable by default so a worker never blindly repeats a
 * live publish action (CLAUDE.md section 32).
 */
export function isRetryableError(error: unknown): boolean {
  return error instanceof PlatformRateLimitError || error instanceof PlatformServerError;
}
