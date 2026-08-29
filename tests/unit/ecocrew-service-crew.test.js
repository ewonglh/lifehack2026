import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSquad = vi.hoisted(() => vi.fn());
const joinSquad = vi.hoisted(() => vi.fn());
const getCrewOverview = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/env.js', () => ({ useMockData: false }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../../src/services/profile-service.js', () => ({ profileService: {} }));
vi.mock('../../src/services/game-service.js', () => ({
  gameService: { createSquad, joinSquad, getCrewOverview },
}));

import { ecoCrewService } from '../../src/services/ecocrew-service.js';

describe('crew mutation adapters', () => {
  beforeEach(() => {
    createSquad.mockReset();
    joinSquad.mockReset();
    getCrewOverview.mockReset();
  });

  it('returns the create RPC membership without reloading the overview', async () => {
    createSquad.mockResolvedValue({ squadId: 'squad-1' });
    getCrewOverview.mockRejectedValue(new Error('The crew mission is unavailable.'));

    await expect(ecoCrewService.createCrew('Green Team')).resolves.toMatchObject({
      crewId: 'squad-1',
      role: 'owner',
    });
    expect(createSquad).toHaveBeenCalledWith('Green Team', 'Asia/Singapore');
    expect(getCrewOverview).not.toHaveBeenCalled();
  });

  it('returns the join RPC membership without reloading the overview', async () => {
    joinSquad.mockResolvedValue({ squadId: 'squad-1' });
    getCrewOverview.mockRejectedValue(new Error('The crew mission is unavailable.'));

    await expect(ecoCrewService.joinCrew('ABC123')).resolves.toMatchObject({
      crewId: 'squad-1',
      role: 'member',
    });
    expect(joinSquad).toHaveBeenCalledWith('ABC123');
    expect(getCrewOverview).not.toHaveBeenCalled();
  });
});
