import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentLeague = vi.hoisted(() => vi.fn());
const getCrewOverview = vi.hoisted(() => vi.fn());
const queueForLeague = vi.hoisted(() => vi.fn());
const cancelLeagueQueue = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/env.js', () => ({ useMockData: false }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../../src/services/game-service.js', () => ({
  gameService: { getCurrentLeague, getCrewOverview, queueForLeague, cancelLeagueQueue },
}));

import { ecoCrewService } from '../../src/services/ecocrew-service.js';

describe('Supabase league eligibility', () => {
  beforeEach(() => {
    getCurrentLeague.mockResolvedValue({ squadId: null, queue: null, league: null });
    getCrewOverview.mockReset();
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
