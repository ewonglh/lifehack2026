import { announce, escapeHtml } from '../lib/dom.js';
import { gameService } from '../services/game-service.js';

function leaderboardRows(rows) {
  if (!rows.length) return '<p class="text-secondary mb-0">No leaderboard data yet.</p>';
  return `<div class="list-group">${rows.map((row) => `<div class="list-group-item d-flex justify-content-between align-items-center"><span><strong>#${row.rank}</strong> ${escapeHtml(row.display_name)}</span><span>${row.completed_tasks} tasks · ${row.current_streak} day streak</span></div>`).join('')}</div>`;
}

export const friendsPage = () => ({
  title: 'Contacts and leaderboards',
  content: `<div class="page-intro mb-4"><h1>Contacts</h1><p class="text-secondary">Compare your task performance with crew members and contacts who have EcoCrew accounts.</p></div><section class="surface-card card mb-4"><div class="card-body"><h2 class="h5">Sync contacts</h2><p class="small text-secondary">Syncing is opt-in. EcoCrew stores hashed identifiers, not your address book.</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-primary" data-contact-provider="google">Connect Google Contacts</button><button class="btn btn-outline-primary" data-contact-provider="facebook">Connect Facebook</button></div></div></section><section class="mb-4"><h2 class="h4">Crew leaderboard</h2><div data-crew-leaderboard>Loading…</div></section><section><h2 class="h4">Contact leaderboard</h2><div data-contact-leaderboard>Loading…</div></section>`,
  afterRender: async () => {
    const current = await gameService.getCurrentLeague();
    const crewTarget = document.querySelector('[data-crew-leaderboard]');
    crewTarget.innerHTML = current.squadId
      ? leaderboardRows(await gameService.getCrewLeaderboard(current.squadId))
      : '<p class="text-secondary">Join a crew to compare crew performance.</p>';
    document.querySelector('[data-contact-leaderboard]').innerHTML = leaderboardRows(
      await gameService.getContactLeaderboard(),
    );
    document.querySelectorAll('[data-contact-provider]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await gameService.startContactSync(button.dataset.contactProvider);
        } catch (exception) {
          announce(exception.message || 'Contact sync could not be started.', 'error');
        }
      });
    });
  },
});
