import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('consumes tokens under the limit', () => {
    const limiter = new RateLimiter({ max: 3, windowMs: 1000 });
    expect(() => limiter.consume('user-1')).not.toThrow();
    expect(() => limiter.consume('user-1')).not.toThrow();
    expect(() => limiter.consume('user-1')).not.toThrow();
    expect(limiter.remaining('user-1')).toBe(0);
  });

  it('throws RateLimitError when exceeded', () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 });
    limiter.consume('a');
    expect(() => limiter.consume('a')).toThrow();
  });

  it('isolates keys', () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 });
    limiter.consume('a');
    expect(() => limiter.consume('a')).toThrow();
    expect(() => limiter.consume('b')).not.toThrow();
  });

  it('reports retryAfter in the thrown error', () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 5000 });
    limiter.consume('a');
    let caught: unknown;
    try {
      limiter.consume('a');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe('RateLimitError');
  });
});

