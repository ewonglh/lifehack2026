import { demoFixtures } from '../features/ecocrew/mock-data.js';
import { ecoCrewService } from '../services/ecocrew-service.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
} from '../features/ecocrew/page-utils.js';

function fixtureChoices() {
  return (
    '<details class="ecocrew-demo-fixtures"><summary>Use a demo example</summary><p class="ecocrew-muted">Only use this when you do not have a bottle nearby.</p><div class="ecocrew-demo-fixtures__grid">' +
    demoFixtures
      .map(
        (fixture) =>
          '<button class="btn ecocrew-btn-secondary" type="button" data-fixture="' +
          escapeHtml(fixture.id) +
          '"><span aria-hidden="true">' +
          escapeHtml(fixture.icon) +
          '</span> ' +
          escapeHtml(fixture.label) +
          '</button>',
      )
      .join('') +
    '</div></details>'
  );
}

async function createFixtureFile(fixtureId) {
  const labels = {
    liquid_bottle: ['BOTTLE', 'VISIBLE WATER'],
    empty_bottle: ['BOTTLE', 'EMPTY + RECYCLE'],
    unrelated_item: ['SHOE', 'NOT TODAY’S ITEM'],
  };
  const [headline, subtitle] = labels[fixtureId] || labels.empty_bottle;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#dff1e4"/><rect x="40" y="40" width="720" height="520" rx="36" fill="#f8fff9" stroke="#173d36" stroke-width="8"/><circle cx="400" cy="250" r="115" fill="#d7f25a" stroke="#173d36" stroke-width="8"/><text x="400" y="235" text-anchor="middle" font-family="Arial" font-size="44" font-weight="700" fill="#173d36">' +
    headline +
    '</text><text x="400" y="290" text-anchor="middle" font-family="Arial" font-size="24" fill="#173d36">' +
    subtitle +
    '</text><text x="400" y="475" text-anchor="middle" font-family="Arial" font-size="22" fill="#536862">EcoCrew demo sample</text></svg>';
  const image = new window.Image();
  const url = window.URL.createObjectURL(new window.Blob([svg], { type: 'image/svg+xml' }));
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  image.src = url;
  await loaded;
  window.URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Unable to prepare the demo sample.');
  return new window.File([blob], fixtureId + '.png', { type: 'image/png' });
}

export function renderSubmitPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Today’s action',
    'Clean Bottle Check',
    '<section class="ecocrew-sort-card">' +
      '<div class="ecocrew-task-prompt"><p class="ecocrew-kicker" data-task-title>TODAY’S ACTION</p><h2 data-task-instruction>Loading today’s action…</h2></div>' +
      '<div class="ecocrew-upload" data-upload-area>' +
      '<input id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="visually-hidden">' +
      '<label for="item-photo" class="ecocrew-upload__label"><span class="ecocrew-upload__icon" aria-hidden="true">⌁</span><strong>Take a photo of the empty bottle</strong><small>Use your camera or choose an image</small></label>' +
      '<img class="ecocrew-preview d-none" alt="Selected empty bottle preview">' +
      '</div>' +
      fixtureChoices() +
      '<div class="ecocrew-action-submit" hidden><button class="btn ecocrew-btn-primary" type="button" data-check-action>Check my action</button></div>' +
      '<p class="ecocrew-processing" aria-live="polite" hidden><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking your action…</p>' +
      '<p class="ecocrew-form-error" data-submit-error role="alert" hidden></p>' +
      '<div class="ecocrew-card" data-submit-complete hidden><p class="ecocrew-kicker">TODAY’S ACTION</p><h2 data-submit-complete-title>Already complete</h2><p class="ecocrew-muted" data-submit-complete-copy>Your recycling action is already recorded.</p><a class="btn ecocrew-btn-primary" data-submit-result-link href="#/result/latest">View today’s result</a></div>' +
      '</section>',
    'Photograph the empty bottle ready for recycling, then check in after you have recycled it.',
  );

  const photo = page.querySelector('#item-photo');
  const preview = page.querySelector('.ecocrew-preview');
  const submitAction = page.querySelector('.ecocrew-action-submit');
  const error = page.querySelector('[data-submit-error]');
  const complete = page.querySelector('[data-submit-complete]');
  const resultLink = page.querySelector('[data-submit-result-link]');
  let taskId;
  let completed = false;
  let previewUrl = null;
  let selectedFile = null;
  let selectedFixture = null;

  function showSelectedFile(file, fixture = null) {
    selectedFile = file;
    selectedFixture = fixture;
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    previewUrl = window.URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.classList.remove('d-none');
    page.querySelector('.ecocrew-upload__label').hidden = true;
    submitAction.hidden = false;
    error.hidden = true;
  }

  function showCompleted(result, pending = false) {
    completed = !pending;
    page.querySelector('[data-upload-area]').hidden = true;
    page.querySelector('.ecocrew-demo-fixtures').hidden = true;
    submitAction.hidden = true;
    page.querySelector('.ecocrew-processing').hidden = true;
    if (photo) photo.disabled = true;
    error.hidden = true;
    complete.hidden = false;
    page.querySelector('[data-submit-complete-title]').textContent = pending
      ? 'Your action is ready to finish'
      : 'Already complete';
    page.querySelector('[data-submit-complete-copy]').textContent = pending
      ? 'Your bottle photo is ready. Place it in recycling, then check in.'
      : 'Your recycling action is already recorded.';
    const submissionId = result?.submissionId || result?.scanEventId || 'latest';
    resultLink.href = '#/result/' + encodeURIComponent(submissionId);
  }

  photo?.addEventListener('change', () => {
    if (completed) return;
    const file = photo.files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      selectedFile = null;
      selectedFixture = null;
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.removeAttribute('src');
      preview.classList.add('d-none');
      page.querySelector('.ecocrew-upload__label').hidden = false;
      submitAction.hidden = true;
      error.textContent = 'Choose a JPEG, PNG, or WebP image smaller than 10 MB.';
      error.hidden = false;
      photo.value = '';
      return;
    }
    showSelectedFile(file);
  });

  page.querySelectorAll('[data-fixture]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (completed) return;
      button.disabled = true;
      error.hidden = true;
      try {
        const file = await createFixtureFile(button.dataset.fixture);
        showSelectedFile(file, button.dataset.fixture);
      } catch (exception) {
        error.textContent = exception.message || 'We could not prepare that demo sample.';
        error.hidden = false;
      } finally {
        button.disabled = false;
      }
    }),
  );

  page.querySelector('[data-check-action]')?.addEventListener('click', async () => {
    if (completed) return;
    const file = selectedFile || photo?.files?.[0];
    if (!file) return;
    const checkButton = page.querySelector('[data-check-action]');
    checkButton.disabled = true;
    page.querySelector('.ecocrew-processing').hidden = false;
    error.hidden = true;
    try {
      const result = await ecoCrewService.submitTask({
        file,
        taskId,
        demoFixture: selectedFixture,
        idempotencyKey: 'web-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        locale: 'en-SG',
      });
      navigate(
        '/result/' + encodeURIComponent(result.submissionId || result.scanEventId || 'latest'),
      );
    } catch (exception) {
      if (exception.code === 'DAILY_TASK_ALREADY_SUBMITTED') {
        showCompleted(await ecoCrewService.getLastResult());
        return;
      }
      if (exception.code === 'ACTION_CHECK_IN_PENDING') {
        showCompleted(await ecoCrewService.getLastResult(exception.submissionId), true);
        return;
      }
      error.textContent = exception.message || 'We could not check that image. Try again.';
      error.hidden = false;
      page.querySelector('.ecocrew-processing').hidden = true;
      checkButton.disabled = false;
    }
  });

  return {
    element: page,
    title: 'Today’s action',
    afterRender: async () => {
      try {
        const task = await ecoCrewService.getDailyTask();
        taskId = task?.taskId;
        const taskTitle = page.querySelector('[data-task-title]');
        const taskInstruction = page.querySelector('[data-task-instruction]');
        if (taskTitle) taskTitle.textContent = task?.title || 'Today’s action';
        if (taskInstruction)
          taskInstruction.textContent = task?.instruction || 'Complete today’s assigned action.';
        const existingResult = await ecoCrewService.getLastResult();
        if (task && existingResult?.taskDay === task.taskDay) {
          if (existingResult.behaviorCheckIn?.status === 'pending')
            showCompleted(existingResult, true);
          else if (
            existingResult.behaviorCheckIn?.status === 'confirmed' ||
            existingResult.validated === true
          )
            showCompleted(existingResult);
        }
      } catch (exception) {
        const taskTitle = page.querySelector('[data-task-title]');
        const taskInstruction = page.querySelector('[data-task-instruction]');
        if (taskTitle) taskTitle.textContent = 'Today’s action';
        if (taskInstruction)
          taskInstruction.textContent = exception.message || 'Your daily action is unavailable.';
      }
    },
  };
}
