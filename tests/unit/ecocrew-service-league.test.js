import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentLeague = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/env.js', () => ({ useMockData: false }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../../src/services/game-service.js', () => ({ gameService: { getCurrentLeague } }));

import { ecoCrewService } from '../../src/services/ecocrew-service.js';

describe('Supabase league eligibility', () => {
  beforeEach(() => {
    getCurrentLeague.mockResolvedValue({ squadId: null, queue: null, league: null });
  });

  it('returns the same no-crew shape when the backend has no active squad', async () => {
    await expect(ecoCrewService.getLeagueOverview()).resolves.toMatchObject({
      eligibility: 'no_crew',
      crewId: null,
      rows: [],
      weeklyPoints: null,
    });
  });
});
