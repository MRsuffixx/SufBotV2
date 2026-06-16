/**
 * Base class for all application errors. The `code` is a stable, machine-readable
 * identifier safe to expose to API consumers. The `status` is the HTTP status
 * the web layer should return. The underlying `cause` (if any) is NEVER exposed
 * to the client — it is intended for logs only.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;
  public override readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; details?: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = options?.status ?? 500;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, { status: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, { status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, { status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, { status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, { status: 409 });
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterMs: number;
  constructor(retryAfterMs: number, message = 'Rate limit exceeded') {
    super('RATE_LIMITED', message, { status: 429 });
    this.retryAfterMs = retryAfterMs;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super('CONFIGURATION_ERROR', message, { status: 500 });
  }
}
