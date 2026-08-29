import { announce, escapeHtml } from '../lib/dom.js';
import { gameService } from '../services/game-service.js';

export const leaguePage = () => ({
  title: 'League',
  content: `<div class="page-intro mb-4"><h1>League</h1><p class="text-secondary">Crews are randomly matched into seven-day leagues. A crew needs at least four members to queue.</p></div><section class="surface-card card mb-4"><div class="card-body p-4" data-league-summary>Loading league status…</div></section><section class="surface-card card"><div class="card-body p-4"><h2 class="h4">Available leagues</h2><div data-league-list>Loading…</div></div></section>`,
  afterRender: async () => {
    const summary = document.querySelector('[data-league-summary]');
    const current = await gameService.getCurrentLeague();
    summary.innerHTML = current.squadId
      ? `<p class="mb-2">${current.queue ? 'Your crew is queued for matchmaking.' : current.league?.leagues?.status === 'active' ? `Active league: ${escapeHtml(current.league.leagues.name)}` : 'Your crew is not queued.'}</p>${!current.queue && current.league?.leagues?.status !== 'active' ? `<button class="btn btn-primary" data-queue-league data-squad-id="${current.squadId}">Queue for league</button>` : ''}`
      : '<p class="mb-0">Join a crew before entering a league.</p>';
    summary.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-queue-league]');
      if (!button) return;
      try {
        await gameService.queueForLeague(button.dataset.squadId);
        button.replaceWith(document.createTextNode('Your crew is queued for the next league.'));
      } catch (exception) {
        announce(exception.message || 'Unable to queue your crew.', 'error');
      }
    });
    const leagues = await gameService.getLeagues();
    document.querySelector('[data-league-list]').innerHTML = leagues.length
      ? leagues
          .map(
            (league) =>
              `<article class="border-bottom py-3"><h3 class="h5">${escapeHtml(league.name)}</h3><p class="small text-secondary mb-2">${escapeHtml(league.status)} · ${league.league_entries?.length ?? 0} crews</p>${(league.league_entries ?? []).map((entry) => `<div class="d-flex justify-content-between"><span>${escapeHtml(entry.squads?.name || 'Crew')}</span><strong>${entry.score ?? 0}</strong></div>`).join('')}</article>`,
          )
          .join('')
      : '<p class="text-secondary mb-0">No leagues have started yet.</p>';
  },
});
