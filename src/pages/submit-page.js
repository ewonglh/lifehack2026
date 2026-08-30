import { demoFixtures } from '../features/ecocrew/mock-data.js';
import { ecoCrewService } from '../services/ecocrew-service.js';
import { loadingState } from '../components/loading-state.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
} from '../features/ecocrew/page-utils.js';

function fixtureChoices() {
  return (
    '<details class="ecocrew-demo-fixtures" data-task-control hidden><summary>Use a demo example</summary><p class="ecocrew-muted">Only use this when you do not have a bottle nearby.</p><div class="ecocrew-demo-fixtures__grid">' +
    demoFixtures
      .map(
        (fixture) =>
          '<button class="btn ecocrew-btn-secondary ecocrew-demo-fixture" type="button" data-fixture="' +
          escapeHtml(fixture.id) +
          '" aria-pressed="false"><img class="ecocrew-demo-fixture__image" src="' +
          escapeHtml(fixture.imageUrl) +
          '" alt="" loading="lazy"><span class="ecocrew-demo-fixture__label">' +
          escapeHtml(fixture.icon) +
          ' ' +
          escapeHtml(fixture.label) +
          '</span>' +
          '</button>',
      )
      .join('') +
    '</div></details>'
  );
}

async function createFixtureFile(fixture) {
  const response = await window.fetch(fixture.imageUrl);
  if (!response.ok) throw new Error('Unable to load that demo sample.');
  const blob = await response.blob();
  return new window.File([blob], fixture.fileName, { type: fixture.mimeType });
}

export function renderSubmitPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Today’s action',
    'Clean Bottle Check',
    '<section class="ecocrew-sort-card" data-task-region aria-busy="true">' +
      '<div class="ecocrew-task-prompt"><div data-task-loading>' +
      loadingState('Loading today’s action') +
      '</div><div data-task-content hidden><p class="ecocrew-kicker" data-task-title>TODAY’S ACTION</p><h2 data-task-instruction>Today’s action</h2></div></div>' +
      '<div class="ecocrew-upload" data-upload-area data-task-control hidden>' +
      '<input id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="visually-hidden" disabled>' +
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
  const fixtureButtons = [...page.querySelectorAll('[data-fixture]')];

  function setTaskAvailability(available) {
    page.querySelectorAll('[data-task-control]').forEach((control) => {
      control.hidden = !available;
    });
    if (photo) photo.disabled = !available;
  }

  function showSelectedFile(file, fixture = null) {
    selectedFile = file;
    selectedFixture = fixture;
    fixtureButtons.forEach((button) => {
      const isSelected = fixture !== null && button.dataset.fixture === fixture;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
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
      fixtureButtons.forEach((button) => {
        button.classList.remove('is-selected');
        button.setAttribute('aria-pressed', 'false');
      });
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
        const fixture = demoFixtures.find((item) => item.id === button.dataset.fixture);
        if (!fixture) throw new Error('Unable to prepare that demo sample.');
        const file = await createFixtureFile(fixture);
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
      const taskRegion = page.querySelector('[data-task-region]');
      const taskLoading = page.querySelector('[data-task-loading]');
      const taskContent = page.querySelector('[data-task-content]');

      const finishTaskLoading = (available) => {
        if (taskLoading) taskLoading.hidden = true;
        if (taskContent) taskContent.hidden = false;
        if (taskRegion) taskRegion.setAttribute('aria-busy', 'false');
        setTaskAvailability(available);
      };

      try {
        const task = await ecoCrewService.getDailyTask();
        taskId = task?.taskId;
        const taskTitle = page.querySelector('[data-task-title]');
        const taskInstruction = page.querySelector('[data-task-instruction]');
        if (taskTitle) taskTitle.textContent = task?.title || 'Today’s action';
        if (taskInstruction)
          taskInstruction.textContent = task?.instruction || 'Complete today’s assigned action.';
        const existingResult = await ecoCrewService.getLastResult();
        finishTaskLoading(Boolean(task?.taskId));
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
        finishTaskLoading(false);
        const taskTitle = page.querySelector('[data-task-title]');
        const taskInstruction = page.querySelector('[data-task-instruction]');
        if (taskTitle) taskTitle.textContent = 'Today’s action';
        if (taskInstruction)
          taskInstruction.textContent = exception.message || 'Your daily action is unavailable.';
      }
    },
  };
}
