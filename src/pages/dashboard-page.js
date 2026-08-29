import { crew } from '../features/ecocrew/mock-data.js';
import { analyseDemoPhoto, completeDemoTask, getDailyTask, getDemoCosmetics, getDemoProfile, getDemoState } from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

export function renderDashboardPage() {
  const state = getDemoState();
  const dailyTask = getDailyTask();
  const profile = getDemoProfile();
  const mushroomFrame = getDemoCosmetics().find((item) => item.id === 'mushroom-frame');
  const isTaskCompleted = state.dailyScans >= state.dailyCap;
  const page = appShell('Make today count.', `Good morning, ${escapeHtml(profile.name)}`, `
    <section class="ecocrew-sort-card">
      <div class="ecocrew-task-prompt"><p class="ecocrew-kicker">YOUR TASK</p><h2>${dailyTask.title}</h2><p>${dailyTask.guidance}</p></div>
      <div class="ecocrew-upload" data-upload-area>
        <input id="item-photo" type="file" accept="image/*" capture="environment" class="visually-hidden">
        <label for="item-photo" class="ecocrew-upload__label"><span class="ecocrew-upload__icon" aria-hidden="true">⌁</span><strong>Add a post photo</strong><small>Use your camera or choose an image</small></label>
        <img class="ecocrew-preview d-none" alt="Selected task evidence preview">
      </div>
      <p class="ecocrew-form-error" data-upload-error role="alert" hidden>Please choose an image file smaller than 10 MB.</p>
      <div class="ecocrew-choice-section" hidden><p class="ecocrew-kicker">TASK EVIDENCE READY</p><h2>Complete today’s task</h2><p class="text-secondary">Your photo will be submitted as proof of completing: ${dailyTask.title}.</p><button class="btn ecocrew-btn-primary w-100" type="button" data-complete-task>Submit completed task</button></div>
      <p class="ecocrew-processing" aria-live="polite" hidden><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking your evidence…</p>
      ${isTaskCompleted ? '<p class="ecocrew-form-error" role="status">You have completed today’s task. Come back tomorrow for a new challenge.</p>' : ''}
    </section>
    <label class="ecocrew-task-completion"><input type="checkbox" ${isTaskCompleted ? 'checked' : ''} disabled><span>${isTaskCompleted ? 'Today’s task completed — great work!' : 'Completed Daily Task'}</span></label>
    <section class="ecocrew-stat-grid" aria-label="Your progress">
      <article><span>Today</span><strong>${state.todayPoints}</strong><small>points earned</small></article>
      <article><span>Crew streak</span><strong>${crew.streak} <i>🔥</i></strong><small>days together</small></article>
    </section>
    <section class="ecocrew-next-unlock"><span aria-hidden="true">🍄</span><div><p class="ecocrew-kicker">${mushroomFrame.unlocked ? 'COLLECTION' : 'NEXT UNLOCK'}</p><strong>Mushroom Frame</strong><small>${mushroomFrame.equipped ? 'Equipped' : mushroomFrame.unlocked ? 'Ready to equip in your collection' : mushroomFrame.progress}</small></div></section>
  `);
  const photo = page.querySelector('#item-photo');
  const preview = page.querySelector('.ecocrew-preview');
  const choices = page.querySelector('.ecocrew-choice-section');
  let previewUrl = null;

  if (isTaskCompleted) {
    photo.disabled = true;
    page.querySelector('.ecocrew-upload__label').setAttribute('aria-disabled', 'true');
    return page;
  }

  photo.addEventListener('change', () => {
    const [file] = photo.files;
    if (!file) return;
    const uploadError = page.querySelector('[data-upload-error]');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.removeAttribute('src');
      preview.classList.add('d-none');
      page.querySelector('.ecocrew-upload__label').hidden = false;
      choices.hidden = true;
      uploadError.hidden = false;
      photo.value = '';
      return;
    }
    uploadError.hidden = true;
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (completeDemoTask(dailyTask)) navigate('/result');
    else navigate('/dashboard');
  });
  return page;
}
