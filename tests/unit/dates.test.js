import { describe, expect, it } from 'vitest';
import { formatTaskDate, getDayOfYear, getDaysInYear } from '../../src/utils/dates.js';

describe('task date helpers', () => {
  it('calculates ordinal days without using the browser timezone', () => {
    expect(getDayOfYear('2026-01-01')).toBe(1);
    expect(getDayOfYear('2026-08-30')).toBe(242);
    expect(getDayOfYear('2026-12-31')).toBe(365);
  });

  it('handles leap-year totals and leap-day ordinals', () => {
    expect(getDaysInYear('2024-02-29')).toBe(366);
    expect(getDayOfYear('2024-02-29')).toBe(60);
    expect(getDayOfYear('2024-12-31')).toBe(366);
  });

  it('formats a task calendar date as a readable daily label', () => {
    expect(formatTaskDate('2026-08-30')).toBe('Sunday, 30 August 2026');
  });

  it('returns safe empty values for malformed task dates', () => {
    expect(getDayOfYear('not-a-date')).toBeNull();
    expect(getDaysInYear('2026-02-30')).toBeNull();
    expect(formatTaskDate('')).toBe('');
  });
});
