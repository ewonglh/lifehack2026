/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDailyTask = vi.hoisted(() => vi.fn());
const getLastResult = vi.hoisted(() => vi.fn());
const submitTask = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getDailyTask, getLastResult, submitTask },
}));

import { renderSubmitPage } from '../../src/pages/submit-page.js';

const task = {
  taskId: 'recycle-plastic-bottle',
  taskDay: '2026-08-29',
  prompt: 'Recycle a plastic drink bottle',
};

describe('completed daily challenge state', () => {
  beforeEach(() => {
    getDailyTask.mockResolvedValue(task);
    getLastResult.mockReset();
    submitTask.mockReset();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:demo');
  });

  it('renders the challenge as read-only when today is already complete', async () => {
    getLastResult.mockReturnValue({ taskDay: task.taskDay, submissionId: 'submission-1' });
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-upload-area]').hidden).toBe(true);
    expect(rendered.element.querySelector('.ecocrew-choice-section').hidden).toBe(true);
    expect(rendered.element.querySelector('#item-photo').disabled).toBe(true);
    expect(rendered.element.querySelector('[data-submit-complete]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-submit-result-link]').getAttribute('href')).toBe(
      '#/result/submission-1',
    );
  });

  it('switches to the read-only state if a duplicate is detected during submission', async () => {
    getLastResult.mockReturnValueOnce(null).mockReturnValue({
      taskDay: task.taskDay,
      submissionId: 'submission-2',
    });
    submitTask.mockRejectedValue({
      code: 'DAILY_TASK_ALREADY_SUBMITTED',
      message: 'You have already submitted today’s challenge.',
    });
    const rendered = renderSubmitPage();

    await rendered.afterRender();
    const photo = rendered.element.querySelector('#item-photo');
    Object.defineProperty(photo, 'files', {
      configurable: true,
      value: [new globalThis.File(['demo image'], 'item.png', { type: 'image/png' })],
    });
    photo.dispatchEvent(new window.Event('change', { bubbles: true }));
    rendered.element.querySelector('[data-bin="recycle"]').click();

    await vi.waitFor(() =>
      expect(rendered.element.querySelector('[data-submit-complete]').hidden).toBe(false),
    );
    expect(rendered.element.querySelector('[data-submit-result-link]').getAttribute('href')).toBe(
      '#/result/submission-2',
    );
  });
});
