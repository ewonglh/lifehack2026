import { announce, escapeHtml } from '../lib/dom.js';
import { gameService } from '../services/game-service.js';

export const crewPage = () => ({
  title: 'Your crew',
  content: `<div class="page-intro mb-4"><h1>Your crew</h1><p class="text-secondary">Work together to keep the crew streak alive. Half of the active members must complete their daily task.</p></div><section class="surface-card card mb-4"><div class="card-body p-4" data-crew-panel>Loading crew…</div></section>`,
  afterRender: async () => {
    const panel = document.querySelector('[data-crew-panel]');
    const current = await gameService.getCurrentLeague();
    if (!current.squadId) {
      panel.innerHTML =
        '<h2 class="h4">Join or create a crew</h2><div class="row g-2"><div class="col-md-6"><input class="form-control" data-squad-name placeholder="Crew name"></div><div class="col-md-3"><button class="btn btn-primary w-100" data-create-squad>Create</button></div><div class="col-md-3"><input class="form-control" data-invite-code placeholder="Invite code"></div><div class="col-md-3"><button class="btn btn-outline-primary w-100" data-join-squad>Join</button></div></div>';
      panel.addEventListener('click', async (event) => {
        try {
          if (event.target.closest('[data-create-squad]')) {
            await gameService.createSquad(
              panel.querySelector('[data-squad-name]').value,
              'Asia/Singapore',
            );
            window.location.reload();
          }
          if (event.target.closest('[data-join-squad]')) {
            await gameService.joinSquad(panel.querySelector('[data-invite-code]').value);
            window.location.reload();
          }
        } catch (exception) {
          announce(exception.message || 'Unable to update your crew.', 'error');
        }
      });
      return;
    }
    const league = current.league?.leagues;
    panel.innerHTML = `<div class="d-flex justify-content-between align-items-start gap-3"><div><h2 class="h4">Crew active</h2><p class="mb-1">Your crew is ready to compete.</p><p class="text-secondary mb-0">${league ? escapeHtml(league.name) : 'Not in a league yet'}</p></div><a class="btn btn-outline-primary" href="#/league">League</a></div>`;
  },
});
