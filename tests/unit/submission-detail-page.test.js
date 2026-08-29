/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLastResult = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getLastResult },
}));

import { renderSubmissionDetailPage } from '../../src/pages/submission-detail-page.js';

describe('submission result presentation', () => {
  beforeEach(() => getLastResult.mockReset());

  it('emphasizes verified task completion, preparation, explanation, and reward', async () => {
    getLastResult.mockReturnValue({
      taskId: 'recycle-plastic-bottle',
      task: { prompt: 'Recycle a plastic drink bottle' },
      isCorrect: true,
      userSelectedBin: 'recycle',
      classification: {
        recommendedBin: 'recycle',
        confidence: 0.92,
        preparationTip: 'Empty and rinse it first.',
        explanation: 'The item is a PET bottle.',
      },
      points: { total: 25, correctBin: 10, preparation: 5, dailyBonus: 10 },
    });
    const rendered = renderSubmissionDetailPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-result-kicker]').textContent).toBe(
      'TASK COMPLETE',
    );
    expect(rendered.element.querySelector('[data-result-title]').textContent).toBe('Great work!');
    expect(rendered.element.querySelector('[data-result-task]').textContent).toContain(
      'Recycle a plastic drink bottle',
    );
    expect(rendered.element.querySelector('[data-result-tip]').hidden).toBe(false);
    expect(
      rendered.element.querySelector('[data-result-reason]').parentElement.querySelector('summary')
        .textContent,
    ).toBe('Why this result?');
    expect(rendered.element.querySelector('[data-result-reason]').textContent).toBe(
      'The item is a PET bottle.',
    );
    expect(rendered.element.querySelector('[data-result-points]').textContent).toContain('25');
  });

  it('keeps server-provided explanations as text', async () => {
    getLastResult.mockReturnValue({
      isCorrect: false,
      classification: {
        recommendedBin: 'unknown',
        confidence: 0.2,
        explanation: '<img src=x onerror=alert(1)>',
      },
      points: { total: 0 },
    });
    const rendered = renderSubmissionDetailPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-result-reason]').textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(rendered.element.querySelector('[data-result-reason] img')).toBeNull();
  });
});
