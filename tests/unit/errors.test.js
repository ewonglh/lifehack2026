import { describe, expect, it } from 'vitest';
import { toAppError } from '../../src/app/errors.js';

describe('toAppError', () => {
  it('preserves the shared API error contract', () => {
    const error = {
      code: 'quota_exceeded',
      message: 'Daily limit reached.',
      details: { retryAt: 'tomorrow' },
    };
    expect(toAppError(error)).toEqual(error);
  });
  it('normalizes unknown errors', () => expect(toAppError(null).code).toBe('unexpected_error'));
});
