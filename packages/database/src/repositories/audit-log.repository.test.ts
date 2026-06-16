import { describe, expect, it } from 'vitest';
import { __sanitizeMetadata } from './audit-log.repository.js';

describe('audit-log metadata sanitizer', () => {
  it('returns an empty object for undefined', () => {
    expect(__sanitizeMetadata(undefined)).toEqual({});
  });

  it('keeps scalar fields', () => {
    expect(__sanitizeMetadata({ a: 1, b: 'hi', c: true, d: 0 })).toEqual({
      a: 1,
      b: 'hi',
      c: true,
      d: 0,
    });
  });

  it('strips forbidden keys (case-insensitive)', () => {
    const result = __sanitizeMetadata({
      token: 'abc',
      SECRET: 'abc',
      Password: 'abc',
      Authorization: 'abc',
      other: 'keep',
    }) as Record<string, unknown>;
    expect(result).toEqual({ other: 'keep' });
  });

  it('truncates long strings', () => {
    const long = 'x'.repeat(2000);
    const result = __sanitizeMetadata({ note: long }) as Record<string, string>;
    expect(result.note.length).toBeLessThanOrEqual(1025); // 1024 + '…'
    expect(result.note.endsWith('…')).toBe(true);
  });

  it('drops nullish values', () => {
    const result = __sanitizeMetadata({ a: null, b: undefined, c: 1 });
    expect(result).toEqual({ c: 1 });
  });
});
