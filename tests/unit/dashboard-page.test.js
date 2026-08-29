/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboardData = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getDashboardData },
}));

import { renderDashboardPage } from '../../src/pages/dashboard-page.js';

const task = {
  taskId: 'recycle-plastic-bottle',
  taskDay: '2026-08-29',
  prompt: 'Recycle a plastic drink bottle',
  targetObject: 'bottle',
  targetMaterial: 'plastic',
};

describe('dashboard mock progress states', () => {
  beforeEach(() => {
    getDashboardData.mockReset();
  });

  it('shows a placeholder for weekly points without a crew', async () => {
    getDashboardData.mockResolvedValue({
      task,
      crew: { membership: null },
      weeklyPoints: null,
      dailyPoints: 0,
      todaySubmitted: false,
    });
    const rendered = renderDashboardPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-dashboard-weekly]').textContent).toBe('—');
    expect(rendered.element.querySelector('[data-dashboard-weekly-label]').textContent).toBe(
      'join a crew to track this',
    );
    expect(rendered.element.querySelector('[data-dashboard-today]').textContent).toBe('0');
    expect(rendered.element.querySelector('[data-dashboard-personal-streak]').textContent).toBe(
      '0',
    );
    expect(rendered.element.querySelector('[data-dashboard-day-marker]').textContent).toContain(
      '#241',
    );
    expect(rendered.element.querySelector('[data-dashboard-crew-card]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-dashboard-mission]').textContent).toBe(
      'Join a crew to unlock the weekly mission.',
    );
    expect(rendered.element.querySelector('[data-dashboard-progress]').textContent).toContain(
      'Weekly mission progress will appear after you join a crew.',
    );
    expect(rendered.element.querySelector('[data-dashboard-crew-card] [data-action="crew"]')).toBe(
      null,
    );
    expect(rendered.element.textContent).not.toContain('745');
  });

  it('shows crew weekly points after membership is present', async () => {
    getDashboardData.mockResolvedValue({
      task,
      crew: { membership: { crewId: 'demo-crew' }, streak: 4 },
      weeklyPoints: 745,
      dailyPoints: 0,
      personalStreak: { current: 7, longest: 9 },
      todaySubmitted: false,
    });
    const rendered = renderDashboardPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-dashboard-weekly]').textContent).toBe('745');
    expect(rendered.element.querySelector('[data-dashboard-weekly-label]').textContent).toBe(
      'this league week',
    );
    expect(rendered.element.querySelector('[data-dashboard-personal-streak]').textContent).toBe(
      '7 🔥',
    );
    expect(rendered.element.querySelector('[data-dashboard-streak]').textContent).toBe('4 🔥');
  });

  it('routes the completed dashboard CTA to the saved result', async () => {
    const navigate = vi.fn();
    getDashboardData.mockResolvedValue({
      task,
      crew: { membership: null },
      weeklyPoints: null,
      dailyPoints: 30,
      todaySubmitted: true,
      todaySubmissionId: 'submission-1',
    });
    const rendered = renderDashboardPage({ navigate });

    await rendered.afterRender();
    const button = rendered.element.querySelector('[data-action="sort"]');
    button.click();

    expect(button.textContent).toBe('View #241 result');
    expect(navigate).toHaveBeenCalledWith('/result/submission-1');
  });

  it('offers a resumable CTA for a pending check-in without requiring a crew', async () => {
    getDashboardData.mockResolvedValue({
      task,
      crew: { membership: null },
      weeklyPoints: null,
      dailyPoints: 0,
      todaySubmitted: false,
      todayActionStatus: 'pending',
      todaySubmissionId: 'pending-1',
    });
    const rendered = renderDashboardPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('h2').textContent).toContain(
      'Empty and recycle one plastic bottle.',
    );
    expect(rendered.element.querySelector('[data-action="sort"]').textContent).toBe(
      'Finish #241 check-in',
    );
    expect(rendered.element.querySelector('[data-action="sort"]').dataset.destination).toBe(
      '/result/pending-1',
    );
    expect(rendered.element.querySelector('[data-dashboard-no-crew]').hidden).toBe(false);
  });

  it('keeps crew errors out of the individual daily-task CTA', async () => {
    getDashboardData.mockRejectedValue(new Error('The crew mission is unavailable.'));
    const rendered = renderDashboardPage();

    await rendered.afterRender();

    const taskMeta = rendered.element.querySelector('[data-dashboard-task-meta]').textContent;
    expect(taskMeta).toContain('daily task');
    expect(taskMeta).not.toContain('crew mission');
  });

  it('shows an animated loader and guards the action while dashboard data is pending', async () => {
    let resolveDashboard;
    getDashboardData.mockReturnValue(
      new Promise((resolve) => {
        resolveDashboard = resolve;
      }),
    );
    const rendered = renderDashboardPage();
    const loading = rendered.element.querySelector('[data-dashboard-task-loading]');
    const pending = rendered.afterRender();

    expect(loading.hidden).toBe(false);
    expect(
      rendered.element.querySelector('[data-dashboard-task-region]').getAttribute('aria-busy'),
    ).toBe('true');
    expect(rendered.element.querySelector('[data-action="sort"]').disabled).toBe(true);

    resolveDashboard({ task, crew: { membership: null }, dailyPoints: 0 });
    await pending;

    expect(loading.hidden).toBe(true);
    expect(
      rendered.element.querySelector('[data-dashboard-task-region]').getAttribute('aria-busy'),
    ).toBe('false');
    expect(rendered.element.querySelector('[data-action="sort"]').disabled).toBe(false);
  });
});
