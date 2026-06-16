import { getWebEnv } from './env';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Sliding-window rate limiter used by the web app's API layer and login
 * flow.  In-memory; replace with Redis when the dashboard scales beyond
 * a single Node process.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(opts?: { max?: number; windowMs?: number }) {
    const env = getWebEnv();
    this.max = opts?.max ?? env.API_RATE_LIMIT_MAX;
    this.windowMs = opts?.windowMs ?? env.API_RATE_LIMIT_WINDOW_MS;
  }

  /**
   * Returns the number of milliseconds the caller must wait before
   * retrying, or 0 if the request is allowed.  Increments the counter
   * on success.
   */
  check(key: string, cost = 1): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: cost, resetAt: now + this.windowMs });
      return { allowed: true };
    }
    if (bucket.count + cost > this.max) {
      return { allowed: false, retryAfterMs: Math.max(bucket.resetAt - now, 0) };
    }
    bucket.count += cost;
    return { allowed: true };
  }

  reset(): void {
    this.buckets.clear();
  }
}

let shared: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  if (!shared) shared = new RateLimiter();
  return shared;
}
