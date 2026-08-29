import { getDemoCosmetics, getDemoPosts, getDemoProfile, updateDemoProfile } from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

function postTime(dateString) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : 'Today';
}

function profileContent(profile, posts, totalPoints, equippedItem, cosmetics) {
  return `<div data-profile-content>
    <section class="ecocrew-profile-hero">
      <div class="ecocrew-profile-avatar" aria-label="${escapeHtml(profile.name)}'s profile avatar">${escapeHtml(profile.name.charAt(0).toUpperCase() || 'E')}<span aria-hidden="true">${equippedItem.icon}</span></div>
      <div><h2>${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.handle)} · ${escapeHtml(profile.location)}</p><small>${escapeHtml(profile.joinedLabel)}</small></div>
      <button class="btn ecocrew-btn-secondary" type="button" data-edit>Edit</button>
    </section>
    <section class="ecocrew-profile-about"><p class="ecocrew-kicker">ABOUT MYSELF</p><p>${escapeHtml(profile.about)}</p><dl><div><dt>Age</dt><dd>${escapeHtml(String(profile.age))}</dd></div><div><dt>Based in</dt><dd>${escapeHtml(profile.location)}</dd></div></dl></section>
    <section class="ecocrew-profile-stats" aria-label="Your EcoCrew stats"><article><strong>${totalPoints.toLocaleString()}</strong><span>total points</span></article><article><strong>${posts.length}</strong><span>posts shared</span></article><article><strong>8 🔥</strong><span>best streak</span></article></section>
    <section class="ecocrew-card ecocrew-profile-collection"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">CURRENT LOOK</p><h2>${equippedItem.name}</h2></div><button class="btn btn-link" data-collection>Collection</button></div><div class="ecocrew-profile-items">${cosmetics.filter((item) => item.unlocked).map((item) => `<span title="${item.name}" class="${item.equipped ? 'is-equipped' : ''}" aria-label="${item.name}${item.equipped ? ', equipped' : ''}">${item.icon}</span>`).join('')}</div></section>
    <section class="ecocrew-profile-posts"><div class="ecocrew-section-heading"><h2>My posts</h2><span>${posts.length ? 'Your latest eco wins' : 'Your eco story starts here'}</span></div>${posts.length ? posts.map((post) => `<article class="ecocrew-profile-post"><span aria-hidden="true">${post.taskId ? '✓' : post.isCorrect ? '♻' : '💡'}</span><div><strong>${escapeHtml(post.itemName)}</strong><p>${post.taskId ? 'Completed daily task' : post.isCorrect ? `Sorted correctly · ${escapeHtml(post.bin)}` : `Learned the right bin · ${escapeHtml(post.bin)}`}</p><small>${postTime(post.createdAt)} · +${post.points} points</small></div></article>`).join('') : `<div class="ecocrew-posts-empty"><span aria-hidden="true">📷</span><strong>No posts yet</strong><p>Upload proof after completing today’s sustainability task.</p><button class="btn ecocrew-btn-primary" type="button" data-create-post>Complete today’s task</button></div>`}</section>
    <section class="ecocrew-profile-actions" aria-label="Profile actions"><button type="button" data-settings><i class="bi bi-gear" aria-hidden="true"></i> Settings <i class="bi bi-chevron-right" aria-hidden="true"></i></button><button type="button" data-privacy><i class="bi bi-shield-check" aria-hidden="true"></i> Privacy & photo controls <i class="bi bi-chevron-right" aria-hidden="true"></i></button><button type="button" data-logout><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Log out <i class="bi bi-chevron-right" aria-hidden="true"></i></button></section></div>`;
}

function editForm(profile) {
  return `<form class="ecocrew-edit-form"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">EDIT PROFILE</p><h2>Make it yours</h2></div><button class="btn btn-link" type="button" data-cancel>Cancel</button></div><label>Name<input name="name" value="${escapeHtml(profile.name)}" required maxlength="40"></label><label>Handle<input name="handle" value="${escapeHtml(profile.handle)}" required maxlength="30" pattern="@[a-zA-Z0-9._]+"></label><label>Age<input name="age" type="number" value="${escapeHtml(String(profile.age))}" min="13" max="120" required></label><label>About myself<textarea name="about" rows="4" maxlength="280" required>${escapeHtml(profile.about)}</textarea></label><p class="ecocrew-form-error" role="alert" hidden>Please check your details and try again.</p><button class="btn ecocrew-btn-primary" type="submit">Save changes</button></form>`;
}

export function renderProfilePage() {
  const cosmetics = getDemoCosmetics();
  const equippedItem = cosmetics.find((item) => item.equipped);
  const profile = getDemoProfile();
  const posts = getDemoPosts();
  const page = appShell('Your eco identity', 'Profile', profileContent(profile, posts, profile.totalPoints, equippedItem, cosmetics));
  const content = page.querySelector('[data-profile-content]');
  page.querySelector('[data-edit]').addEventListener('click', () => {
    content.innerHTML = editForm(getDemoProfile());
    const form = content.querySelector('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.querySelector('.ecocrew-form-error').hidden = false; form.reportValidity(); return; }
      updateDemoProfile(Object.fromEntries(new FormData(form)));
      navigate('/profile');
    });
    content.querySelector('[data-cancel]').addEventListener('click', () => navigate('/profile'));
  });
  page.querySelector('[data-collection]').addEventListener('click', () => navigate('/league'));
  page.querySelector('[data-create-post]')?.addEventListener('click', () => navigate('/sort'));
  page.querySelector('[data-logout]').addEventListener('click', () => { sessionStorage.removeItem('ecocrew-demo-signed-in'); navigate('/login'); });
  page.querySelectorAll('[data-settings], [data-privacy]').forEach((button) => button.addEventListener('click', () => { button.textContent = 'Coming soon'; button.disabled = true; }));
  return page;
}
