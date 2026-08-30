import { ecoCrewService } from '../services/ecocrew-service.js';
import Modal from 'bootstrap/js/dist/modal';
import { cosmeticVisual } from '../components/cosmetic-visual.js';
import { loadingState } from '../components/loading-state.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
  syncCurrentProfileAvatar,
} from '../features/ecocrew/page-utils.js';

function rankings(rows) {
  if (!rows.length) return '<p class="ecocrew-muted">No league standings are available yet.</p>';
  return rows
    .map(
      (row) =>
        '<div class="ecocrew-ranking ' +
        (row.trend === 'you' ? 'is-you' : '') +
        '"><strong>' +
        Number(row.rank) +
        '</strong><span class="ecocrew-ranking__badge" aria-hidden="true">' +
        (Number(row.rank) === 1 ? '🏆' : '✦') +
        '</span><b>' +
        escapeHtml(row.name || 'EcoCrew') +
        '</b><small>' +
        Number(row.score || 0).toLocaleString() +
        ' pts</small>' +
        (row.trend === 'you' ? '<em>You</em>' : '') +
        '</div>',
    )
    .join('');
}

function collection(items) {
  if (!items.length)
    return '<p class="ecocrew-muted">Cosmetics will appear here as your crew progresses.</p>';
  return items
    .map((item) => {
      const action = item.equipped ? 'unequip' : 'equip';
      const actionLabel = item.equipped ? 'Unequip' : 'Equip';
      return (
        '<article class="ecocrew-cosmetic ' +
        (item.unlocked ? '' : 'is-locked') +
        (item.equipped ? ' is-equipped' : '') +
        '"><span aria-hidden="true">' +
        cosmeticVisual(item, 'ecocrew-cosmetic-visual') +
        '</span><strong>' +
        escapeHtml(item.name || 'Eco cosmetic') +
        '</strong><small>' +
        (item.equipped
          ? 'Equipped'
          : item.unlocked
            ? 'Ready to equip'
            : escapeHtml(item.progress || 'Keep contributing')) +
        '</small>' +
        (item.unlocked
          ? '<button class="btn btn-sm ecocrew-btn-secondary" type="button" data-equip="' +
            escapeHtml(item.id) +
            '" data-cosmetic-action="' +
            action +
            '" aria-label="' +
            actionLabel +
            ' ' +
            escapeHtml(item.name || 'Eco cosmetic') +
            '">' +
            actionLabel +
            '</button>'
          : '') +
        '</article>'
      );
    })
    .join('');
}

function leagueEligibility(overview = {}) {
  if (overview.eligibility) return overview.eligibility;
  if (overview.membership === null || overview.crewId === null) return 'no_crew';
  return overview.rows?.some((row) => row.trend === 'you') ? 'ranked' : 'unranked';
}

export function renderLeaderboardPage({ navigate = defaultNavigate, session } = {}) {
  const page = appShell(
    'Sprout League',
    'This week',
    '<div data-league-loading>' +
      loadingState('Loading league standings') +
      '</div>' +
      '<div data-league-content hidden aria-busy="true">' +
      '<section class="ecocrew-league-summary" data-league-summary data-league-state="loading"><span aria-hidden="true">🌱</span><div><strong data-league-rank>Loading standings…</strong><p data-league-position>Every correct post helps your crew move up.</p></div></section>' +
      '<section class="ecocrew-card ecocrew-league-state" data-league-waiting hidden><span aria-hidden="true">🕊</span><p class="ecocrew-kicker">WAITING FOR YOUR LEADER</p><h2>Your crew has not entered a league yet.</h2><p class="ecocrew-muted">Only the crew owner can enter matchmaking. Ask your crew leader to queue the crew when everyone is ready.</p><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">Back to crew</button></section>' +
      '<section class="ecocrew-card ecocrew-league-state" data-league-queued hidden><span aria-hidden="true">⏳</span><p class="ecocrew-kicker">WAITING FOR A MATCH</p><h2>Your crew is queued for the next league.</h2><p class="ecocrew-muted">We will place your crew when the current matchmaking window runs.</p><button class="btn ecocrew-btn-secondary" type="button" data-cancel-queue>Leave queue</button><p class="ecocrew-form-error" data-league-action-error role="alert" hidden></p></section>' +
      '<section class="ecocrew-card ecocrew-league-state" data-league-unranked hidden><span aria-hidden="true">🌱</span><p class="ecocrew-kicker">CREW NOT RANKED YET</p><h2 data-league-unranked-title>Your crew is not ranked yet.</h2><p class="ecocrew-muted" data-league-unranked-copy>Complete league activity with your crew to appear in the weekly standings.</p><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">View crew</button><button class="btn ecocrew-btn-primary" type="button" data-queue-league hidden>Join the weekly league</button><p class="ecocrew-form-error" data-league-action-error role="alert" hidden></p></section>' +
      '<section class="ecocrew-league-points"><div><span data-league-points-label>Weekly league points</span><strong data-league-points>—</strong></div><small data-league-reset>—</small><p>Your lifetime profile points are kept permanently.</p></section>' +
      '<section class="ecocrew-card ecocrew-rankings" data-league-rankings><p class="ecocrew-muted">Loading rankings…</p></section>' +
      '<section class="ecocrew-section-heading"><h2>Your collection</h2><button class="btn btn-link" type="button" data-action="crew">Crew</button></section>' +
      '<section class="ecocrew-cosmetics" data-cosmetics aria-busy="true">' +
      loadingState('Loading collection') +
      '</section>' +
      '</div>' +
      '<div class="modal fade" id="league-no-crew-modal" data-league-no-crew-modal tabindex="-1" aria-labelledby="league-no-crew-modal-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="league-no-crew-modal-title">Join a crew to enter the Sprout League.</h2><button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><p class="mb-0">The Sprout League is for crews. Join or create a crew to compete together.</p></div><div class="modal-footer"><button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Maybe later</button><button class="btn ecocrew-btn-primary" type="button" data-action="crew" data-bs-dismiss="modal">Find a crew</button></div></div></div></div>',
    'Compare your crew’s points for the current weekly league. League points reset every Monday, while your profile’s lifetime points never reset.',
  );
  const leagueContent = page.querySelector('[data-league-content]');
  const leagueLoading = page.querySelector('[data-league-loading]');
  const summary = page.querySelector('[data-league-summary]');
  const rankingsTarget = page.querySelector('[data-league-rankings]');
  const waitingState = page.querySelector('[data-league-waiting]');
  const queuedState = page.querySelector('[data-league-queued]');
  const unrankedState = page.querySelector('[data-league-unranked]');
  const queueButton = page.querySelector('[data-queue-league]');
  const cancelQueueButton = page.querySelector('[data-cancel-queue]');
  const noCrewModal = page.querySelector('[data-league-no-crew-modal]');
  let noCrewModalShown = false;
  let latestOverview = {};

  page.querySelectorAll('[data-action="crew"]').forEach((button) => {
    button.addEventListener('click', () => navigate('/crew'));
  });

  function renderLeagueOverview(overview = {}) {
    latestOverview = overview;
    const state = overview.queueStatus === 'queued' ? 'queued' : leagueEligibility(overview);
    const rows = Array.isArray(overview.rows) ? overview.rows : [];
    const own = rows.find((row) => row.trend === 'you');
    const crewName = overview.crewName || own?.name || 'Your crew';

    page.dataset.leagueState = state;
    summary.dataset.leagueState = state;
    leagueContent.hidden = state === 'no_crew';
    waitingState.hidden = state !== 'waiting';
    queuedState.hidden = state !== 'queued';
    unrankedState.hidden = state !== 'unranked';
    rankingsTarget.hidden = state !== 'ranked';
    queueButton.hidden = !(state === 'unranked' && overview.canQueue);
    cancelQueueButton.hidden = !(state === 'queued' && overview.membershipRole === 'owner');
    page.querySelectorAll('[data-league-action-error]').forEach((error) => {
      error.hidden = true;
      error.textContent = '';
    });
    page.querySelector('[data-league-reset]').textContent =
      overview.resetLabel || 'Resets Monday at 00:00 SGT.';

    if (state === 'no_crew') {
      page.querySelector('[data-league-rank]').textContent = 'Not in a league';
      page.querySelector('[data-league-position]').textContent =
        'Join a crew to enter the weekly standings.';
      page.querySelector('[data-league-points-label]').textContent = 'League points';
      page.querySelector('[data-league-points]').textContent = '—';
      if (!noCrewModalShown && noCrewModal) {
        noCrewModalShown = true;
        Modal.getOrCreateInstance(noCrewModal).show();
      }
      return;
    }

    if (state === 'queued') {
      page.querySelector('[data-league-rank]').textContent = 'Queued for a league';
      page.querySelector('[data-league-position]').textContent =
        'Your crew will appear after matchmaking.';
      page.querySelector('[data-league-points-label]').textContent = 'League points';
      page.querySelector('[data-league-points]').textContent = '—';
      return;
    }

    if (state === 'waiting') {
      page.querySelector('[data-league-rank]').textContent = 'Waiting for your leader';
      page.querySelector('[data-league-position]').textContent =
        crewName + ' will appear after its owner queues it.';
      page.querySelector('[data-league-points-label]').textContent = 'League points';
      page.querySelector('[data-league-points]').textContent = '—';
      return;
    }

    if (state === 'unranked') {
      page.querySelector('[data-league-rank]').textContent = 'Not ranked yet';
      page.querySelector('[data-league-position]').textContent =
        crewName + ' will appear here once it has league activity.';
      page.querySelector('[data-league-unranked-title]').textContent =
        crewName + ' is not ranked yet.';
      page.querySelector('[data-league-unranked-copy]').textContent =
        'Complete league activity with your crew to appear in the weekly standings.';
      page.querySelector('[data-league-points-label]').textContent =
        'League points after first result';
      page.querySelector('[data-league-points]').textContent = '—';
      return;
    }

    page.querySelector('[data-league-rank]').textContent = own
      ? '#' + own.rank + ' of ' + rows.length
      : 'Ranked';
    page.querySelector('[data-league-position]').textContent = own
      ? 'Your crew is on the board. Keep the shared streak alive.'
      : 'Your crew is participating in the weekly standings.';
    page.querySelector('[data-league-points-label]').textContent = 'Weekly league points';
    page.querySelector('[data-league-points]').textContent = Number(
      overview.weeklyPoints || own?.score || 0,
    ).toLocaleString();
    rankingsTarget.innerHTML = rankings(rows);
  }

  function renderLeagueError(exception) {
    leagueLoading.hidden = true;
    leagueContent.setAttribute('aria-busy', 'false');
    page.dataset.leagueState = 'error';
    summary.dataset.leagueState = 'error';
    page.querySelector('[data-league-rank]').textContent = 'Standings unavailable';
    page.querySelector('[data-league-position]').textContent = 'Try again in a moment.';
    page.querySelector('[data-league-points-label]').textContent = 'League points';
    page.querySelector('[data-league-points]').textContent = '—';
    leagueContent.hidden = false;
    waitingState.hidden = true;
    queuedState.hidden = true;
    queueButton.hidden = true;
    cancelQueueButton.hidden = true;
    unrankedState.hidden = true;
    rankingsTarget.hidden = false;
    rankingsTarget.innerHTML =
      '<p class="ecocrew-form-error" role="alert">' +
      escapeHtml(exception.message || 'League data is unavailable.') +
      '</p>';
  }

  function renderQueueError(exception) {
    page.querySelectorAll('[data-league-action-error]').forEach((error) => {
      error.textContent = exception.message || 'We could not update the league queue.';
      error.hidden = false;
    });
  }

  async function refreshLeague() {
    const overview = await ecoCrewService.getLeagueOverview();
    renderLeagueOverview(overview);
  }

  queueButton.addEventListener('click', async () => {
    const crewId = latestOverview.crewId || latestOverview.membership?.crewId;
    if (!crewId) return;
    queueButton.disabled = true;
    try {
      await ecoCrewService.queueForLeague(crewId);
      await refreshLeague();
    } catch (exception) {
      renderQueueError(exception);
      queueButton.disabled = false;
    }
  });

  cancelQueueButton.addEventListener('click', async () => {
    const crewId = latestOverview.crewId || latestOverview.membership?.crewId;
    if (!crewId) return;
    cancelQueueButton.disabled = true;
    try {
      await ecoCrewService.cancelLeagueQueue(crewId);
      await refreshLeague();
    } catch (exception) {
      renderQueueError(exception);
      cancelQueueButton.disabled = false;
    }
  });

  async function renderCosmetics({ syncFrame = false, actionItem = null } = {}) {
    const target = page.querySelector('[data-cosmetics]');
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = loadingState('Loading collection');
    try {
      const cosmetics = await ecoCrewService.getCosmetics();
      target.innerHTML = collection(cosmetics || []);
      target.setAttribute('aria-busy', 'false');
      const activeFrame = (cosmetics || []).find((item) => item.kind === 'frame' && item.equipped);
      if (syncFrame || activeFrame) {
        const frameId =
          activeFrame?.id ||
          (actionItem?.kind === 'frame' ? null : document.body.dataset.ecocrewFrameId);
        syncCurrentProfileAvatar({ frameId });
        session?.syncProfileCosmetics?.({ frameId });
      }
      page.querySelectorAll('[data-equip]').forEach((button) =>
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const item = (cosmetics || []).find(
              (candidate) => candidate.id === button.dataset.equip,
            );
            const mutate =
              button.dataset.cosmeticAction === 'unequip'
                ? ecoCrewService.unequipCosmetic
                : ecoCrewService.equipCosmetic;
            await mutate(button.dataset.equip);
            await renderCosmetics({ syncFrame: true, actionItem: item });
          } catch (exception) {
            button.disabled = false;
            button.textContent = exception.message || 'Try again';
          }
        }),
      );
    } catch (exception) {
      target.innerHTML =
        '<p class="ecocrew-form-error" role="alert">' +
        escapeHtml(exception.message || 'Cosmetics are unavailable.') +
        '</p>';
      target.setAttribute('aria-busy', 'false');
    }
  }

  return {
    element: page,
    title: 'Sprout League',
    afterRender: async () => {
      try {
        const overview = await ecoCrewService.getLeagueOverview();
        const state = overview.queueStatus === 'queued' ? 'queued' : leagueEligibility(overview);
        leagueLoading.hidden = true;
        leagueContent.setAttribute('aria-busy', 'false');
        renderLeagueOverview(overview);
        if (state !== 'no_crew') await renderCosmetics();
      } catch (exception) {
        renderLeagueError(exception);
        await renderCosmetics();
      }
    },
  };
}
