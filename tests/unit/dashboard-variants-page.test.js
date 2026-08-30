/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboardData = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getDashboardData },
}));

import { renderDashboardVariantsPage } from '../../src/pages/dashboard-variants-page.js';

const weekDays = [
  ['2026-08-24', 'Mon', 'Monday', 'completed', false],
  ['2026-08-25', 'Tue', 'Tuesday', 'completed', false],
  ['2026-08-26', 'Wed', 'Wednesday', 'missed', false],
  ['2026-08-27', 'Thu', 'Thursday', 'pending', false],
  ['2026-08-28', 'Fri', 'Friday', 'available', true],
  ['2026-08-29', 'Sat', 'Saturday', 'upcoming', false],
  ['2026-08-30', 'Sun', 'Sunday', 'upcoming', false],
].map(([date, shortLabel, longLabel, status, isToday]) => ({
  date,
  shortLabel,
  longLabel,
  status,
  isToday,
}));

const dashboardData = {
  task: {
    taskDay: '2026-08-28',
    title: 'Clean Bottle Check',
    instruction: 'Empty and recycle one plastic bottle.',
  },
  personalStreak: { current: 2, longest: 5 },
  weekProgress: { weekStart: '2026-08-24', completedCount: 2, days: weekDays },
  crew: {
    membership: { crewId: 'crew-1' },
    streak: 4,
    mission: {
      title: 'Defeat the Landfill Monster',
      progress: 64,
      target: 100,
      endsLabel: '3 days left',
    },
  },
  dailyPoints: 25,
  weeklyPoints: 745,
  todayActionStatus: 'pending',
  todaySubmissionId: 'submission-1',
};

describe('dashboard design review page', () => {
  beforeEach(() => {
    getDashboardData.mockReset();
    getDashboardData.mockResolvedValue(dashboardData);
  });

  it('loads data once and renders all three complete dashboard variants', async () => {
    const rendered = renderDashboardVariantsPage();

    await rendered.afterRender();

    expect(getDashboardData).toHaveBeenCalledTimes(1);
    expect(rendered.element.querySelectorAll('[data-dashboard-variant]')).toHaveLength(3);
    expect(rendered.element.querySelectorAll('[data-dashboard-variant]')).toHaveLength(3);
    expect(rendered.element.querySelectorAll('[data-variant-action]')).toHaveLength(3);
    expect(rendered.element.textContent).toContain('Clean Bottle Check');
    expect(rendered.element.textContent).toContain('Defeat the Landfill Monster');
  });

  it('renders seven accessible day indicators with their status in every variant', async () => {
    const rendered = renderDashboardVariantsPage();

    await rendered.afterRender();

    rendered.element.querySelectorAll('[data-dashboard-variant]').forEach((variant) => {
      const days = variant.querySelectorAll(
        '[aria-label*="Monday"], [aria-label*="Tuesday"], [aria-label*="Wednesday"], [aria-label*="Thursday"], [aria-label*="Friday"], [aria-label*="Saturday"], [aria-label*="Sunday"]',
      );
      expect(days).toHaveLength(7);
      expect(variant.textContent).toContain('2');
    });
    expect(rendered.element.textContent).toContain('check-in pending');
    expect(rendered.element.textContent).toContain('not completed');
    expect(rendered.element.textContent).toContain('ready to start');
  });

  it('keeps variant actions connected to the supplied navigation function', async () => {
    const navigate = vi.fn();
    const rendered = renderDashboardVariantsPage({ navigate });

    await rendered.afterRender();
    rendered.element.querySelector('[data-variant-action]').click();

    expect(navigate).toHaveBeenCalledWith('/result/submission-1');
  });

  it('shows a recoverable review error when dashboard data is unavailable', async () => {
    getDashboardData.mockRejectedValue(new Error('Unavailable'));
    const rendered = renderDashboardVariantsPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[role="alert"]').textContent).toContain(
      'temporarily unavailable',
    );
    expect(
      rendered.element.querySelector('[data-dashboard-variants]').getAttribute('aria-busy'),
    ).toBe('false');
  });
});
