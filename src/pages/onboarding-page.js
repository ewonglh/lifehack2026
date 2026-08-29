import { required } from '../utils/validation.js';
import { announce, escapeHtml } from '../lib/dom.js';

export const onboardingPage = () => ({
  title: 'Set up your profile',
  content: profileForm('Create your EcoCrew profile', 'Continue'),
  afterRender: bindProfileForm,
});

export function profileForm(title, submitLabel, profile = {}) {
  return `<div class="row justify-content-center"><section class="col-lg-7"><div class="surface-card card"><div class="card-body p-4 p-md-5"><h1 class="h2">${title}</h1><p class="text-secondary">Choose the name your friends will see.</p><form data-profile-form novalidate><div class="mb-3"><label class="form-label" for="displayName">Display name</label><input class="form-control" id="displayName" name="displayName" maxlength="60" required value="${escapeHtml(profile.display_name || '')}"></div><div class="mb-3"><label class="form-label" for="country">Country</label><input class="form-control" id="country" name="country" maxlength="60" required value="${escapeHtml(profile.country || '')}"></div><div class="mb-3"><label class="form-label" for="bio">Bio <span class="text-secondary">(optional)</span></label><textarea class="form-control" id="bio" name="bio" rows="3" maxlength="280">${escapeHtml(profile.bio || '')}</textarea></div><div class="form-check mb-4"><input class="form-check-input" id="isPublic" name="isPublic" type="checkbox" ${profile.is_public ? 'checked' : ''}><label class="form-check-label" for="isPublic">Let other EcoCrew members find my profile</label></div><p class="text-danger small d-none" data-form-error role="alert"></p><button class="btn btn-primary" type="submit">${submitLabel}</button></form></div></div></section></div>`;
}

export function bindProfileForm({ session, navigate }) {
  const form = document.querySelector('[data-profile-form]');
  const error = document.querySelector('[data-form-error]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.isPublic = form.elements.isPublic.checked;
    const message =
      required(values.displayName, 'Display name') || required(values.country, 'Country');
    if (message) {
      error.textContent = message;
      error.classList.remove('d-none');
      return;
    }
    try {
      await session.saveProfile(values);
      announce('Profile saved.', 'success');
      navigate('/dashboard');
    } catch (exception) {
      error.textContent = exception.message || 'We could not save your profile.';
      error.classList.remove('d-none');
    }
  });
}
