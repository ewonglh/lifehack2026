import { analyseDemoPhoto, completeDemoTask, getDailyTask, getDemoState } from '../features/ecocrew/scan-service.js';
import { appShell, navigate } from '../features/ecocrew/page-utils.js';

export function renderSubmitPage() {
  const state = getDemoState();
  const isDailyCapReached = state.dailyScans >= state.dailyCap;
  const dailyTask = getDailyTask();
  const page = appShell('Create a post', 'Daily challenge', `
    <section class="ecocrew-sort-card">
      <div class="ecocrew-task-prompt"><p class="ecocrew-kicker">YOUR TASK</p><h2>${dailyTask.title}</h2><p>${dailyTask.guidance}</p></div>
      <div class="ecocrew-upload" data-upload-area>
        <input id="item-photo" type="file" accept="image/*" capture="environment" class="visually-hidden">
        <label for="item-photo" class="ecocrew-upload__label"><span class="ecocrew-upload__icon" aria-hidden="true">⌁</span><strong>Add a post photo</strong><small>Use your camera or choose an image</small></label>
        <img class="ecocrew-preview d-none" alt="Selected item preview">
      </div>
      <div class="ecocrew-choice-section" hidden><p class="ecocrew-kicker">TASK EVIDENCE READY</p><h2>Complete today’s task</h2><p class="text-secondary">Your photo will be submitted as proof of completing: ${dailyTask.title}.</p><button class="btn ecocrew-btn-primary w-100" type="button" data-complete-task>Submit completed task</button></div>
      <p class="ecocrew-processing" aria-live="polite" hidden><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking your item…</p>
      ${isDailyCapReached ? '<p class="ecocrew-form-error" role="status">You have completed today’s task. Come back tomorrow for a new challenge.</p>' : ''}
    </section>
  `);
  const photo = page.querySelector('#item-photo');
  const preview = page.querySelector('.ecocrew-preview');
  const choices = page.querySelector('.ecocrew-choice-section');
  let previewUrl = null;
  if (isDailyCapReached) {
    photo.disabled = true;
    page.querySelector('.ecocrew-upload__label').setAttribute('aria-disabled', 'true');
    return page;
  }
  photo.addEventListener('change', () => {
    const [file] = photo.files;
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.classList.remove('d-none');
    page.querySelector('.ecocrew-upload__label').hidden = true;
    choices.hidden = false;
  });
  page.querySelector('[data-complete-task]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    page.querySelector('.ecocrew-processing').hidden = false;
    await analyseDemoPhoto();
    if (completeDemoTask(dailyTask)) navigate('/result');
    else navigate('/dashboard');
  });
  return page;
}
