import { bins } from '../features/ecocrew/mock-data.js';
import { analyseDemoPhoto, completeDemoSort } from '../features/ecocrew/scan-service.js';
import { appShell, navigate } from '../features/ecocrew/page-utils.js';

export function renderSubmitPage() {
  const page = appShell('Sort it!', 'Daily challenge', `
    <section class="ecocrew-sort-card">
      <div class="ecocrew-upload" data-upload-area>
        <input id="item-photo" type="file" accept="image/*" capture="environment" class="visually-hidden">
        <label for="item-photo" class="ecocrew-upload__label"><span class="ecocrew-upload__icon" aria-hidden="true">⌁</span><strong>Add an item photo</strong><small>Use your camera or choose an image</small></label>
        <img class="ecocrew-preview d-none" alt="Selected item preview">
      </div>
      <div class="ecocrew-choice-section" hidden><p class="ecocrew-kicker">BEFORE WE REVEAL IT</p><h2>Where does it belong?</h2><p class="text-secondary">Choose your best guess. You can always correct the result.</p><div class="ecocrew-bin-grid">${bins.map((bin) => `<button class="ecocrew-bin" data-bin="${bin.id}"><span aria-hidden="true">${bin.icon}</span><strong>${bin.label}</strong><small>${bin.description}</small></button>`).join('')}</div></div>
      <p class="ecocrew-processing" aria-live="polite" hidden><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Checking your item…</p>
    </section>
  `);
  const photo = page.querySelector('#item-photo');
  const preview = page.querySelector('.ecocrew-preview');
  const choices = page.querySelector('.ecocrew-choice-section');
  photo.addEventListener('change', () => {
    const [file] = photo.files;
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('d-none');
    page.querySelector('.ecocrew-upload__label').hidden = true;
    choices.hidden = false;
  });
  page.querySelectorAll('[data-bin]').forEach((button) => button.addEventListener('click', async () => {
    page.querySelectorAll('[data-bin]').forEach((item) => { item.disabled = true; });
    page.querySelector('.ecocrew-processing').hidden = false;
    const analysis = await analyseDemoPhoto();
    completeDemoSort(button.dataset.bin, analysis);
    navigate('/result');
  }));
  return page;
}
