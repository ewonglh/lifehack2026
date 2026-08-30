/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeagueOverview = vi.hoisted(() => vi.fn());
const getCosmetics = vi.hoisted(() => vi.fn());
const equipCosmetic = vi.hoisted(() => vi.fn());
const unequipCosmetic = vi.hoisted(() => vi.fn());
const queueForLeague = vi.hoisted(() => vi.fn());
const cancelLeagueQueue = vi.hoisted(() => vi.fn());
const showModal = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: {
    getLeagueOverview,
    getCosmetics,
    equipCosmetic,
    unequipCosmetic,
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
    unequipCosmetic.mockReset().mockResolvedValue(null);
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

  it('shows the league loader until overview data is fetched', async () => {
    let resolveOverview;
    getLeagueOverview.mockReturnValue(
      new Promise((resolve) => {
        resolveOverview = resolve;
      }),
    );
    const rendered = renderLeaderboardPage();
    const pending = rendered.afterRender();

    expect(
      rendered.element.querySelector('[data-league-loading] [data-loading-state]'),
    ).not.toBeNull();
    expect(rendered.element.querySelector('[data-league-content]').getAttribute('aria-busy')).toBe(
      'true',
    );

    resolveOverview({ eligibility: 'ranked', rows: [], weeklyPoints: 0 });
    await pending;

    expect(rendered.element.querySelector('[data-league-loading]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-league-content]').getAttribute('aria-busy')).toBe(
      'false',
    );
  });

  it('keeps the cosmetics loader independent from the league overview', async () => {
    let resolveCosmetics;
    getLeagueOverview.mockResolvedValue({ eligibility: 'ranked', rows: [], weeklyPoints: 0 });
    getCosmetics.mockReturnValue(
      new Promise((resolve) => {
        resolveCosmetics = resolve;
      }),
    );
    const rendered = renderLeaderboardPage();
    const pending = rendered.afterRender();

    await vi.waitFor(() => expect(getCosmetics).toHaveBeenCalled());
    expect(rendered.element.querySelector('[data-league-content]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-cosmetics] [data-loading-state]')).not.toBeNull();

    resolveCosmetics([]);
    await pending;

    expect(rendered.element.querySelector('[data-cosmetics] [data-loading-state]')).toBeNull();
    expect(rendered.element.querySelector('[data-cosmetics]').getAttribute('aria-busy')).toBe(
      'false',
    );
  });

  it('renders the leaf frame and refreshes its equip state', async () => {
    const inactive = [
      { id: 'leaf-frame', name: 'Leaf Frame', kind: 'frame', unlocked: true, equipped: false },
      { id: 'mushroom-frame', name: 'Mushroom Frame', kind: 'frame', unlocked: false },
    ];
    const active = inactive.map((item) =>
      item.id === 'leaf-frame' ? { ...item, equipped: true } : item,
    );
    getLeagueOverview.mockResolvedValue({ eligibility: 'ranked', rows: [], weeklyPoints: 0 });
    getCosmetics.mockReset().mockResolvedValueOnce(inactive).mockResolvedValueOnce(active);
    equipCosmetic.mockResolvedValue({ id: 'leaf-frame', equipped: true });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();

    const leafCard = rendered.element.querySelector('[data-equip="leaf-frame"]');
    expect(rendered.element.querySelector('[data-cosmetics] img')).not.toBeNull();
    expect(leafCard.textContent).toBe('Equip');
    leafCard.click();

    await vi.waitFor(() => expect(equipCosmetic).toHaveBeenCalledWith('leaf-frame'));
    await vi.waitFor(() =>
      expect(rendered.element.querySelector('[data-equip="leaf-frame"]').textContent).toBe(
        'Unequip',
      ),
    );
  });

  it('unequips the leaf frame and keeps it available to equip again', async () => {
    const active = [
      { id: 'leaf-frame', name: 'Leaf Frame', kind: 'frame', unlocked: true, equipped: true },
    ];
    const inactive = [{ ...active[0], equipped: false }];
    getLeagueOverview.mockResolvedValue({ eligibility: 'ranked', rows: [], weeklyPoints: 0 });
    getCosmetics.mockReset().mockResolvedValueOnce(active).mockResolvedValueOnce(inactive);
    unequipCosmetic.mockResolvedValue({ id: 'leaf-frame', equipped: false });
    const rendered = renderLeaderboardPage();

    await rendered.afterRender();
    const leafButton = rendered.element.querySelector('[data-equip="leaf-frame"]');
    expect(leafButton.textContent).toBe('Unequip');
    leafButton.click();

    await vi.waitFor(() => expect(unequipCosmetic).toHaveBeenCalledWith('leaf-frame'));
    await vi.waitFor(() =>
      expect(rendered.element.querySelector('[data-equip="leaf-frame"]').textContent).toBe('Equip'),
    );
  });
});
