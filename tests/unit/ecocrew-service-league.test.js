import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentLeague = vi.hoisted(() => vi.fn());
const getCrewOverview = vi.hoisted(() => vi.fn());
const getLeagues = vi.hoisted(() => vi.fn());
const queueForLeague = vi.hoisted(() => vi.fn());
const cancelLeagueQueue = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/env.js', () => ({ useMockData: false }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../../src/services/game-service.js', () => ({
  gameService: {
    getCurrentLeague,
    getCrewOverview,
    getLeagues,
    queueForLeague,
    cancelLeagueQueue,
  },
}));

import { ecoCrewService } from '../../src/services/ecocrew-service.js';

describe('Supabase league eligibility', () => {
  beforeEach(() => {
    getCurrentLeague.mockResolvedValue({ squadId: null, queue: null, league: null });
    getCrewOverview.mockReset();
    getLeagues.mockReset();
    queueForLeague.mockReset();
    cancelLeagueQueue.mockReset();
  });

  it('returns the same no-crew shape when the backend has no active squad', async () => {
    await expect(ecoCrewService.getLeagueOverview()).resolves.toMatchObject({
      eligibility: 'no_crew',
      crewId: null,
      rows: [],
      weeklyPoints: null,
    });
  });

  it('normalizes a backend queue into an explicit queued state', async () => {
    getCurrentLeague.mockResolvedValue({
      squadId: 'squad-1',
      queue: { status: 'queued' },
      league: null,
    });
    getCrewOverview.mockResolvedValue({
      membership: { crewId: 'squad-1', crewName: 'Fresh Crew', role: 'owner' },
    });

    await expect(ecoCrewService.getLeagueOverview()).resolves.toMatchObject({
      eligibility: 'queued',
      queueStatus: 'queued',
      crewId: 'squad-1',
      canQueue: false,
    });
  });

  it('normalizes a non-owner crew without a league into a waiting state', async () => {
    getCurrentLeague.mockResolvedValue({ squadId: 'squad-1', queue: null, league: null });
    getCrewOverview.mockResolvedValue({
      membership: { crewId: 'squad-1', crewName: 'Fresh Crew', role: 'member' },
    });

    await expect(ecoCrewService.getLeagueOverview()).resolves.toMatchObject({
      eligibility: 'waiting',
      queueStatus: 'none',
      crewId: 'squad-1',
      canQueue: false,
      membershipRole: 'member',
    });
  });

  it('orders league rows by descending score and assigns display ranks', async () => {
    getCurrentLeague.mockResolvedValue({
      squadId: 'squad-1',
      queue: null,
      league: { league_id: 'league-1' },
    });
    getCrewOverview.mockResolvedValue({
      membership: { crewId: 'squad-1', crewName: 'Glass Guardians', role: 'owner' },
    });
    getLeagues.mockResolvedValue([
      {
        id: 'league-1',
        league_entries: [
          { squad_id: 'squad-1', score: 745, final_rank: 1, squads: { name: 'Glass Guardians' } },
          { squad_id: 'squad-2', score: 910, final_rank: 2, squads: { name: 'Bottle Brigade' } },
          { squad_id: 'squad-3', score: 835, final_rank: 3, squads: { name: 'Compost Club' } },
        ],
      },
    ]);

    await expect(ecoCrewService.getLeagueOverview()).resolves.toMatchObject({
      eligibility: 'ranked',
      rows: [
        { rank: 1, name: 'Bottle Brigade', score: 910 },
        { rank: 2, name: 'Compost Club', score: 835 },
        { rank: 3, name: 'Glass Guardians', score: 745, trend: 'you' },
      ],
      weeklyPoints: 745,
    });
  });

  it('delegates queue and cancellation through the backend adapter', async () => {
    queueForLeague.mockResolvedValue({ status: 'queued' });
    cancelLeagueQueue.mockResolvedValue({ status: 'cancelled' });

    await expect(ecoCrewService.queueForLeague('squad-1')).resolves.toEqual({ status: 'queued' });
    await expect(ecoCrewService.cancelLeagueQueue('squad-1')).resolves.toEqual({
      status: 'cancelled',
    });
    expect(queueForLeague).toHaveBeenCalledWith('squad-1');
    expect(cancelLeagueQueue).toHaveBeenCalledWith('squad-1');
  });
});
