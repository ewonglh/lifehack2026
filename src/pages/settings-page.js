import { required } from '../utils/validation.js';
import { announce, escapeHtml } from '../lib/dom.js';
import { appShell, navigate as defaultNavigate } from '../features/ecocrew/page-utils.js';

function profileValue(profile, camelCase, snakeCase, fallback = '') {
  return profile?.[camelCase] ?? profile?.[snakeCase] ?? fallback;
}

export function renderSettingsPage({ profile = {}, session, navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Settings',
    'Your account',
    '<section class="ecocrew-card ecocrew-settings-card" aria-labelledby="settings-title">' +
      '<p class="ecocrew-kicker">PROFILE AND PRIVACY</p><h2 id="settings-title">Keep your details current</h2><p class="ecocrew-muted">These settings control how your crew sees you. Your post photos remain private.</p>' +
      '<form class="ecocrew-settings-form" data-settings-form novalidate>' +
      '<label for="settings-display-name">Display name<input id="settings-display-name" name="displayName" type="text" maxlength="40" required value="' +
      escapeHtml(profileValue(profile, 'displayName', 'display_name')) +
      '"></label>' +
      '<label for="settings-handle">Handle <span>(optional)</span><input id="settings-handle" name="handle" type="text" maxlength="30" placeholder="@eco-player" value="' +
      escapeHtml(profileValue(profile, 'handle', 'handle')) +
      '"></label>' +
      '<label for="settings-location">Location<input id="settings-location" name="location" type="text" maxlength="80" value="' +
      escapeHtml(profileValue(profile, 'location', 'location', 'Singapore')) +
      '"></label>' +
      '<label for="settings-timezone">Timezone<input id="settings-timezone" name="timezone" type="text" maxlength="80" value="' +
      escapeHtml(profileValue(profile, 'timezone', 'timezone', 'Asia/Singapore')) +
      '"></label>' +
      '<label for="settings-about">About myself <span>(optional)</span><textarea id="settings-about" name="about" rows="4" maxlength="280">' +
      escapeHtml(profileValue(profile, 'about', 'about')) +
      '</textarea></label>' +
      '<label for="settings-age-visibility">Age visibility<select id="settings-age-visibility" name="ageVisibility"><option value="private" ' +
      (profileValue(profile, 'ageVisibility', 'age_visibility', 'private') === 'private'
        ? 'selected'
        : '') +
      '>Private</option><option value="crew" ' +
      (profileValue(profile, 'ageVisibility', 'age_visibility') === 'crew' ? 'selected' : '') +
      '>Crew</option><option value="public" ' +
      (profileValue(profile, 'ageVisibility', 'age_visibility') === 'public' ? 'selected' : '') +
      '>Public</option></select></label>' +
      '<label class="ecocrew-settings-check"><input name="leaderboardVisible" type="checkbox" ' +
      (profileValue(profile, 'leaderboardVisible', 'leaderboard_visible', true) !== false
        ? 'checked'
        : '') +
      '><span>Show me on contact leaderboards</span></label>' +
      '<p class="ecocrew-form-error" data-settings-error role="alert" hidden></p>' +
      '<div class="ecocrew-actions"><button class="btn ecocrew-btn-secondary" type="button" data-cancel-settings>Cancel</button><button class="btn ecocrew-btn-primary" type="submit">Save changes</button></div>' +
      '</form></section>',
    'Update your display name and privacy preferences. Server-side profile validation remains authoritative.',
  );

  const form = page.querySelector('[data-settings-form]');
  const error = page.querySelector('[data-settings-error]');
  form
    .querySelector('[data-cancel-settings]')
    .addEventListener('click', () => navigate('/profile'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.leaderboardVisible = form.elements.leaderboardVisible.checked;
    const message = required(values.displayName, 'Display name');
    if (message) {
      error.textContent = message;
      error.hidden = false;
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    error.hidden = true;
    try {
      await session.saveProfile(values);
      announce('Settings saved.', 'success');
      navigate('/profile');
    } catch (exception) {
      error.textContent = exception.message || 'We could not save your settings.';
      error.hidden = false;
      submitButton.disabled = false;
    }
  });

  return { element: page, title: 'Settings' };
}

export const settingsPage = ({ profile } = {}) => {
  const rendered = renderSettingsPage({ profile });
  return { title: rendered.title, content: rendered.element.outerHTML };
};
