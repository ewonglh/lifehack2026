import { describe, expect, it } from 'vitest';
import { resolveEnvironmentMode } from '../../src/config/env.js';

describe('environment mode', () => {
  it('uses local mocks when explicitly enabled during development', () => {
    expect(
      resolveEnvironmentMode({ isDevelopment: true, useMockFlag: true, hasCredentials: true }),
    ).toBe('mock');
  });
  it('uses local mocks by default without credentials during development', () => {
    expect(
      resolveEnvironmentMode({ isDevelopment: true, useMockFlag: false, hasCredentials: false }),
    ).toBe('mock');
  });
  it('does not allow mock mode in production', () => {
    expect(
      resolveEnvironmentMode({ isDevelopment: false, useMockFlag: true, hasCredentials: true }),
    ).toBe('supabase');
    expect(
      resolveEnvironmentMode({ isDevelopment: false, useMockFlag: true, hasCredentials: false }),
    ).toBe('invalid');
  });
});
