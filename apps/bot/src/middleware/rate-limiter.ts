import { RateLimitError } from '@bot/shared/errors';
import { getEnv } from '../config/env.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Sliding-window rate limiter for Discord interactions.
 *
 * The limiter is intentionally in-memory: a single bot process is expected
 * to handle a few thousand interactions per second at most, so a Map of
 * user/bucket entries fits comfortably.  When the bot is horizontally
 * scaled, replace this with a Redis-backed implementation that shares state
 * across replicas — the public API does not change.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(opts?: { max?: number; windowMs?: number }) {
    const env = getEnv();
    this.max = opts?.max ?? env.BOT_RATE_LIMIT_MAX;
    this.windowMs = opts?.windowMs ?? env.BOT_RATE_LIMIT_WINDOW_MS;
  }

  /**
   * Check whether `key` may proceed.  Increments the counter on success.
   * Throws `RateLimitError` when the limit is exceeded.  The error carries
   * the time the caller should wait before retrying.
   */
  consume(key: string, cost = 1): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: cost, resetAt: now + this.windowMs });
      return;
    }
    if (bucket.count + cost > this.max) {
      const retryAfterMs = Math.max(bucket.resetAt - now, 0);
      throw new RateLimitError(retryAfterMs);
    }
    bucket.count += cost;
  }

  /** Read-only inspection helper for tests and metrics. */
  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= Date.now()) return this.max;
    return Math.max(this.max - bucket.count, 0);
  }

  /** Test-only: clear state. */
  reset(): void {
    this.buckets.clear();
  }
}
