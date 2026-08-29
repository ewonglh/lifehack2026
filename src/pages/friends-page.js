import { avatar } from '../components/avatar.js';
import { announce, escapeHtml } from '../lib/dom.js';
import { friendsService } from '../services/friends-service.js';
import { toAppError } from '../app/errors.js';

const friendCard = (friend) =>
  `<li class="list-group-item d-flex align-items-center gap-3">${avatar(friend)}<div class="flex-grow-1"><strong>${escapeHtml(friend.displayName)}</strong><div class="text-secondary small">${escapeHtml(friend.country || '')}</div></div>${actions(friend)}</li>`;
const actions = (friend) =>
  friend.status === 'accepted'
    ? `<button class="btn btn-sm btn-outline-danger" data-friend-action="remove" data-id="${friend.id}">Remove</button>`
    : friend.status === 'pending_incoming'
      ? `<button class="btn btn-sm btn-primary" data-friend-action="accept" data-id="${friend.id}">Accept</button><button class="btn btn-sm btn-outline-secondary" data-friend-action="decline" data-id="${friend.id}">Decline</button>`
      : `<span class="badge text-bg-secondary">Request sent</span>`;

export const friendsPage = () => ({
  title: 'Friends',
  content: `<div class="page-intro mb-4"><h1>Friends</h1><p class="text-secondary">Invite people you know and celebrate small recycling wins together.</p></div><section class="surface-card card mb-4"><div class="card-body"><form data-friend-search class="row g-2"><div class="col-sm"><label class="visually-hidden" for="friend-query">Find a friend</label><input class="form-control" id="friend-query" name="query" placeholder="Search EcoCrew members"></div><div class="col-sm-auto"><button class="btn btn-primary w-100" type="submit">Search</button></div></form><div class="mt-3" data-search-results></div></div></section><section><h2 class="h4">Your circle</h2><div data-friends-list><div class="py-3" role="status">Loading friends…</div></div></section>`,
  afterRender: bindFriends,
});

async function bindFriends() {
  const list = document.querySelector('[data-friends-list]');
  async function render() {
    try {
      const friends = await friendsService.list();
      list.innerHTML = friends.length
        ? `<ul class="list-group">${friends.map(friendCard).join('')}</ul>`
        : '<p class="text-secondary">Your circle is ready for its first friend.</p>';
    } catch (exception) {
      list.innerHTML = `<div class="alert alert-danger" role="alert">${toAppError(exception).message}</div>`;
    }
  }
  await render();
  document.querySelector('[data-friend-search]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('query').trim();
    const results = document.querySelector('[data-search-results]');
    if (!query) return;
    try {
      const matches = await friendsService.search(query);
      results.innerHTML = matches.length
        ? `<ul class="list-group">${matches.map((friend) => `<li class="list-group-item d-flex justify-content-between align-items-center"><span>${escapeHtml(friend.displayName)}</span><button class="btn btn-sm btn-outline-primary" data-friend-action="request" data-id="${friend.id}" data-name="${escapeHtml(friend.displayName)}">Add</button></li>`).join('')}</ul>`
        : '<p class="text-secondary mb-0">No members found.</p>';
    } catch (exception) {
      results.innerHTML = `<div class="alert alert-danger mb-0">${toAppError(exception).message}</div>`;
    }
  });
  list.closest('main').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-friend-action]');
    if (!button) return;
    try {
      const { friendAction: action, id, name } = button.dataset;
      if (action === 'request')
        await friendsService.request({ id, displayName: name, country: '' });
      else await friendsService[action](id);
      announce(action === 'request' ? 'Friend request sent.' : 'Friends updated.', 'success');
      await render();
    } catch (exception) {
      announce(toAppError(exception).message, 'error');
    }
  });
}
