/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeagueOverview = vi.hoisted(() => vi.fn());
const getCosmetics = vi.hoisted(() => vi.fn());
const equipCosmetic = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getLeagueOverview, getCosmetics, equipCosmetic },
}));

import { renderLeaderboardPage } from '../../src/pages/leaderboard-page.js';

describe('league page states', () => {
  beforeEach(() => {
    getCosmetics.mockResolvedValue([]);
    equipCosmetic.mockResolvedValue(null);
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
    expect(rendered.element.querySelector('[data-league-no-crew]').hidden).toBe(false);
    expect(rendered.element.querySelector('[data-league-rankings]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-league-points]').textContent).toBe('—');
    expect(rendered.element.textContent).not.toContain('Glass Guardians');
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
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).not.toContain('Another Crew');
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
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).toContain('Glass Guardians');
    expect(rendered.element.querySelector('[data-league-rankings]').textContent).toContain('You');
  });
});
