import { required } from '../utils/validation.js';
import { announce, escapeHtml } from '../lib/dom.js';
import { navigate as defaultNavigate, standaloneShell } from '../features/ecocrew/page-utils.js';
import { clearPendingInvite, getPendingInviteCode } from './join-crew-page.js';
import { ecoCrewService } from '../services/ecocrew-service.js';

function initials(value) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function renderOnboardingPage({ session, navigate = defaultNavigate } = {}) {
  const page = standaloneShell(
    'Set up your profile',
    'First step',
    '<section class="ecocrew-card ecocrew-onboarding-card" aria-labelledby="onboarding-title">' +
      '<div class="ecocrew-onboarding-avatar" data-onboarding-avatar aria-hidden="true">?</div>' +
      '<p class="ecocrew-kicker">MAKE IT YOURS</p>' +
      '<h2 id="onboarding-title">What should we call you?</h2>' +
      '<p class="ecocrew-muted">This is the name your crew will see. You can personalise more later.</p>' +
      '<form class="ecocrew-onboarding-form" data-profile-form novalidate>' +
      '<label for="display-name">Display name<input id="display-name" name="displayName" type="text" maxlength="40" autocomplete="name" placeholder="e.g. Maya" required></label>' +
      '<p class="ecocrew-form-error" data-form-error role="alert" hidden></p>' +
      '<button class="btn ecocrew-btn-primary" type="submit">Continue to today’s action</button>' +
      '</form></section>',
    'Choose the display name your crew will see. EcoCrew creates an initials avatar automatically so you can start immediately.',
  );

  const form = page.querySelector('[data-profile-form]');
  const input = page.querySelector('[name="displayName"]');
  const avatar = page.querySelector('[data-onboarding-avatar]');
  const error = page.querySelector('[data-form-error]');

  input.addEventListener('input', () => {
    avatar.textContent = initials(input.value);
    error.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = input.value.trim();
    const message = required(displayName, 'Display name');
    if (message) {
      error.textContent = message;
      error.hidden = false;
      input.focus();
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    error.hidden = true;
    try {
      await session.saveProfile({ displayName });
      const inviteCode = getPendingInviteCode();
      if (inviteCode) {
        try {
          await ecoCrewService.joinCrew(inviteCode);
          clearPendingInvite();
        } catch (joinError) {
          error.textContent =
            joinError.message ||
            'Your profile is ready, but we could not join the invited crew yet.';
          error.hidden = false;
          submitButton.disabled = false;
          return;
        }
      }
      announce('Profile saved.', 'success');
      navigate('/dashboard');
    } catch (exception) {
      error.textContent = exception.message || 'We could not save your profile.';
      error.hidden = false;
      submitButton.disabled = false;
    }
  });

  return { element: page, title: 'Set up your profile' };
}

export const onboardingPage = () => {
  const rendered = renderOnboardingPage();
  return { title: rendered.title, content: rendered.element.outerHTML };
};

export function profileForm(title = 'Set up your profile', submitLabel = 'Continue') {
  return (
    '<section class="ecocrew-card ecocrew-onboarding-card" aria-labelledby="profile-form-title"><p class="ecocrew-kicker">FIRST STEP</p><h1 id="profile-form-title">' +
    escapeHtml(title) +
    '</h1><form class="ecocrew-onboarding-form" data-profile-form novalidate><label for="display-name">Display name<input id="display-name" name="displayName" type="text" maxlength="40" required></label><button class="btn ecocrew-btn-primary" type="submit">' +
    escapeHtml(submitLabel) +
    '</button></form></section>'
  );
}
