import { required } from '../utils/validation.js';
import { announce, escapeHtml } from '../lib/dom.js';

export const onboardingPage = () => ({
  title: 'Set up your profile',
  content: profileForm('Create your EcoCrew profile', 'Continue'),
  afterRender: bindProfileForm,
});

export function profileForm(title, submitLabel, profile = {}) {
  const avatar = profile.avatar_url
    ? `<img class="avatar avatar-lg object-fit-cover" src="${escapeHtml(profile.avatar_url)}" alt="">`
    : '<span class="avatar avatar-lg" aria-hidden="true">?</span>';
  return `<div class="row justify-content-center"><section class="col-lg-7"><div class="surface-card card"><div class="card-body p-4 p-md-5"><h1 class="h2">${title}</h1><p class="text-secondary">Choose how your crew and contacts will see you.</p><form data-profile-form enctype="multipart/form-data" novalidate><div class="mb-3"><label class="form-label" for="displayName">Display name</label><input class="form-control" id="displayName" name="displayName" maxlength="40" required value="${escapeHtml(profile.display_name || '')}"></div><div class="mb-3"><label class="form-label" for="handle">Handle <span class="text-secondary">(optional)</span></label><input class="form-control" id="handle" name="handle" placeholder="@eco-player" maxlength="30" value="${escapeHtml(profile.handle || '')}"></div><div class="mb-3"><label class="form-label" for="location">Location</label><input class="form-control" id="location" name="location" maxlength="80" required value="${escapeHtml(profile.location || 'Singapore')}"></div><div class="mb-3"><label class="form-label" for="about">About <span class="text-secondary">(optional)</span></label><textarea class="form-control" id="about" name="about" rows="3" maxlength="280">${escapeHtml(profile.about || '')}</textarea></div><div class="mb-3"><label class="form-label" for="timezone">Timezone</label><input class="form-control" id="timezone" name="timezone" maxlength="80" value="${escapeHtml(profile.timezone || 'Asia/Singapore')}"></div><div class="mb-3"><label class="form-label" for="avatar">Profile photo</label><div class="d-flex align-items-center gap-3 mb-2">${avatar}<input class="form-control" id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="form-text">JPEG, PNG, or WebP up to 2 MB.</div></div><div class="mb-3"><label class="form-label" for="ageVisibility">Age visibility</label><select class="form-select" id="ageVisibility" name="ageVisibility"><option value="private" ${profile.age_visibility === 'private' || !profile.age_visibility ? 'selected' : ''}>Private</option><option value="crew" ${profile.age_visibility === 'crew' ? 'selected' : ''}>Crew</option><option value="public" ${profile.age_visibility === 'public' ? 'selected' : ''}>Public</option></select></div><div class="form-check mb-4"><input class="form-check-input" id="leaderboardVisible" name="leaderboardVisible" type="checkbox" ${profile.leaderboard_visible !== false ? 'checked' : ''}><label class="form-check-label" for="leaderboardVisible">Show me on contact leaderboards</label></div><p class="text-danger small d-none" data-form-error role="alert"></p><button class="btn btn-primary" type="submit">${submitLabel}</button></form></div></div></section></div>`;
}

export function bindProfileForm({ session, navigate }) {
  const form = document.querySelector('[data-profile-form]');
  const error = document.querySelector('[data-form-error]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.leaderboardVisible = form.elements.leaderboardVisible.checked;
    values.avatarFile = form.elements.avatar.files[0] ?? null;
    const message =
      required(values.displayName, 'Display name') || required(values.location, 'Location');
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
