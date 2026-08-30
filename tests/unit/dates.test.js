import { describe, expect, it } from 'vitest';
import {
  formatTaskDate,
  getDayOfYear,
  getDaysInYear,
  getWeekDays,
  getWeekRange,
} from '../../src/utils/dates.js';

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

  it('builds a Monday-to-Sunday week without using the browser timezone', () => {
    expect(getWeekDays('2026-08-30')).toEqual([
      { date: '2026-08-24', shortLabel: 'Mon', longLabel: 'Monday', isToday: false },
      { date: '2026-08-25', shortLabel: 'Tue', longLabel: 'Tuesday', isToday: false },
      { date: '2026-08-26', shortLabel: 'Wed', longLabel: 'Wednesday', isToday: false },
      { date: '2026-08-27', shortLabel: 'Thu', longLabel: 'Thursday', isToday: false },
      { date: '2026-08-28', shortLabel: 'Fri', longLabel: 'Friday', isToday: false },
      { date: '2026-08-29', shortLabel: 'Sat', longLabel: 'Saturday', isToday: false },
      { date: '2026-08-30', shortLabel: 'Sun', longLabel: 'Sunday', isToday: true },
    ]);
    expect(getWeekRange('2026-08-24')).toEqual({ start: '2026-08-24', end: '2026-08-30' });
  });

  it('handles a week that crosses a year boundary', () => {
    expect(getWeekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});
