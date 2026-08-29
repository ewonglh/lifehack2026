/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeagueOverview = vi.hoisted(() => vi.fn());
const getCosmetics = vi.hoisted(() => vi.fn());
const equipCosmetic = vi.hoisted(() => vi.fn());
const queueForLeague = vi.hoisted(() => vi.fn());
const cancelLeagueQueue = vi.hoisted(() => vi.fn());
const showModal = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: {
    getLeagueOverview,
    getCosmetics,
    equipCosmetic,
    queueForLeague,
    cancelLeagueQueue,
  },
}));

vi.mock('bootstrap/js/dist/modal', () => ({
  default: {
    getOrCreateInstance: vi.fn(() => ({ show: showModal })),
  },
}));

import { renderLeaderboardPage } from '../../src/pages/leaderboard-page.js';

describe('league page states', () => {
  beforeEach(() => {
    getLeagueOverview.mockReset();
    getCosmetics.mockResolvedValue([]);
    equipCosmetic.mockResolvedValue(null);
    queueForLeague.mockReset();
    cancelLeagueQueue.mockReset();
    showModal.mockReset();
  });

  it('shows a join-crew state without seeded standings for unaffiliated users', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'no_crew',
      rows: [],
      weeklyPoints: null,
      resetLabel: 'Resets Monday at 00:00 SGT.',
    });
    const rendered = renderLeaderboardPage({ navigate: vi.fn() });

    await rendered.afterRender();

    expect(rendered.element.dataset.leagueState).toBe('no_crew');
    expect(rendered.element.querySelector('[data-league-content]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-league-summary]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-league-rankings]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-league-points]').textContent).toBe('—');
    expect(rendered.element.textContent).not.toContain('Glass Guardians');
    expect(rendered.element.querySelector('[data-league-no-crew-modal]')).not.toBeNull();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(getCosmetics).not.toHaveBeenCalled();
  });

  it('routes the league modal to the crew tab', async () => {
    getLeagueOverview.mockResolvedValue({ eligibility: 'no_crew', rows: [] });
    const navigate = vi.fn();
    const rendered = renderLeaderboardPage({ navigate });

    await rendered.afterRender();
    rendered.element.querySelector('[data-league-no-crew-modal] [data-action="crew"]').click();

    expect(navigate).toHaveBeenCalledWith('/crew');
  });

  it('shows an unranked state without rendering a rank or score', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'unranked',
      crewName: 'Fresh Crew',
      rows: [{ rank: 1, name: 'Another Crew', score: 20, trend: 'up' }],
      weeklyPoints: 0,
      resetLabel: 'Resets Monday at 00:00 SGT.',
    });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();

    expect(rendered.element.dataset.leagueState).toBe('unranked');
    expect(rendered.element.querySelector('[data-league-unranked]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-league-rankings]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-league-points]').textContent).toBe('—');
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).not.toContain(
      'Another Crew',
    );
    expect(showModal).not.toHaveBeenCalled();
  });

  it('preserves rankings for an eligible crew', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'ranked',
      crewName: 'Glass Guardians',
      rows: [{ rank: 1, name: 'Glass Guardians', score: 100, trend: 'you' }],
      weeklyPoints: 100,
      resetLabel: 'Resets Monday at 00:00 SGT.',
    });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();

    expect(rendered.element.dataset.leagueState).toBe('ranked');
    expect(rendered.element.querySelector('[data-league-rankings]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).toContain(
      'Glass Guardians',
    );
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).toContain('You');
  });

  it('shows a queued state and delegates queue cancellation', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'queued',
      queueStatus: 'queued',
      crewId: 'crew-1',
      rows: [],
      weeklyPoints: null,
    });
    cancelLeagueQueue.mockResolvedValue({ status: 'cancelled' });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();
    expect(rendered.element.dataset.leagueState).toBe('queued');
    expect(rendered.element.querySelector('[data-league-queued]').hidden).toBe(false);

    rendered.element.querySelector('[data-cancel-queue]').click();
    await vi.waitFor(() => expect(cancelLeagueQueue).toHaveBeenCalledWith('crew-1'));
  });

  it('shows the leader-waiting state for a crew member', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'waiting',
      crewName: 'Fresh Crew',
      membershipRole: 'member',
      rows: [],
      weeklyPoints: null,
    });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();

    expect(rendered.element.dataset.leagueState).toBe('waiting');
    expect(rendered.element.querySelector('[data-league-waiting]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-queue-league]').hidden).toBe(true);
  });

  it('shows a queue CTA only for an eligible crew owner', async () => {
    getLeagueOverview.mockResolvedValue({
      eligibility: 'unranked',
      crewId: 'crew-1',
      canQueue: true,
      rows: [],
      weeklyPoints: 0,
    });
    queueForLeague.mockResolvedValue({ status: 'queued' });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();
    const queueButton = rendered.element.querySelector('[data-queue-league]');
    expect(queueButton.hidden).toBe(false);
    queueButton.click();
    await vi.waitFor(() => expect(queueForLeague).toHaveBeenCalledWith('crew-1'));
  });
});
