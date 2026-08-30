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
  title: 'Clean Bottle Check',
  instruction:
    'Empty a single-use plastic bottle, take a photo of it ready for recycling, then place it in recycling.',
};

describe('today’s action photo flow', () => {
  beforeEach(() => {
    getDailyTask.mockResolvedValue(task);
    getLastResult.mockReset();
    submitTask.mockReset();
    window.fetch = vi.fn();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:demo');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('renders the action as read-only when today is already complete', async () => {
    getLastResult.mockReturnValue({
      taskDay: task.taskDay,
      submissionId: 'submission-1',
      validated: true,
    });
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-upload-area]').hidden).toBe(true);
    expect(rendered.element.querySelector('.ecocrew-demo-fixtures').hidden).toBe(true);
    expect(rendered.element.querySelector('#item-photo').disabled).toBe(true);
    expect(rendered.element.querySelector('[data-submit-complete]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-submit-result-link]').getAttribute('href')).toBe(
      '#/result/submission-1',
    );
  });

  it('renders the task name and instruction without duplicate task copy', async () => {
    getLastResult.mockReturnValue(null);
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-task-title]').textContent).toBe(
      'Clean Bottle Check',
    );
    expect(rendered.element.querySelector('[data-task-instruction]').textContent).toBe(
      task.instruction,
    );
    expect(rendered.element.querySelectorAll('[data-task-title]')).toHaveLength(1);
    expect(rendered.element.querySelectorAll('[data-task-instruction]')).toHaveLength(1);
    expect(rendered.element.querySelector('[data-task-guidance]')).toBeNull();
    expect(rendered.element.textContent.match(new RegExp(task.instruction, 'g'))).toHaveLength(1);
  });

  it('keeps task fallbacks when the daily task is unavailable', async () => {
    getDailyTask.mockResolvedValue(null);
    getLastResult.mockReturnValue(null);
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-task-title]').textContent).toBe('Today’s action');
    expect(rendered.element.querySelector('[data-task-instruction]').textContent).toBe(
      'Complete today’s assigned action.',
    );
    expect(rendered.element.querySelector('[data-task-guidance]')).toBeNull();
  });

  it('renders the supplied image fixtures without an unrelated-item option', async () => {
    getLastResult.mockReturnValue(null);
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    const fixtures = [...rendered.element.querySelectorAll('[data-fixture]')];
    expect(fixtures).toHaveLength(2);
    expect(fixtures.map((fixture) => fixture.dataset.fixture)).toEqual([
      'liquid_bottle',
      'empty_bottle',
    ]);
    expect(fixtures[0].querySelector('img').getAttribute('src')).toContain('bottle-with-water.jpg');
    expect(fixtures[1].querySelector('img').getAttribute('src')).toContain(
      'person-throws-plastic-bottle',
    );
    expect(rendered.element.textContent).not.toContain('Unrelated item');
    expect(rendered.element.querySelectorAll('svg')).toHaveLength(0);
    expect(fixtures.every((fixture) => fixture.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    );
  });

  it.each([
    ['liquid_bottle', 'bottle-with-water', 'bottle-with-water.jpg'],
    ['empty_bottle', 'person-throws-plastic-bottle', 'person-throws-plastic-bottle.jpg'],
  ])(
    'selects and submits the %s image fixture as a JPEG file',
    async (fixtureId, assetName, fileName) => {
      getLastResult.mockReturnValue(null);
      submitTask.mockResolvedValue({ submissionId: 'submission-fixture' });
      window.fetch.mockResolvedValue({
        ok: true,
        blob: async () => new window.Blob(['demo jpeg'], { type: 'image/jpeg' }),
      });
      const navigate = vi.fn();
      const rendered = renderSubmitPage({ navigate });
      await rendered.afterRender();

      const fixture = rendered.element.querySelector(`[data-fixture="${fixtureId}"]`);
      const otherFixture = rendered.element.querySelector(
        `[data-fixture="${fixtureId === 'liquid_bottle' ? 'empty_bottle' : 'liquid_bottle'}"]`,
      );
      fixture.click();

      await vi.waitFor(() =>
        expect(window.fetch).toHaveBeenCalledWith(expect.stringContaining(assetName)),
      );
      await vi.waitFor(() => expect(fixture.getAttribute('aria-pressed')).toBe('true'));
      expect(otherFixture.getAttribute('aria-pressed')).toBe('false');
      expect(fixture.classList.contains('is-selected')).toBe(true);
      expect(rendered.element.querySelector('.ecocrew-preview').getAttribute('src')).toBe(
        'blob:demo',
      );

      rendered.element.querySelector('[data-check-action]').click();

      await vi.waitFor(() => expect(submitTask).toHaveBeenCalled());
      expect(submitTask).toHaveBeenCalledWith(
        expect.objectContaining({
          demoFixture: fixtureId,
          file: expect.any(globalThis.File),
        }),
      );
      const uploadedFile = submitTask.mock.calls[0][0].file;
      expect(uploadedFile.name).toBe(fileName);
      expect(uploadedFile.type).toBe('image/jpeg');
      expect(navigate).toHaveBeenCalledWith('/result/submission-fixture');
    },
  );

  it('clears the selected demo fixture when a manual upload is chosen', async () => {
    getLastResult.mockReturnValue(null);
    window.fetch.mockResolvedValue({
      ok: true,
      blob: async () => new window.Blob(['demo jpeg'], { type: 'image/jpeg' }),
    });
    const rendered = renderSubmitPage();
    await rendered.afterRender();

    const demoFixture = rendered.element.querySelector('[data-fixture="empty_bottle"]');
    demoFixture.click();
    await vi.waitFor(() => expect(demoFixture.getAttribute('aria-pressed')).toBe('true'));

    const photo = rendered.element.querySelector('#item-photo');
    Object.defineProperty(photo, 'files', {
      configurable: true,
      value: [new globalThis.File(['manual image'], 'manual.jpg', { type: 'image/jpeg' })],
    });
    photo.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(demoFixture.getAttribute('aria-pressed')).toBe('false');
    expect(demoFixture.classList.contains('is-selected')).toBe(false);
  });

  it('shows an error when a demo image cannot be loaded', async () => {
    getLastResult.mockReturnValue(null);
    window.fetch.mockRejectedValue(new Error('Asset unavailable.'));
    const rendered = renderSubmitPage();
    await rendered.afterRender();

    const fixture = rendered.element.querySelector('[data-fixture="empty_bottle"]');
    fixture.click();

    await vi.waitFor(() =>
      expect(rendered.element.querySelector('[data-submit-error]').hidden).toBe(false),
    );
    expect(rendered.element.querySelector('[data-submit-error]').textContent).toContain(
      'Asset unavailable.',
    );
    expect(submitTask).not.toHaveBeenCalled();
    expect(fixture.disabled).toBe(false);
  });

  it('shows an unavailable-task error in the task fields when loading fails', async () => {
    getDailyTask.mockRejectedValue(new Error('Today’s action is unavailable.'));
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-task-title]').textContent).toBe('Today’s action');
    expect(rendered.element.querySelector('[data-task-instruction]').textContent).toBe(
      'Today’s action is unavailable.',
    );
    expect(rendered.element.querySelector('[data-task-guidance]')).toBeNull();
  });

  it('shows a resumable state when photo validation is pending check-in', async () => {
    getLastResult.mockReturnValue({
      taskDay: task.taskDay,
      submissionId: 'submission-pending',
      outcome: 'awaiting_check_in',
      behaviorCheckIn: { status: 'pending' },
    });
    const rendered = renderSubmitPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-submit-complete-title]').textContent).toBe(
      'Your action is ready to finish',
    );
    expect(rendered.element.querySelector('[data-submit-result-link]').getAttribute('href')).toBe(
      '#/result/submission-pending',
    );
  });

  it('submits a photo without a user-selected disposal category', async () => {
    submitTask.mockResolvedValue({ submissionId: 'submission-3' });
    const navigate = vi.fn();
    const rendered = renderSubmitPage({ navigate });
    await rendered.afterRender();
    const photo = rendered.element.querySelector('#item-photo');

    Object.defineProperty(photo, 'files', {
      configurable: true,
      value: [new globalThis.File(['not an image'], 'item.txt', { type: 'text/plain' })],
    });
    photo.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(rendered.element.querySelector('[data-submit-error]').textContent).toContain('JPEG');

    Object.defineProperty(photo, 'files', {
      configurable: true,
      value: [new globalThis.File(['demo image'], 'item.png', { type: 'image/png' })],
    });
    photo.dispatchEvent(new window.Event('change', { bubbles: true }));
    rendered.element.querySelector('[data-check-action]').click();

    await vi.waitFor(() => expect(submitTask).toHaveBeenCalled());
    expect(submitTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.taskId,
        locale: 'en-SG',
        file: expect.any(globalThis.File),
      }),
    );
    expect(submitTask.mock.calls[0][0]).not.toHaveProperty('userSelectedBin');
    expect(rendered.element.querySelector('[data-bin]')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/result/submission-3');
  });

  it('renders a backend error and re-enables the action check button', async () => {
    submitTask.mockRejectedValue(new Error('Server is unavailable.'));
    const rendered = renderSubmitPage();
    await rendered.afterRender();
    const photo = rendered.element.querySelector('#item-photo');
    Object.defineProperty(photo, 'files', {
      configurable: true,
      value: [new globalThis.File(['demo image'], 'item.png', { type: 'image/png' })],
    });
    photo.dispatchEvent(new window.Event('change', { bubbles: true }));
    rendered.element.querySelector('[data-check-action]').click();

    await vi.waitFor(() =>
      expect(rendered.element.querySelector('[data-submit-error]').hidden).toBe(false),
    );
    expect(rendered.element.querySelector('[data-submit-error]').textContent).toContain(
      'Server is unavailable.',
    );
    expect(rendered.element.querySelector('[data-check-action]').disabled).toBe(false);
  });

  it('shows a loader and guards photo controls while the task is pending', async () => {
    let resolveTask;
    getDailyTask.mockReturnValue(
      new Promise((resolve) => {
        resolveTask = resolve;
      }),
    );
    const rendered = renderSubmitPage();
    const pending = rendered.afterRender();

    expect(rendered.element.querySelector('[data-task-loading]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-task-region]').getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(rendered.element.querySelector('#item-photo').disabled).toBe(true);
    expect(rendered.element.querySelector('[data-upload-area]').hidden).toBe(true);

    getLastResult.mockReturnValue(null);
    resolveTask(task);
    await pending;

    expect(rendered.element.querySelector('[data-task-loading]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-task-region]').getAttribute('aria-busy')).toBe(
      'false',
    );
    expect(rendered.element.querySelector('#item-photo').disabled).toBe(false);
    expect(rendered.element.querySelector('[data-upload-area]').hidden).toBe(false);
  });
});
