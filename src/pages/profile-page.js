import { ecoCrewService } from '../services/ecocrew-service.js';
import { loadingState } from '../components/loading-state.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
  syncCurrentProfileAvatar,
} from '../features/ecocrew/page-utils.js';
import { cosmeticVisual } from '../components/cosmetic-visual.js';
import { getCosmeticAsset, getProfileFrameId } from '../features/ecocrew/cosmetic-assets.js';

function postTime(dateString) {
  const timestamp = new Date(dateString || Date.now()).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? minutes + ' min ago' : 'Today';
}

function activeFrameId(cosmetics = []) {
  return cosmetics.find((item) => item.kind === 'frame' && item.equipped)?.id || null;
}

function profileContent(data) {
  const profile = data.profile || {};
  const posts = data.posts || [];
  const cosmetics = data.cosmetics || [];
  const profileFrameId = getProfileFrameId(profile);
  const frame =
    cosmetics.find(
      (item) => item.kind === 'frame' && item.equipped && item.id === profileFrameId,
    ) || cosmetics.find((item) => item.kind === 'frame' && item.equipped);
  const equipped = frame ||
    cosmetics.find((item) => item.equipped) || { name: 'EcoCrew look', icon: '🌱' };
  const frameAsset = getCosmeticAsset(frame?.id);
  const accessory = cosmetics.find((item) => item.kind === 'badge' && item.equipped);
  const name = profile.displayName || 'EcoCrew member';
  return (
    '<div data-profile-content><section class="ecocrew-profile-hero"><div class="ecocrew-profile-avatar" aria-label="' +
    escapeHtml(name) +
    '\'s profile avatar">' +
    escapeHtml(name.charAt(0).toUpperCase()) +
    (frameAsset
      ? '<img class="ecocrew-profile-frame" src="' +
        escapeHtml(frameAsset) +
        '" alt="" aria-hidden="true">'
      : '') +
    (accessory
      ? '<span aria-hidden="true">' +
        cosmeticVisual(accessory, 'ecocrew-cosmetic-visual') +
        '</span>'
      : '') +
    '</div><div><h2>' +
    escapeHtml(name) +
    '</h2><p>' +
    escapeHtml(profile.handle || '') +
    (profile.handle ? ' · ' : '') +
    escapeHtml(profile.location || 'Singapore') +
    '</p><small>' +
    escapeHtml(profile.joinedLabel || 'EcoCrew member') +
    '</small></div><button class="btn ecocrew-btn-secondary" type="button" data-edit>Edit</button></section>' +
    '<section class="ecocrew-profile-about"><p class="ecocrew-kicker">ABOUT MYSELF</p><p>' +
    escapeHtml(profile.about || 'No profile bio yet.') +
    '</p><dl><div><dt>Based in</dt><dd>' +
    escapeHtml(profile.location || 'Singapore') +
    '</dd></div><div><dt>Visibility</dt><dd>' +
    (profile.leaderboardVisible === false ? 'Private' : 'Crew') +
    '</dd></div></dl></section>' +
    '<section class="ecocrew-profile-stats" aria-label="Your EcoCrew stats"><article><strong>' +
    Number(data.lifetimePoints || 0).toLocaleString() +
    '</strong><span>total points</span></article><article><strong>' +
    posts.length +
    '</strong><span>tasks completed</span></article><article><strong>' +
    (Number(data.bestStreak || 0) ? Number(data.bestStreak) + ' 🔥' : '—') +
    '</strong><span>best streak</span></article></section>' +
    '<section class="ecocrew-card ecocrew-profile-collection"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">CURRENT LOOK</p><h2>' +
    escapeHtml(equipped.name) +
    '</h2></div><button class="btn btn-link" type="button" data-collection>Collection</button></div><div class="ecocrew-profile-items">' +
    cosmetics
      .filter((item) => item.unlocked)
      .map(
        (item) =>
          '<button type="button" data-equip-cosmetic="' +
          escapeHtml(item.id) +
          '" data-cosmetic-action="' +
          (item.equipped ? 'unequip' : 'equip') +
          '" title="' +
          escapeHtml((item.equipped ? 'Unequip ' : 'Equip ') + item.name) +
          '" class="' +
          (item.equipped ? 'is-equipped' : '') +
          '" aria-label="' +
          (item.equipped ? 'Unequip ' : 'Equip ') +
          escapeHtml(item.name + (item.equipped ? ', equipped' : '')) +
          '" aria-pressed="' +
          (item.equipped ? 'true' : 'false') +
          '">' +
          cosmeticVisual(item, 'ecocrew-cosmetic-visual') +
          '</button>',
      )
      .join('') +
    '</div></section>' +
    '<section class="ecocrew-profile-posts"><div class="ecocrew-section-heading"><h2>Task history</h2><span>' +
    (posts.length ? 'Your latest daily tasks' : 'Your task history starts here') +
    '</span></div>' +
    (posts.length
      ? posts
          .map(
            (post) =>
              '<article class="ecocrew-profile-post"><span aria-hidden="true">' +
              (post.isCorrect ? '♻' : '💡') +
              '</span><div><strong>' +
              escapeHtml(post.itemName || 'Daily task') +
              '</strong><p>' +
              (post.isCorrect ? 'Daily task completed' : 'Guidance received') +
              ' · ' +
              escapeHtml(post.finalBin || post.bin || 'unknown') +
              '</p><small>' +
              postTime(post.createdAt) +
              ' · +' +
              Number(post.points || 0) +
              ' points</small></div></article>',
          )
          .join('')
      : '<div class="ecocrew-posts-empty"><span aria-hidden="true">📷</span><strong>No daily tasks yet</strong><p>Complete your first daily task with your crew.</p><button class="btn ecocrew-btn-primary" type="button" data-create-post>Start a daily task</button></div>') +
    '</section><section class="ecocrew-profile-actions" aria-label="Profile actions"><button type="button" data-settings><i class="bi bi-gear" aria-hidden="true"></i> Settings <i class="bi bi-chevron-right" aria-hidden="true"></i></button><button type="button" data-privacy><i class="bi bi-shield-check" aria-hidden="true"></i> Privacy & photo controls <i class="bi bi-chevron-right" aria-hidden="true"></i></button><button type="button" data-logout><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Log out <i class="bi bi-chevron-right" aria-hidden="true"></i></button></section></div>'
  );
}

function editForm(profile) {
  return (
    '<form class="ecocrew-edit-form"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">EDIT PROFILE</p><h2>Make it yours</h2></div><button class="btn btn-link" type="button" data-cancel>Cancel</button></div><label>Name<input name="displayName" value="' +
    escapeHtml(profile.displayName || '') +
    '" required maxlength="40"></label><label>Handle<input name="handle" value="' +
    escapeHtml(profile.handle || '') +
    '" maxlength="30"></label><label>About myself<textarea name="about" rows="4" maxlength="280">' +
    escapeHtml(profile.about || '') +
    '</textarea><p class="ecocrew-form-error" data-profile-error role="alert" hidden></p><button class="btn ecocrew-btn-primary" type="submit">Save changes</button></form>'
  );
}

export function renderProfilePage({ session, sessionState, navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Your eco identity',
    'Profile',
    '<div data-profile-content aria-busy="true">' + loadingState('Loading your profile') + '</div>',
    'View your display name, lifetime progress, cosmetics, and daily task history. Photos remain private by default.',
  );
  const userId = sessionState?.session?.user?.id || 'mock-user';
  let latestData;

  async function loadProfile() {
    const target = page.querySelector('[data-profile-content]');
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = loadingState('Loading your profile');
    try {
      latestData = await ecoCrewService.getProfileData(userId);
      const refreshedProfile = {
        ...latestData.profile,
        frameId: activeFrameId(latestData.cosmetics),
      };
      syncCurrentProfileAvatar(refreshedProfile);
      session?.syncProfileCosmetics?.(refreshedProfile);
      target.outerHTML = profileContent(latestData);
      const loadedTarget = page.querySelector('[data-profile-content]');
      loadedTarget.setAttribute('aria-busy', 'false');
      bindProfileActions();
    } catch (exception) {
      target.innerHTML =
        '<p class="ecocrew-form-error" role="alert">' +
        escapeHtml(exception.message || 'We could not load your profile yet.') +
        '</p>';
      target.setAttribute('aria-busy', 'false');
    }
  }

  function bindProfileActions() {
    page.querySelectorAll('[data-equip-cosmetic]').forEach((button) =>
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const mutate =
            button.dataset.cosmeticAction === 'unequip'
              ? ecoCrewService.unequipCosmetic
              : ecoCrewService.equipCosmetic;
          await mutate(button.dataset.equipCosmetic);
          await loadProfile();
        } catch (exception) {
          button.disabled = false;
          button.setAttribute(
            'aria-label',
            exception.message || 'Could not equip this cosmetic. Try again.',
          );
        }
      }),
    );
    page.querySelector('[data-edit]')?.addEventListener('click', () => {
      const target = page.querySelector('[data-profile-content]');
      target.innerHTML = editForm(latestData.profile);
      const form = target.querySelector('form');
      form.querySelector('[data-cancel]').addEventListener('click', () => {
        loadProfile();
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const submit = form.querySelector('[type="submit"]');
        const error = form.querySelector('[data-profile-error]');
        submit.disabled = true;
        try {
          await ecoCrewService.saveProfile(userId, Object.fromEntries(new FormData(form)));
          await loadProfile();
        } catch (exception) {
          error.textContent = exception.message || 'We could not save your profile.';
          error.hidden = false;
          submit.disabled = false;
        }
      });
    });
    page.querySelector('[data-collection]')?.addEventListener('click', () => navigate('/league'));
    page.querySelector('[data-create-post]')?.addEventListener('click', () => navigate('/sort'));
    page.querySelector('[data-settings]')?.addEventListener('click', () => navigate('/settings'));
    page.querySelector('[data-privacy]')?.addEventListener('click', () => navigate('/settings'));
    page.querySelector('[data-logout]')?.addEventListener('click', async () => {
      await session?.signOut?.();
      navigate('/login');
    });
  }

  return { element: page, title: 'Your profile', afterRender: loadProfile };
}
