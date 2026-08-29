import { bins } from '../features/ecocrew/mock-data.js';
import { ecoCrewService } from '../services/ecocrew-service.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
} from '../features/ecocrew/page-utils.js';

function binChoices() {
  return bins
    .map(
      (bin) =>
        '<button class="ecocrew-bin" type="button" data-bin="' +
        escapeHtml(bin.id) +
        '"><span aria-hidden="true">' +
        escapeHtml(bin.icon) +
        '</span><strong>' +
        escapeHtml(bin.label) +
        '</strong><small>' +
        escapeHtml(bin.description) +
        '</small></button>',
    )
    .join('');
}

export function renderSubmitPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Create a post',
    'Daily challenge',
    '<section class="ecocrew-sort-card">' +
      '<p class="ecocrew-task-prompt" data-task-prompt>Loading your daily task…</p>' +
      '<div class="ecocrew-upload" data-upload-area>' +
      '<input id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="visually-hidden">' +
      '<label for="item-photo" class="ecocrew-upload__label"><span class="ecocrew-upload__icon" aria-hidden="true">⌁</span><strong>Add a post photo</strong><small>Use your camera or choose an image</small></label>' +
      '<img class="ecocrew-preview d-none" alt="Selected item preview">' +
      '</div>' +
      '<div class="ecocrew-choice-section" hidden><p class="ecocrew-kicker">BEFORE WE REVEAL IT</p><h2>Where does it belong?</h2><p class="text-secondary">Choose your best guess. The server will check the image and your bin choice.</p><div class="ecocrew-bin-grid">' +
      binChoices() +
      '</div></div>' +
      '<p class="ecocrew-processing" aria-live="polite" hidden><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking your item…</p>' +
      '<p class="ecocrew-form-error" data-submit-error role="alert" hidden></p>' +
      '<div class="ecocrew-card" data-submit-complete hidden><p class="ecocrew-kicker">TODAY’S CHALLENGE</p><h2>Already complete</h2><p class="ecocrew-muted">You have submitted today’s challenge. Come back tomorrow for your next one.</p><a class="btn ecocrew-btn-primary" data-submit-result-link href="#/result/latest">View today’s result</a></div>' +
      '</section>',
    'Upload a private item photo, choose the bin you think is correct, and receive the daily task result.',
  );

  const photo = page.querySelector('#item-photo');
  const preview = page.querySelector('.ecocrew-preview');
  const choices = page.querySelector('.ecocrew-choice-section');
  const error = page.querySelector('[data-submit-error]');
  const complete = page.querySelector('[data-submit-complete]');
  const resultLink = page.querySelector('[data-submit-result-link]');
  let taskId;
  let completed = false;

  function showCompleted(result) {
    completed = true;
    page.querySelector('[data-upload-area]').hidden = true;
    choices.hidden = true;
    page.querySelector('.ecocrew-processing').hidden = true;
    page.querySelectorAll('[data-bin]').forEach((button) => {
      button.disabled = true;
    });
    if (photo) photo.disabled = true;
    error.hidden = true;
    complete.hidden = false;
    const submissionId = result?.submissionId || result?.scanEventId || 'latest';
    resultLink.href = '#/result/' + encodeURIComponent(submissionId);
  }

  page.querySelector('[data-upload-area]')?.addEventListener('click', () => {
    if (!completed) photo?.click();
  });
  photo?.addEventListener('change', () => {
    if (completed) return;
    const file = photo.files?.[0];
    if (!file) return;
    preview.src = window.URL.createObjectURL(file);
    preview.classList.remove('d-none');
    page.querySelector('.ecocrew-upload__label').hidden = true;
    choices.hidden = false;
    error.hidden = true;
  });

  page.querySelectorAll('[data-bin]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (completed) return;
      const file = photo?.files?.[0];
      if (!file) return;
      page.querySelectorAll('[data-bin]').forEach((item) => {
        item.disabled = true;
      });
      page.querySelector('.ecocrew-processing').hidden = false;
      error.hidden = true;
      try {
        const result = await ecoCrewService.submitTask({
          file,
          taskId,
          userSelectedBin: button.dataset.bin,
          idempotencyKey: 'web-' + Date.now() + '-' + Math.random().toString(16).slice(2),
          locale: 'en-SG',
        });
        navigate(
          '/result/' + encodeURIComponent(result.submissionId || result.scanEventId || 'latest'),
        );
      } catch (exception) {
        if (exception.code === 'DAILY_TASK_ALREADY_SUBMITTED') {
          showCompleted(ecoCrewService.getLastResult());
          return;
        }
        error.textContent = exception.message || 'We could not check that image. Try again.';
        error.hidden = false;
        page.querySelector('.ecocrew-processing').hidden = true;
        page.querySelectorAll('[data-bin]').forEach((item) => {
          item.disabled = false;
        });
      }
    }),
  );

  return {
    element: page,
    title: 'Create a post',
    afterRender: async () => {
      try {
        const task = await ecoCrewService.getDailyTask();
        taskId = task?.taskId;
        const prompt = page.querySelector('[data-task-prompt]');
        if (prompt) prompt.textContent = task?.prompt || 'Choose an item to sort today.';
        const existingResult = ecoCrewService.getLastResult();
        if (existingResult?.taskDay === task?.taskDay) showCompleted(existingResult);
      } catch (exception) {
        const prompt = page.querySelector('[data-task-prompt]');
        if (prompt) prompt.textContent = exception.message || 'Your daily task is unavailable.';
      }
    },
  };
}
