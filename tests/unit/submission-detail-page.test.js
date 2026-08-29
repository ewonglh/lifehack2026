/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLastResult = vi.hoisted(() => vi.fn());
const confirmAction = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getLastResult, confirmAction },
}));

import { renderSubmissionDetailPage } from '../../src/pages/submission-detail-page.js';

describe('submission result presentation', () => {
  beforeEach(() => {
    getLastResult.mockReset();
    confirmAction.mockReset();
  });

  it('shows guidance and rewards only after a self-reported check-in', async () => {
    getLastResult.mockReturnValue({
      submissionId: 'submission-1',
      taskId: 'recycle-plastic-bottle',
      task: {
        title: 'Clean Bottle Check',
        instruction:
          'Empty a single-use plastic bottle, take a photo of it ready for recycling, then place it in recycling.',
      },
      outcome: 'awaiting_check_in',
      behaviorCheckIn: { status: 'pending', selfReported: false },
      classification: {
        recommendedBin: 'recycle',
        confidence: 0.92,
        preparationTip: 'Empty and rinse it first.',
        explanation: 'The item is a PET bottle.',
      },
      points: { total: 0, actionCompletion: 0, preparation: 0, dailyBonus: 0 },
    });
    const confirmed = {
      submissionId: 'submission-1',
      outcome: 'completed',
      validated: true,
      behaviorCheckIn: { status: 'confirmed', selfReported: true },
      classification: {
        recommendedBin: 'recycle',
        confidence: 0.92,
        preparationTip: 'Empty and rinse it first.',
        explanation: 'The item is a PET bottle.',
      },
      points: { total: 25, actionCompletion: 10, preparation: 5, dailyBonus: 10 },
    };
    confirmAction.mockResolvedValue(confirmed);
    const rendered = renderSubmissionDetailPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-result-kicker]').textContent).toBe(
      'READY FOR CHECK-IN',
    );
    expect(rendered.element.querySelector('[data-action-checkin]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-result-points]').textContent).toContain('0');
    expect(rendered.element.textContent).toContain('self-reported');

    rendered.element.querySelector('[data-action="confirm"]').click();
    await vi.waitFor(() =>
      expect(confirmAction).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionId: 'submission-1',
          action: 'recycle_bottle',
        }),
      ),
    );
    expect(rendered.element.querySelector('[data-result-kicker]').textContent).toBe(
      'ACTION COMPLETE',
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
