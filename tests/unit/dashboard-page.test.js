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
    expect(rendered.element.textContent).not.toContain('745');
  });

  it('shows crew weekly points after membership is present', async () => {
    getDashboardData.mockResolvedValue({
      task,
      crew: { membership: { crewId: 'demo-crew' } },
      weeklyPoints: 745,
      dailyPoints: 0,
      todaySubmitted: false,
    });
    const rendered = renderDashboardPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-dashboard-weekly]').textContent).toBe('745');
    expect(rendered.element.querySelector('[data-dashboard-weekly-label]').textContent).toBe(
      'this league week',
    );
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

    expect(button.textContent).toBe('View today’s result');
    expect(navigate).toHaveBeenCalledWith('/result/submission-1');
  });
});
